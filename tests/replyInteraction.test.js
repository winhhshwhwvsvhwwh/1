const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {createRequire}=require('node:module');
const timers=[],toasts=[];let clipboard='',clipboardFails=false;
global.wx={getStorageSync:()=>undefined,setStorageSync(){},showToast:e=>toasts.push(e.title),nextTick:fn=>fn(),setClipboardData(options){if(clipboardFails)options.fail();else{clipboard=options.data;options.success();}}};
const dispatcher=require('../utils/skillDispatcher');let dispatch=content=>dispatcher.dispatch(content);
const apiPath=require.resolve('../utils/api');const apiModule={exports:{}};const apiRequire=createRequire(apiPath);
vm.runInNewContext(fs.readFileSync(apiPath,'utf8'),{module:apiModule,exports:apiModule.exports,require:id=>id==='./skillDispatcher.js'?{dispatch:content=>dispatch(content)}:apiRequire(id),wx:global.wx,setTimeout:(fn,delay)=>timers.push({fn,delay})});
const api=apiModule.exports;let definition;const pagePath=require.resolve('../pages/chat/chat');const pageRequire=createRequire(pagePath);
vm.runInNewContext(fs.readFileSync(pagePath,'utf8'),{Page:d=>definition=d,require:id=>id==='../../utils/api.js'?api:pageRequire(id),wx:global.wx,setTimeout,clearTimeout});
const page=()=>({...definition,data:JSON.parse(JSON.stringify(definition.data)),setData(d,cb){Object.assign(this.data,d);if(cb)cb();}});
async function reply(){const timer=timers.shift();assert.equal(timer.delay,1200);timer.fn();for(let i=0;i<30;i++)await Promise.resolve();}
(async()=>{
 const p=page();p.onInputChange({detail:{value:'备孕期间用药有哪些注意事项？'}});p.onSend();
 assert.equal(p.data.loading,true);assert.equal(p.data.messages.length,1);assert.equal(p.data.messages[0].role,'user');assert.equal(p.data.inputValue,'');
 p.onInputChange({detail:{value:'重复发送'}});p.onSend();assert.equal(p.data.messages.length,1);assert.equal(timers.length,1);
 await reply();assert.equal(p.data.loading,false);assert.equal(p.data.messages.length,2);const answer=p.data.messages[1];assert(answer.content.includes('遵医嘱'));
 p.onCardAction({detail:{action:'copy'},currentTarget:{dataset:{id:answer.id}}});assert.equal(clipboard,answer.content);assert(toasts.includes('已复制'));assert(clipboard.includes('不要自行用药或停药'));
 p.data.messages.push({id:999,role:'assistant',content:'另一条回答'});p.onCardAction({detail:{action:'copy'},currentTarget:{dataset:{id:answer.id}}});assert.equal(clipboard,answer.content);
 clipboardFails=true;p.copyText(answer.content);assert.equal(toasts.at(-1),'复制失败，请重试');clipboardFails=false;
 p.copyText(' ');assert.equal(toasts.at(-1),'暂无可复制的内容');
 for(const impl of [()=>Promise.resolve({code:1}),()=>Promise.reject(Error('offline')),()=>{throw Error('sync failure')}]){dispatch=impl;const failed=page();failed.sendMessage('测试失败');assert(failed.data.loading);await reply();assert.equal(failed.data.loading,false);assert.equal(failed.data.messages.length,1);assert(toasts.at(-1).includes('暂时无法回复'));}
 console.log('PASS user message → 1200ms loading → answer; duplicate-send guard; complete selected reply copied; clipboard failure; nonzero/rejected/thrown errors end loading');
})().catch(e=>{console.error(e);process.exitCode=1});
