const OAuth = require('oauth');
const Inventory = require('../models/inventory');
const Order = require("../models/order");
const {isObjectsSame,mappingOrderItemsForChecked} = require('./functions');
const {logger} = require('./logger');
const { update } = require('../models/inventory');
const {increaseApiCallAmount,hasUserExceededAPiAmount} = require('../helpers/ApiHelper');

module.exports.inventorySingle = async (user,inventory_id) => {
    await Inventory.findOne({CONSUMER_KEY:user.CONSUMER_KEY,inventory_id:inventory_id},async(err, data)=>{
        if(err){
            logger.error(`Could not find inventory for user ${user.email} : ${err}`);
            return false;
        }else{
            const oauth = new OAuth.OAuth(
                user.TOKEN_VALUE,
                user.TOKEN_SECRET,
                user.CONSUMER_KEY,
                user.CONSUMER_SECRET,
                "1.0",
                null,
                "HMAC-SHA1"
            );
            if(await hasUserExceededAPiAmount(user._id)){
                logger.error(`User has exceeded the API limit of bricklink'`);
                return;
            }
            increaseApiCallAmount(user._id);
            await oauth.get("https://api.bricklink.com/api/store/v1/inventories/"+inventory_id,oauth._requestUrl, oauth._accessUrl, 
            async (err, data) => {
                if(err){
                    logger.error(`receiving order items for user ${user.email} gave error : ${err}`);
                    if(err.code='ETIMEDOUT'){
                        logger.warn(`Timeout received by bricklink API from user ${user.email}, retrying after 20sec... `);
                        return false;
                    }else if(err.code="ECONNRESET"){
                        logger.warn(`Connection reset, please check your internet connection`);
                        return;
                    }
                }
                if(data && data.meta && data.meta==200){
                    let updatedInventoryItem = {
                        CONSUMER_KEY:user.CONSUMER_KEY,
                        ...data
                    }
                    await Inventory({CONSUMER_KEY:user.CONSUMER_KEY,inventory_id:inventory_id},updatedInventoryItem);
                }else{
                    logger.error(`Could not update single inventory ${inventory_id} for user ${user.email}: ${err}`);
                    return false;
                }
            });
        }
    });
}

/**
 * @description updates and rewrites the users inventory model
 * @param {User} user - Mongodb User schema
 */
module.exports.inventoryAll = async (user) => {
    const oauth = new OAuth.OAuth(
        user.TOKEN_VALUE,
        user.TOKEN_SECRET,
        user.CONSUMER_KEY,
        user.CONSUMER_SECRET,
        "1.0",
        null,
        "HMAC-SHA1"
    )
    // get inventory data
    
    if(await hasUserExceededAPiAmount(user._id)){
        logger.error(`User has exceeded the API limit of bricklink'`);
        return;
    }
    increaseApiCallAmount(user._id);
    await oauth.get("https://api.bricklink.com/api/store/v1/inventories",oauth._requestUrl, oauth._accessUrl, 
        async (err, data) => {
            if(err){
                logger.error(`receiving order items for user ${user.email} gave error : ${err}`);
                if(err.code='ETIMEDOUT'){
                    logger.warn(`Timeout received by bricklink API from user ${user.email}, retrying after 20sec... `);
                    return false;
                }else if(err.code="ECONNRESET"){
                    logger.warn(`Connection reset, please check your internet connection`);
                    return;
                }
            }
            try{
                data = JSON.parse(data);
                }catch(e){
                    logger.error(`could not parse data for inventory for user ${user.email}: ${e}`);
                    return false;
                }
            //check if inventory data is correct
            if(data && data.meta && data.meta.code==200){
                logger.info(`preparing to save ${data.data.length} items to inventory in our database for user ${user.email}`);
                // await Inventory.deleteMany({CONSUMER_KEY:user.CONSUMER_KEY});
                const totalItems = data.data.length;
                let itemsUpdated = 0;
                let itemsNew = 0;
                data.data.forEach(
                    async (item) => {
                        const item_in_db = await Inventory.findOne({CONSUMER_KEY:user.CONSUMER_KEY,inventory_id:item.inventory_id});
                        //console.log(JSON.stringify(item),JSON.stringify(item_in_db));
                        if(!item_in_db){
                            //logger.debug(`did not found item ${item.inventory_id} for user ${user.CONSUMER_KEY} in database, creating new item`);
                            //new
                            itemsNew++;
                            const newItem = new Inventory(
                                {
                                    CONSUMER_KEY:user.CONSUMER_KEY,
                                    ...item
                                }
                            );
                            await newItem.save((err, data)=>{
                                if(err){
                                    logger.error(`Could not save new inventory item ${item.inventory_id} of user ${user.email}: ${err}`);
                                    return false;
                                }else{
                                    logger.info(`Successfully saved new inventory item ${item.inventory_id} for user ${user.email}`);
                                }
                            })
                        }else{
                            //logger.debug(`Found item ${item.inventory_id} in database, item in database is out of date. updating item ...`);
                            itemsUpdated++;
                            await Inventory.updateOne({
                                CONSUMER_KEY:user.CONSUMER_KEY,
                                inventory_id:item.inventory_id
                            },{
                                CONSUMER_KEY:user.CONSUMER_KEY,
                                ...item
                            },(err,data)=>{
                                if(err){
                                    logger.error(`Could not save new inventory item ${item.inventory_id} of user ${user.email}: ${err}`);
                                    return false;
                                }else{
                                    //logger.info(`Successfully updated inventory item ${item.inventory_id} for user ${user.email}`);
                                }
                            });
                        }
                    }
                );
            }else{
                logger.warn(`Could not receive any data to update inventory for user ${user.email}: ${data.meta.description}`);
                logger.debug(`${data.meta.description}`)
            }
        }
    );
}

