const assert=require('node:assert/strict');
global.wx={getStorageSync:()=>undefined,request:()=>{throw Error('Must stay offline')}};
const {dispatch}=require('../utils/skillDispatcher');
(async()=>{
 const plan=await dispatch('帮我制定一个备孕计划');
 assert.equal(plan.data.meta.type,'A');assert(plan.data.meta.faqIds.includes('home-preparation-plan'));
 for(const week of [1,2,3,4])assert(plan.data.analysis.includes('第'+week+'周｜'));
 for(const action of ['药物和补充剂清单','记录检测时间和结果','回顾','不保证受孕'])assert(plan.data.content.includes(action));
 for(const label of ['今天先做','本周安排','每天执行'])assert(plan.data.suggestions.some(s=>s.startsWith(label)));
 assert(plan.data.understanding.includes('4周'));assert(!plan.data.understanding.includes('通用注意事项'));
 const guide=await dispatch('备孕知识科普');
 assert.equal(guide.data.meta.type,'A');assert(guide.data.meta.faqIds.includes('home-preconception-guide'));
 for(const topic of ['月经周期怎么计算','强阳不等于已经排卵','饮食和叶酸','不是只要求女方','孕前检查和用药','什么时候需要专业评估'])assert(guide.data.analysis.includes(topic));
 assert(guide.data.analysis.includes('第一天'));assert(guide.data.analysis.includes('12个月'));assert(!guide.data.understanding.includes('通用注意事项'));
 for(const question of ['帮我制定备孕计划，我下腹疼痛还有出血','备孕知识科普，我阴道大量出血肚子剧痛']){const r=await dispatch(question);assert.equal(r.data.meta.type,'D');assert.equal(r.data.riskLevel,'high');assert(!r.data.analysis.includes('第1周｜'));}
 console.log('PASS home plan gives four concrete weeks and immediate actions; overview explains six topics; high-risk routing preserved; offline only');
})().catch(e=>{console.error(e);process.exitCode=1});
