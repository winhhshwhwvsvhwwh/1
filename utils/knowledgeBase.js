// utils/knowledgeBase.js
// 备孕RAG知识库 —— 原始数据层（存"有什么知识"，检索编排逻辑在 utils/ragRetriever.js）
//
// 知识来源共5类，对应产品文档里的"专业医学知识来源"：
//   1. ACOG（美国妇产科医师学会）—— 生育力评估相关
//   2. WHO（世界卫生组织）—— 孕前保健相关
//   3. 中国营养学会 —— 备孕营养相关
//   4. 小暖FAQ知识库 —— 产品自建的高频问题问答（内部知识，非外部文献引用）
//   5. 风险规则库 —— 内部风险分级规则（依据卫健委互联网诊疗合规文件设计）
// 另外补充了《妇产科学》教材作为周期生理知识的来源（不在上述5类里，但同样标注了来源，不是编造）。
//
// 说明：以下内容是对权威公开资料核心结论的要点提炼与转述（自己的表达，不是原文摘抄），
// 涉及具体医学决策（剂量、诊断、治疗方案）时，始终建议用户以医生面诊意见为准。

// 参考文献列表（外部文献），编号与产品文档里的"参考文献排版"保持一致
const OFFLINE_FAQ = require('./offlineFaq.js');

const REFERENCES = [
  { id: 1, label: '中国营养学会妇幼营养分会.《备孕妇女膳食指南》', url: 'http://www.mcnutri.cn/guifanzn/811800200.html' },
  { id: 2, label: 'WHO. Preconception care: Maximizing the gains for maternal and child health', url: 'https://cdn.who.int/media/docs/default-source/mca-documents/maternal-nb/preconception_care_policy_brief.pdf' },
  { id: 3, label: "ACOG. Committee Opinion No.781: Infertility Workup for the Women's Health Specialist", url: 'https://pubmed.ncbi.nlm.nih.gov/31135764/' },
  { id: 4, label: '谢幸，孔北华，段涛.《妇产科学》(第9版). 北京：人民卫生出版社, 2018', url: '' },
  { id: 5, label: '国家卫生健康委员会.《互联网诊疗管理办法（试行）》', url: 'https://www.gov.cn/gongbao/content/2019/content_5358684.htm' },
  { id: 6, label: '国家卫生健康委.《医务人员互联网健康科普负面行为清单（试行）》', url: 'https://www.nhc.gov.cn/yzygj/c100068/202511/e21f87287e754f19bd0330bc4471c92e.shtml' }
];

// 知识要点库（来源：ACOG / WHO / 中国营养学会 / 《妇产科学》），按关键词命中
const KNOWLEDGE_POINTS = [
  {
    topic: 'nutrition',
    source: '中国营养学会',
    keywords: ['叶酸', '营养', '饮食', '膳食', '吃什么'],
    text: '备孕期建议每日额外补充叶酸（常见推荐剂量约400微克/天），并保持均衡膳食，适量摄入优质蛋白、深绿色蔬菜和全谷物；具体剂量建议在医生或营养师指导下调整。',
    refIds: [1]
  },
  {
    topic: 'preconception_checkup',
    source: 'WHO',
    keywords: ['孕前检查', '体检', '孕前准备', '备孕检查'],
    text: '孕前建议做一次系统的孕前保健评估，包括慢性病管理、疫苗接种情况核查、生活方式调整（如戒烟戒酒）等，有助于降低孕期并发症风险。',
    refIds: [2]
  },
  {
    topic: 'infertility_evaluation',
    source: 'ACOG',
    keywords: ['没有成功', '没怀孕', '不孕', '备孕失败', '一直没怀孕', '一直没成功', '一直没怀上', '怀不上'],
    text: '国际妇产科学界普遍建议：35岁以下女性规律备孕满1年未孕，或35岁及以上备孕满6个月未孕，建议尽早就医进行系统的生育力评估。',
    refIds: [3]
  },
  {
    topic: 'cycle_physiology',
    source: '《妇产科学》教材',
    keywords: ['周期', '排卵', '月经', '卵泡期', '黄体期'],
    text: '女性月经周期通常分为月经期、卵泡期、排卵期和黄体期，排卵一般发生在下次月经来潮前约14天左右，具体因人而异，坚持记录周期有助于判断易孕窗口。',
    refIds: [4]
  }
];

