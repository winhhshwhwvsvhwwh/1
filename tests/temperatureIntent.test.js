const assert=require('node:assert/strict');
let records=[];global.wx={getStorageSync:key=>key==='recordList'?records:undefined};
const router=require('../utils/intentRouter'),dispatcher=require('../utils/skillDispatcher');
const methods=['基础体温怎么记录？','每天什么时候量基础体温？','我的基础体温怎么记录？','我想问基础体温怎么记录，有点焦虑','怎么记录基础体温？'];
const personal=['根据我记录的体温，帮我看看现在处于哪个周期阶段','请根据我的基础体温曲线分析当前周期阶段'];
(async()=>{
 for(const q of methods){const r=await dispatcher.dispatch(q);assert.equal(r.data.meta.type,'A',q);assert(r.data.meta.faqIds.includes('cycle-temperature'));assert(r.data.analysis.includes('早晨醒来后、起床活动前'));assert(r.data.analysis.includes('记录日期、时间和温度'));assert(!r.data.analysis.includes('你还没在'));console.log('PASS knowledge: '+q);}
 for(const q of personal){const r=await dispatcher.dispatch(q);assert.equal(r.data.meta.type,'B');for(const needed of ['开始日期','结束日期','平均周期长度','经期长度'])assert(r.data.analysis.includes(needed));assert(r.data.analysis.includes('当前记录页不保存连续体温数据'));assert(!r.data.analysis.includes('正处于'));console.log('PASS cycle without record: '+q);}
 const now=new Date(),start=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');records=[{id:'synthetic',startDate:start,endDate:start,cycleLength:28,periodLength:5,symptoms:[]}];
 const r=await dispatcher.dispatch(personal[0]);assert.equal(r.data.meta.type,'B');assert(r.data.analysis.includes('今天是这个周期的第1天'));assert(r.data.analysis.includes('不包含连续体温数据'));
 assert.equal((await dispatcher.dispatch(methods[0])).data.meta.type,'A');
 for(const q of ['根据我的记录分析周期，我腹痛还有出血','基础体温怎么记录？我阴道大量出血，肚子剧痛']){const risk=await dispatcher.dispatch(q);assert.equal(risk.data.meta.type,'D');assert.equal(risk.data.riskLevel,'high');}
 console.log('PASS saved cycle data still analysed; method questions stay knowledge; high-risk priority preserved');
})().catch(e=>{console.error(e);process.exitCode=1});
