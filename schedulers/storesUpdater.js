const schedule = require('node-schedule');
const {getStores} = require('fyrebrick-helper').helpers;
const {logger} = require("fyrebrick-helper").helpers
const {Store} = require("fyrebrick-helper").models;
const {User} = require("fyrebrick-helper").models;
const _ = require('lodash');
//const allCountryIDs = ["AR","BR","CA","CL","CO","CR","SV","MX","PE","US","VE","AT","BY","BE","BG","HR","CZ","DK","EE","FO","FI","FR","DE","GI","GR","HU","IS","IE","IT","LV","LT","LU","MT","MD","MC","NL","NO","PL","PT","RO","RU","SM","RS","SK","SI","ES","SE","CH","UA","UK","CN","HK","IN","ID","JP","KZ","MO","MY","NZ","PK","PH","SG","KR","TW","TH","VN","BH","CY","IL","LB","MA","OM","QA","ZA","IR","AE"];
const allCountryIDs = ["BE"];

module.exports = async ()=>{
    //every 24 hours
    schedule.scheduleJob("0 0 * * *",async()=>{
        logger.info('running store updater');
        try{
            console.time('run stores');
            logger.info('started running stores');
            logger.info(`searching for ${allCountryIDs.length} countries`);
            await allCountryIDs.forEach(async(countryID)=>{
                try{
                    const data = await getStores(countryID);
                    logger.info(`countryID: ${countryID} ${data.length} stores`);
                    await data.forEach(async(store,index)=>{  
                        const store_db = await Store.findOne({username:store.username});
                        logger.info(`store ${store.name} from country ${countryID} done`);
                        if(!store_db){
                            const newStore = new Store(store);
                            await newStore.save(err=>{
                                if(err){
                                    logger.err(err);
                                }
                            })  
                        }else{
                            await Store.updateOne({_id:store_db._id},store);
                        }
                        if(countryID===allCountryIDs[allCountryIDs.length-1] && index+1 === data.length){
                            logger.info(`all stores ran!`);
                            console.timeEnd('run stores');
                            await updateAll();
                        }
                    })
                    
                }catch(err){
                    logger.error(err.toString());
                }
            });
        }catch(err){
            logger.error(err);
        }
        //await updateAll();
    });
}
const updateAll = async()=>{
    //after every country done, update ranks
    const allStores = await Store.find({});
    const users = await User.find({});
    //create a nationalsStores array
    let nationalStores_unsorted = [...new Array(allCountryIDs.length)].map(elem => new Array());
    await allStores.forEach(async(store)=>{
        nationalStores_unsorted[allCountryIDs.indexOf(store.countryID)].push(store);
    })
    const views = (dataset) => _.orderBy(dataset, ['n4totalViews'],['desc']);
    const lots = (dataset) => _.orderBy(dataset, ['n4totalLots'],['desc']);
    const items = (dataset) => _.orderBy(dataset, ['n4totalItems'],['desc']);   
    //store found in stores
    const data = [...new Array(allCountryIDs.length)].map(elem => new Array());
    await allCountryIDs.forEach(async(countryID,index)=>{
       data[index].push({
            national:{
                views:arrayMe(views(nationalStores_unsorted[index])),
                lots:arrayMe(lots(nationalStores_unsorted[index])),
                items:arrayMe(items(nationalStores_unsorted[index]))
            },
            global:{
                views: arrayMe(views(allStores)),
                lots: arrayMe(lots(allStores)),
                items: arrayMe(items(allStores))
            }
        });
    });
    logger.info(`starting to find ranks... ${allStores.length} stores`);
    users.forEach(async(user)=>{
        user = JSON.parse(JSON.stringify(user)); //why? i dont know, but this fixes it. otherwise properties are undefined
        //logger.info(`running user ${user.userName}`);
        
        const thisStore = await Store.findOne({username:user.userName});
        try{
            await updateRank(user.userName,data[allCountryIDs.indexOf(thisStore.countryID)][0],true);
        }catch(e){
            let d = data[allCountryIDs.indexOf(user.countryID)];
            //console.log(user);
            console.log(user.userName);
            console.log(thisStore);
            console.log(allCountryIDs.indexOf(user.countryID));
            console.log(d);
            console.trace(e);
        }
    });
    
    allStores.forEach(async(store,index)=>{
        store = JSON.parse(JSON.stringify(store));
        //logger.info(`running store ${store.username}`);
        //console.log(`${index+1}/${allStores.length}`);
        try{
            await updateRank(store.username,data[allCountryIDs.indexOf(store.countryID)][0])
        }catch(e){
            console.trace(e);
            let d = data[allCountryIDs.indexOf(store.countryID)];
            console.log(d);
            console.log(store.username);
        }
        if(index+1 === store.length){
            //await runStores();
            logger.info(`Store scheduler done!`);
        }
    });
}
//this creates an array of online the usernames
const arrayMe = (data)=>{
    let d = [];
    data.forEach((s)=>{
        d.push(s.username);
    })
    return d;
}

const updateRank = async (username,data,isUser=false)=>{
    //console.log(data,username);
    const myStore = await Store.findOne({username:username});
    let user;
    if(isUser){
        user = await User.findOne({userName:username});
    }else{
        user = myStore;
    }
    if(!myStore){
        logger.warn(`store from username ${username} not found in stores`);
    }else{
        
        //both global and national stores are now stored by each value and in an array separate
        //now search for the current username in each of these arrays and get its array which is its rank for that type
        const rank={
            global:{
                views:{
                    date:new Date,
                    rank:data.global.views.indexOf(myStore.username)+1
                },
                lots:{
                    date:new Date,
                    rank:data.global.lots.indexOf(myStore.username)+1
                },
                items:{
                    date:new Date,
                    rank:data.global.items.indexOf(myStore.username)+1
                }
            },
            national:{
                views:{
                    date:new Date,
                    rank:data.national.views.indexOf(myStore.username)+1
                },
                lots:{
                    date:new Date,
                    rank:data.national.lots.indexOf(myStore.username)+1
                },
                items:{
                    date:new Date,
                    rank:data.national.items.indexOf(myStore.username)+1
                }
            }
        }
        
        //now update this store with new variables
        if(user && user.rank){
            //user already has a rank, push new one
            user.rank.global.views.unshift(rank.global.views);
            user.rank.global.lots.unshift(rank.global.lots);
            user.rank.global.items.unshift(rank.global.items);
            user.rank.national.views.push(rank.national.views);
            user.rank.national.lots.unshift(rank.national.lots);
            user.rank.national.items.unshift(rank.national.items);
            if(isUser){
                await User.updateOne({userName:username},{rank:user.rank},(err,data)=>{
                    if(err)console.log(err,data,username);
                });
            }else{
                await Store.updateOne({username:username},{rank:user.rank},(err,data)=>{
                    if(err)console.log(err,data,username);
                });
            }
        }else{
            //user does not have a rank, create a new one
            let updateRank = {rank:{
                global:{
                    views:[rank.global.views],
                    lots:[rank.global.lots],
                    items:[rank.global.items],
                },
                national:{
                    views:[rank.national.views],
                    lots:[rank.national.lots],
                    items:[rank.national.items],
                }
            }};
            //return updateRank;
            if(isUser){
                await User.updateOne({userName:username},updateRank,(err,data)=>{
                    if(err)console.log(err,data,username);
                });
            }else{
                await Store.updateOne({username:username},updateRank,(err,data)=>{
                    if(err)console.log(err,data,username);
                });
            }
        }
    }
}