const OAuth = require('oauth');
const Inventory = require('../models/inventory');
const Order = require("../models/order");
const {isObjectsSame,mappingOrderItemsForChecked} = require('./functions');
const {logger} = require('./logger');
const { update } = require('../models/inventory');
const TIMEOUT_RESTART = 20*100;
module.exports.inventorySingle = async (user,inventory_id) => {
    const item = await Inventory.findOne({CONSUMER_KEY:user.CONSUMER_KEY},async(err, data)=>{
        if(err){
            logger.error(`Could not find inventory for user ${user.email} : ${err}`);
            return;
        }else{
            const item = data.map((item)=>{
                return item.inventory_id;
            });
            const oauth = new OAuth.OAuth(
                user.TOKEN_VALUE,
                user.TOKEN_SECRET,
                user.CONSUMER_KEY,
                user.CONSUMER_SECRET,
                "1.0",
                null,
                "HMAC-SHA1"
            );
            await oauth.get("https://api.bricklink.com/api/store/v1/inventories/"+inventory_id,oauth._requestUrl, oauth._accessUrl, 
            async (err, data) => {
                if(err){
                    logger.error(`receiving order items for user ${user.email} gave error : ${err}`);
                    if(err.code='ETIMEDOUT'){
                        logger.warn(`Timeout received by bricklink API from user ${user.email}, retrying after 20sec... `);
                        return setTimeout(this.inventorySingle, TIMEOUT_RESTART,user, inventory_id);
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
                    return;
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
    await oauth.get("https://api.bricklink.com/api/store/v1/inventories",oauth._requestUrl, oauth._accessUrl, 
        async (err, data) => {
            if(err){
                logger.error(`receiving order items for user ${user.email} gave error : ${err}`);
                if(err.code='ETIMEDOUT'){
                    logger.warn(`Timeout received by bricklink API from user ${user.email}, retrying after 20sec... `);
                    return setTimeout(this.inventoryAll, TIMEOUT_RESTART,user);
                }
            }
            try{
                data = JSON.parse(data);
                }catch(e){
                    logger.error(`could not parse data for inventory for user ${user.email}: ${e}`);
                    return;
                }
            //check if inventory data is correct
            if(data && data.meta && data.meta.code==200){
                logger.info(`preparing to save ${data.data.length} items to inventory in our database for user ${user.email}`);
                await Inventory.deleteMany({CONSUMER_KEY:user.CONSUMER_KEY});
                data.data.forEach(
                    async (item) => {
                        const newItem = new Inventory(
                            {
                                CONSUMER_KEY:user.CONSUMER_KEY,
                                ...item
                            }
                        );
                        await newItem.save((err,data)=>{
                            if(err){
                                logger.error(`Could not save new inventory item ${item.inventory_id} of user ${user.email}: ${err}`);
                                return;
                            }
                        });
                        }
                    )
                logger.info(`Successfully saved/updated inventory items for users ${user.email}`);
            }else{
                logger.warn(`Could not receive any data to update inventory for user ${user.email}: ${data.meta.description}`);
                logger.debug(`${data.meta.description}`)
            }
        }
    );
}

module.exports.ordersAll = async (user,query="")=>{
    const oauth = new OAuth.OAuth(
        user.TOKEN_VALUE,
        user.TOKEN_SECRET,
        user.CONSUMER_KEY,
        user.CONSUMER_SECRET,
        "1.0",
        null,
        "HMAC-SHA1"
    );
    await oauth.get("https://api.bricklink.com/api/store/v1/orders"+query,oauth._requestUrl, oauth._accessUrl, 
        async (err, data) => {
            if(err){
                logger.error(`receiving order items for user ${user.email} gave error : ${err}`);
                if(err.code='ETIMEDOUT'){
                    logger.warn(`Timeout received by bricklink API from user ${user.email}, retrying after 20sec... `);
                    return setTimeout(this.ordersAll, TIMEOUT_RESTART,user, query);
                }
            }
            try{
            data = JSON.parse(data);
            }catch(e){
                logger.error(`could not parse data for orders for user ${user.email}: ${e}`);
                return;;
            }
            if(data && data.meta && data.meta.code==200){
                logger.info(`Found ${data.data.length} orders for user ${user.email}`);
                data.data.forEach(
                    async (order) => {
                        const order_db = await Order.findOne({consumer_key:user.CONSUMER_KEY,order_id:order.order_id});                                                        
                        await oauth.get("https://api.bricklink.com/api/store/v1/orders/"+order.order_id+"/items",oauth._requestUrl, oauth._accessUrl, 
                        async (err, data_items) => {
                            if(err){
                                logger.error(`receiving order items for user ${user.email} gave error : ${err}`);
                                if(err.code='ETIMEDOUT'){
                                    logger.warn(`Timeout received by bricklink API from user ${user.email}, retrying after 20sec... `);
                                    return setTimeout(this.ordersAll, TIMEOUT_RESTART,user, query);
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
                                            return;
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
                                    if(!isObjectsSame(order_db,order_dbObj)){
                                        Order.updateOne({consumer_key:user.CONSUMER_KEY,order_id:order.order_id},order_dbObj,(err)=>{
                                            if(err){
                                                logger.error(`Could not update order ${order.order_id} of user ${user.email} : ${err}`);
                                                return;
                                            }
                                        });
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