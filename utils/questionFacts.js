// Facts stated in this message only; never infer age, duration or symptoms from missing data.
function chineseNumber(text) {
  if (/^\d+$/.test(text)) return Number(text);
  const digits={一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};
  if(text==='十') return 10;
  if(text.includes('十')){const [a,b]=text.split('十');return (a?digits[a]:1)*10+(b?digits[b]:0);}
  return digits[text] || null;
}
function extractFacts(content) {
  const text=String(content||'');
  const candidate=text.match(/(\d{1,2})\s*岁/);
  const ageMatch=candidate&&!/男方|老公|丈夫|先生|不是|并非/.test(text.slice(Math.max(0,candidate.index-6),candidate.index))?candidate:null;
  const duration=text.match(/(?:备孕|未避孕(?:性生活)?|尝试)(?:已经|已|了|有|大概|约|持续|规律|满|\s)*((?:\d+|[一二两三四五六七八九十]+)(?:个)?(?:月|年)|半年)/);
  let months=null;
  if(duration){if(duration[1]==='半年')months=6;else{const value=chineseNumber(duration[1].replace(/个|月|年/g,''));if(value)months=value*(duration[1].endsWith('年')?12:1);}}
  const cycle=text.match(/周期(?:长度)?(?:一般|通常)?(?:是|为|约|大概|有)?\s*(\d{2})\s*天/);
  const length=cycle?Number(cycle[1]):null;
  return {age:ageMatch?Number(ageMatch[1]):null,durationMonths:months,durationText:duration?duration[1]:'',cycleLength:length&&length>=15&&length<=90?length:null};
}
function durationAdvice(content, fallback) {
  const f=extractFacts(content),known=[];
  if(f.age!==null)known.push(`女方年龄${f.age}岁`);
  if(f.durationMonths!==null)known.push(`备孕${f.durationText}（${f.durationMonths}个月）`);
  let answer=fallback;
  if(f.age!==null&&f.durationMonths!==null){
    const threshold=f.age<35?12:6;
    answer=f.durationMonths>=threshold
      ? '如果这段时间有规律未避孕性生活且仍未孕，已达到通常建议安排双方生育相关评估的时间点；这不等于不孕诊断，具体检查由医生结合双方情况决定。'
      : '不能仅凭这段备孕时长判断生育能力；是否需要评估还应结合规律未避孕性生活、双方病史和症状，有不适或已知相关疾病时可提前咨询。';
  }
  const questions=[];
  if(f.age===null)questions.push('女方年龄大致是多少？');
  if(f.durationMonths===null)questions.push('规律未避孕尝试多久？');
  questions.push('这段时间是否有规律未避孕性生活，是否有相关病史或不适？');
  return {answer:(known.length?'你已提供：'+known.join('，')+'。\n':'')+answer,questions};
}
function durationSuggestions(content, suggestions){
  return extractFacts(content).durationMonths===null?suggestions:suggestions.map((text,index)=>index===0?'整理双方既往病史、检查及用药情况，并确认是否有规律未避孕性生活。':text);
}
function cycleWindow(length){const day=length-14;return `按你提供的平均周期${length}天粗略估算，排卵日可能在周期第${Math.max(1,day-2)}—${day+2}天附近。估算，仅供参考；实际排卵可能提前或推迟，不能据此确认排卵、怀孕或用于避孕。`;}
function emotionPrefix(content){return /焦虑|担心|害怕|紧张|压力|难过|崩溃|好烦/.test(content)?'能理解你现在有些担心。':'';}
module.exports={extractFacts,durationAdvice,durationSuggestions,cycleWindow,emotionPrefix};
