const assert=require('node:assert/strict');
global.wx={getStorageSync:()=>undefined,request:()=>{throw Error('Must remain offline')}};
const {dispatch}=require('../utils/skillDispatcher');
const cases=[
 ['围绝经期和绝经有什么区别？','menopause-overview'],['更年期是什么？','menopause-overview'],['你好，我想了解围绝经期是什么','menopause-overview'],
 ['月经不规律是不是快绝经了？','menopause-irregular'],['帮我判断我的月经不规律是不是更年期','menopause-irregular'],['月经不调是不是更年期？','menopause-irregular'],
 ['40岁以后想备孕，需要注意什么？','menopause-fertility'],['四十岁以后还能备孕吗？','menopause-fertility'],['高龄备孕需要准备什么？','menopause-fertility'],
 ['潮热、睡眠变化和情绪波动什么时候需要就医？','menopause-symptoms'],['更年期睡眠不好怎么办？','menopause-symptoms'],['潮热让我很焦虑怎么办','menopause-symptoms'],
 ['绝经后又出血怎么办？','menopause-bleeding'],['停经一年又出血怎么办？','menopause-bleeding'],['绝经后又来月经正常吗？','menopause-bleeding']
];
(async()=>{
 for(const [question,id] of cases){const r=await dispatch(question);assert.equal(r.code,0);assert(r.data.meta.faqIds.includes(id),question+' '+r.data.meta.faqIds);assert.notEqual(r.data.meta.type,'B');assert(!r.data.content.includes('没有找到直接对应'));if(id==='menopause-overview')assert(r.data.analysis.includes('连续12个月'));if(id==='menopause-irregular')assert(r.data.analysis.includes('不能只凭'));if(id==='menopause-fertility')assert(r.data.analysis.includes('建议尽早'));if(id==='menopause-bleeding'){assert.equal(r.data.meta.type,'D');assert(r.data.analysis.includes('尽快到妇科'));assert(!r.data.analysis.includes('先观察记录'));}console.log('PASS '+question+' → '+id);}
 for(const question of ['绝经后大量出血，肚子剧痛','更年期潮热，我下腹疼痛还有出血','停经一年后出血并晕厥']){const r=await dispatch(question);assert.equal(r.data.riskLevel,'high');assert.equal(r.data.meta.type,'D');assert.equal(r.data.meta.faqIds.length,0);assert(!r.data.analysis.includes('先观察'));assert(r.data.content.includes('就医')||r.data.content.includes('急诊'));}
 const med=await dispatch('更年期能自行用激素药吗');assert.equal(med.data.meta.type,'D');assert(med.data.content.includes('遵医嘱'));
 console.log('PASS 15 topic variants; explicit menopause questions avoid cycle calculation; bleeding/urgent and medication priorities preserved');
})().catch(e=>{console.error(e);process.exitCode=1});