// 小暖FAQ知识库：产品自建的高频问题问答，有真实可检索的answer内容（不再只是分类标签）
const FAQ_LIBRARY = [
  {
    question: '排卵期怎么算',
    source: '小暖FAQ知识库',
    keywords: ['排卵期怎么算', '怎么算排卵期', '排卵期计算'],
    answer: '排卵时间因人、因周期而异，日历只能估计，不能确认实际排卵。易孕窗口通常主要涉及排卵前几天至排卵当天；周期不规律时推算更不可靠。试纸与基础体温也各有局限，有疑问时请专业人员解释。',
    refIds: [4]
  },
  {
    question: '月经推迟怎么办',
    source: '小暖FAQ知识库',
    keywords: ['月经推迟', '例假推迟', '大姨妈推迟'],
    answer: '偶尔推迟5-7天，在压力大、作息变化、体重波动等因素下比较常见，可以先观察。如果推迟超过7-10天且近期有同房史，建议先排查是否怀孕；如果经常不规律，建议就医检查。',
    refIds: []
  },
  {
    question: '备孕多久正常',
    source: '小暖FAQ知识库',
    keywords: ['备孕多久', '多久能怀上', '多久算正常'],
    answer: '大多数健康夫妻在规律备孕6个月到1年内能够怀孕。国际通行标准是：35岁以下规律备孕满1年未孕、35岁及以上满6个月未孕，建议就医做生育力评估。',
    refIds: [3]
  },
  {
    question: '基础体温怎么看',
    source: '小暖FAQ知识库',
    keywords: ['基础体温怎么看', '体温怎么看', '基础体温曲线'],
    answer: '排卵前基础体温相对较低，排卵后受黄体酮影响会升高0.3-0.5℃并维持到下次月经前，连续测量几周画成曲线，能大致判断是否排卵、排卵大概时间。需要每天清晨醒来、还没起床活动前测量才准确。',
    refIds: [4]
  },
  {"question": "备孕生活计划怎么安排", "source": "小暖Demo固定问答（待用户确认）", "keywords": ["备孕计划", "生活计划"], "answer": "备孕生活计划可以从周期记录、规律作息、均衡饮食和孕前咨询四方面安排。按自己的实际情况逐步调整，不需要把某一天视为必须受孕的期限。", "suggestions": ["记录月经开始和结束日期及身体变化。", "保持可持续的作息、饮食和适度活动。", "有慢性病、长期用药或不适时，先咨询医生。"], "refIds": []},
  {"question": "备孕知识科普包括哪些内容", "source": "小暖Demo固定问答（待用户确认）", "keywords": ["备孕知识科普", "备孕知识概览", "更多备孕建议"], "answer": "备孕科普主要包括孕前准备、周期记录、饮食作息、用药注意事项和何时寻求专业帮助。Demo提供一般知识，不判断是否患病或是否能怀孕。", "suggestions": ["可以从孕前准备或周期记录选一个具体问题继续问。", "把自己的实际情况与通用科普区分开。", "涉及症状、检查和用药决定时咨询专业人员。"], "refIds": []},
  {"question": "备孕期间用药有哪些注意事项", "source": "小暖Demo固定问答（待用户确认）", "keywords": ["用药", "二甲双胍", "克罗米芬", "促排", "药"], "answer": "备孕用药应遵医嘱，不要自行用药或停药，用药前咨询医生或药师。已有用药方案的人应向开药医生说明备孕计划；Demo不判断某种药是否适合你，也不提供剂量或停药方案。", "suggestions": ["整理正在使用的处方药、非处方药和补充剂清单。", "用药前咨询医生或药师，说明备孕计划。", "不要仅凭网上信息自行用药、换药或停药。"], "refIds": []},
  {"question": "排卵试纸结果怎么看", "source": "小暖Demo固定问答（待用户确认）", "keywords": ["我的试纸结果怎么看", "排卵试纸怎么看", "排卵试纸结果"], "answer": "排卵试纸一般检测尿液中的LH变化，需按该产品说明书，在规定时间内比较检测线和对照线；没有有效对照线通常提示本次结果无效。不同产品读法可能不同，单次结果不能确认已排卵，也不能用来判断怀孕。", "suggestions": ["先核对产品类型、说明书及有效判读时间。", "记录检测日期和结果，结合连续变化理解。", "结果不清楚或与身体情况不符时咨询专业人员。"], "refIds": []},
  {"question": "如何提高受孕几率", "source": "小暖Demo固定问答（待用户确认）", "keywords": ["提高受孕几率", "提高怀孕几率"], "answer": "受孕受多种因素影响，没有保证成功的方法。可保持规律、未避孕的性生活，结合周期记录了解变化，避免只依赖一次排卵预测；有疑问时安排孕前或生育相关咨询。", "suggestions": ["双方保持可持续的生活节奏，避免因精确安排增加压力。", "持续记录周期，不把日历预测当作确定排卵的证据。", "备孕时间较长或有不适时及时寻求专业咨询。"], "refIds": []},
  {"question": "备孕时如何调整作息", "source": "小暖Demo固定问答（待用户确认）", "keywords": ["调整作息", "作息调整"], "answer": "作息调整可以从固定起床和睡眠时间、减少熬夜、安排适度活动开始，逐步形成可持续的节奏。若长期睡眠困难、情绪困扰或明显不适，建议寻求专业帮助。", "suggestions": ["先设定自己能坚持的作息目标。", "减少临睡前让自己兴奋或紧张的活动。", "记录休息与精神状态，必要时咨询专业人员。"], "refIds": []},
  {"question": "备孕生活习惯需要注意什么", "source": "小暖Demo固定问答（待用户确认）", "keywords": ["生活习惯", "生活方式"], "answer": "备孕期间可关注规律作息、均衡饮食、适度运动和避免吸烟饮酒。调整应结合身体状况循序渐进，不用追求短期内把所有习惯都改变。", "suggestions": ["选择一两项最容易坚持的习惯先调整。", "保持饮食多样，避免自行尝试极端饮食或偏方。", "有慢性病、特殊饮食需求或活动限制时咨询医生。"], "refIds": []},
  {"question": "初次备孕需要关注什么", "source": "小暖Demo固定问答（待用户确认）", "keywords": ["初次备孕"], "answer": "初次备孕可以先了解双方健康史、正在使用的药物和孕前准备事项，再开始记录周期与生活习惯。有慢性病、既往不良妊娠经历或长期用药时，提前安排专业咨询。", "suggestions": ["整理双方健康史及用药清单。", "了解适合自己的孕前咨询和检查安排。", "开始记录周期，不用凭一次结果判断身体状况。"], "refIds": []},
  {"question": "备孕1–3个月需要关注什么", "source": "小暖Demo固定问答（待用户确认）", "keywords": ["备孕1–3个月", "备孕1-3个月", "备孕1–3月", "备孕1-3月"], "answer": "备孕1–3个月可先建立周期记录和稳定生活节奏，熟悉相关检测产品的说明书。暂未怀孕不等于患病，是否需要咨询还应结合年龄、病史和症状。", "suggestions": ["持续记录周期和身体变化。", "保持规律作息与双方沟通。", "出现不适或对既往病史有疑问时及时咨询。"], "refIds": []},
  {"question": "备孕3–6个月需要关注什么", "source": "小暖Demo固定问答（待用户确认）", "keywords": ["备孕3–6个月", "备孕3-6个月", "备孕3–6月", "备孕3-6月"], "answer": "备孕3–6个月可回顾记录是否连续、生活安排是否可持续，避免反复根据单次试纸或预测作结论。年龄已满35岁、有规律未避孕性生活满6个月仍未孕时，建议双方安排生育相关咨询。", "suggestions": ["整理已有周期记录与检测记录。", "遇到不清楚的结果时请专业人员帮助解释。", "不要自行使用促排或其他药物。"], "refIds": []},
  {"question": "备孕半年以上需要关注什么", "source": "小暖Demo固定问答（待用户确认）", "keywords": ["备孕半年以上", "备孕半年+"], "answer": "备孕半年以上时，是否需要评估应结合年龄、备孕方式、病史和症状。通常35岁以下有规律未避孕性生活满12个月仍未孕，或35岁及以上满6个月仍未孕，可安排双方生育相关咨询；有异常症状不必等待到这些时间点。", "suggestions": ["带上连续周期记录和既往检查资料。", "双方共同沟通咨询安排。", "避免仅凭备孕时长自行判断不孕或自行用药。"], "refIds": []},
  {"question": "排卵日总是算不准怎么办", "source": "小暖Demo固定问答（待用户确认）", "keywords": ["排卵日总是算不准", "排卵监测", "记录排卵相关变化"], "answer": "排卵时间存在个体差异，日历估算不能确定实际排卵。可以记录周期与连续检测变化，并按产品说明书使用试纸；周期经常不规律或结果持续不清楚时，建议咨询医生。", "suggestions": ["记录月经日期和检测时间。", "按说明书判读，避免只依据单次结果。", "有不适或持续疑问时咨询专业人员。"], "refIds": []}
].concat(OFFLINE_FAQ);

