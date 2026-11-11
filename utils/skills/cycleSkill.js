// utils/skills/cycleSkill.js
// 类型B｜周期分析Skill（对应 PRD 8.4 Skill02）
// 输入：用户数据（周期长度/末次月经等，来自用户自己在「周期记录」里填的真实数据）
// 处理：数学推算当前周期阶段、排卵窗口（不是知识库检索，是对用户自己数据的计算，本身不存在编造问题）
// 同时调用 ragRetriever 检索周期生理相关的知识片段作为科普背景补充

const ragRetriever = require('../ragRetriever.js');

/**
 * 简化版周期阶段计算，与 pages/index/index.js 中的 calcCycleStatus 规则保持一致
 * 注：record 字段为 { startDate, endDate, cycleLength, periodLength, symptoms }
 */
function calcCyclePhase(record) {
  const cycleLength = Number(record.cycleLength) || 28;
  const startDate = new Date(record.startDate);
  const today = new Date();
  const diffDays = Math.floor((today - startDate) / (24 * 60 * 60 * 1000));
  const cycleDay = ((diffDays % cycleLength) + cycleLength) % cycleLength + 1;
  const ovulationDay = Math.round(cycleLength / 2);

  let phase = '黄体期';
  if (cycleDay <= 5) {
    phase = '月经期';
  } else if (Math.abs(ovulationDay - cycleDay) <= 2) {
    phase = '排卵期';
  } else if (cycleDay < ovulationDay) {
    phase = '卵泡期';
  }
  return { cycleDay, cycleLength, ovulationDay, phase };
}

/**
 * @param {string} content 用户输入
 * @param {object|null} latestRecord 最近一条周期记录（可能为空）
 * @returns {{ understanding: string, analysisLines: string[], suggestions: string[], refIds: number[], usedUserData: boolean }}
 */
function handle(content, latestRecord) {
  const understanding = '我来帮你看看现在处于周期的哪个阶段~';
  const analysisLines = [];
  const suggestions = [];

  // 检索周期生理相关的知识片段（ACOG/教材/小暖FAQ），作为科普背景补充；
  // 检索不到就不加，不会为了凑内容而编一句
  const { chunks } = ragRetriever.retrieve(content, 'B');
  const refIds = ragRetriever.collectRefIds(chunks);

  if (!latestRecord) {
    analysisLines.push('目前没有周期记录，暂时不能估算你处于哪个阶段。请先在「周期记录」里填写并保存经期开始日期、结束日期、平均周期长度和经期长度。');
    if (/体温/.test(content)) analysisLines.push('当前记录页不保存连续体温数据，不能据此分析你的体温曲线，也不能仅凭体温判断周期阶段或确认排卵。');
    chunks.forEach((c) => analysisLines.push(c.text));
    suggestions.push(
      '先填写并保存经期开始/结束日期、平均周期长度和经期长度',
      '之后每次月经都及时记一下，数据越全，分析就越准',
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

  if (/体温/.test(content)) analysisLines.push('以下只使用已保存的月经日期和周期参数做日期估算，现有记录不包含连续体温数据，不能据此分析体温曲线。');
  const { cycleDay, cycleLength, ovulationDay, phase } = calcCyclePhase(latestRecord);
  analysisLines.push(`本次使用你保存的 ${latestRecord.startDate} 至 ${latestRecord.endDate} 记录：平均周期 ${cycleLength} 天，经期 ${latestRecord.periodLength} 天，身体状态为 ${(latestRecord.symptoms || []).join('、') || '未填写'}。\n按这条记录和周期仍规律的假设估算，今天是这个周期的第${cycleDay}天，目前可能处于${phase}；这不是排卵确认。`);
  analysisLines.push(`照这个周期推算，排卵窗口大概在第${Math.max(ovulationDay - 2, 1)}-${ovulationDay + 2}天左右。`);
  chunks.forEach((c) => analysisLines.push(c.text));

  if (phase === '排卵期') {
    suggestions.push(
      '按记录估算可能接近排卵窗口，可结合自身情况安排，不必把估算日当作必须受孕的期限',
      '可结合排卵试纸或基础体温监测，进一步确认排卵时间点',
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
      '按记录估算可能不在排卵窗口，仍需留意周期变化并保持规律生活',
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
