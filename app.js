require('dotenv').config();
const mongoose = require('mongoose');
const {start}  = require('./schedulers/schedulers');
try {
    mongoose.connect(process.env.DB_URI, {
        useCreateIndex: true,
        useUnifiedTopology: true,
        useNewUrlParser: true
    });
    mongoose.connection.on('open', () => {
        logger.info(`mongodb connection opened at ${process.env.DB_URI}`);
        start();
    })
}catch(err){
    logger.error(`error caught: ${err}`);
}