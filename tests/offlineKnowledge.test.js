const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const entries=require('../utils/offlineFaq');const kb=require('../utils/knowledgeBase');
global.wx={getStorageSync:()=>undefined,request:()=>{throw Error('Offline mode must not request network')}};
const {dispatch}=require('../utils/skillDispatcher');
const variants={
'plan-start':['准备开始备孕，先做什么？','请给我一份备孕准备清单'],
'plan-month':['我想做一个月备孕计划','帮我安排本月备孕生活'],
'plan-partner':['男方备孕需要做什么？','男性备孕也要准备吗？'],
'plan-intercourse':['同房频率应该怎么考虑？','备孕一定每天同房吗？'],
'plan-duration':['备孕什么时候看医生？','备孕几个月没动静需要检查吗？'],
'plan-information':['个性化备孕建议需要哪些背景？','不知道怎么备孕，能先问我信息吗？'],
'cycle-record':['月经第一天怎么算？','月经周期怎么算天数？'],
'cycle-irregular':['周期不规律时怎么安排？','月经提前了该关注什么？'],
'cycle-window':['怎么算排卵期？','易孕窗口是什么意思？'],
'cycle-confirm':['一次强阳能确定排卵吗？','体温能确认排卵吗？'],
'cycle-temperature':['基础体温曲线能说明什么？','基础体温怎么测？'],
'cycle-delayed':['姨妈没来该怎么办？','月经迟了但没测过怎么办？'],
'test-lh':['LH试纸的两条线如何理解？','排卵试纸两条杠就是排卵吗？'],
'test-no-peak':['一直测不到强阳怎么办？','排卵试纸一直弱阳是什么原因？'],
'test-long-positive':['连续强阳能确定什么吗？','一直强阳怎么办？'],
'test-hcg':['验孕棒出现颜色怎么理解？','早孕试纸阴性就一定没怀孕吗？'],
'test-invalid':['试纸没有对照线怎么办？','试纸过了时间才有线能用吗？'],
'test-type':['我的试纸结果怎么看？','排卵试纸能测怀孕吗？'],
'nutrition-folate':['叶酸要怎么补充？','补充叶酸是不是越多越好？'],
'nutrition-diet':['备孕吃什么更合适？','备孕饮食怎么搭配？'],
'nutrition-supplements':['保健品需要买一整套吗？','维生素要每种都吃吗？'],
'habits-exercise':['备孕运动要注意什么？','备孕时可以跑步吗？'],
'habits-exposure':['备孕能喝咖啡吗？','二手烟有什么要注意的？'],
'habits-sleep':['夜班怎么安排备孕生活？','经常熬夜要怎么调整？'],
'checkup-couple':['孕前检查双方都要去吗？','备孕检查要全部做吗？'],
'checkup-preparation':['检查要空腹吗？','检查前准备需要问谁？'],
'checkup-report':['检查报告怎么看？','AMH能算怀孕几率吗？'],
'checkup-vaccine':['备孕前疫苗要怎么核对？','已经接种了以后才发现可能怀孕呢？'],
'checkup-history':['有甲状腺问题怎么准备备孕？','有慢性病需要先做什么？'],
'checkup-evaluation':['生育力评估要双方去吗？','什么时候做双方检查？'],
'medication-review':['备孕用药要核对哪些信息？','我想整理用药清单'],
'medication-chronic':['吃二甲双胍能备孕吗？','长期用药是不是必须先停药？'],
'medication-ovulation':['克罗米芬能自己用吗？','来曲唑能跟别人同样用吗？'],
'medication-cold':['备孕能吃布洛芬吗？','感冒药是不是都一样？'],
'medication-herbal':['中药偏方调理能随便试吗？','中成药需要告诉医生吗？'],
'medication-exposure':['已经吃了药才发现可能怀孕怎么办？','吃药后发现怀孕一定有问题吗？']
};
(async()=>{assert.equal(entries.length,36);assert.equal(new Set(entries.map(e=>e.category)).size,6);const results=[];
for(const entry of entries){for(const q of [entry.question,...variants[entry.id]]){const r=await dispatch(q);assert.equal(r.code,0);assert(!r.data.content.includes('没有找到直接对应'),q);assert(r.data.meta.faqIds.includes(entry.id),q+' expected '+entry.id+' got '+r.data.meta.faqIds);assert(r.data.content.includes(entry.answer),q);assert(r.data.content.includes(entry.followUpQuestions[0]),q);assert.equal(r.data.needHandoff,false,q);if(entry.category==='medication'){assert.equal(r.data.meta.type,'D');assert(r.data.content.includes('遵医嘱')||r.data.content.includes('按专业建议'));assert(!r.data.content.includes('先观察'));}results.push({id:entry.id,question:q,route:r.data.meta.type,faqIds:r.data.meta.faqIds,answer:r.data.content});}}
const greeting=await dispatch('你好，备孕吃什么？');assert(greeting.data.meta.faqIds.includes('nutrition-diet'));assert.notEqual(greeting.data.meta.type,'BASIC');
const mixed=await dispatch('我想问备孕饮食和同房频率怎么安排？');assert(mixed.data.meta.faqIds.includes('nutrition-diet'));assert(mixed.data.meta.faqIds.includes('plan-intercourse'));
for(const q of ['我大量出血，想找医生','吃了促排药，现在下腹疼痛还有出血','你好，我阴道大量出血，肚子剧痛']){const r=await dispatch(q);assert.equal(r.data.meta.type,'D');assert.equal(r.data.riskLevel,'high');assert.equal(r.data.meta.faqIds.length,0);assert(!r.data.content.includes('先观察'));}
for(const q of ['LH试纸怎么看？','lh 试纸怎么看？','备孕１—３个月需要关注什么？']){const r=await dispatch(q);assert(!r.data.content.includes('没有找到直接对应'));}
const unrelated=await dispatch('火星飞船如何驾驶');assert(unrelated.data.content.includes('没有找到直接对应'));
assert(!kb.matchFAQ('排卵期计算')[0].answer.includes('后4天'));
const dir=path.resolve(__dirname,'../design-reference/offline-knowledge');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'answers.json'),JSON.stringify({newTopics:36,categories:6,questionCases:results.length,results},null,2)+'\n');
console.log('PASS '+results.length+' topic/paraphrase cases; 6 categories, follow-ups, mixed topics, greeting bypass, high-risk precedence, normalization and honest unknown fallback');
})().catch(e=>{console.error(e);process.exitCode=1});
