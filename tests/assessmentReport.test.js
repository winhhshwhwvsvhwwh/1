const assert = require('node:assert/strict');
const { buildAssessmentReport } = require('../utils/assessmentReport');
const answer = values => values.map(value => ({ indices: Array.isArray(value) ? value : [value] }));
assert.equal(buildAssessmentReport(answer([0,0,0,1,1,0])).score,93);
for(const scoreCase of [[0,1,0,0],[1,1,1,1],[2,0,2,2],[2,0,3,2]]){
 const [cycle,period,life,symptoms]=scoreCase;
 const result=buildAssessmentReport(answer([0,0,cycle,period,life,symptoms]));
 assert.equal(result.pointerAngle,135-result.score*2.7);
 assert.equal(result.indicators.reduce((s,i)=>s+i.points,0),result.score);
}
const seen=new Set();let count=0;
for(let cycle=0;cycle<4;cycle++)for(let period=0;period<4;period++)for(let life=0;life<4;life++)for(const symptoms of [[0],[1],[2],[3],[1,2],[1,3],[2,3],[1,2,3]]){
 const r=buildAssessmentReport(answer([0,0,cycle,period,life,symptoms]));count++;
 if(cycle===3||period===3){assert.equal(r.score,null);assert.equal(r.pointerAngle,null);assert.equal(r.label,'信息待补充');}
 else {assert(r.score>=0&&r.score<=100);assert.equal(r.indicators.reduce((s,i)=>s+i.points,0),r.score);seen.add(r.label);assert(r.pointerAngle>=-135&&r.pointerAngle<=135);}
 if(symptoms.includes(1))assert(r.suggestions[0].includes('非经期出血'));
 if(symptoms.includes(2))assert(r.priority.some(s=>s.includes('持续疼痛')));
}
assert.equal(seen.size,4);
const highRisk=buildAssessmentReport(answer([0,3,0,1,0,1]));assert.equal(highRisk.score,85);assert(highRisk.suggestions[0].includes('非经期出血'));assert(highRisk.priority.some(s=>s.includes('超过12个月')));
const older=buildAssessmentReport(answer([3,2,0,1,0,0]));assert(older.priority.some(s=>s.includes('35岁')));
assert.equal(buildAssessmentReport(answer([0,0,0,1,0,[1,2]])).score,80);
assert.throws(()=>buildAssessmentReport(answer([0,0,0,1,0,[0,1]])));
assert.throws(()=>buildAssessmentReport([]));
console.log(`PASS ${count} answer combinations; all bands, unknowns, symptom overrides, multi-select and pointer mapping`);
