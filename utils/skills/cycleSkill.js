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
    analysisLines.push('你还没在「周期记录」里加过数据，我暂时摸不准具体是周期第几天，方便的话先记一下最近一次月经的日期，我能分析得更准。');
    chunks.forEach((c) => analysisLines.push(c.text));
    suggestions.push(
      '先去「周期记录」页加一条最近的月经记录（开始/结束日期、周期长度）',
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

  const { cycleDay, cycleLength, ovulationDay, phase } = calcCyclePhase(latestRecord);
  analysisLines.push(`从你记录的数据来看，你的周期大概${cycleLength}天一次，今天是这个周期的第${cycleDay}天，正处于${phase}。`);
  analysisLines.push(`照这个周期推算，排卵窗口大概在第${Math.max(ovulationDay - 2, 1)}-${ovulationDay + 2}天左右。`);
  chunks.forEach((c) => analysisLines.push(c.text));

  if (phase === '排卵期') {
    suggestions.push(
      '当前正处于排卵窗口期，是同房的较佳时机，建议隔天安排一次',
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
      '当前不在排卵窗口期，可以先专注调理作息和饮食',
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
