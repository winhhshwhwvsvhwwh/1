const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{createRequire}=require('node:module');
const calls=[];let cleared=false,opened=false;
global.wx={getStorageSync:key=>key==='xiaonuan_cloud_memory_consent_v1'?true:[],setStorageSync(){},removeStorageSync(){cleared=true;},cloud:{init(){calls.push('init');throw Error('unexpected cloud');},callFunction(){calls.push('call');throw Error('unexpected cloud');}},showActionSheet:options=>options.success({tapIndex:0}),showModal:options=>options.success&&options.success({confirm:true}),showToast(){},nextTick:fn=>fn()};
const constants=require('../utils/constants');assert.equal(constants.USE_CLOUD,false);assert.equal(constants.REPORT_VISION.enabled,false);assert.equal(constants.MEMORY_CLOUD,undefined);
const apiFile=require.resolve('../utils/api');const moduleObj={exports:{}};vm.runInNewContext(fs.readFileSync(apiFile,'utf8'),{module:moduleObj,require:createRequire(apiFile),setTimeout:fn=>fn(),wx:global.wx});
(async()=>{
 const reply=await moduleObj.exports.sendChatMessage('基础体温怎么记录？');assert.equal(reply.code,0);assert(reply.data.analysis.includes('早晨醒来后'));assert(!reply.data.content.includes('云端记忆'));assert.deepEqual(calls,[]);
 let definition;const file=require.resolve('../pages/chat/chat');vm.runInNewContext(fs.readFileSync(file,'utf8'),{Page:d=>definition=d,require:createRequire(file),wx:global.wx,setTimeout,clearTimeout});
 const page={...definition,data:JSON.parse(JSON.stringify(definition.data)),setData(d){Object.assign(this.data,d)},openRecordPage(){opened=true;}};page.onProfileClick();assert(opened);page.onNewConversation();assert(cleared);assert.deepEqual(calls,[]);
 assert(!fs.existsSync(require('node:path').join(__dirname,'../cloudfunctions/companionMemory')));
 console.log('PASS local-only Q/A and profile menu, old cloud consent cannot trigger uploads, new chat clears only local storage, cloud function source removed');
})().catch(e=>{console.error(e);process.exitCode=1});
