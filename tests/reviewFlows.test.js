const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const {createRequire} = require('node:module');
const root=path.resolve(__dirname,'..');
const store = new Map(); let toasts=[];
global.wx={getStorageSync:k=>store.get(k),setStorageSync:(k,v)=>store.set(k,v),showToast:x=>toasts.push(x.title),nextTick:fn=>fn(),navigateTo(){}};
const dispatcher=require('../utils/skillDispatcher');
const api=require('../utils/api');
let definition;
vm.runInNewContext(fs.readFileSync(path.join(root,'pages/chat/chat.js'),'utf8'),{require:createRequire(path.join(root,'pages/chat/chat.js')),Page:d=>definition=d,wx:global.wx,setTimeout,clearTimeout});
function page(){return {...definition,data:JSON.parse(JSON.stringify(definition.data)),setData(d,cb){Object.assign(this.data,d);if(cb)cb();}};}
async function settle(p){for(let i=0;i<20&&p.data.loading;i++)await new Promise(r=>setTimeout(r,0));assert.equal(p.data.loading,false);}
(async()=>{
 const p=page();const initial=p.data.welcomeQuestions.slice();p.refreshQuestions();const refreshed=p.data.welcomeQuestions.slice();
 const presets=[{label:'备孕计划',question:'帮我制定一个备孕计划'},{label:'知识科普',question:'备孕知识科普'},{label:'用药建议',question:'备孕期间用药有哪些注意事项？'},...initial.map(q=>({label:q,question:q})),...refreshed.map(q=>({label:q,question:q})),...p.data.stageQuestions,...p.data.needQuestions,{label:'推荐问题1',question:'排卵日总是算不准怎么办？'},{label:'推荐问题2',question:'我的试纸结果怎么看？'}];
 assert.equal(presets.length,23);
 const results=[];
 for(const preset of presets){const res=await dispatcher.dispatch(preset.question);assert.equal(res.code,0);assert(!res.data.content.includes('没有找到直接对应'),preset.label);assert.equal(res.data.needHandoff,false,preset.label);results.push({label:preset.label,question:preset.question,type:res.data.meta.type,needHandoff:res.data.needHandoff,answer:res.data.content});console.log('PASS preset '+preset.label+' -> '+res.data.meta.type);}
 const risks=[];
 for(const text of ['我下腹疼痛还有出血','我吃二甲双胍可以备孕吗','我阴道大量出血，肚子剧痛']){
  const res=await dispatcher.dispatch(text);assert(!res.data.analysis.includes('先观察'));const matchedRisk=require('../utils/knowledgeBase').matchRisk(text);assert(res.data.analysis.startsWith(matchedRisk[0].guidance));for(const lower of matchedRisk.slice(1))assert(!res.data.analysis.includes(lower.guidance));if(matchedRisk[0].category !== '备孕用药')assert.equal(res.data.analysis,matchedRisk[0].guidance);if(text.includes('二甲双胍')){assert.equal(res.data.riskLevel,'medium');assert(res.data.content.includes('遵医嘱'));assert(res.data.content.includes('不要自行用药或停药'));}else assert.equal(res.data.riskLevel,'high');risks.push({question:text,...res.data});console.log('PASS risk '+text+' -> '+res.data.riskLevel+'\n'+res.data.content);
 }
 assert.equal((await dispatcher.dispatch('请结合周期和焦虑帮我制定备孕计划')).data.meta.type,'A');
 assert.equal((await dispatcher.dispatch('用药让我感到压力，月经也变了')).data.meta.type,'D');
 const original=api.sendChatMessage;
 try{
  api.sendChatMessage=dispatcher.dispatch;
  const chat=page();chat.onWelcomeCardTap({currentTarget:{dataset:{question:'帮我制定一个备孕计划'}}});await settle(chat);chat.onWelcomeCardTap({currentTarget:{dataset:{question:'备孕知识科普'}}});await settle(chat);assert.equal(chat.data.showHandoffBanner,false);assert.equal(chat.data.unresolvedStreak,0);
  const answer=chat.data.messages.filter(m=>m.role==='assistant')[0];assert(answer.riskNotice);
  chat.openFeedback({currentTarget:{dataset:{id:answer.id}}});assert.equal(chat.data.feedbackPositive,false);assert.equal(chat.data.feedbackTags.length,7);chat.toggleFeedbackTag({currentTarget:{dataset:{index:0}}});chat.submitFeedback();assert(chat.data.messages.find(m=>m.id===answer.id).dissatisfied);assert.equal(chat.data.handoffReason,'feedback_rephrase');assert.equal(chat.data.showHandoffBanner,true);
  chat.onHandoffBannerAction();assert.equal(chat.data.inputFocused,true);
  chat.openFeedback({currentTarget:{dataset:{id:answer.id,positive:false}}});chat.toggleFeedbackTag({currentTarget:{dataset:{index:1}}});chat.submitFeedback();assert.equal(chat.data.handoffReason,'feedback_medical');
  const highPage=page();highPage.sendMessage(risks[0].question);await settle(highPage);assert.equal(highPage.data.showHandoffBanner,false);assert.equal(highPage.data.messages.at(-1).riskLevel,'high');
  highPage.openFeedback({currentTarget:{dataset:{id:highPage.data.messages.at(-1).id,positive:false}}});highPage.toggleFeedbackTag({currentTarget:{dataset:{index:1}}});highPage.submitFeedback();assert.equal(highPage.data.showHandoffBanner,false);
  const plan=page();plan.data.assessmentReport={suggestions:['记录生活与周期变化','出现不适时按已有建议咨询']};plan.data.reportAnalysis=[{title:'周期状态',content:'周期不规律，近期焦虑'}];let routed=false;api.sendChatMessage=()=>{routed=true;throw Error('must not route')};plan.onPlanFromReport();assert.equal(routed,false);assert.equal(plan.data.messages.at(-1).type,'plan');assert(plan.data.messages.at(-1).content.endsWith('Demo 规则模板，仅供参考。'));
  const failure=page();api.sendChatMessage=async()=>({code:1});failure.sendMessage('测试失败');await settle(failure);assert(toasts.includes('暂时无法回复，请稍后重试'));
  failure.onCardAction({detail:{action:'continue'}});assert.equal(failure.data.inputFocused,true);
 }finally{api.sendChatMessage=original;}
 const source=fs.readFileSync(path.join(root,'components/AIMessageCard/AIMessageCard.wxml'),'utf8');assert(source.includes('以上为备孕科普参考，不替代医生诊断。'));
 fs.writeFileSync(path.join(root,'design-reference/review-fixes/self-test-output.json'),JSON.stringify({presetCount:23,unmatched:0,presets:results,risks},null,2)+'\n');
 console.log('PASS 23/23 entries, 0 unmatched; risk priority, feedback, no duplicate banner, plan bypass, focus and API failure');
})().catch(e=>{console.error(e);process.exitCode=1;});
