const cacheUpdater = require('./modelUpdater');
const apiUpdater = require('./apiUpdater');
const storesUpdater = require('./storesUpdater');
const store_chart =require('./chartsUpdater');
const {logger} = require("fyrebrick-helper").helpers;

module.exports = 
{
    start : ()=>{
        try{
            cacheUpdater.default();
            apiUpdater.CallAmountUpdater();
            storesUpdater();
            store_chart();
        }catch(err){
            logger.error(`Caught error successfully ${err}`);
        }
        logger.info('updaters successfully initiliated');
    }
}