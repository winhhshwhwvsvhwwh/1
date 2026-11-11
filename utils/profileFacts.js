// Suggestions for confirmation only. Never infer facts from assistant text or hypothetical questions.
const LABELS={age:'年龄（岁）',preparingMonths:'备孕时长（月）',cycleLength:'平均周期（天）',periodLength:'经期长度（天）'};
function extract(text){
 if(typeof text!=='string'||!(/我|记住|年龄/.test(text))||/如果|假如|比如|例如|朋友|别人|她|他|不是|并非/.test(text))return {};
 const result={};let m;
 if((m=text.match(/(?:我(?:今年)?|年龄[是为：:]?)\s*(\d{2})\s*岁/))){const n=+m[1];if(n>=18&&n<=80)result.age=n;}
 if((m=text.match(/备孕(?:了|已经|时长[是为：:]?)?\s*(\d{1,3})\s*个?月/))&&+m[1]<=240)result.preparingMonths=+m[1];
 else if((m=text.match(/备孕(?:了|已经)?\s*(一年半|三个月|半年|一年|两年)/)))result.preparingMonths={'三个月':3,'半年':6,'一年':12,'两年':24,'一年半':18}[m[1]];
 if((m=text.match(/(?:平均)?周期(?:长度)?(?:是|为|：|:)?\s*(\d{2})\s*天/))&&+m[1]>=15&&+m[1]<=90)result.cycleLength=+m[1];
 if((m=text.match(/经期(?:长度|持续)?(?:是|为|：|:)?\s*(\d{1,2})\s*天/))&&+m[1]>=1&&+m[1]<=20)result.periodLength=+m[1];
 return result;
}
function describe(profile){const record=profile.cycleRecord;const recordText=record?'\n周期记录：'+record.startDate+' 至 '+record.endDate+'；周期'+record.cycleLength+'天，经期'+record.periodLength+'天；状态：'+(record.symptoms.join('、')||'未选') : '';return (Object.keys(LABELS).filter(k=>profile[k]!==undefined).map(k=>LABELS[k]+'：'+profile[k]).join('\n')+recordText)||'还没有保存个人档案。';}
module.exports={extract,describe};
