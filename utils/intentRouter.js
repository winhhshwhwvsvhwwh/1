// utils/intentRouter.js
// 用户需求类型识别（对应 PRD 8.2 架构图中的"AI意图识别 → Skill调度中心"环节）
//
// 按PRD要求，把用户输入分类成互斥的5种类型，每种类型对应一个处理模块：
//   A 备孕知识咨询 → knowledgeSkill
//   B 周期分析     → cycleSkill
//   C 情绪焦虑     → emotionSkill
//   D 医疗风险     → riskSkill
//   E 人工咨询     → humanTransferSkill
//
// 当前是规则引擎版本（关键词优先级匹配），不是真正的NLU模型；
// 后续如果要换成真实模型/云函数分类，只需要替换 analyzeIntent 内部实现，
// 调用方（skillDispatcher）不需要变。

const knowledgeBase = require('./knowledgeBase.js');

// E类·人工咨询：用户主动请求人工/专家
const EXPERT_REQUEST_KEYWORDS = ['转人工', '找医生', '咨询专家', '人工客服', '真人医生'];
// E类·人工咨询：用户反馈AI没能有效解决问题
const UNRESOLVED_KEYWORDS = ['没解决我的问题', '不是这个意思', '答非所问', '没听懂'];

// C类·情绪焦虑关键词
const EMOTION_KEYWORDS = ['焦虑', '难过', '压力', '沮丧', '崩溃', '为什么别人', '好烦', '心态崩了', '想哭'];

// B类·周期分析关键词
const CYCLE_DATA_KEYWORDS = ['周期', '排卵', '月经', '基础体温', '卵泡期', '黄体期'];

const TYPE_LABEL = {
  A: '备孕知识咨询',
  B: '周期分析',
  C: '情绪焦虑',
  D: '医疗风险',
  E: '人工咨询'
};

const TYPE_TO_SKILL = {
  A: 'knowledge',
  B: 'cycle',
  C: 'emotion',
  D: 'risk',
  E: 'human_transfer'
};

/**
 * 识别用户需求类型（第一步），返回 A/B/C/D/E 中的一个，并给出对应要调用的Skill id。
 *
 * 优先级说明：
 * 1. E 人工咨询——用户明确表达要找人工/医生，或反馈AI没解决问题，这是最强信号，优先级最高
 * 2. D 医疗风险——命中风险问题库（不区分medium/high，只要沾边医疗风险就先交给专业的风险处理模块，
 *    而不是让它被情绪/知识类回答稀释掉，安全类问题优先于其他类型）
 * 3. 已命中的固定知识问句/备孕计划 → A，避免被情绪或周期词抢走
 * 4. C 情绪焦虑
 * 5. B 周期分析
 * 6. A 备孕知识咨询（默认兜底）
 *
 * @param {string} content 用户输入
 * @param {object} context { hasRecord: boolean } 是否已有周期记录数据
 */
function analyzeIntent(content, context) {
  context = context || {};
  const riskItems = knowledgeBase.matchRisk(content);
  const matchedFAQ = knowledgeBase.matchFAQ(content);
  const hasHighRisk = riskItems.some((item) => item.level === 'high');

  let type = 'A';
  let handoffReason = '';

  if (EXPERT_REQUEST_KEYWORDS.some((kw) => content.includes(kw))) {
    type = 'E';
    handoffReason = 'user_request';
  } else if (UNRESOLVED_KEYWORDS.some((kw) => content.includes(kw))) {
    type = 'E';
    handoffReason = 'unresolved';
  } else if (riskItems.length > 0) {
    type = 'D';
  } else if (/备孕计划|生活计划|用药|药/.test(content) || matchedFAQ.some(faq => faq.suggestions)) {
    type = 'A';
  } else if (EMOTION_KEYWORDS.some((kw) => content.includes(kw))) {
    type = 'C';
  } else if (CYCLE_DATA_KEYWORDS.some((kw) => content.includes(kw))) {
    type = 'B';
  }
  // 否则维持默认值 'A'

  return {
    type,
    typeLabel: TYPE_LABEL[type],
    primarySkill: TYPE_TO_SKILL[type],
    handoffReason,
    riskItems,
    matchedFAQ,
    hasHighRisk
  };
}

module.exports = { analyzeIntent, TYPE_LABEL, TYPE_TO_SKILL };
