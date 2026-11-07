const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const {createRequire} = require('node:module');
const root = path.resolve(__dirname, '..');
const storage = new Map();
const calls = [];
let pages = [];
global.wx = {
  getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, value),
  showToast: data => calls.push(data), navigateTo: data => calls.push(data),
  navigateBack: data => { calls.push('back'); data.success(); }, redirectTo: data => calls.push(data),
  showModal: data => calls.push(data),
  nextTick: callback => callback()
};
const store = require('../utils/recordStore');
const dispatcher = require('../utils/skillDispatcher');
const cycle = require('../utils/skills/cycleSkill');
function page(file) {
  let definition;
  const full = path.join(root, file);
  vm.runInNewContext(fs.readFileSync(full, 'utf8'), {
    require: createRequire(full), Page: value => definition = value, wx: global.wx,
    getCurrentPages: () => pages, setTimeout, clearTimeout
  });
  return {...definition, data: JSON.parse(JSON.stringify(definition.data)),
    setData(data, callback) { Object.assign(this.data, data); if (callback) callback(); }};
}
async function settle() { await new Promise(resolve => setTimeout(resolve, 750)); }
function dateAgo(days) {
  const date = new Date(); date.setDate(date.getDate() - days);
  return [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-');
}
(async () => {
  assert.equal(require('../utils/constants').USE_CLOUD, false);
  const noRecord = await dispatcher.dispatch('我现在处于周期哪个阶段？');
  assert.equal(noRecord.data.meta.type, 'B');
  assert(noRecord.data.content.includes('缺少记录时无法估算当前阶段'));
  assert(!/可能处于(月经期|卵泡期|排卵期|黄体期)/.test(noRecord.data.content));
  const chat = page('pages/chat/chat.js'); chat.route = 'pages/chat/chat';
  const record = page('pages/record/record.js'); pages = [chat, record];
  chat.openRecordPage(); assert.equal(calls.at(-1).url, '/pages/record/record');
  record.onLoad(); await settle(); assert.equal(record.data.interpretationRecord, null);
  record.onViewCycleInterpretation(); assert(calls.at(-1).title.includes('请先填写'));
  record.setData({startDate: dateAgo(7), endDate: dateAgo(3), cycleLength: '28', periodLength: '5'});
  record.onSave(); await settle();
  assert(record.data.savedForInterpretation);
  const saved = record.data.interpretationRecord;
  record.onViewCycleInterpretation(); await settle();
  assert.equal(chat.data.messages.at(-2).content, '我现在处于周期哪个阶段？');
  assert(chat.data.messages.at(-1).understanding.includes(saved.startDate));
  assert(chat.data.messages.at(-1).analysis.includes('根据这条记录估算，目前可能处于'));
  assert(!chat.data.messages.at(-1).content.includes('正处于'));
  console.log('PASS empty home → record → save → interpretation, without typing');

  const newer = await store.saveRecord({startDate: dateAgo(2), endDate: dateAgo(0), cycleLength: '30', periodLength:'3'});
  const existing = page('pages/record/record.js'); pages = [chat, existing];
  existing.onLoad(); await settle(); assert.equal(existing.data.interpretationRecord.id, newer.id);
  existing.onViewCycleInterpretation(); await settle();
  assert(chat.data.messages.at(-1).understanding.includes(newer.startDate));
  console.log('PASS existing home → record → interpretation uses latest dated record');

  existing.setData({startDate: dateAgo(12), endDate: dateAgo(8), cycleLength:'31', periodLength:'5'});
  existing.onSave(); await settle(); const older = existing.data.interpretationRecord;
  assert.notEqual(older.id, newer.id);
  existing.onViewCycleInterpretation(); await settle();
  assert(chat.data.messages.at(-1).understanding.includes(older.startDate));
  assert(chat.data.messages.at(-1).understanding.includes('31 天'));
  console.log('PASS just-saved older dated record is selected by ID, not silently replaced');
  const deleted = await dispatcher.dispatch('我现在处于周期哪个阶段？', {recordId: 'deleted'});
  assert(deleted.data.content.includes('缺少记录时无法估算当前阶段'));
  assert.equal(cycle.calcCyclePhase({startDate:'bad', cycleLength:28, periodLength:5}), null);
  assert.equal(cycle.calcCyclePhase({startDate:dateAgo(2), cycleLength:'', periodLength:5}), null);
  const stale = cycle.handle('我现在处于周期哪个阶段？', {startDate:dateAgo(70),endDate:dateAgo(66),cycleLength:28,periodLength:5});
  assert(stale.analysisLines.some(text => text.includes('外推')));
  pages = [existing]; existing.onViewCycleInterpretation();
  assert(calls.at(-1).url.includes('cycleRecordId='));
  const direct = page('pages/chat/chat.js'); direct.onLoad({cycleRecordId:older.id}); await settle();
  assert(direct.data.messages.at(-1).understanding.includes(older.startDate));
  console.log('PASS missing ID, invalid inputs, stale record notice and standalone return');
  const answer = chat.data.messages.at(-1);
  chat.openFeedback({currentTarget:{dataset:{id:answer.id}}});
  assert.equal(chat.data.feedbackPositive, false); assert.equal(chat.data.feedbackTags.length, 7);
  chat.toggleFeedbackTag({currentTarget:{dataset:{index:0}}}); chat.submitFeedback();
  assert.equal(chat.data.handoffReason, 'feedback_rephrase');
  assert.equal(chat.data.messages.at(-1).dissatisfied, true);
  chat.onHandoffBannerAction(); assert.equal(chat.data.inputFocused, true);
  chat.openFeedback({currentTarget:{dataset:{id:answer.id}}});
  chat.toggleFeedbackTag({currentTarget:{dataset:{index:1}}}); chat.submitFeedback();
  assert.equal(chat.data.handoffReason, 'feedback_medical');
  chat.onHandoffBannerAction(); assert.equal(calls.at(-1).title, '建议咨询专业医生');
  assert(calls.at(-1).content.includes('正规医院'));
  assert.equal(storage.get('xiaonuan_feedback').at(-1).tags[0], '内容有误');
  console.log('PASS actual feedback methods: negative default, local storage, ordinary focus and medical guidance; native keyboard pending');
})().catch(error => { console.error(error); process.exitCode = 1; });
