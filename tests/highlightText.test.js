const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {createRequire} = require('node:module');
const {highlightText} = require('../utils/highlightText');
const joined = spans => spans.map(span => span.text).join('');
const highlighted = spans => spans.filter(span => span.highlighted).map(span => span.text);
for (const text of [
  '请遵医嘱，不要自行用药或停药，用药前咨询医生或药师。',
  '建议规律作息、均衡饮食，并记录基础体温和排卵试纸。',
  '通常未满35岁满12个月仍未孕，或35岁及以上满6个月仍未孕，可安排双方咨询。',
  '腹痛同时伴有出血，建议尽快前往妇科或急诊评估。',
  '第一行\n第二行 <script> & 普通文字', ''
]) {
  const spans = highlightText(text);
  assert.equal(joined(spans), text);
  assert(highlighted(spans).length <= 3);
}
assert(highlighted(highlightText('不要自行用药或停药')).includes('不要自行用药或停药'));
assert(!highlighted(highlightText('不要自行用药或停药')).includes('停药'));
assert.deepEqual(highlighted(highlightText('普通问题，没有预设重点')), []);
assert(highlighted(highlightText('规律作息、均衡饮食', 1)).length === 1);
let definition;
const file = require.resolve('../components/AIMessageCard/AIMessageCard.js');
vm.runInNewContext(fs.readFileSync(file, 'utf8'), {Component: value => definition = value, require:createRequire(file)});
const state = {properties:{understanding:'请保持规律作息', analysis:'请遵医嘱，不要自行用药或停药。', fallbackContent:'', threshold:5, suggestions:['记录周期记录和基础体温']}, data:{}, setData(d){Object.assign(this.data,d)}, triggerEvent(name,data){this.lastEvent={name,data}}};
definition.methods.computeCollapse.call(state);
assert.equal(state.data.isLong, true);
assert.equal(joined(state.data.previewSegments), state.data.previewText);
assert.equal(joined(state.data.understandingSegments), state.properties.understanding);
assert.equal(joined(state.data.analysisSegments), state.properties.analysis);
assert.equal(joined(state.data.suggestionRows[0].segments), state.properties.suggestions[0]);
assert.equal(highlighted(state.data.suggestionRows[0].segments).length,1);
definition.methods.onToggleExpand.call(state); assert.equal(state.data.expanded,true);
definition.methods.onActionTap.call(state,{currentTarget:{dataset:{action:'continue'}}}); assert.equal(state.lastEvent.data.action,'continue');
state.properties={understanding:'', analysis:'', fallbackContent:'旧消息：请遵医嘱。', threshold:120, suggestions:[]};
definition.methods.computeCollapse.call(state);
assert.equal(joined(state.data.fallbackSegments), state.properties.fallbackContent);
assert(highlighted(state.data.fallbackSegments).includes('遵医嘱'));
assert.equal(state.data.suggestionRows.length,0);
assert(Object.keys(definition.observers)[0].includes('suggestions'));
console.log('PASS unchanged text, limited emphasis, complete negative instructions, old messages, collapsed preview, suggestions and existing actions');