// 风险规则库：内部风险分级规则，依据卫健委互联网诊疗合规文件设计
// 注：关键词尽量用完整短语而不是"一直没"这种2-3字的片段——太短的片段容易在无关问题里
// 意外命中（比如"我一直没弄懂排卵期"会被误判成"长期未孕"），造成不必要的转人工。
const RISK_LIBRARY = [
  {
    level: 'high', priority: 110, category: '腹痛同时出血', source: '风险规则库',
    allKeywords: [['腹痛', '下腹疼痛', '肚子痛', '肚子疼', '肚子剧痛'], ['出血']],
    keywords: [],
    guidance: '腹痛同时伴有出血，建议尽快前往妇科或急诊评估；若疼痛剧烈、出血量大、头晕或晕厥，请立即就医。Demo无法判断具体原因，不建议仅等待观察。', refIds: []
  },
  {
    level: 'medium', priority: 50, category: '备孕用药', source: '风险规则库',
    keywords: ['药', '二甲双胍', '克罗米芬', '促排', '来曲唑', '排卵针', '优甲乐', '左甲状腺素', '布洛芬', '对乙酰氨基酚'],
    guidance: '用药请遵医嘱，不要自行用药或停药，用药前咨询医生或药师。Demo不判断某种药是否适合你，不提供剂量、换药或停药方案。', refIds: []
  },
  {
    level: 'high',
    priority: 120, category: '异常出血/剧烈疼痛',
    source: '风险规则库',
    keywords: ['剧烈疼痛', '大量出血', '腹痛难忍', '晕厥', '剧痛'],
    guidance: '大量出血、剧烈疼痛或晕厥可能需要紧急处置，请立即前往急诊或联系当地急救服务，不要等待观察；Demo无法判断具体原因。',
    refIds: []
  },
  {
    level: 'high',
    category: '长期未孕',
    source: '风险规则库',
    keywords: ['一年没有怀孕', '一年未孕', '两年没有怀孕', '备孕失败', '一直没怀孕', '一直没成功', '一直没怀上', '怀不上'],
    guidance: '仅凭未怀孕的描述不能判断是否不孕或已经达到评估条件。请补充双方年龄、规律未避孕尝试的时长和病史；是否需要生育相关评估应由医生结合实际情况决定，有异常症状时不要仅等待。',
    refIds: [5, 6]
  },
  {
    level: 'medium',
    category: '异常症状',
    source: '风险规则库',
    keywords: ['疼痛', '出血', '流产', '月经不调', '腹痛'],
    guidance: '这类症状建议先观察记录，如果持续存在或者加重，应及时就医检查，不建议长期自行处理。',
    refIds: [5, 6]
  },
  {
    level: 'medium',
    category: '疾病咨询',
    source: '风险规则库',
    keywords: ['不孕不育', '是不是不孕'],
    guidance: '涉及是否患病的判断，AI科普内容无法替代医生诊断，建议就医做专业检查后再下结论。',
    refIds: [5, 6]
  }
];

