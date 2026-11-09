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

// Headings and follow-up questions are structural emphasis, independent of the keyword cap.
function structureRanges(text) {
  const ranges = [];
  for (const match of text.matchAll(/(?:可以补充|请补充|可补充)[：:][^\n]*/g)) {
    ranges.push({start: match.index, end: match.index + match[0].length});
  }
  for (const match of text.matchAll(/[^\n]+/g)) {
    const line = match[0];
    const marker = line.match(/^\s*(?:第[一二三四五六七八九十\d]+(?:周|步|阶段)\s*[｜|：:]|(?:\d+|[一二三四五六七八九十]+)[．.、)）](?!\d))\s*/);
    if (marker) {
      const colon = line.slice(marker[0].length).search(/[：:]/);
      if (colon >= 0) ranges.push({start: match.index, end: match.index + marker[0].length + colon + 1});
      else if (line.trim().length <= 64 && !/[。！？；]/.test(line)) ranges.push({start: match.index, end: match.index + line.length});
    } else {
      // Existing suggestion labels such as 今天先做：/本周安排：/每天执行：.
      const label = line.match(/^\s*(?:今天先做|本周安排|每天执行|今日任务|本周重点|每日安排|注意事项|小结|温馨提示|下一步)[：:]/);
      if (label) ranges.push({start: match.index, end: match.index + label[0].length});
    }
  }
  return ranges;
}

function highlightText(value, limit = 3) {
  const text = typeof value === 'string' ? value : '';
  if (!text) return [];
  const ranges = structureRanges(text);
  const structural = ranges.slice();
  const used = new Set();
  let cursor = 0;
  let count = 0;
  while (cursor < text.length && count < limit) {
    const inside = structural.find(range => cursor >= range.start && cursor < range.end);
    if (inside) { cursor = inside.end; continue; }
    const phrase = KEY_PHRASES.find(item => !used.has(item) && text.startsWith(item, cursor));
    if (!phrase) { cursor++; continue; }
    ranges.push({start: cursor, end: cursor + phrase.length});
    used.add(phrase);
    cursor += phrase.length;
    count++;
  }
  const merged = [];
  for (const range of ranges.sort((a,b) => a.start - b.start)) {
    const previous = merged[merged.length - 1];
    if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end);
    else merged.push({...range});
  }
  const segments = [];
  let start = 0;
  const push = (value, highlighted) => {
    if (value) segments.push({id: segments.length, text: value, highlighted});
  };
  for (const range of merged) {
    push(text.slice(start, range.start), false);
    push(text.slice(range.start, range.end), true);
    start = range.end;
  }
  push(text.slice(start), false);
  return segments;
}

module.exports = {highlightText};
