const schedule = require('node-schedule');
const {getStores} = require('fyrebrick-helper').helpers;
const {logger} = require("fyrebrick-helper").helpers
const {Store} = require("fyrebrick-helper").models;
const {User} = require("fyrebrick-helper").models;
const _ = require('lodash');
module.exports = ()=>{
    //every 24 hours
    const allCountryIDs = ["AR","BR","CA","CL","CO","CR","SV","MX","PE","US","VE","AT","BY","BE","BG","HR","CZ","DK","EE","FO","FI","FR","DE","GI","GR","HU","IS","IE","IT","LV","LT","LU","MT","MD","MC","NL","NO","PL","PT","RO","RU","SM","RS","SK","SI","ES","SE","CH","UA","UK","UA","CN","HK","IN","ID","JP","KZ","MO","MY","NZ","PK","PH","SG","KR","TW","TH","VN","BH","CY","IL","LB","MA","OM","QA","ZA","IR","AE"];
    //const allCountryIDs = ["VE"]; //tester variable
    schedule.scheduleJob("0 0 * * *",async()=>{
        logger.info('running store updater');
        await allCountryIDs.forEach(async(countryID)=>{
            try{
                console.log(countryID);
                const data = await getStores(countryID);
                await data.forEach(async(store)=>{  
                    const newStore = new Store(store);
                    await newStore.save(err=>{
                        if(err){
                            logger.err(err);
                        }
                    })  
                })
                
            }catch(err){
                logger.error(err);
            }
        })
        logger.info('starting to find ranks...');
                //after every country done, update ranks
                const allStores = await Store.find();
                const users = await User.find();
                users.forEach(async(user)=>{
                    user = JSON.parse(JSON.stringify(user)); //why? i dont know, but this fixes it. otherwise properties are undefined
                    const myStore = await Store.findOne({username:user.userName});
                    if(!myStore){
                        logger.warn(`store from username ${user.userName} not found in stores`);
                    }else{
                        //store found in stores
                        const nationalStores = await Store.find({countryID:myStore.countryID});
                        const data = {
                            national:{
                                views:arrayMe(_.orderBy(nationalStores, ['n4totalViews'],['desc'])),
                                lots:arrayMe(_.orderBy(nationalStores, ['n4totalLots'],['desc'])),
                                items:arrayMe(_.orderBy(nationalStores, ['n4totalItems'],['desc']))
                            },
                            global:{
                                views: arrayMe(_.orderBy(allStores, ['n4totalViews'],['desc'])),
                                lots: arrayMe(_.orderBy(allStores, ['n4totalLots'],['desc'])),
                                items: arrayMe(_.orderBy(allStores, ['n4totalItems'],['desc']))
                            }
                        }
                        //both global and national stores are now stored by each value and in an array separate
                        //now search for the current username in each of these arrays and get its array which is its rank for that type
                        const rank={
                            global:{
                                views:{
                                    date:new Date,
                                    rank:data.global.views.indexOf(myStore.username)
                                },
                                lots:{
                                    date:new Date,
                                    rank:data.global.lots.indexOf(myStore.username)
                                },
                                items:{
                                    date:new Date,
                                    rank:data.global.items.indexOf(myStore.username)
                                }
                            },
                            national:{
                                views:{
                                    date:new Date,
                                    rank:data.national.views.indexOf(myStore.username)
                                },
                                lots:{
                                    date:new Date,
                                    rank:data.national.lots.indexOf(myStore.username)
                                },
                                items:{
                                    date:new Date,
                                    rank:data.national.items.indexOf(myStore.username)
                                }
                            }
                        }
                        //now update this store with new variables
                        if(user.rank){
                            //user already has a rank, push new one
                            user.rank.global.views.unshift(rank.global.views);
                            user.rank.global.lots.unshift(rank.global.lots);
                            user.rank.global.items.unshift(rank.global.items);
                            user.rank.national.views.push(rank.national.views);
                            user.rank.national.lots.unshift(rank.national.lots);
                            user.rank.national.items.unshift(rank.national.items);
                            console.log(user);
                            await User.updateOne({_id:user._id},user);
                            logger.info(`done with ranks for user ${user.userName}`);
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
                            await User.updateOne({_id:user._id},updateRank);
                            logger.info(`done with ranks for user ${user.userName}`);
                        }
                    }
                });
    });
}

const arrayMe = (data)=>{
    let d = [];
    data.forEach((s)=>{
        d.push(s.username);
    })
    return d;
}