// 人工咨询转接关键词（对应PRD Skill05），intentRouter 和 humanTransferSkill 共用同一份，
// 避免两处各维护一份导致后续修改时漏改、分流结果不一致
const EXPERT_REQUEST_KEYWORDS = ['转人工', '找医生', '咨询专家', '人工客服', '真人医生'];
const UNRESOLVED_KEYWORDS = ['没解决我的问题', '不是这个意思', '答非所问', '没听懂'];

/**
 * 根据用户输入匹配小暖FAQ知识库里的问答（返回带真实answer内容的条目）
 */
function normalizeQuestion(content) {
  return String(content || '').normalize('NFKC').replace(/[–—−]/g, '-').replace(/\s+/g, '').toLowerCase();
}
function matchFAQ(content) {
  const text = normalizeQuestion(content);
  return FAQ_LIBRARY.map(item => ({ item, length: Math.max(0,...item.keywords.map(kw => normalizeQuestion(kw)).filter(kw => text.includes(kw)).map(kw => kw.length)) }))
    .filter(match => match.length > 0)
    .sort((a,b) => b.length-a.length || (b.item.priority || 0)-(a.item.priority || 0))
    .map(match => match.item);
}

/**
 * 根据用户输入匹配风险规则库，返回命中的风险条目（可能为空数组=无风险）
 */
