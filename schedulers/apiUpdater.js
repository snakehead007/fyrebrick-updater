const schedule = require('node-schedule');
const User = require('../models/user');
const {logger} = require('../helpers/logger');

const CallAmountUpdater = ()=>{
    //calls everyday “At 00:00.”
    schedule.scheduleJob("0 0 * * *",async ()=>{
        logger.info(`Resetting all API calls amount daily to 0 `);
        await User.updateMany({setUpComplete:true},{'API_call_amount.daily':0});
    });
}

module.exports = {
    CallAmountUpdater
}