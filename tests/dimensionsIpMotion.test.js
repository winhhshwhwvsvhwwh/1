const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{createRequire}=require('node:module');
let definition,clock=0,id=0,fail=false;const timers=new Map();class ClockDate extends Date{static now(){return clock;}}
const file=require.resolve('../pages/chat/chat'),nativeRequire=createRequire(file);const api={submitAssessment:async()=>{if(fail)throw Error('synthetic failure');return {code:0,data:{assessmentId:'test'}};},getReportDetail:async()=>({code:0,data:{}})};
const wx={showToast(){},nextTick:fn=>fn()};vm.runInNewContext(fs.readFileSync(file,'utf8'),{Page:d=>definition=d,require:id=>id==='../../utils/api.js'?api:id==='../../utils/chatMemory.js'?{save(){}}:nativeRequire(id),wx,Date:ClockDate,setTimeout:(fn,delay)=>{timers.set(++id,{fn,delay});return id;},clearTimeout:key=>timers.delete(key)});
function page(){return {...definition,data:JSON.parse(JSON.stringify(definition.data)),drawRadar(){},refreshScrollShortcut(){},setData(d,cb){Object.assign(this.data,d);if(cb)cb();}};}
async function settle(){for(let i=0;i<15;i++)await Promise.resolve();}function tick(){const [key,timer]=timers.entries().next().value;timers.delete(key);clock+=timer.delay;timer.fn();}
function fill(p){p.setData({pageMode:'assessment',assessmentMode:'quiz',assessmentAnswers:Array.from({length:6},()=>({title:'合成测试',indices:[0],answer:'A.测试'}))});p.setQuestion(5);}
(async()=>{
 const p=page();p.openReportDimensions();assert(!p.data.dimensionsMotionPlaying);assert.equal(timers.size,0);fill(p);const pending=p.confirmAssessment();await settle();tick();await pending;assert.equal(p.data.assessmentMode,'result');assert.equal(p.data.showDimensions,false);assert.equal(p.data.dimensionsMotionPlaying,false);assert.equal(timers.size,0);
 p.openReportDimensions();assert(p.data.showDimensions);assert(p.data.dimensionsMotionPlaying);assert.equal(timers.size,1);p.onDimensionsMotionLoaded();assert.equal([...timers.values()][0].delay,5100);p.onDimensionsMotionLoaded();assert.equal(timers.size,1);p.stopDimensionsMotion();assert(!p.data.dimensionsMotionPlaying);assert(p.data.showDimensions);assert.equal(timers.size,0);
 p.openReportDimensions();assert(p.data.dimensionsMotionPlaying);tick();assert(!p.data.dimensionsMotionPlaying);assert(p.data.showDimensions);
 p.openReportDimensions();p.closeReportDimensions();assert(!p.data.dimensionsMotionPlaying);assert(!p.data.showDimensions);assert.equal(timers.size,0);
 p.openReportDimensions();p.onHide();assert(!p.data.dimensionsMotionPlaying);assert.equal(timers.size,0);
 p.openReportDimensions();p.onUnload();assert.equal(timers.size,0);p.openReportDimensions();assert.equal(timers.size,0);
 const failed=page();fill(failed);fail=true;await failed.confirmAssessment();assert(!failed.data.dimensionsMotionPlaying);assert(!failed.data.showDimensions);
 const template=fs.readFileSync(path.join(__dirname,'../pages/chat/chat.wxml'),'utf8');assert(!template.includes('assessment-celebration-mask'));assert(!template.includes('role="dialog"'));assert(template.includes('/images/campaign/dimensions-ip-motion.gif'));assert(template.includes('bindload="onDimensionsMotionLoaded"'));assert(!template.includes('<video'));assert(template.includes('binderror="stopDimensionsMotion"'));assert(template.includes('wx:else class="dimensions-ip"'));assert.equal(fs.readFileSync(path.join(__dirname,'../images/campaign/dimensions-ip-motion.gif')).toString('ascii',0,6),'GIF89a');

 // Parse the packaged GIF, so a single-frame export cannot silently pass this regression check.
 const gif=fs.readFileSync(path.join(__dirname,'../images/campaign/dimensions-ip-motion.gif'));let cursor=13,frames=0,duration=0;
 if(gif[10]&128)cursor+=3*(2**((gif[10]&7)+1));
 while(cursor<gif.length&&gif[cursor]!==0x3b){
  if(gif[cursor]===0x21){if(gif[cursor+1]===0xf9)duration+=gif.readUInt16LE(cursor+4)*10;cursor+=2;}
  else if(gif[cursor]===0x2c){const flags=gif[cursor+9];cursor+=10;if(flags&128)cursor+=3*(2**((flags&7)+1));cursor++;frames++;}
  else throw Error('Unexpected GIF block');
  while(gif[cursor])cursor+=gif[cursor]+1;cursor++;
 }
 assert.equal(frames,50);assert.equal(duration,5040);assert(!template.includes('dimensions-ip-motion.webp'));
 console.log('PASS no popup after assessment, transparent silent IP starts only on opening dimensions, replays on each entry, ends/error restores static, close/hide/unload clean up; original report and geometry retained');
})().catch(e=>{console.error(e);process.exitCode=1});