function matchRisk(content) {
  return RISK_LIBRARY.filter((item) => item.allKeywords
    ? item.allKeywords.every(group => group.some(kw => content.includes(kw)))
    : item.keywords.some(kw => content.includes(kw)))
    .sort((a,b) => ({high:2,medium:1}[b.level] - {high:2,medium:1}[a.level]) || (b.priority || 0) - (a.priority || 0));
}

/**
 * 根据用户输入内容匹配知识要点库（ACOG/WHO/中国营养学会/教材），简单关键词命中，非语义检索
 */
function matchKnowledge(content) {
  return KNOWLEDGE_POINTS.filter((item) => item.keywords.some((kw) => content.includes(kw)));
}

/**
 * 把 refId 数组格式化成 "[1] xxx\n[2] xxx" 形式的参考来源文本
 */
function formatReferences(refIds) {
  const uniqueIds = [...new Set(refIds)];
  return uniqueIds
    .map((id) => {
      const ref = REFERENCES.find((r) => r.id === id);
      return ref ? `[${ref.id}] ${ref.label}` : '';
    })
    .filter(Boolean)
    .join('\n');
}

module.exports = {
  REFERENCES,
  KNOWLEDGE_POINTS,
  FAQ_LIBRARY,
  RISK_LIBRARY,
  EXPERT_REQUEST_KEYWORDS,
  UNRESOLVED_KEYWORDS,
  matchKnowledge,
  matchFAQ,
  matchRisk,
  formatReferences
};
