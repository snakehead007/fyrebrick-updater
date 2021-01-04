const schedule = require('node-schedule');
const {User} = require("fyrebrick-helper").models;
const {bricklink} = require("fyrebrick-helper").helpers;
const {logger} = require("fyrebrick-helper").helpers;
const {client} = require('../helpers/session');
const bricklinkPlus = require('bricklink-plus');
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
    schedule.scheduleJob("*/1 * * * *",async ()=>{
        logger.info(`running model updater job`);
        try{
            if(await bricklinkPlus.plus.maintanceCheck.monthly()){
                logger.warn(`Bricklink is currently working on a monthly maintenance`);
                return;
            }
        }catch(err){
            logger.error(`err caught checking bricklink maintenance : ${err}`);
            return;
        }
        await processKeys().then((data)=>{
            logger.info(`Updating, ${data.doingUsers.length} CONSUMER_KEY's processed`);
            data.doingUsers.forEach(async(user,index)=>{
                logger.info(`Running ${index+1}/${data.doingUsers.length}...`);
                await updateModels(user);
            });
            logger.info(`Removed ${data.danglingSessions} dangling sessions`);
        })
    });
};
const processKeys = async () =>{
    return new Promise((resolve, reject) =>{
        let alreadyDoneUsers = [];
        let doingUsers = [];
        let danglingSessions = 0;
        let processedKeys = 0;
        let totalKeys = 0;
        client.keys("session*", async (error, keys)=>{
            totalKeys = keys.length;
            logger.info(`Fyrebrick currently has ${keys.length} sessions`);
            if(error){
                logger.error(`Error while finding keys of session: ${error}`);
                reject(error);
            }
            await keys.forEach(async(key, index)=>{
                await client.get(key,async (err,data) =>{
                    data = JSON.parse(data);
                    if(data && data.email && data._id){
                        //current time in minutes per 120 minutes.
                        const CURRENT_TIME_IN_MINUTES = Math.round((Date.now()/1000)/60)%120;
                        const user = await User.findOne({_id:data._id},async (err,user)=>{
                            if(err){
                                logger.error(`Error while finding user, err: ${err.message}`);
                                processedKeys++;
                                if(processedKeys===totalKeys)resolve({doingUsers,danglingSessions});
                            }
                            if(!user){
                                if(data.email){
                                    logger.error(`User ${data.email} not found, might be lost`);
                                    logger.debug(`Check if db_uri is correct: ${process.env.DB_URI}`);
                                }else{
                                    logger.error(`No user found for _id ${data._id}, might be lost`);
                                }    
                                 logger.info(`Did not found user ${data.email}, removing lost session key '${key}'`);
                                 await client.del(key);
                                processedKeys++;
                                if(processedKeys===totalKeys)resolve({doingUsers,danglingSessions});
                            }
                        });
                        if(CURRENT_TIME_IN_MINUTES%user.update_interval===0){
                            logger.info(`Updating interval for ${user.email} checks out`);
                            if(alreadyDoneUsers.indexOf(user.CONSUMER_KEY)===-1){
                                alreadyDoneUsers.push(user.CONSUMER_KEY);
                                    try{
                                        logger.info(`Processing CONSUMER_KEY ${user.CONSUMER_KEY}`);
                                        doingUsers.push(user);
                                        processedKeys++;
                                        if(processedKeys===totalKeys)resolve({doingUsers,danglingSessions});
                                    }catch(err){
                                        logger.error(`Caught error for user ${user.email} : ${err}`);
                                    }
                            }else{
                                logger.info(`already processed user ${data.email}`);
                                processedKeys++;
                                if(processedKeys===totalKeys)resolve({doingUsers,danglingSessions});
                            }
                        }else{
                            logger.info(`Not updating user ${user.email}, updating interval is ${user.update_interval}`);
                            processedKeys++;
                            if(processedKeys===totalKeys)resolve({doingUsers,danglingSessions});
                        }
                    }else{
                        //No email or _id found in session key
                        logger.info(`Dangling session found ${key}, removing...`);
                        await client.del(key);
                        danglingSessions++;
                        processedKeys++;
                        if(processedKeys===totalKeys)resolve({doingUsers,danglingSessions});
                    }
                });
            });
        })
    })
}
const updateModels = async (user) => {
    await bricklink.inventory.all(user);
    await bricklink.order.all(user);
}