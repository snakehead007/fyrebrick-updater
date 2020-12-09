require('dotenv').config();
const mongoose = require('mongoose');
const {start}  = require('./schedulers/schedulers');
const {logger} = require('./helpers/logger');
const Inventory = require('./models/inventory');
const Order = require('./models/order');
try {
    mongoose.connect(process.env.DB_URI, {
        useCreateIndex: true,
        useUnifiedTopology: true,
        useNewUrlParser: true
    });
    mongoose.connection.on('open', async() => {
        logger.info(`mongodb connection opened at ${process.env.DB_URI}`);
        if((await Inventory.find()).length===0 && (await Order.find()).length===0){
            logger.error(`Error on getting data from database, both orders and inventory are empty`)
            process.exit(-1);
        }else{
            start();
        }
        
    })
    mongoose.connection.on('error', (error) =>{
        logger.error(`mongodb connection error: ${error}`);
    })
    mongoose.connection.on('close', () =>{
        logger.info(`mongodb connection closed at ${process.env.DB_URI}`);
    })
}catch(err){
    logger.error(`error caught: ${err}`);
}