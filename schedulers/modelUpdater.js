const schedule = require('node-schedule');
const User = require('../models/user');
const bricklink = require('../helpers/bricklink');
const {logger} = require('../helpers/logger');
const {client} = require('../helpers/session');
exports.default = async ()=>{
    schedule.scheduleJob("0 0 * * *",async ()=>{
        const user = await User.find({setUpComplete:true});
        user.forEach((user)=>{
            bricklink.ordersAll(user);
            bricklink.inventoryAll(user);
        })
    })
    //TODO this does not work for multiple users (check if it does)/
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
                    if(data.email && data._id){
                        const CURRENT_TIME_IN_MINUTES = Math.round((Date.now()/1000)/60);
                        logger.info(`found user with data: ${data._id} - ${data.email}`);
                        const user = await User.findOne({_id:data._id},async (err,user)=>{
                            if(err){
                                logger.error(`Error while finding user, err: ${err.message}`);
                            }
                            if(!user){
                                if(data.email){
                                    logger.error(`No user found for _id ${data._id}, might be lost, but session has ${data.email} stored`);
                                }else{
                                    logger.error(`No user found for _id ${data._id}, might be lost`);
                                }
                            }
                        });
                        if(CURRENT_TIME_IN_MINUTES%user.update_interval===0){
                            if(alreadyDoneUsers.indexOf(data.email)===-1){
                                alreadyDoneUsers.push(data.email);
                                    logger.info(`${data.email} logged in, updating its models`);
                                    updateModels(user);
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
    bricklink.inventoryAll(user);
    //bricklink.ordersAll(user,"?direction=in&status=pending,updated,processing,ready,paid,packed");
    bricklink.ordersAll(user);
}