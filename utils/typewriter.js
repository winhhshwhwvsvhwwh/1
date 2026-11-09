// Display-only typing: Unicode characters stay intact, originals remain available for copying.
function fieldsLength(fields) {
  return Object.values(fields).reduce((sum,value)=>sum+(Array.isArray(value)?value:[value]).reduce((n,text)=>n+Array.from(text||'').length,0),0);
}
function typingFrame(fields, count) {
  let remaining=Math.max(0,count);const result={};
  for(const [key,value] of Object.entries(fields)){
    const values=Array.isArray(value)?value:[value];const visible=[];
    for(const text of values){const chars=Array.from(text||'');const part=chars.slice(0,remaining).join('');remaining=Math.max(0,remaining-chars.length);if(part)visible.push(part);else if(!Array.isArray(value))visible.push('');}
    result[key]=Array.isArray(value)?visible:(visible[0]||'');
  }
  return result;
}
function startTypewriter(fields,onFrame,onDone,options={}) {
  const total=fieldsLength(fields),clock=options.clock||Date.now,setTimer=options.setTimer||setTimeout,clearTimer=options.clearTimer||clearTimeout;
  const duration=Math.min(15000,total*24);const start=clock();let timer=null,ended=false;
  const complete=()=>{if(ended)return;ended=true;if(timer!==null)clearTimer(timer);onFrame(typingFrame(fields,total));onDone();};
  const tick=()=>{if(ended)return;const elapsed=clock()-start;const count=Math.min(total,Math.max(1,Math.floor(total*elapsed/Math.max(duration,1))));onFrame(typingFrame(fields,count));if(count>=total){complete();return;}timer=setTimer(tick,24);};
  onFrame(typingFrame(fields,0));
  if(total)timer=setTimer(tick,24);else complete();
  return {finish:complete,cancel(){ended=true;if(timer!==null)clearTimer(timer);}};
}
module.exports={fieldsLength,typingFrame,startTypewriter};
