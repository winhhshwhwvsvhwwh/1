// utils/skillDispatcher.js
// Skill调度中心（对应 PRD 8.2 架构图：用户输入 → AI意图识别 → Skill调度中心 → ... → AI回复/专家咨询）
//
// 按PRD要求，第一步识别用户需求类型（A-E，互斥分类，一次只归为一类），
// 再调用该类型对应的处理模块：
//   A 备孕知识咨询 → knowledgeSkill
//   B 周期分析     → cycleSkill
//   C 情绪焦虑     → emotionSkill
//   D 医疗风险     → riskSkill
//   E 人工咨询     → humanTransferSkill
//
// 「风险提醒」作为AI咨询接口固定的第4个结构化字段，不管主类型是哪一个，
// 都会调用 riskSkill.assessRisk() 生成一遍并附加在回复末尾——这是唯一保留的
// "并行"部分，其余四类是互斥单选的。
//
// 当前实现是"雏形"版本：跑在小程序本地（USE_CLOUD=false 时的mock路径），
// 用规则引擎代替真正的NLU/大模型；接入真实大模型时，可以把各Skill内部的规则
// 替换成"检索知识库 + prompt大模型生成"，调度中心本身的流程不需要大改。

const recordStore = require('./recordStore.js');
const knowledgeBase = require('./knowledgeBase.js');
const intentRouter = require('./intentRouter.js');
const knowledgeSkill = require('./skills/knowledgeSkill.js');
const cycleSkill = require('./skills/cycleSkill.js');
const riskSkill = require('./skills/riskSkill.js');
const emotionSkill = require('./skills/emotionSkill.js');
const humanTransferSkill = require('./skills/humanTransferSkill.js');
const basicConsultationSkill = require('./skills/basicConsultationSkill.js');
const qualityCheck = require('./qualityCheck.js');

const SKILL_NAME_MAP = {
  knowledge: 'A 备孕知识咨询Skill',
  cycle: 'B 周期分析Skill',
  emotion: 'C 情绪陪伴Skill',
  risk: 'D 医疗风险识别Skill',
  human_transfer: 'E 人工咨询转接Skill'
};

/**
 * 把各Skill各自不同形状的输出，统一收敛成"AI咨询接口"对外承诺的四个标准字段：
 * 问题理解(understanding) / 分析结果(analysis) / 备孕建议(suggestions) / 风险提醒(riskNotice)
 * 这样不管背后是A-E哪个类型在处理，接口契约永远是这四块，不会退化成一段随意的聊天文本。
 */
function normalizeSkillResult(skillResult, primarySkill) {
  if (primarySkill === 'emotion') {
    return {
      understanding: skillResult.comfort,
      analysis: skillResult.explanation,
      suggestions: skillResult.actions,
      refIds: skillResult.refIds || []
    };
  }
  return {
    understanding: skillResult.understanding,
    analysis: skillResult.analysisLines.join('\n'),
    suggestions: skillResult.suggestions,
    refIds: skillResult.refIds || []
  };
}

/**
 * 把四个标准字段组装成聊天气泡展示用的文本（保持口语化，不用生硬的方括号标题）
 */
function formatDisplayText({ understanding, analysis, suggestions, riskNotice, quality, primarySkill, refIds }) {
  const paragraphs = [
    understanding,
    analysis,
    '给你几个具体建议：\n' + suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')
  ];

  // D类（医疗风险）的analysis本身就是基于风险规则库生成的riskNotice，末尾不用再重复一遍
  if (analysis !== riskNotice) {
    paragraphs.push(riskNotice);
  }

  if (quality.suggestHandoff && primarySkill !== 'human_transfer') {
    paragraphs.push('如果回答没有解决问题，可以补充更具体的信息；涉及健康决定时请向专业人员核实。');
  }

  const referencesText = knowledgeBase.formatReferences(refIds);
  if (referencesText) {
    paragraphs.push('这部分内容参考了：\n' + referencesText);
  }

  return paragraphs.filter(Boolean).join('\n\n');
}

/**
 * 第一步：识别用户需求类型（A-E） → 第二步：调用对应处理模块
 * @param {string} content 用户输入
 * @param {object} intent  intentRouter.analyzeIntent 的返回结果
 * @param {object|null} latestRecord 最近一条周期记录
 */
function callSkillByType(content, intent, latestRecord) {
  switch (intent.primarySkill) {
    case 'human_transfer':
      return humanTransferSkill.handle(content, intent, latestRecord);
    case 'emotion':
      return emotionSkill.handle(content, latestRecord);
    case 'cycle':
      return cycleSkill.handle(content, latestRecord);
    case 'risk':
      return riskSkill.handle(content, latestRecord);
    case 'knowledge':
    default:
      return knowledgeSkill.handle(content, intent, latestRecord);
  }
}

