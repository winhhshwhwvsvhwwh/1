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
    answer: '一般以下次月经来潮前14天左右作为排卵日，排卵日前5天到后4天都算易孕窗口。如果周期规律，可以用"下次月经预计日期-14天"估算；也可以配合基础体温或排卵试纸辅助判断，会更准确。',
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
  }
];

// 风险规则库：内部风险分级规则，依据卫健委互联网诊疗合规文件设计
// 注：关键词尽量用完整短语而不是"一直没"这种2-3字的片段——太短的片段容易在无关问题里
// 意外命中（比如"我一直没弄懂排卵期"会被误判成"长期未孕"），造成不必要的转人工。
const RISK_LIBRARY = [
  {
    level: 'high',
    category: '异常出血/剧烈疼痛',
    source: '风险规则库',
    keywords: ['剧烈疼痛', '大量出血', '腹痛难忍', '晕厥'],
    guidance: '这类症状可能需要及时的医学处置，建议尽快前往正规医院妇科/生殖科就诊，不建议自行判断或等待观察。',
    refIds: [5, 6]
  },
  {
    level: 'high',
    category: '长期未孕',
    source: '风险规则库',
    keywords: ['一年没有怀孕', '一年未孕', '两年没有怀孕', '备孕失败', '一直没怀孕', '一直没成功', '一直没怀上', '怀不上'],
    guidance: '达到"长期未孕"的判断标准，建议尽早就医做系统的生育力评估，而不是继续自行尝试观察。',
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
function matchFAQ(content) {
  return FAQ_LIBRARY.filter((item) => item.keywords.some((kw) => content.includes(kw)));
}

/**
 * 根据用户输入匹配风险规则库，返回命中的风险条目（可能为空数组=无风险）
 */
function matchRisk(content) {
  return RISK_LIBRARY.filter((item) => item.keywords.some((kw) => content.includes(kw)));
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
