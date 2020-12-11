const cacheUpdater = require('./modelUpdater');
const {logger} = require('../helpers//logger');

module.exports = 
{
    start : ()=>{
        try{
            cacheUpdater.default();
        }catch(err){
            logger.error(`Caught error successfully ${err}`);
        }
        logger.info('updaters succefully initiliated');
    }
}