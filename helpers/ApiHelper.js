const { logger } = require("../helpers/logger");
const User = require("../models/user");
const increaseApiCallAmount = async(_id) => {
    logger.info(`Incrementing API call amount for user with _id ${_id}`);
    const user = await User.findOne({_id:_id});
    const usersWithSameCONSUMER_KEY = await User.find({CONSUMER_KEY:user.CONSUMER_KEY});
    usersWithSameCONSUMER_KEY.forEach(async _user=>{
        await User.updateOne({_id:_user._id,"API_call_amount.daily":_user.API_call_amount.daily},{$inc:{'API_call_amount.daily':1,'API_call_amount.total':1}},(err)=>{
            if(err){
                logger.error(`Incrementing API call amount for user ${user.email} gave error, err: ${err.message}`);
            }
        });
    })
}
const hasUserExceededAPiAmount = async(_id)=>{
    const user = await User.findOne({_id:_id});
    if(user.API_call_amount.daily>= 5000){
        logger.error(`user has exceeded api call amount`);
        return true;
    }else{
        return false;
    }
}
module.exports = {
    increaseApiCallAmount,
    hasUserExceededAPiAmount
}

