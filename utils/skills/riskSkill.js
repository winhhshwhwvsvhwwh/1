// utils/skills/riskSkill.js
// 类型D｜医疗风险识别Skill（对应 PRD 8.4 Skill03）
//
// 提供两个函数：
// - assessRisk(content)：判断风险等级，产出「风险提醒」文案。不管最终主类型判定是A/B/C/D/E中的哪一个，
//   这个函数的结果都会作为AI咨询接口"四段式"里固定的第4部分（风险提醒）附加在回复末尾。
// - handle(content)：当意图识别把本次问题归为类型D（医疗风险）时调用，返回标准的
//   understanding/analysisLines/suggestions结构，和knowledgeSkill/cycleSkill的返回形状一致，
//   方便skillDispatcher统一处理。

const ragRetriever = require('../ragRetriever.js');
const userContext = require('./userContext.js');

/**
 * @param {string} content 用户输入
 * @returns {{ riskLevel: 'none'|'medium'|'high', riskNotice: string, refIds: number[] }}
 */
function assessRisk(content) {
  const { chunks, hasMatch } = ragRetriever.retrieve(content, 'D');
  const riskChunks = chunks.filter((c) => c.topic === 'risk');

  if (!hasMatch || riskChunks.length === 0) {
    // 没有命中风险规则库：给标准合规免责声明（这是固定的安全兜底话术，不是知识库检索内容）
    return {
      riskLevel: 'none',
      riskNotice: '对了，这些内容主要是科普参考，没法替代医生诊断哦；如果备孕超过一年还没成功，或者出现月经紊乱、肚子疼这些情况，还是建议尽早去医院看看比较放心。',
      refIds: []
    };
  }

  const hasHighRisk = riskChunks.some((c) => c.level === 'high');
  const categories = [...new Set(riskChunks.map((c) => c.category))].join('、');
  // riskNotice直接基于"风险规则库"里的guidance字段拼装，而不是另外手写一套话术
  const guidanceText = [...new Set(riskChunks.map((c) => c.text))].join(' ');

  return {
    riskLevel: hasHighRisk ? 'high' : 'medium',
    riskNotice: `你提到的情况（${categories}）：${guidanceText}`,
    refIds: ragRetriever.collectRefIds(riskChunks)
  };
}

/**
 * 当意图识别判定本次为"D 医疗风险"类型时调用，返回标准四段式结构里的
 * understanding/analysisLines/suggestions 三块（riskNotice由skillDispatcher统一附加在末尾）
 * @param {string} content 用户输入
 * @param {object|null} latestRecord 最近一条周期记录（可能为空）
 * @returns {{ skillId: string, understanding: string, analysisLines: string[], suggestions: string[], refIds: number[], usedUserData: boolean }}
 */
function handle(content, latestRecord) {
  const risk = assessRisk(content);

  const understanding = '你提到的这个情况我认真看了一下，确实需要留意一下~';
  const analysisLines = [risk.riskNotice];

  // 个性化：有真实周期数据时，直接把具体数值列出来，而不是"整理一下带过去"这种空话
  const shortSummary = userContext.buildShortSummary(latestRecord);
  const dataForDoctorTip = shortSummary
    ? `就诊时可以直接把这份数据给医生看：${shortSummary}，这些来自你在「周期记录」里的记录，能帮医生更快了解情况`
    : '就诊前可以把「周期记录」里的数据整理一下带过去，方便医生快速了解情况';

  const suggestions = risk.riskLevel === 'high'
    ? [
        '建议尽快前往正规医院妇科/生殖科就诊，让医生结合检查结果做出准确判断',
        dataForDoctorTip,
        '如果想让我帮你对接更专业的咨询，也可以直接回复"转人工"'
      ]
    : [
        '先观察一下具体症状和持续时间，方便的话记录下来',
        '保持规律作息，避免给身体增加额外负担',
        '如果症状持续或者变严重，尽快去正规医院看看会更放心'
      ];

  return {
    skillId: 'risk',
    understanding,
    analysisLines,
    suggestions,
    refIds: risk.refIds,
    usedUserData: !!shortSummary
  };
}

module.exports = { handle, assessRisk };