/**
 * Skill调度主入口
 * @param {string} content 用户输入
 * @returns {Promise<{ code: number, data: { role: string, content: string, timestamp: number, meta: object } }>}
 */
function dispatch(content) {
  // ============ 新增：基础咨询Skill前置短路判断 ============
  // 在进入A-E专业路由之前，先问一下BasicConsultationSkill这是不是打招呼/问身份/模糊问题。
  // 是 → 直接用它的回复，不再跑后面的知识检索/周期分析等专业逻辑。
  // 不是（need_routing:true）→ 完全不影响，原有A-E路由逻辑照常执行。
  const basicResult = basicConsultationSkill.handle(content);
  if (!basicResult.need_routing) {
    return Promise.resolve({
      code: 0,
      data: {
        role: 'assistant',
        content: basicResult.answer,
        understanding: basicResult.answer,
        analysis: '',
        suggestions: [],
        riskNotice: '',
        timestamp: Date.now(),
        riskLevel: 'none',
        needHandoff: false,
        meta: {
          type: 'BASIC',
          typeLabel: '基础咨询',
          skill: 'basic_consultation',
          skillName: 'BasicConsultationSkill 小暖基础咨询Skill',
          riskLevel: 'none',
          quality: null
        }
      }
    });
  }

  return recordStore.getRecords().then((records) => {
    const latestRecord = records && records[0];

    // 第一步：识别用户需求类型（A/B/C/D/E）
    const intent = intentRouter.analyzeIntent(content, { hasRecord: !!latestRecord });

    // 第二步：根据类型调用对应处理模块
    const skillResult = callSkillByType(content, intent, latestRecord);

    // 风险提醒始终生成一遍，作为四段式回复固定的第4部分（不管主类型是不是D）
    const riskResult = riskSkill.assessRisk(content);

    // 归一化：不管背后是A-E哪个类型，都收敛成四个标准字段
    const normalized = normalizeSkillResult(skillResult, intent.primarySkill);
    const refIds = [].concat(normalized.refIds, riskResult.refIds || []);

    // 回复质量检测
    // 个性化程度：统一读取每个Skill各自上报的 usedUserData（现在A/C/D/E/B五类都会如实标记
    // "有没有真的把用户数据代入回答"，不再是"只要有周期记录就算个性化"这种不准确的判定）
    const quality = qualityCheck.review({
      usedKnowledge: !!(skillResult.usedKnowledge || skillResult.usedUserData),
      usedUserData: !!skillResult.usedUserData,
      riskLevel: riskResult.riskLevel,
      suggestionCount: normalized.suggestions.length
    });

    // "AI无法有效解决"的判定：A类知识咨询检索不到任何知识片段，就是最直接的"没解决"信号；
    // 之前只依赖qualityCheck的总分阈值，实测几乎不会触发（默认建议数量凑够3条就能拿到及格分），
    // 所以这里改成优先看检索结果本身，quality.suggestHandoff作为兜底的次要信号保留
    const noKnowledgeMatch = intent.primarySkill === 'knowledge' && skillResult.usedKnowledge === false;
    const needHandoff = riskResult.riskLevel === 'high' || noKnowledgeMatch || quality.suggestHandoff;

    const displayContent = formatDisplayText({
      understanding: normalized.understanding,
      analysis: normalized.analysis,
      suggestions: normalized.suggestions,
      riskNotice: riskResult.riskNotice,
      quality,
      primarySkill: intent.primarySkill,
      refIds
    });

    return {
      code: 0,
      data: {
        role: 'assistant',
        // content：拼装好的展示文本，聊天气泡直接渲染这个字段（兼容现有页面，不用改wxml）
        content: displayContent,
        // 同时把AI咨询接口承诺的四个结构化字段单独暴露出来，供以后需要结构化展示/校验时使用
        understanding: normalized.understanding,
        analysis: normalized.analysis,
        suggestions: normalized.suggestions,
        riskNotice: riskResult.riskNotice,
        timestamp: Date.now(),
        // riskLevel/needHandoff：供前端"AI咨询兜底机制"直接判断，不用深挖meta
        riskLevel: riskResult.riskLevel,
        needHandoff,
        // meta 字段记录本次识别到的类型和调用的模块，便于调试/演示分流是否准确
        meta: {
          type: intent.type,
          typeLabel: intent.typeLabel,
          skill: intent.primarySkill,
          skillName: SKILL_NAME_MAP[intent.primarySkill],
          riskLevel: riskResult.riskLevel,
          quality
        }
      }
    };
  });
}

module.exports = { dispatch };
