const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{createRequire}=require('node:module');
let definition,clock=0,id=0,fail=false;const timers=new Map();class ClockDate extends Date{static now(){return clock;}}
const file=require.resolve('../pages/chat/chat'),nativeRequire=createRequire(file);const api={submitAssessment:async()=>{if(fail)throw Error('synthetic failure');return {code:0,data:{assessmentId:'test'}};},getReportDetail:async()=>({code:0,data:{}})};
const wx={showToast(){},nextTick:fn=>fn()};vm.runInNewContext(fs.readFileSync(file,'utf8'),{Page:d=>definition=d,require:id=>id==='../../utils/api.js'?api:id==='../../utils/chatMemory.js'?{save(){}}:nativeRequire(id),wx,Date:ClockDate,setTimeout:(fn,delay)=>{timers.set(++id,{fn,delay});return id;},clearTimeout:key=>timers.delete(key)});
function page(){return {...definition,data:JSON.parse(JSON.stringify(definition.data)),drawRadar(){},refreshScrollShortcut(){},setData(d,cb){Object.assign(this.data,d);if(cb)cb();}};}
async function settle(){for(let i=0;i<15;i++)await Promise.resolve();}function tick(){const [key,timer]=timers.entries().next().value;timers.delete(key);clock+=timer.delay;timer.fn();}
function fill(p){p.setData({pageMode:'assessment',assessmentMode:'quiz',assessmentAnswers:Array.from({length:6},()=>({title:'合成测试',indices:[0],answer:'A.测试'}))});p.setQuestion(5);}
(async()=>{
 const p=page();p.openReportDimensions();assert(!p.data.dimensionsMotionPlaying);assert.equal(timers.size,0);fill(p);const pending=p.confirmAssessment();await settle();tick();await pending;assert.equal(p.data.assessmentMode,'result');assert.equal(p.data.showDimensions,false);assert.equal(p.data.dimensionsMotionPlaying,false);assert.equal(timers.size,0);
 p.openReportDimensions();assert(p.data.showDimensions);assert(p.data.dimensionsMotionPlaying);assert.equal(timers.size,1);p.onDimensionsMotionLoaded();assert.equal([...timers.values()][0].delay,2800);p.onDimensionsMotionLoaded();assert.equal(timers.size,1);p.stopDimensionsMotion();assert(!p.data.dimensionsMotionPlaying);assert(p.data.showDimensions);assert.equal(timers.size,0);
 p.openReportDimensions();assert(p.data.dimensionsMotionPlaying);tick();assert(!p.data.dimensionsMotionPlaying);assert(p.data.showDimensions);
 p.openReportDimensions();p.closeReportDimensions();assert(!p.data.dimensionsMotionPlaying);assert(!p.data.showDimensions);assert.equal(timers.size,0);
 p.openReportDimensions();p.onHide();assert(!p.data.dimensionsMotionPlaying);assert.equal(timers.size,0);
 p.openReportDimensions();p.onUnload();assert.equal(timers.size,0);p.openReportDimensions();assert.equal(timers.size,0);
 const failed=page();fill(failed);fail=true;await failed.confirmAssessment();assert(!failed.data.dimensionsMotionPlaying);assert(!failed.data.showDimensions);
 const template=fs.readFileSync(path.join(__dirname,'../pages/chat/chat.wxml'),'utf8');
 assert(!template.includes('assessment-celebration-mask'));assert(!template.includes('<video'));assert(!template.includes('dimensions-ip-motion.gif'));
 assert(template.includes('/images/campaign/dimensions-ip-clean.png'));assert(template.includes('bindload="onDimensionsMotionLoaded"'));
 assert.equal(p.data.dimensionsConfetti.length,10);
 for(const piece of p.data.dimensionsConfetti)assert(piece.duration+piece.delay<=2800);
 const css=fs.readFileSync(path.join(__dirname,'../pages/chat/chat.wxss'),'utf8');
 const motion=css.slice(css.indexOf('/* Independent crisp mascot'),css.indexOf('.radar-stage'));
 assert(!motion.includes('blur('));assert(motion.includes('animation-iteration-count:1'));assert(motion.includes('radial-gradient'));
 const png=fs.readFileSync(path.join(__dirname,'../images/campaign/dimensions-ip-clean.png'));assert.equal(png.readUInt32BE(16),630);assert.equal(png.readUInt32BE(20),558);
 console.log('PASS no popup after assessment, transparent silent IP starts only on opening dimensions, replays on each entry, ends/error restores static, close/hide/unload clean up; original report and geometry retained');
})().catch(e=>{console.error(e);process.exitCode=1});
