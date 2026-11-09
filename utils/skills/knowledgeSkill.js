// utils/skills/knowledgeSkill.js
// 类型A｜备孕知识咨询Skill（对应 PRD 8.4 Skill01）
// 输入：用户问题 → 处理：调用 ragRetriever 检索RAG知识库 → 输出：知识解释/判断方法/下一步建议
//
// 硬性要求：回答必须基于知识库检索到的内容，不允许编造。
// 检索不到任何知识片段时，会如实告知"没有找到依据"，而不是返回一段听起来专业、
// 但实际上和知识库无关的通用建议（这是之前版本的一个真实问题，这次修掉了）。

const ragRetriever = require('../ragRetriever.js');
const userContext = require('./userContext.js');
const {extractFacts,durationAdvice,durationSuggestions,cycleWindow} = require('../questionFacts.js');

function extractDurationText(content) {
  const match = content.match(/(\d+)\s*(个月|月|年)/);
  return match ? match[0] : '';
}

function buildUnderstanding(durationText) {
  // 开场白：口语化，避免"根据你的描述..."这种模板腔
  return durationText
    ? `备孕${durationText}了，这个问题我理解你会关心，别太着急，我们先看看具体情况~`
    : '这个问题我来帮你梳理一下~';
}

/**
 * 根据检索到的知识片段主题，给出与依据挂钩的下一步建议。
 * 注意：这里只在"确实检索到了对应主题"的前提下才会给具体建议，
 * 不会在没有检索到任何内容时凭空生成。
 */
function buildSuggestions(content, chunks) {
  const topics = chunks.map((c) => c.topic);

  if (topics.includes('infertility_evaluation')) {
    return [
      '参考国际通行标准判断是否需要就医：35岁以下规律备孕满1年未孕、或35岁及以上满6个月未孕，建议尽早到生殖门诊做系统检查',
      '继续保持规律作息、均衡饮食，并在医生指导下补充叶酸等孕前营养素',
      '同步记录月经周期和基础体温，就诊时带给医生参考，有助于更快定位问题'
    ];
  }
  if (topics.includes('nutrition')) {
    return [
      '每日额外补充叶酸（常见推荐剂量约400微克/天），具体是否调整请咨询医生或营养师',
      '饮食上注意蛋白质、深绿色蔬菜、全谷物的均衡摄入，避免节食或暴饮暴食',
      '备孕期尽量减少咖啡因、酒精摄入，保持规律作息'
    ];
  }
  if (topics.includes('cycle_physiology') || content.includes('周期') || content.includes('月经')) {
    return [
      '坚持记录每次月经的开始日期和周期天数，帮助更准确判断排卵期',
      '排卵期前后2-3天安排同房，可结合排卵试纸或基础体温监测提高准确性',
      '若周期持续短于21天或长于35天，建议尽早就医排查内分泌相关因素'
    ];
  }
  if (topics.includes('preconception_checkup')) {
    return [
      '可以先预约一次孕前检查，覆盖慢性病管理、疫苗核查等基础项目',
      '备孕期同步调整生活方式，比如戒烟戒酒、规律作息',
      '有慢性病史或特殊用药史的，建议提前和医生沟通备孕计划'
    ];
  }
  // 命中了FAQ但没有落在上面几个主题里（比如"月经推迟怎么办"），FAQ的答案本身已经在analysis里给出了，
  // 这里给通用的下一步动作，不重复编造具体医学建议
  return [
    '可以先参考上面的说明，观察1-2个周期看看情况是否稳定',
    '同步在「周期记录」里记录数据，方便后续更准确地分析',
    '如果情况持续没有改善，建议直接咨询医生做进一步检查'
  ];
}

/**
 * @param {string} content 用户输入
 * @param {object} intent  intentRouter.analyzeIntent 的返回结果
 * @param {object|null} latestRecord 最近一条周期记录（可能为空）
 * @returns {{ understanding: string, analysisLines: string[], suggestions: string[], refIds: number[], usedKnowledge: boolean, usedUserData: boolean }}
 */
function handle(content, intent, latestRecord) {
  const { chunks, hasMatch } = ragRetriever.retrieve(content, 'A');
  const matched = intent.matchedFAQ || [];
  const faq = matched[0];
  if (faq && faq.suggestions) {
    const selected = [faq];
    // A second explicit topic is included only when the question asks for both.
    if (/还有|以及|同时|另外|和|也想/.test(content) && faq.category) {
      const second = matched.find(item => item.category && item.category !== faq.category && item.keywords.some(kw => kw.length >= 4 && content.toLowerCase().includes(kw.toLowerCase())));
      if (second) selected.push(second);
    }
    const duration=faq.id==='plan-duration'?durationAdvice(content,faq.answer):null;
    const followUps = duration?duration.questions:[...new Set(selected.flatMap(item => item.followUpQuestions || []))].slice(0,3);
    const answers=duration?[duration.answer]:selected.map(item=>item.answer);
    const cycleLength=extractFacts(content).cycleLength;
    if(cycleLength && /排卵/.test(content)) answers.unshift(cycleWindow(cycleLength));
    return {
      skillId: 'knowledge', understanding: '我来说明这个问题的通用注意事项。',
      analysisLines: [...answers, ...(followUps.length ? ['为了更具体地说明，可以补充：' + followUps.join('；')] : [])],
      suggestions: duration?durationSuggestions(content,faq.suggestions):[...new Set(selected.flatMap(item => item.suggestions))].slice(0,6),
      faqIds: selected.map(item => item.id).filter(Boolean), refIds: selected.flatMap(item => item.refIds || []), usedKnowledge: true, usedUserData: false
    };
  }
  const durationText = extractDurationText(content);
  const understanding = buildUnderstanding(durationText);

  if (!hasMatch) {
    // 检索不到任何知识片段：如实告知，不编造具体的医学建议
    return {
      skillId: 'knowledge',
      understanding,
      analysisLines: [
        '这个问题我在现有知识库（ACOG / WHO / 中国营养学会 / 小暖FAQ）里没有找到直接对应的内容，为了不给你不准确的信息，我不会瞎猜答案。'
      ],
      suggestions: [
        '可以换个更具体的问法，比如提到具体症状、时间或数据，我再帮你检索看看',
        '也可以先在「周期记录」里记下你的情况，我就能结合你的数据给出更有针对性的分析',
        '如果比较着急，建议直接咨询医生或专业机构，回复"转人工"我可以引导你'
      ],
      refIds: [],
      usedKnowledge: false,
      usedUserData: false
    };
  }

  // 知识解释（直接来自检索到的知识片段，不做超出原意的引申）
  const analysisLines = chunks.map((c) => c.text);

  // 个性化：如果用户已经有周期记录数据，追加一句真实背景，而不是只泛泛地说"结合你的情况"
  const personalization = userContext.buildPersonalizationContext(latestRecord);
  if (personalization) {
    analysisLines.push(personalization.text);
  }

  // 下一步建议：只在有检索依据时生成，且与检索到的主题挂钩
  const suggestions = buildSuggestions(content, chunks);

  return {
    skillId: 'knowledge',
    understanding,
    analysisLines,
    suggestions,
    refIds: ragRetriever.collectRefIds(chunks),
    usedKnowledge: true,
    usedUserData: !!personalization
  };
}

module.exports = { handle };
