//Uncomment next line if in development
//require('dotenv').config();
const mongoose = require('mongoose');
const {start}  = require('./schedulers/schedulers');
const {logger} = require("fyrebrick-helper").helpers;
const {Inventory} = require("fyrebrick-helper").models;
const {Order} = require("fyrebrick-helper").models;
try {
    mongoose.connect(process.env.DB_URI, {
        useCreateIndex: true,
        useUnifiedTopology: true,
        useNewUrlParser: true
    });
    mongoose.connection.on('open', async() => {
        logger.info(`mongodb connection opened at ${process.env.DB_URI}`);
        start();
        
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