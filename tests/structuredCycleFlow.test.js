const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{createRequire}=require('node:module');
let saved,definition,analysis,selected;let records=[];const modals=[];
global.wx={getStorageSync:()=>[],showToast(){}};
const dispatcher=require('../utils/skillDispatcher');const {extract}=require('../utils/profileFacts');
const store={getRecords:async()=>records,saveRecord:async data=>{saved={...data,id:'fresh'};records=[{id:'other',startDate:'2026-11-10',endDate:'2026-11-11',cycleLength:30,periodLength:2,symptoms:[]},saved];return saved;}};
const previous={route:'pages/chat/chat',onCycleInterpretation(record){selected=record;analysis=dispatcher.dispatch('我现在处于周期哪个阶段？',{cycleRecord:record});}};
const wxMock={showToast(){},showModal:options=>{modals.push(options);options.success({confirm:true});},navigateBack:options=>options.success()};
const file=require.resolve('../pages/record/record');vm.runInNewContext(fs.readFileSync(file,'utf8'),{Page:d=>definition=d,require:path=>path.includes('recordStore')?store:{saveCycleRecord:async()=>false},wx:wxMock,getCurrentPages:()=>[previous,{}]});
const page={...definition,data:JSON.parse(JSON.stringify(definition.data)),setData(data){Object.assign(this.data,data)}};
(async()=>{
 const missing=await dispatcher.dispatch('我现在处于周期哪个阶段？');assert(missing.data.analysis.includes('没有周期记录'));
 page.setData({today:'2026-11-11',startDate:'2026-11-01',endDate:'2026-11-05',cycleLength:'28',periodLength:'5',symptoms:['疲劳','睡眠不足']});page.onSave();await new Promise(resolve=>setImmediate(resolve));assert(selected);assert.equal(selected.id,'fresh');const result=await analysis;
 assert.equal(result.data.meta.skill,'cycle');assert(result.data.analysis.includes('2026-11-01 至 2026-11-05'));assert(result.data.analysis.includes('疲劳、睡眠不足'));assert(result.data.analysis.includes('可能处于'));assert(!result.data.analysis.includes('2026-11-10'));assert(modals.some(m=>m.confirmText==='查看解读'));
 console.log('PASS no record → information prompt; form → correct saved values → explicit next step → cycle Skill uses EXACT newly saved record including symptoms, not another newer record; simulated navigation, no live cloud');
})().catch(e=>{console.error(e);process.exitCode=1});
