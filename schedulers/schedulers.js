const cacheUpdater = require('./modelUpdater');
const {logger} = require('../helpers//logger');

module.exports = 
{
    start : ()=>{
        cacheUpdater.default();
        logger.info('updaters succefully initiliated');
    }
}