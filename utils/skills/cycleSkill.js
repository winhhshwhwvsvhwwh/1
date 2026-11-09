// utils/skills/cycleSkill.js
// 类型B｜周期分析Skill（对应 PRD 8.4 Skill02）
// 输入：用户数据（周期长度/末次月经等，来自用户自己在「周期记录」里填的真实数据）
// 处理：数学推算当前周期阶段、排卵窗口（不是知识库检索，是对用户自己数据的计算，本身不存在编造问题）
// 同时调用 ragRetriever 检索周期生理相关的知识片段作为科普背景补充

const ragRetriever = require('../ragRetriever.js');
const {extractFacts} = require('../questionFacts.js');

/**
 * 简化日期估算；排卵日按平均周期减14天粗估，不用于确认排卵或避孕
 * 注：record 字段为 { startDate, endDate, cycleLength, periodLength, symptoms }
 */
function calcCyclePhase(record) {
  const cycleLength = Number(record.cycleLength) || 28;
  const startDate = new Date(record.startDate);
  const today = new Date();
  const diffDays = Math.floor((today - startDate) / (24 * 60 * 60 * 1000));
  const cycleDay = ((diffDays % cycleLength) + cycleLength) % cycleLength + 1;
  const ovulationDay = Math.max(1, cycleLength - 14);

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
  const background=chunks.find(chunk=>chunk.topic==='cycle_physiology')||chunks[0];
  const refIds = ragRetriever.collectRefIds(background?[background]:[]);

  if (!latestRecord) {
    analysisLines.push('目前没有周期记录，暂时不能估算你处于哪个阶段。请先在「周期记录」里填写并保存经期开始日期、结束日期、平均周期长度和经期长度。');
    if (/体温/.test(content)) analysisLines.push('当前记录页不保存连续体温数据，不能据此分析你的体温曲线，也不能仅凭体温判断周期阶段或确认排卵。');
    if(background) analysisLines.push(background.text);
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
  const providedLength=extractFacts(content).cycleLength;
  const { cycleDay, cycleLength, ovulationDay, phase } = calcCyclePhase(providedLength?{...latestRecord,cycleLength:providedLength}:latestRecord);
  analysisLines.push(`${providedLength?'按你本次提供的周期长度和已保存的经期日期':'从你记录的数据来看'}，你的周期大概${cycleLength}天一次，今天是这个周期的第${cycleDay}天，根据日期估算目前可能处于${phase}。`);
  analysisLines.push(`照这个周期推算，排卵日可能在周期第${Math.max(ovulationDay - 2, 1)}-${ovulationDay + 2}天附近。估算，仅供参考，不能确认实际排卵或用于避孕。`);
  if(background) analysisLines.push(background.text);

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
