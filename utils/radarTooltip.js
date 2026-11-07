// Per-answer descriptions, not diagnoses or interpretations of the overall score.
const STATES = [
  [ ['stable','基本规律 · 状态稳定'], ['general','偶有波动 · 持续观察'], ['attention','周期不规律 · 建议关注'], ['unknown','尚不确定 · 建议记录'] ],
  [ ['general','时长偏短 · 结合记录观察'], ['stable','常见时长 · 持续记录'], ['attention','时长偏长 · 建议关注'], ['unknown','尚不确定 · 建议记录'] ],
  [ ['stable','作息规律 · 继续保持'], ['general','偶有熬夜 · 适当调整'], ['attention','作息或情绪需调整'], ['attention','优先改善休息与管理'] ],
  [ ['stable','未报告明显不适'], ['attention','异常出血 · 建议及时咨询'], ['attention','明显或持续疼痛 · 建议及时咨询'], ['general','其他不适 · 持续关注'] ]
];
function indicatorFeedback(selected) {
  const indices = [selected[2][0], selected[3][0], selected[4][0], selected[5].includes(2) ? 2 : selected[5].includes(1) ? 1 : selected[5].includes(3) ? 3 : 0];
  return indices.map((choice,i) => ({ tone:STATES[i][choice][0], tooltip:STATES[i][choice][1] }));
}
function tooltipPosition(node, width, height, text) {
  const tipWidth = Math.min(200, width-16);
  const tipHeight = text.length > 14 ? 46 : 28;
  const left = Math.max(8,Math.min(width-tipWidth-8,node.x-tipWidth/2));
  const below = node.y < tipHeight+8;
  const top = Math.max(8,Math.min(height-tipHeight-8,below ? node.y+10 : node.y-tipHeight-8));
  return { left, top, width:tipWidth, below, pointerLeft:Math.max(12,Math.min(tipWidth-12,node.x-left)) };
}
module.exports = { indicatorFeedback, tooltipPosition };
