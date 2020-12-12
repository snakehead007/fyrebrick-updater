const schedule = require('node-schedule');
const User = require('../models/user');
const bricklink = require('../helpers/bricklink');
const {logger} = require('../helpers/logger');
const {client} = require('../helpers/session');
const TIMEOUT_RESTART = 20*100;

exports.default = async ()=>{
    schedule.scheduleJob("0 0 * * *",async ()=>{
        logger.info(`started daily update for all users`);
        const user = await User.find({setUpComplete:true});
        user.forEach(async(user)=>{
            logger.info(`updating for user ${user.email}`);
            try{
            await updateModels(user);
            }catch(err){
                logger.error(`Gave error for user ${err}`);
            }
        })
    })
    logger.info(`Setting up all schedulers for users`);
    //checks every minute for all users if any need updates
    schedule.scheduleJob("*/1 * * * *",()=>{
        let alreadyDoneUsers = [];
        let danglingSessions = 0;
        client.keys("session*", function(error, keys){
            logger.info(`updating ${keys.length} sessions`);
            if(error){
                logger.error(`Error while finding keys of session: ${error}`);
            }
            keys.forEach(key=>{
                logger.info(`Looking for user with ${key}`);
                client.get(key,async (err,data) =>{
                    data = JSON.parse(data);
                    if(data && data.email && data._id){
                        const CURRENT_TIME_IN_MINUTES = Math.round((Date.now()/1000)/60);
                        logger.info(`found user with data: ${data._id} - ${data.email}`);
                        const user = await User.findOne({_id:data._id},async (err,user)=>{
                            if(err){
                                logger.error(`Error while finding user, err: ${err.message}`);
                            }
                            if(!user){
                                if(data.email){
                                    logger.error(`No user found for _id ${data._id}, might be lost`);
                                    logger.error(`Check if db_uri is correct: ${process.env.DB_URI}`);
                                }else{
                                    logger.error(`No user found for _id ${data._id}, might be lost`);
                                }
                            }
                        });
                        if(CURRENT_TIME_IN_MINUTES%user.update_interval===0){
                            if(alreadyDoneUsers.indexOf(data.email)===-1){
                                alreadyDoneUsers.push(data.email);
                                    logger.info(`${data.email} logged in, updating its models`);
                                    try{
                                        await updateModels(user);
                                    }catch(err){
                                        logger.error(`Caught error for user ${user.email} : ${err}`);
                                    }
                                }
                            else{
                                logger.info(`already done user ${data.email}`);                                
                            }
                        }
                    }else{
                        danglingSessions++;
                        logger.info(`Dangling session found ${key}, removing...`);
                        client.del(key);
                    }
                });
            });
        });
        
        logger.info(`Removed ${danglingSessions} dangling sessions`);
        
    });
};

const updateModels = async (user) => {
    const s1 = await bricklink.inventoryAll(user);
    if(s1===false){
        logger.warn(`requesting inventoryAll for user ${user.email} was not successful, retrying in 20sec...`);
        timeout(await bricklink.inventoryAll,TIMEOUT_RESTART,user);
    }
    //bricklink.ordersAll(user,"?direction=in&status=pending,updated,processing,ready,paid,packed");
    const s2 = await bricklink.ordersAll(user);
    if(s2===false){
        logger.warn(`requesting ordersAll for user ${user.email} was not successful, retrying in 20sec...`);
        timeout(await bricklink.inventoryAll,TIMEOUT_RESTART,user);
    }
}