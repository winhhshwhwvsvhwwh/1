const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{createRequire}=require('node:module');
let definition,clock=0,id=0,navigations=0;const timers=new Map(),toasts=[];
const wx={getStorageSync:()=>[],setStorageSync(){},nextTick:fn=>fn(),showToast:o=>toasts.push(o.title),navigateTo:()=>navigations++};global.wx=wx;
const file=require.resolve('../pages/chat/chat'),nativeRequire=createRequire(file);class TestDate extends Date{static now(){return clock;}}
vm.runInNewContext(fs.readFileSync(file,'utf8'),{Page:d=>definition=d,require:nativeRequire,wx,Date:TestDate,setTimeout:(fn,delay)=>{timers.set(++id,{fn,delay});return id;},clearTimeout:key=>timers.delete(key)});
function page(){return {...definition,data:JSON.parse(JSON.stringify(definition.data)),setData(d,cb){Object.assign(this.data,d);if(cb)cb();}};}
function tick(){const [key,timer]=timers.entries().next().value;timers.delete(key);clock+=timer.delay;timer.fn();}
async function settle(){for(let i=0;i<20;i++)await Promise.resolve();}
(async()=>{
 let p=page();const opening=p.openConsult();assert(p.data.loading);assert.equal(p.data.pageMode,'home');assert.equal(p.data.scrollToId,'chat-bottom');p.openConsult();assert.equal(timers.size,1);tick();await opening;assert.equal(p.data.loading,false);assert.equal(p.data.pageMode,'consult');
 p=page();const assessment=p.openAssessment();assert(p.data.loading);tick();await assessment;assert.equal(p.data.assessmentMode,'intro');const quiz=p.beginAssessment();assert(p.data.loading);tick();await quiz;assert.equal(p.data.assessmentMode,'quiz');assert(p.data.currentQuestion.title);p.selectAssessmentOption({currentTarget:{dataset:{index:0}}});const next=p.confirmAssessment();assert(p.data.loading);assert.equal(p.data.questionIndex,0);tick();await next;assert.equal(p.data.questionIndex,1);
 const api=nativeRequire('../../utils/api.js'),oldSubmit=api.submitAssessment,oldReport=api.getReportDetail;
 api.submitAssessment=async()=>({code:0,data:{assessmentId:'synthetic'}});api.getReportDetail=async()=>({code:0,data:{}});
 for(let q=1;q<5;q++){p.selectAssessmentOption({currentTarget:{dataset:{index:0}}});const changing=p.confirmAssessment();tick();await changing;}
 p.selectAssessmentOption({currentTarget:{dataset:{index:0}}});const final=p.confirmAssessment();await settle();assert(p.data.loading);assert(p.data.assessmentSubmitting);tick();await final;assert.equal(p.data.assessmentMode,'result');assert.equal(p.data.loading,false);assert.equal(p.data.assessmentSubmitting,false);assert.equal(p.data.dimensionsMotionPlaying,false);
 api.submitAssessment=oldSubmit;api.getReportDetail=oldReport;
 p=page();p.openRecordPage();assert(p.data.loading);assert.equal(navigations,0);tick();assert.equal(navigations,1);
 p=page();const report=p.onReportClick();assert(p.data.loading);tick();await report;assert(p.data.showImagePicker||toasts.includes('报告图片识别暂未开启'));
 p=page();p.data.assessmentReport={suggestions:['保持规律作息']};p.data.reportAnalysis=[{title:'周期状态',content:'规律'}];const plan=p.onPlanFromReport();assert(p.data.loading);assert.equal(p.data.messages.length,1);assert.equal(p.data.messages[0].role,'user');tick();await plan;assert.equal(p.data.messages.length,2);assert.equal(p.data.messages[1].type,'plan');assert.equal(p.data.messages[1].animate,true);
 p=page();const cancelled=p.openConsult();p.onPageBack();assert.equal(await cancelled,false);assert.equal(p.data.loading,false);assert.equal(timers.size,0);assert.equal(p.data.pageMode,'home');
 p=page();const hidden=p.openConsult();p.onHide();assert.equal(await hidden,false);assert.equal(p.data.loading,false);assert.equal(timers.size,0);
 p=page();p.onVoiceSend({detail:{tempFilePath:'synthetic.wav',duration:1}});assert(p.data.loading);assert.equal(p.data.messages.length,1);tick();assert.equal(p.data.messages.length,2);assert.equal(p.data.loading,false);assert.equal(p.data.messages[1].animate,true);
 p=page();p.data.pendingImage='synthetic.jpg';p.data.pendingCaption='排卵试纸结果';p.onImagePreviewSend();await settle();assert(p.data.loading);assert.equal(p.data.messages.length,1);assert(timers.size);tick();await settle();assert.equal(p.data.loading,false);assert.equal(p.data.messages.length,2);
 assert.equal(timers.size,0);
 console.log('PASS shared thinking for consultation/assessment/question progression/record/report entry/plan/image/voice; duplicate taps blocked; back/hide cancel pending actions; answers retain typing');
})().catch(e=>{console.error(e);process.exitCode=1});