//updates all orders
module.exports.ordersAll = async (user,query="")=>{
    //authentication for this user
    const oauth = new OAuth.OAuth(
        user.TOKEN_VALUE,
        user.TOKEN_SECRET,
        user.CONSUMER_KEY,
        user.CONSUMER_SECRET,
        "1.0",
        null,
        "HMAC-SHA1"
    );
    //make the bricklink api request to get all the orders
    if(await hasUserExceededAPiAmount(user._id)){
        logger.error(`User has exceeded the API limit of bricklink'`);
        return;
    }
    increaseApiCallAmount(user._id);
    await oauth.get("https://api.bricklink.com/api/store/v1/orders"+query,oauth._requestUrl, oauth._accessUrl, 
        async (err, data) => {
            //error handling
            if(err){
                logger.error(`receiving order items for user ${user.email} gave error : ${err}`);
                if(err.code='ETIMEDOUT'){
                    logger.warn(`Timeout received by bricklink API from user ${user.email}, retrying after 20sec... `);
                    return false
                }else if(err.code="ECONNRESET"){
                    logger.warn(`Connection reset, please check your internet connection`);
                    return;
                }else{
                    logger.warn(`Error ${err.code}: retrying later...`);
                    return;
                }
            }
            try{
            data = JSON.parse(data);
            }catch(e){
                logger.error(`could not parse data for orders for user ${user.email}: ${e}`);
                return false;
            }
            if(data && data.meta && data.meta.code==200){
                logger.info(`Found ${data.data.length} orders for user ${user.email}`);
                data.data.forEach(
                    async (order) => {
                        const order_db = await Order.findOne({consumer_key:user.CONSUMER_KEY,order_id:order.order_id});
                        if(await hasUserExceededAPiAmount(user._id)){
                            logger.error(`User has exceeded the API limit of bricklink'`);
                            return;
                        }
                        increaseApiCallAmount(user._id);
                        await oauth.get("https://api.bricklink.com/api/store/v1/orders/"+order.order_id+"/items",oauth._requestUrl, oauth._accessUrl, 
                        async (err, data_items) => {
                            if(err){
                                logger.error(`receiving order items for user ${user.email} gave error : ${err}`);
                                if(err.code='ETIMEDOUT'){
                                    logger.warn(`Timeout received by bricklink API from user ${user.email}, retrying after 20sec... `);
                                    return false;
                                }else if(err.code="ECONNRESET"){
                                    logger.warn(`Connection reset, please check your internet connection`);
                                    return;
                                }
                            }
                            try{
                            data_items = JSON.parse(data_items);
                            }catch(e){
                                logger.warn(`Parsing order items failed, err: ${e}`);
                            }
                            if(data_items && data_items.meta && data_items.meta.code==200){
                                if(!order_db){
                                    logger.info(`Order of id ${order.order_id} not found in our database for user ${user.email}`);
                                    data_items.data.forEach((batch)=>{
                                        batch.forEach((item)=>{
                                            item['isChecked']=false;
                                        })
                                    })
                                    const newOrder = new Order({
                                        orders_checked:0,
                                        description:"",
                                        consumer_key:user.CONSUMER_KEY,
                                        ...order,
                                        items:data_items.data
                                    });
                                    await newOrder.save((err,data)=>{
                                        if(err){
                                            logger.error(`Could not save new order ${order.order_id} of user ${user.email} ${err}`);
                                            return false;
                                        }
                                    });
                                }else{
                                    let orders_checked = 0;
                                    const checkedMap = mappingOrderItemsForChecked(order_db.items);
                                    data_items.data.forEach((batch)=>{
                                        batch.forEach((item)=>{
                                            item['isChecked'] = checkedMap.get(item.inventory_id);
                                            if(item['isChecked']){  
                                                orders_checked++;
                                            }
                                        })  
                                    })
                                    const order_dbObj = {
                                        orders_checked:orders_checked,
                                        description:order_db.description,
                                        consumer_key:user.CONSUMER_KEY,
                                        ...order,
                                        items:data_items.data
                                    };
                                    //check if there is any updates
                                    if(order.status.toUpperCase()!=="PURGED"){
                                        Order.updateOne({consumer_key:user.CONSUMER_KEY,order_id:order.order_id},order_dbObj,(err,data)=>{
                                            if(err){
                                                logger.error(`Could not update order ${order.order_id} of user ${user.email} : ${err}`);
                                                return;
                                            }else{
                                                logger.info(`Successfully updated order ${order_dbObj.order_id} update data : ${data}`);
                                            }
                                        });
                                    }else{
                                        logger.debug(`Order ${order_dbObj.order_id} does not meet the requirements of status, has status ${order.status}`)
                                    }
                                }
                            }else{
                                logger.warn(`Could not receive any data to update orders items for user ${user.email}`);
                            }
                            
                        });
                    }
                );
                logger.info(`successfully found all orders for user ${user.email}`);
            }else{
                logger.warn(`Could not receive any data to update orders for user ${user.email} : ${data.meta.description}`);
            }
        }
    );
    
}