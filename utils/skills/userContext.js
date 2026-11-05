// utils/skills/userContext.js
// 共享的"用户信息个性化"工具，供 knowledgeSkill / emotionSkill / riskSkill / humanTransferSkill
// 复用，避免每个Skill各自实现一遍周期计算逻辑（周期阶段的计算公式仍然只在 cycleSkill.js 里维护一份）。

const cycleSkill = require('./cycleSkill.js');

/**
 * 根据用户最近一条周期记录，生成一句可以直接嵌入回复里的个性化上下文陈述。
 * 没有记录时返回 null——如实反映"没有数据"，不替用户编一个不存在的周期状态。
 *
 * @param {object|null} latestRecord 最近一条周期记录
 * @returns {{ text: string, cycleDay: number, cycleLength: number, phase: string } | null}
 */
function buildPersonalizationContext(latestRecord) {
  if (!latestRecord) return null;

  const { cycleDay, cycleLength, phase } = cycleSkill.calcCyclePhase(latestRecord);
  return {
    text: `结合你「周期记录」里的数据：周期约${cycleLength}天，今天是第${cycleDay}天，正处于${phase}。`,
    cycleDay,
    cycleLength,
    phase
  };
}

/**
 * 生成一句更简短的版本，用于插在建议/风险提醒里（不重复"周期约XX天"这类完整背景，
 * 只报关键结论），避免同一条回复里把完整周期信息重复陈述好几遍。
 */
function buildShortSummary(latestRecord) {
  if (!latestRecord) return null;
  const { cycleDay, cycleLength, phase } = cycleSkill.calcCyclePhase(latestRecord);
  return `周期约${cycleLength}天、当前第${cycleDay}天（${phase}）`;
}

module.exports = { buildPersonalizationContext, buildShortSummary };
