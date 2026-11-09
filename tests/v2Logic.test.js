const assert=require('node:assert/strict'),fs=require('node:fs');
let records=[];global.wx={getStorageSync:key=>key==='recordList'?records:undefined};
const dispatcher=require('../utils/skillDispatcher');const {extractFacts}=require('../utils/questionFacts');
const outputs=[];
async function run(name,question,check){const r=await dispatcher.dispatch(question);assert.equal(r.code,0);check(r.data);outputs.push({name,question,...r.data});console.log('PASS '+name);}
const absentQuestions=text=>{assert(!/年龄大致是多少|尝试多久|先确认实际未避孕尝试的时长/.test(text));};
(async()=>{
 const start=new Date(Date.now()-2*86400000).toISOString().slice(0,10);records=[{id:'test-only',startDate:start,endDate:new Date().toISOString().slice(0,10),cycleLength:28,periodLength:5,symptoms:[]}];
 for(const phrase of ['我现在在周期第几天','我这个周期第几天','我目前在周期第几天','周期第几天'])await run('personal '+phrase,'排卵期怎么算，'+phrase,d=>{assert.equal(d.meta.type,'B');assert(d.analysis.split('\n')[0].includes('今天是这个周期的第'));assert(d.analysis.includes('估算，仅供参考'));assert.equal(d.analysis.split('\n').length,3);});
 records=[];await run('no record','排卵期怎么算，我现在在周期第几天',d=>{assert.equal(d.meta.type,'B');assert(d.analysis.includes('目前没有周期记录'));assert(!/今天是这个周期的第\d+天/.test(d.analysis));});
 for(const q of ['32 岁，备孕一年','32岁，备孕12个月没怀上怎么办','35岁，备孕三个月未孕'])await run('known facts '+q,q,d=>{assert(d.analysis.includes('你已提供'));absentQuestions(d.content);});
 await run('half year, missing age','备孕半年没怀上怎么办',d=>{assert(d.analysis.includes('6个月'));assert(d.analysis.includes('女方年龄大致是多少'));assert(!d.content.includes('尝试多久'));});
 await run('cycle 35 days','我的月经周期35天，排卵期怎么算',d=>{assert.equal(d.meta.type,'A');assert(d.analysis.includes('第19—23天'));assert(d.analysis.includes('估算，仅供参考'));});
 for(const q of ['我吃二甲双胍可以备孕吗','备孕期间用药有哪些注意事项？','感冒药可以吃吗','促排药能自己用吗'])await run('one medication notice '+q,q,d=>{assert.equal(d.riskLevel,'medium');assert.equal((d.content.match(/遵医嘱/g)||[]).length,1);const visible=[d.understanding,d.analysis,...d.suggestions,d.riskNotice].join('\n');assert.equal((visible.match(/遵医嘱/g)||[]).length,1);assert(d.content.includes('不要自行用药或停药'));});
 await run('emotion with high risk','我很害怕，阴道大量出血肚子剧痛',d=>{assert.equal(d.riskLevel,'high');assert(d.understanding.startsWith('能理解你现在有些担心。'));assert(!d.content.includes('确实需要留意一下'));assert(d.analysis.includes('立即前往急诊'));});
 await run('emotion with medicine','我很焦虑，二甲双胍可以备孕吗',d=>{assert(d.understanding.startsWith('能理解你现在有些担心。'));assert(d.understanding.includes('确实需要留意一下'));});
 assert.equal(extractFacts('备孕一年').durationMonths,12);assert.equal(extractFacts('备孕12个月').durationMonths,12);assert.equal(extractFacts('备孕三个月').durationMonths,3);assert.equal(extractFacts('备孕半年').durationMonths,6);assert.equal(extractFacts('男方32岁，备孕一年').age,null);
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify({note:'本轮自建A类回归，不是缺失的评分表22条用例',count:outputs.length,outputs},null,2));
 console.log('PASS '+outputs.length+' A-class cases and fact parsing; no layout changes required');
})().catch(e=>{console.error(e);process.exitCode=1});
