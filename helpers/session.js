const redis = require('redis');
const {logger} = require('./logger');

const client = redis.createClient(process.env.REDIS_PORT,process.env.REDIS_HOST);

client.on('connect',()=>{
    logger.info(`redis database connect on ${vars.redis.host}:${vars.redis.port}`);
});

client.on('error',(error)=>{
    logger.info(`redis error: ${error}`);
});

if(vars.fyrebrick.develop){
    client.on('monitor',(time,args,rawReply)=>{
        logger.info(`${time}: args`)
    })
}

module.exports = 
{
    client
};