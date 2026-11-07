// utils/skills/riskSkill.js
// 类型D｜医疗风险识别Skill（对应 PRD 8.4 Skill03）
//
// 提供两个函数：
// - assessRisk(content)：判断风险等级，产出「风险提醒」文案。不管最终主类型判定是A/B/C/D/E中的哪一个，
//   这个函数的结果都会作为AI咨询接口"四段式"里固定的第4部分（风险提醒）附加在回复末尾。
// - handle(content)：当意图识别把本次问题归为类型D（医疗风险）时调用，返回标准的
//   understanding/analysisLines/suggestions结构，和knowledgeSkill/cycleSkill的返回形状一致，
//   方便skillDispatcher统一处理。

const userContext = require('./userContext.js');
const knowledgeBase = require('../knowledgeBase.js');

/**
 * @param {string} content 用户输入
 * @returns {{ riskLevel: 'none'|'medium'|'high', riskNotice: string, refIds: number[] }}
 */
function assessRisk(content) {
  const selected = knowledgeBase.matchRisk(content)[0];
  if (!selected) return { riskLevel: 'none', riskNotice: '以上为备孕科普参考，不替代医生诊断。', refIds: [], category: '' };
  return { riskLevel: selected.level, riskNotice: selected.guidance, refIds: selected.refIds || [], category: selected.category };
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

  const suggestions = risk.category === '备孕用药'
    ? ['用药前咨询医生或药师，并说明备孕计划。', '整理正在使用的药物和补充剂清单，供专业人员核对。', '遵医嘱，不要自行用药、换药或停药。']
    : risk.riskLevel === 'high'
    ? [
        '请按以上提示就医，不依赖Demo判断病因。',
        dataForDoctorTip + '；不要为整理资料耽误就医。',
        '不要自行判断病因或用药；就医优先，不要等待Demo回复。'
      ]
    : [
        '记录具体症状和持续时间，向医生说明情况。',
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
