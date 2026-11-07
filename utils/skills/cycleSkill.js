// utils/skills/cycleSkill.js
// 类型B｜周期分析Skill（对应 PRD 8.4 Skill02）
// 输入：用户数据（周期长度/末次月经等，来自用户自己在「周期记录」里填的真实数据）
// 处理：根据记录做日期粗估，不能确认实际周期阶段或排卵。
// 同时调用 ragRetriever 检索周期生理相关的知识片段作为科普背景补充

const ragRetriever = require('../ragRetriever.js');

/**
 * 本地日期估算：按填写的经期长度及平均周期推算，不使用默认参数补齐缺失记录。
 * 注：record 字段为 { startDate, endDate, cycleLength, periodLength, symptoms }
 */
function calcCyclePhase(record) {
  const cycleLength = Number(record.cycleLength);
  const periodLength = Number(record.periodLength);
  const startDate = new Date(record.startDate + 'T00:00:00');
  const endDate = new Date(record.endDate + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today - startDate) / (24 * 60 * 60 * 1000));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(record.startDate) || !Number.isFinite(diffDays) || diffDays < 0 ||
      !Number.isFinite(endDate.getTime()) || endDate < startDate || endDate > today ||
      !Number.isInteger(cycleLength) || cycleLength < 15 || cycleLength > 90 ||
      !Number.isInteger(periodLength) || periodLength < 1 || periodLength > cycleLength) return null;
  const cycleDay = diffDays % cycleLength + 1;
  const ovulationDay = Math.max(1, cycleLength - 14);
  let phase = '黄体期';
  if (cycleDay <= periodLength) phase = '月经期';
  else if (Math.abs(ovulationDay - cycleDay) <= 2) phase = '排卵期';
  else if (cycleDay < ovulationDay) phase = '卵泡期';
  return { cycleDay, cycleLength, ovulationDay, phase, extrapolated: diffDays >= cycleLength };
}

/**
 * @param {string} content 用户输入
 * @param {object|null} latestRecord 最近一条周期记录（可能为空）
 * @returns {{ understanding: string, analysisLines: string[], suggestions: string[], refIds: number[], usedUserData: boolean }}
 */
function handle(content, latestRecord) {
  const understanding = latestRecord
    ? `本次使用你保存的 ${latestRecord.startDate} 至 ${latestRecord.endDate} 记录（平均周期 ${latestRecord.cycleLength} 天、经期 ${latestRecord.periodLength} 天）。`
    : '暂时没有可用于估算的周期记录。';
  const analysisLines = [];
  const suggestions = [];

  // 检索周期生理相关的知识片段（ACOG/教材/小暖FAQ），作为科普背景补充；
  // 检索不到就不加，不会为了凑内容而编一句
  const { chunks } = ragRetriever.retrieve(content, 'B');
  const refIds = ragRetriever.collectRefIds(chunks);

  if (!latestRecord) {
    analysisLines.push('请先在「周期记录」填写并保存经期开始日期、结束日期、平均周期长度和经期长度，再点「查看周期解读」。缺少记录时无法估算当前阶段。');
    suggestions.push(
      '先去「周期记录」页填写开始日期、结束日期、平均周期长度、经期长度并保存',
      '持续记录有助于核对规律，但日期估算仍可能有偏差',
      '也可以配合基础体温、排卵试纸辅助判断排卵窗口'
    );
    return {
      skillId: 'cycle',
      understanding,
      analysisLines,
      suggestions,
      refIds,
      usedUserData: false
    };
  }

  const estimate = calcCyclePhase(latestRecord);
  if (!estimate) {
    return { skillId: 'cycle', understanding, analysisLines: ['这条记录的开始日期或周期参数不完整、无效或不适合本模板估算，暂不提供具体阶段。请检查日期、平均周期长度和经期长度；如周期明显异常，请咨询医生。'], suggestions: ['核对周期记录后保存，再点「查看周期解读」。'], refIds, usedUserData: true };
  }
  const { cycleDay, cycleLength, ovulationDay, phase, extrapolated } = estimate;
  analysisLines.push(`根据这条记录估算，目前可能处于${phase}，约为周期第${cycleDay}天（按平均周期${cycleLength}天推算）。`);
  if (extrapolated) analysisLines.push('记录开始日期已超过一个平均周期；这里按平均周期外推，若其后已有新经期，请先更新记录，不能据此确认当前阶段。');
  analysisLines.push(`仅按日期粗略估算，排卵附近可能在周期第${Math.max(ovulationDay - 2, 1)}—${ovulationDay + 2}天；实际排卵可能提前或推迟，不能用于确认排卵、怀孕或避孕。`);
  chunks.forEach((c) => analysisLines.push(c.text));

  if (phase === '排卵期') {
    suggestions.push(
      '日期估算可能接近排卵期，仅供记录参考，不据此确认已排卵',
      '可连续记录排卵试纸或基础体温变化，必要时由医生结合检查评估',
      '保持心情放松，避免因刻意安排而增加双方压力'
    );
  } else if (phase === '月经期') {
    suggestions.push(
      '月经期注意保暖、避免剧烈运动，做好经期护理',
      '可以趁这几天规划下一次排卵窗口前的准备（如叶酸补充、作息调整）',
      '记录本次月经的开始/结束日期，有助于后续周期计算更准确'
    );
  } else {
    suggestions.push(
      '日期估算不能排除排卵时间变化，可继续规律作息并记录身体变化',
      '临近排卵窗口时再重点安排同房和体温/试纸监测',
      '持续记录周期数据，几个周期后规律会更清晰'
    );
  }

  return {
    skillId: 'cycle',
    understanding,
    analysisLines,
    suggestions,
    refIds,
    usedUserData: true
  };
}

module.exports = { handle, calcCyclePhase };
