// utils/ragRetriever.js
// RAG检索模块 —— 对应流程图里的"检索相关知识"这一步
//
//   用户问题 → Skill判断(A-E) → 【检索相关知识】 → 结合用户信息 → 生成回答
//
// 硬性要求：回答必须基于知识库，不允许编造。
// 本模块只做两件事：
// 1. retrieve()：按Skill类型去对应的知识来源里检索，返回统一格式的知识片段(chunks)。
//    检索不到时返回 hasMatch:false，调用方（各Skill）必须如实告知"没有找到依据"，
//    不能在检索为空的情况下还编一段听起来专业的建议冒充是"有依据的回答"。
// 2. withUserContext()：结合用户在「周期记录」里的真实数据生成背景陈述（不是知识库检索，
//    是结构化用户数据，但同样要求"如实"——没有数据就说没有数据，不能替用户猜一个)。

const knowledgeBase = require('./knowledgeBase.js');

/**
 * 按Skill类型决定要检索哪些知识来源：
 * A 备孕知识咨询 → 知识要点库(ACOG/WHO/中国营养学会/教材) + 小暖FAQ知识库
 * B 周期分析     → 知识要点库(主要是周期生理部分) + 小暖FAQ知识库(排卵期怎么算等)
 * C 情绪焦虑     → 知识要点库(用来给情绪陪伴Skill提供"科学解释"的依据，比如生育时间因人而异)
 * D 医疗风险     → 风险规则库(必须命中，否则不会被分类为D) + 知识要点库(辅助依据)
 * E 人工咨询     → 不检索知识库，直接走人工转接流程
 *
 * @param {string} content 用户输入
 * @param {'A'|'B'|'C'|'D'|'E'} skillType intentRouter.analyzeIntent 返回的 type
 * @returns {{ chunks: Array<{source: string, text: string, refIds: number[], topic?: string}>, hasMatch: boolean }}
 */
function retrieve(content, skillType) {
  const chunks = [];

  const addKnowledgePoints = () => {
    knowledgeBase.matchKnowledge(content).forEach((item) => {
      chunks.push({ source: item.source, text: item.text, refIds: item.refIds, topic: item.topic });
    });
  };
  const addFAQ = () => {
    knowledgeBase.matchFAQ(content).forEach((item) => {
      chunks.push({ source: item.source, text: item.answer, refIds: item.refIds, topic: 'faq' });
    });
  };
  const addRisk = () => {
    knowledgeBase.matchRisk(content).forEach((item) => {
      chunks.push({
        source: item.source,
        text: item.guidance,
        refIds: item.refIds,
        topic: 'risk',
        level: item.level,
        category: item.category
      });
    });
  };

  switch (skillType) {
    case 'A':
      addKnowledgePoints();
      addFAQ();
      break;
    case 'B':
      addKnowledgePoints(); // cycle_physiology 条目会命中
      addFAQ(); // 排卵期怎么算/基础体温怎么看 等
      break;
    case 'C':
      addKnowledgePoints(); // 主要用来给"科学解释"部分提供依据，比如"备孕成功时间因人而异"
      break;
    case 'D':
      addRisk();
      addKnowledgePoints(); // 比如同时命中infertility_evaluation，可以一并作为佐证
      break;
    case 'E':
    default:
      break; // 人工咨询不需要检索知识库
  }

  // 去重（同一条知识可能被多个分支重复加入）
  const seen = new Set();
  const dedupedChunks = chunks.filter((chunk) => {
    if (!chunk.text) return false;
    const key = chunk.source + '|' + chunk.text;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    chunks: dedupedChunks,
    hasMatch: dedupedChunks.length > 0
  };
}

/**
 * 结合用户信息（周期记录）生成一句背景陈述。
 * 没有数据时如实说明"暂无数据"，不替用户猜一个不存在的周期状态。
 * @param {object|null} latestRecord 最近一条周期记录
 * @param {(record: object) => { cycleDay: number, cycleLength: number, phase: string }} calcCyclePhaseFn
 */
function withUserContext(latestRecord, calcCyclePhaseFn) {
  if (!latestRecord) {
    return {
      hasUserData: false,
      text: '你还没有在「周期记录」里添加数据，这部分暂时没法结合你的具体情况分析。'
    };
  }
  const { cycleDay, cycleLength, phase } = calcCyclePhaseFn(latestRecord);
  return {
    hasUserData: true,
    text: `结合你在「周期记录」里的数据：周期约${cycleLength}天，今天是第${cycleDay}天，处于${phase}。`
  };
}

/**
 * 把chunks里的refIds汇总去重，供最终回复拼"参考来源"用
 */
function collectRefIds(chunks) {
  return chunks.reduce((ids, chunk) => ids.concat(chunk.refIds || []), []);
}

module.exports = { retrieve, withUserContext, collectRefIds };
