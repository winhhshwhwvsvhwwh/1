// Presentation only: split plain text into native <text> spans, without changing the reply.
// Keep negative instructions whole, and limit emphasis so paragraphs remain readable.
const KEY_PHRASES = [
  '不要自行用药或停药', '不要自行使用促排药', '不要自行用药、换药或停药',
  '不要自行停药', '不要自行用药', '不建议仅等待观察', '不能用于确认排卵、怀孕或避孕',
  '不能判断是否不孕', '不据此确认已排卵',
  '请立即前往急诊', '请立即就医', '立即前往急诊', '尽快前往妇科或急诊评估',
  '尽快就医', '遵医嘱', '咨询医生或药师', '用药前咨询医生或药师',
  '生育相关评估', '生育力评估', '双方咨询', '规律未避孕性生活',
  '35岁及以上满6个月', '未满35岁满12个月',
  '35岁以下规律备孕满1年', '35岁及以上备孕满6个月',
  '规律作息', '均衡饮食', '周期记录', '排卵试纸', '基础体温', '叶酸补充',
  '排卵窗口', '月经周期', '周期长度', '经期长度', '孕前检查'
].sort((a, b) => b.length - a.length);

function highlightText(value, limit = 3) {
  const text = typeof value === 'string' ? value : '';
  if (!text) return [];
  const segments = [];
  const used = new Set();
  let start = 0;
  let cursor = 0;
  let count = 0;
  const push = (value, highlighted) => {
    if (value) segments.push({id: segments.length, text: value, highlighted});
  };
  while (cursor < text.length && count < limit) {
    const phrase = KEY_PHRASES.find(item => !used.has(item) && text.startsWith(item, cursor));
    if (!phrase) { cursor++; continue; }
    push(text.slice(start, cursor), false);
    push(phrase, true);
    used.add(phrase);
    cursor += phrase.length;
    start = cursor;
    count++;
  }
  push(text.slice(start), false);
  return segments;
}

module.exports = {highlightText};
