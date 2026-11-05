// utils/skills/emotionSkill.js
// 类型C｜情绪陪伴Skill（对应 PRD 8.4 Skill04）
// 输入：用户情绪表达 → 输出：三段式（情绪安慰 → 科学解释 → 行动建议）

const ragRetriever = require('../ragRetriever.js');
const userContext = require('./userContext.js');

/**
 * @param {string} content 用户输入
 * @param {object|null} latestRecord 最近一条周期记录（可能为空）
 * @returns {{ comfort: string, explanation: string, actions: string[], refIds: number[], usedUserData: boolean }}
 */
function handle(content, latestRecord) {
  // 情绪安慰：如果用户已经在坚持记录周期数据，把这份坚持真实地说出来，比泛泛的安慰更有说服力
  const shortSummary = userContext.buildShortSummary(latestRecord);
  const comfort = shortSummary
    ? `能感觉到你现在压力不小，备孕过程中有焦虑、失落的情绪是很正常的。看到你已经在坚持记录周期数据（${shortSummary}），说明你一直在很认真地对待这件事，不用太苛责自己。`
    : '能感觉到你现在压力不小，备孕过程中有焦虑、失落的情绪是很正常的，你已经在很认真地对待这件事了，不用太苛责自己。';

  // 科学解释：优先用知识库里"何时需要就医评估"的知识点做客观解释，缓解"是不是我有问题"的自责
  // 检索不到时用一句不带引用的通用安慰话（不假装这是有出处的医学结论）
  const { chunks } = ragRetriever.retrieve(content, 'C');
  const infertilityChunk = chunks.find((c) => c.topic === 'infertility_evaluation');
  const explanation = infertilityChunk
    ? infertilityChunk.text
    : '每个人的身体状况、周期规律都不一样，备孕成功所需要的时间本身就存在个体差异，短期内没有进展并不代表身体有问题，不需要用"别人多快"来衡量自己。';

  // 行动建议
  const actions = [
    '可以找伴侣、朋友或家人聊聊现在的感受，不必一个人扛着',
    '把注意力适当从"每个周期是否成功"上移开，做一些自己喜欢的事放松心情',
    '如果焦虑情绪持续影响到日常生活和睡眠，也可以考虑寻求专业心理咨询的帮助'
  ];

  return {
    skillId: 'emotion',
    comfort,
    explanation,
    actions,
    refIds: infertilityChunk ? infertilityChunk.refIds : [],
    usedUserData: !!shortSummary
  };
}

module.exports = { handle };
