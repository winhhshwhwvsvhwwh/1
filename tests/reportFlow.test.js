const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{createRequire}=require('node:module');
const modals=[],calls=[];global.wx={showModal:x=>modals.push(x),showToast(){},getStorageSync:()=>undefined,nextTick:f=>f()};
let recognition=async()=>({items:[{id:'1',name:'示例指标',value:'1.0',unit:'U/L',referenceRange:'0-2',flag:''}],warnings:[],notice:'测试核对提示'});
const reportClient={recognizeReport:async(...args)=>{calls.push(['recognize',...args]);return recognition()},interpretReport:async(items,question)=>{calls.push(['interpret',JSON.parse(JSON.stringify(items)),question]);return {content:'示例指标 '+items[0].value+' U/L',understanding:'仅合成测试',analysis:'非真实报告',suggestions:[],riskNotice:'测试',riskLevel:'medium',needHandoff:false}}};
const file=require.resolve('../pages/chat/chat'),nativeRequire=createRequire(file);let definition;
vm.runInNewContext(fs.readFileSync(file,'utf8'),{Page:d=>definition=d,require:m=>m==='../../utils/reportClient.js'?reportClient:nativeRequire(m),wx:global.wx,setTimeout,clearTimeout});
function page(){return {...definition,data:JSON.parse(JSON.stringify(definition.data)),setData(d,cb){Object.assign(this.data,d);if(cb)cb()}};}
(async()=>{
 const p=page();p.onReportClick();assert.equal(p.data.imageIntent,'report');p.setData({pendingImage:'synthetic-test-only.jpg',pendingCaption:'合成测试'});await p.onImagePreviewSend();assert.equal(p.data.messages.length,0);assert.equal(p.data.reportItems.length,1);assert.equal(calls.filter(c=>c[0]==='interpret').length,0);
 p.onReportItemChange({detail:{index:0,field:'value',value:'1.5'}});await p.onImagePreviewSend();assert.equal(calls.at(-1)[1][0].value,'1.5');assert.equal(p.data.messages.length,2);assert.equal(p.data.messages[1].type,'report_analysis');assert.equal(p.data.messages[1].animate,true);assert.equal(p.data.reportBusy,false);
 const stale=page();stale.onReportClick();stale.setData({pendingImage:'test.jpg'});let resolve;recognition=()=>new Promise(r=>resolve=r);const running=stale.onImagePreviewSend();assert(stale.data.reportBusy);stale.onImagePreviewCancel();resolve({items:[{id:'1',name:'x',value:'1'}],warnings:[]});await running;assert.equal(stale.data.reportItems.length,0);assert.equal(stale.data.pendingImage,'');
 recognition=async()=>{throw Error('服务尚未配置')};const failed=page();failed.onReportClick();failed.setData({pendingImage:'test.jpg'});await failed.onImagePreviewSend();assert.equal(failed.data.messages.length,0);assert.equal(failed.data.reportBusy,false);assert(modals.at(-1).content.includes('尚未配置'));
 const generic=page();generic.setData({pendingImage:'test.jpg',pendingCaption:'这是报告单'});generic.onImagePreviewSend();assert.equal(generic.data.imageIntent,'report');assert.equal(generic.data.messages.length,0);
 // Disabled configuration must fail before any local read or external upload.
 const actual=require('../utils/reportClient');await assert.rejects(actual.recognizeReport('never-read.jpg',''),/尚未启用/);
 console.log('PASS report entrance → recognition → editable confirmation → interpretation; no automatic interpretation, stale request cancellation, service error, disabled config blocks upload, general-report caption switches with notice');
})().catch(e=>{console.error(e);process.exitCode=1});
