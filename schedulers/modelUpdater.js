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
        })
    })
    //TODO this does not work for multiple users (check if it does)/
    logger.info(`Setting up all schedulers for users`);
    //checks every minute for all users if any need updates
    const j = schedule.scheduleJob("*/1 * * * *",()=>{
        let alreadyDoneUsers = [];
        let danglingSessions = 0;
        client.keys("session*", function(error, keys){
            keys.forEach(key=>{
                client.get(key,async (err,data) =>{
                    data = JSON.parse(data);
                    if(data.email && data._id){
                        const CURRENT_TIME_IN_MINUTES = Math.round((Date.now()/1000)/60);
                        const user = await User.findOne({_id:data._id});
                        if(CURRENT_TIME_IN_MINUTES%user.update_interval===0){
                            if(alreadyDoneUsers.indexOf(data.email)===-1){
                                alreadyDoneUsers.push(data.email);
                                    logger.info(`${data.email} logged in, updating its models`);
                                    updateModels(user);
                                }
                            else{
                                logger.debug(`already done user ${data.email}`);                                
                            }
                        }
                    }else{
                        danglingSessions++;
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
    bricklink.ordersAll(user,"?direction=in&status=pending,updated,processing,ready,paid,packed");
    //bricklink.ordersAll(user);
}