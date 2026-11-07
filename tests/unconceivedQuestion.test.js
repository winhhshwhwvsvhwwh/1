const assert = require('node:assert/strict');
global.wx = {getStorageSync: () => []};
const dispatcher = require('../utils/skillDispatcher');
const basic = require('../utils/skills/basicConsultationSkill');
const questions = [
  '备孕一年都没怀上孕怎么办', '备孕一年都没怀上怎么办？',
  '备孕1年没有怀上怎么办', '备孕十二个月还没怀上，怎么办？',
  '备孕12个月仍未孕怎么办', '备孕一年没有怀孕怎么办',
  '我一直怀不上怎么办', '备孕一年没怀孕有点焦虑怎么办',
  '你好，我备孕一年都没怀上孕怎么办', '备孕 一年 都没怀上孕 怎么办？'
];
(async () => {
  for (const question of questions) {
    const result = await dispatcher.dispatch(question);
    assert.equal(result.code, 0);
    assert.notEqual(result.data.meta.type, 'BASIC', question);
    assert.equal(result.data.riskLevel, 'medium', question);
    assert(result.data.content.includes('35岁'), question);
    assert(result.data.content.includes('12个月'), question);
    assert(result.data.content.includes('6个月'), question);
    assert(result.data.content.includes('双方'), question);
    assert(result.data.content.includes('女方年龄'), question);
    assert(!result.data.content.includes('当然可以'), question);
    assert(!result.data.content.includes('没有找到直接对应'), question);
    assert(!result.data.content.includes('不要等待Demo回复'), question);
    console.log('PASS ' + question + ' → 生育评估说明（非急症）');
  }
  for (const question of ['怎么办？', '我想咨询一下', '帮帮我！', '我想了解备孕']) {
    assert.equal(basic.handle(question).need_routing, false);
  }
  assert.equal(basic.handle('胳膊不舒服怎么办').need_routing, true);
  assert.equal(basic.handle('备孕一年都没怀上孕怎么办').need_routing, true);
  for (const question of ['备孕一年没怀上，阴道大量出血肚子剧痛怎么办', '备孕一年未孕，我下腹疼痛还有出血怎么办']) {
    const result = await dispatcher.dispatch(question);
    assert.equal(result.data.riskLevel, 'high');
    assert(result.data.content.includes('就医'));
    assert(!result.data.analysis.includes('通常未满35岁'));
  }
  const hcg = await dispatcher.dispatch('早孕试纸阴性就一定没怀孕吗？');
  assert(hcg.data.meta.faqIds.includes('test-hcg'));
  assert(!hcg.data.meta.faqIds.includes('plan-duration'));
  console.log('PASS bare vague messages preserved; concrete questions route onward; urgent symptoms still take priority');
})().catch(error => { console.error(error); process.exitCode = 1; });
