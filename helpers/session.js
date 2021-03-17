const redis = require('redis');
const {logger} = require("fyrebrick-helper").helpers;

const client = redis.createClient(process.env.REDIS_URI.split(":")[1],process.env.REDIS_URI.split(":")[0]);

client.on('connect',()=>{
    logger.info(`redis database connect on ${process.env.REDIS_URI}`);
});

client.on('error',(error)=>{
    logger.info(`redis error: ${error}`);
});

client.on('monitor',(time,args,rawReply)=>{
    logger.info(`${time}: args`)
})


module.exports = 
{
    client
};