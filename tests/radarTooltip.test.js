const assert=require('node:assert/strict');
const {buildAssessmentReport}=require('../utils/assessmentReport');
const {tooltipPosition}=require('../utils/radarTooltip');
const answers=values=>values.map(i=>({indices:Array.isArray(i)?i:[i]}));
for(const [cycle,tone] of [[0,'stable'],[1,'general'],[2,'attention'],[3,'unknown']])assert.equal(buildAssessmentReport(answers([0,0,cycle,1,0,0])).indicators[0].tone,tone);
const high=buildAssessmentReport(answers([0,0,0,1,0,1]));assert.equal(high.score,85);assert.equal(high.indicators[3].tone,'attention');assert(high.indicators[3].tooltip.includes('异常出血'));
const pain=buildAssessmentReport(answers([0,0,0,1,0,[1,2,3]]));assert(pain.indicators[3].tooltip.includes('持续疼痛'));
assert.equal(buildAssessmentReport(answers([0,0,0,3,0,0])).indicators[1].tone,'unknown');
for(const width of [240,280,320,375,414])for(const x of [0,width/2,width])for(const y of [0,20,100,190])for(const text of ['基本规律 · 状态稳定','明显或持续疼痛 · 建议及时咨询']){const p=tooltipPosition({x,y},width,190,text);assert(p.left>=8&&p.left+p.width<=width-8);assert(p.top>=8&&p.top+(text.length>14?46:28)<=182);assert(p.pointerLeft>=12&&p.pointerLeft<=p.width-12);}
console.log('PASS all tooltip states, symptom priority, unknowns and edge clamping');
