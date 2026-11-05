// utils/skills/basicConsultationSkill.js
//
// 小暖基础咨询 Skill（BasicConsultationSkill）
// ------------------------------------------------------------------
// 定位：基础咨询兜底模块。不负责专业医疗知识分析，只负责：
//   1. 接待用户（打招呼）
//   2. 处理简单的日常交流
//   3. 处理无法匹配专业Skill的普通问题
//   4. 当用户问题不明确时，引导用户补充信息
//   5. 将用户引导到正确的备孕咨询场景
//
// 安全边界（严禁事项）：
//   本Skill不得进行疾病诊断、不得判断用户是否患病、不得推荐处方药/促排卵药、
//   不得替代医生诊疗、不得做"你一定可以怀孕"之类的绝对判断、不得对医学风险问题下结论。
//   任何命中医疗相关关键词的问题，一律不在本Skill内处理，交回上层路由（need_routing:true）。
//
// 本文件完全独立，不依赖、不修改其他Skill、intentRouter、ragRetriever、knowledgeBase。

// 场景1：打招呼
const GREETING_KEYWORDS = ['你好', '您好', '嗨', '哈喽', 'hi', 'hello', '在吗', '在不在'];

// 场景2：询问AI身份
const IDENTITY_KEYWORDS = ['你是谁', '你能做什么', '你是什么助手', '你叫什么', '你是什么', '自我介绍', '你能干嘛'];

// 场景3：问题不明确（模糊表达，需要引导用户补充信息）
const VAGUE_KEYWORDS = ['我想咨询一下', '我有点担心', '怎么办', '帮帮我', '我想了解备孕', '我想问问', '能帮我吗', '咨询一下'];

// 不适用场景（安全边界）：命中这些关键词，不管看起来多简单，都不能由本Skill处理，
// 必须交给专业Skill或风险识别Skill，这里只做保护性判断，不做任何分析
const EXCLUDED_KEYWORDS = [
  '排卵期', '排卵', '月经周期', '月经', '周期', '基础体温',
  '备孕多久', '备孕时间', '备孕失败',
  '药', '促排卵', '吃什么药', '用药',
  '出血', '疼痛', '腹痛', '剧烈',
  '不孕', '没有怀孕', '没怀孕', '怀不上', '一直没', '疾病', '确诊'
];

function matchAny(text, keywords) {
  return keywords.some((kw) => text.includes(kw));
}

/**
 * 返回"属于基础咨询"的结果
 */
function buildAnswer(answer) {
  return {
    skill: 'BasicConsultationSkill',
    intent: '基础咨询',
    answer,
    need_routing: false,
    next_skill: null
  };
}

/**
 * 返回"不属于基础咨询，交给上层继续路由"的结果
 */
function buildRoutingResult() {
  return {
    skill: 'BasicConsultationSkill',
    intent: '非基础咨询',
    answer: '',
    need_routing: true,
    next_skill: '待路由判断'
  };
}

/**
 * 判断用户输入是否属于基础咨询场景，属于则直接生成回复；不属于则交回上层路由。
 * 这是本Skill唯一的对外入口。
 *
 * @param {string} content 用户输入
 * @returns {{ skill: string, intent: string, answer: string, need_routing: boolean, next_skill: string|null }}
 */
function handle(content) {
  const text = (content || '').trim();

  if (!text) {
    return buildRoutingResult();
  }

  // 安全边界优先：命中医疗相关关键词，无论如何都不由本Skill处理
  if (matchAny(text, EXCLUDED_KEYWORDS)) {
    return buildRoutingResult();
  }

  // 场景1：打招呼
  if (matchAny(text, GREETING_KEYWORDS)) {
    return buildAnswer(
      '你好呀，我是小暖，一名AI备孕助手。\n我可以帮助你了解备孕知识、周期管理和健康记录。\n如果你有具体问题，可以直接告诉我。'
    );
  }

  // 场景2：询问AI身份
  if (matchAny(text, IDENTITY_KEYWORDS)) {
    return buildAnswer(
      '我是小暖，一名AI备孕助手。\n可以帮助你了解备孕知识、周期管理和健康记录。\n你可以直接告诉我想咨询的问题。'
    );
  }

  // 场景3：问题不明确，引导用户补充信息
  if (matchAny(text, VAGUE_KEYWORDS)) {
    return buildAnswer(
      '当然可以。\n你可以告诉我具体想了解什么，例如：\n- 月经周期\n- 排卵时间\n- 备孕知识\n- 备孕记录\n- 其他身体情况\n我会根据你的问题帮你进一步分析。'
    );
  }

  // 场景4"无法匹配专业Skill的普通问题"：本Skill不主动猜测是否属于这一类，
  // 而是如实交回上层路由——如果上层的专业Skill也匹配不到，最终会走知识咨询Skill的
  // 诚实兜底（如实告知知识库没有对应内容），不会由本Skill越权编造答案。
  return buildRoutingResult();
}

module.exports = { handle };
