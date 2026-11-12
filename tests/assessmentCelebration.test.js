const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{createRequire}=require('node:module');
let definition,clock=0,id=0,fail=false;const timers=new Map(),toasts=[];class ClockDate extends Date{static now(){return clock;}}
const file=require.resolve('../pages/chat/chat'),nativeRequire=createRequire(file);const api={submitAssessment:async()=>{if(fail)throw Error('synthetic failure');return {code:0,data:{assessmentId:'test'}};},getReportDetail:async()=>({code:0,data:{}})};
const wx={showToast:o=>toasts.push(o.title)};
vm.runInNewContext(fs.readFileSync(file,'utf8'),{Page:d=>definition=d,require:id=>id==='../../utils/api.js'?api:id==='../../utils/chatMemory.js'?{save(){}}:nativeRequire(id),wx,Date:ClockDate,setTimeout:(fn,delay)=>{timers.set(++id,{fn,delay});return id;},clearTimeout:key=>timers.delete(key)});
const page=()=>({...definition,data:JSON.parse(JSON.stringify(definition.data)),setData(d,cb){Object.assign(this.data,d);if(cb)cb();}});
async function settle(){for(let i=0;i<15;i++)await Promise.resolve();}function tick(){const [key,timer]=timers.entries().next().value;timers.delete(key);clock+=timer.delay;timer.fn();}
function fill(p){p.setData({pageMode:'assessment',assessmentMode:'quiz',assessmentAnswers:Array.from({length:6},()=>({title:'合成测试',indices:[0],answer:'A.测试'}))});p.setQuestion(5);}
(async()=>{
 const p=page();fill(p);let pending=p.confirmAssessment();await settle();assert.equal(p.data.showAssessmentCelebration,false);assert(p.data.assessmentSubmitting);tick();await pending;assert.equal(p.data.assessmentMode,'result');assert.equal(p.data.showAssessmentCelebration,true);assert.equal(timers.size,1);tick();assert.equal(p.data.showAssessmentCelebration,false);
 pending=p.confirmAssessment();await settle();tick();await pending;assert(p.data.showAssessmentCelebration);p.closeAssessmentCelebration();assert.equal(timers.size,0);assert.equal(p.data.assessmentMode,'result');
 p.startAssessmentCelebration();p.onAssessmentCelebrationError();assert(!p.data.showAssessmentCelebration);assert.equal(timers.size,0);assert(toasts.at(-1).includes('评估结果已生成'));
 p.startAssessmentCelebration();p.onHide();assert(!p.data.showAssessmentCelebration);assert.equal(timers.size,0);
 p.startAssessmentCelebration();p.onUnload();assert.equal(timers.size,0);p.startAssessmentCelebration();assert.equal(timers.size,0);
 const failed=page();fill(failed);fail=true;await failed.confirmAssessment();assert(!failed.data.showAssessmentCelebration);assert(!failed.data.assessmentSubmitting);assert.equal(timers.size,0);
 const template=fs.readFileSync(path.join(__dirname,'../pages/chat/chat.wxml'),'utf8');assert(template.includes('muted="{{true}}"'));assert(template.includes('loop="{{false}}"'));assert(template.includes('bindended="closeAssessmentCelebration"'));assert(template.includes('aria-label="跳过动效"'));const media=fs.readFileSync(path.join(__dirname,'../videos/assessment-complete-2x.mp4'));assert.equal(media.toString('ascii',4,8),'ftyp');
 console.log('PASS assessment success only, every completion replays once, fallback/skip/error/hide/unload clean up, result preserved, muted non-looping local MP4; media timing/audio verified separately with ffprobe');
})().catch(e=>{console.error(e);process.exitCode=1});
