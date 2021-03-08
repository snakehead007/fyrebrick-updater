const schedule = require('node-schedule');
const bricklinkPlus = require("bricklink-plus");
const {User,Store} = require("fyrebrick-helper").models;
const store_chart = async () => {
    schedule.scheduleJob("30 22 * *",async ()=>{
        const stores = await Store.find();
        for(store of stores){
            const user = await User.findOne({userName:store.username});
            if(user){
                const info = await bricklinkPlus.plus.stores.getStoreStats(user.userName);
                const store_info = {
                    timestamp: new Date(),
                    n4totalLots: info.n4totalLots,
                    n4totalItems: info.n4totalItems,
                    n4totalViews: info.n4totalViews,
                }
                await Store.updateOne({_id:store._id},{$push : {store_chart:[store_info]}},(err,data)=>{
                    console.log(err,data);
                });
                console.log(store);
            }
        }
    });
}

module.exports = store_chart;