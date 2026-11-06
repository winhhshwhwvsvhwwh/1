// Demo self-assessment rules approved by the user; not a validated medical scale.
const SCORE_TABLE = [[25, 18, 10, null], [10, 25, 10, null], [25, 18, 10, 5], [25, 10, 5, 10]];
const DIMENSIONS = ['周期规律', '经期时长', '生活状态', '生理关注'];
const BANDS = [
  { min: 85, label: '保持日常管理', summary: '本次自评中可继续保持的日常习惯较多，建议持续记录并按需安排孕前咨询。高分不代表无疾病或更高受孕概率。', advice: ['保持规律作息、均衡饮食和适度运动，避免吸烟饮酒。', '继续记录月经开始、结束时间和身体变化，安排适合自己的孕前咨询。'] },
  { min: 70, label: '关注个别项目', summary: '本次自评有个别项目值得关注，可以从记录习惯、生活节奏或症状观察入手。', advice: ['选择最需要改善的一两项，逐步调整作息与压力管理，避免因分数过度焦虑。', '连续记录周期与身体变化；如异常持续或反复，咨询妇科医生。'] },
  { min: 50, label: '重点改善日常', summary: '本次自评中有多项需要关注，建议先梳理周期变化、休息情况及不适表现。', advice: ['优先保证休息、均衡饮食与可持续的活动，记录异常表现及发生时间。', '如周期异常或不适持续，预约妇科或生殖科咨询，携带周期记录帮助医生评估。'] },
  { min: 0, label: '优先关注与咨询', summary: '本次自评提示多个关注项目，建议优先处理不适并获得专业指导。该分数不能用于判断疾病或生育能力。', advice: ['先处理当前不适和影响休息的因素，不要单凭分数自行用药或判断疾病。', '安排专业咨询，说明周期、备孕时长和症状，由医生决定是否需要检查。'] }
];
function selection(answers, index) {
  const answer = answers[index];
  const indices = answer && answer.indices;
  if (!Array.isArray(indices) || !indices.length || indices.some(i => !Number.isInteger(i) || i < 0 || i > 3)) throw new Error('缺少有效问卷答案');
  if (index !== 5 && indices.length !== 1) throw new Error('单选题答案无效');
  if (index === 5 && indices.includes(0) && indices.length > 1) throw new Error('没有问题与其他选项互斥');
  return indices;
}
// CSS rotation: 0deg points up, -90deg left, +90deg right.
function scoreToPointerAngle(score) {
  if (score === null || !Number.isFinite(score) || score < 0 || score > 100) return null;
  return 90 - score * 1.8;
}
function buildAssessmentReport(answers) {
  const selected = Array.from({ length: 6 }, (_, i) => selection(answers, i));
  const points = [SCORE_TABLE[0][selected[2][0]], SCORE_TABLE[1][selected[3][0]], SCORE_TABLE[2][selected[4][0]], Math.min(...selected[5].map(i => SCORE_TABLE[3][i]))];
  const indicators = points.map((point, i) => ({ name: DIMENSIONS[i], points: point, score: point === null ? null : point * 4 }));
  const score = points.includes(null) ? null : points.reduce((sum, p) => sum + p, 0);
  const band = score === null ? { label: '信息待补充', summary: '周期或经期时长选择了“不确定”，目前信息不足，暂无法计算总分。已填写的项目仍可提供参考。', advice: ['先记录月经开始和结束日期及身体变化，信息明确后可重新自评；不确定不等于状态差。'] } : BANDS.find(b => score >= b.min);
  const priority = [];
  const symptoms = selected[5];
  if (symptoms.includes(1)) priority.push('你提到了非经期出血，建议及时向妇科医生咨询；若出血量大或伴明显头晕、晕厥，应立即就医。');
  if (symptoms.includes(2)) priority.push('你提到了明显或持续疼痛，建议尽快就医；若突发剧烈腹痛、晕厥，或可能怀孕并伴腹痛、出血，应立即就医。');
  if (symptoms.includes(3)) priority.push('你提到了其他不适，请记录具体症状、持续时间和诱因；若持续或加重，请及时就医。');
  if (selected[1][0] === 3) priority.push('你填写的备孕时间已超过12个月。若一直有规律、未避孕的性生活，建议双方进行生育相关咨询。');
  else if (selected[0][0] === 3 && selected[1][0] >= 2) priority.push('若年龄已满35岁，并有规律、未避孕性生活满6个月仍未孕，建议双方安排生育相关咨询。');
  const tailored = [];
  if (selected[2][0] === 2) tailored.push('周期经常不规律时，单靠日历预测排卵可能不准确，建议结合记录向医生咨询。');
  if ([0, 2].includes(selected[3][0])) tailored.push('经期较短或较长需要结合个人既往情况、经量和伴随症状判断；若新出现、反复或伴不适，建议咨询医生。');
  if (selected[4][0] >= 2) tailored.push('近期生活状态需要关注，建议优先改善休息与压力管理，必要时寻求专业支持。');
  return { score, label: band.label, summary: band.summary, indicators, priority, suggestions: [...priority, ...tailored, ...band.advice], pointerAngle: scoreToPointerAngle(score), rulesVersion: 'demo-v1' };
}
module.exports = { buildAssessmentReport, scoreToPointerAngle, SCORE_TABLE, BANDS };
