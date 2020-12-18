const cacheUpdater = require('./modelUpdater');
const apiUpdater = require('./apiUpdater');
const {logger} = require('../helpers//logger');

module.exports = 
{
    start : ()=>{
        try{
            cacheUpdater.default();
            apiUpdater.CallAmountUpdater();
        }catch(err){
            logger.error(`Caught error successfully ${err}`);
        }
        logger.info('updaters successfully initiliated');
    }
}