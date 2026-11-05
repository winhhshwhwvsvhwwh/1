// utils/imageAnalysis.js
// 图片咨询：类型识别 + Skill分流 + 生成结构化回复
//
// ============ 重要的诚实声明 ============
// 项目目前没有接入真正的视觉/OCR模型（比如GLM-4V这类多模态模型），云函数
// cloudfunctions/aiChat 现在调用的是纯文本对话接口，读不懂图片像素内容。
// 所以这里的"图片类型识别"实际上是：根据用户发图时顺带打的文字描述做关键词匹配，
// 不是真的看懂了图片里排卵试纸的颜色深浅、检查报告的具体数值。
// 这一点在返回给用户的文案里也如实写明了（"recognition"字段），不会假装AI看懂了图片。
//
// 如果以后要做成真视觉分析，需要：
// 1. 把图片上传到云存储（wx.cloud.uploadFile）
// 2. 云函数里换成支持图片输入的多模态模型API（消息体里带image_url）
// 3. 把模型识别到的内容，接入下面同样的Skill分流逻辑

const riskSkill = require('./skills/riskSkill.js');
const userContext = require('./skills/userContext.js');

// 图片类型分类关键词（对用户描述文字做匹配，不是图片内容本身）
const CATEGORY_KEYWORDS = {
  ovulation_strip: ['排卵试纸', '排卵棒', '试纸', '强阳', '弱阳', '两条杠', '排卵检测'],
  exam_report: ['检查报告', '体检报告', '化验单', '报告单', 'B超', '激素六项', '性激素', '检验单'],
  cycle_screenshot: ['周期截图', '周期表', '月经记录', '经期记录', 'app截图', 'App截图']
};

const CATEGORY_LABEL = {
  ovulation_strip: '排卵试纸',
  exam_report: '检查报告',
  cycle_screenshot: '周期记录截图',
  unknown: '无法确定类型'
};

/**
 * 按用户描述文字分类图片类型（对应PRD"图片类型识别逻辑"）
 * @param {string} caption 用户发图时输入的文字描述
 * @returns {'ovulation_strip'|'exam_report'|'cycle_screenshot'|'unknown'}
 */
function classifyByCaption(caption) {
  const text = caption || '';
  for (const category of Object.keys(CATEGORY_KEYWORDS)) {
    if (CATEGORY_KEYWORDS[category].some((kw) => text.includes(kw))) {
      return category;
    }
  }
  return 'unknown';
}

function buildOvulationReply(caption, latestRecord) {
  const understanding = '收到你发来的图片，看描述应该是排卵试纸的检测结果~';
  const analysis = '排卵试纸一般是对比"检测线"和"对照线"的深浅来判断：检测线颜色≥对照线，通常视为阳性（强阳提示接下来24-36小时内排卵概率较高）；比对照线浅则是阴性。不过AI目前没法直接从图片里读出线条的实际颜色深浅，具体这次的结果，还是需要你对照实物或者把颜色深浅的描述打字告诉我，我可以基于你的描述帮你进一步分析。';
  const suggestions = [
    '把检测线和对照线的深浅对比用文字告诉我（比如"测试线比对照线深"），我可以帮你进一步分析',
    '连续测2-3天，观察颜色变化趋势，比单次结果更有参考价值',
    userContext.buildShortSummary(latestRecord)
      ? `结合你「周期记录」里的数据（${userContext.buildShortSummary(latestRecord)}）一起看，判断会更准`
      : '也可以先去「周期记录」页面记录一下当前周期数据，结合起来判断会更准'
  ];
  return { understanding, analysis, suggestions };
}

function buildExamReportReply(caption, latestRecord) {
  const understanding = '看起来你上传的是一份检查报告，这类报告涉及专业医学解读~';
  const analysis = 'AI目前没法直接读取报告图片里的具体数值和结论——这类判断需要专业医生结合你的整体情况来看。如果你把报告里想咨询的具体指标名称和数值打字告诉我，我可以基于公开的科普知识帮你理解大概含义，但没法替代医生的诊断意见。';
  const suggestions = [
    '把想咨询的具体指标/数值打字告诉我（比如"AMH是多少"），我可以帮你解读大概含义',
    '这份报告建议带去找开具检查的医生或生殖科医生当面解读，结合你的具体情况判断',
    '如果报告里有异常标注（箭头、加号等），建议优先咨询医生，不要自行下结论'
  ];
  return { understanding, analysis, suggestions };
}

function buildCycleScreenshotReply(caption, latestRecord) {
  const understanding = '看起来你想让我看看周期相关的记录或截图~';
  const shortSummary = userContext.buildShortSummary(latestRecord);
  const analysis = 'AI目前没法直接读取截图里的具体日期和数据。' + (shortSummary
    ? `不过看到你在「周期记录」里已经有数据了（${shortSummary}），我可以直接结合这份数据帮你分析。`
    : '如果你把截图里的关键信息（比如周期天数、末次月经日期）打字告诉我，或者直接去「周期记录」页面正式录入，我就能自动结合这些数据分析了。');
  const suggestions = [
    '把截图里的关键数据（周期天数、末次月经日期等）打字告诉我，我可以帮你分析',
    '建议把这些数据正式记录到「周期记录」页面，之后我能自动读取、不用每次手动描述',
    '如果只是想了解周期相关的知识，也可以直接用文字问我'
  ];
  return { understanding, analysis, suggestions };
}

function buildUnknownReply() {
  const understanding = '收到你发的图片啦~';
  const analysis = '不过AI目前还没法直接看懂图片里的具体内容（这需要接入专门的视觉识别模型，现在还没有），麻烦你用文字简单描述一下这张图是什么、想问我什么，我就能更准确地帮你分析啦。';
  const suggestions = [
    '描述一下图片类型，比如"这是排卵试纸"、"这是检查报告"、"这是周期截图"',
    '或者直接打字告诉我你的具体问题',
    '如果比较着急，也可以回复"转人工"，我帮你引导去咨询医生'
  ];
  return { understanding, analysis, suggestions };
}

/**
 * 根据图片类型评估风险等级：
 * - 复用riskSkill对用户描述文字的风险关键词检测
 * - 检查报告类默认至少按medium处理（涉及专业医学解读，天然需要提醒）
 */
function assessImageRisk(category, caption) {
  const textRisk = riskSkill.assessRisk(caption || '');
  if (category === 'exam_report' && textRisk.riskLevel === 'none') {
    return {
      riskLevel: 'medium',
      riskNotice: '检查报告涉及专业医学解读，AI没法替代医生给出诊断结论，建议带着报告原件咨询开具检查的医生或生殖科医生。',
      refIds: []
    };
  }
  return textRisk;
}

/**
 * 图片咨询主入口
 * @param {string} caption 用户发图时输入的文字描述（可能为空）
 * @param {object|null} latestRecord 最近一条周期记录
 * @returns {{ category: string, recognition: string, analysis: string, suggestions: string[], riskLevel: string, riskNotice: string }}
 */
function analyzeImage(caption, latestRecord) {
  const category = classifyByCaption(caption);

  let reply;
  switch (category) {
    case 'ovulation_strip':
      reply = buildOvulationReply(caption, latestRecord);
      break;
    case 'exam_report':
      reply = buildExamReportReply(caption, latestRecord);
      break;
    case 'cycle_screenshot':
      reply = buildCycleScreenshotReply(caption, latestRecord);
      break;
    default:
      reply = buildUnknownReply();
  }

  const risk = assessImageRisk(category, caption);

  // 识别结果文案：如实说明这是"根据你的描述判断"，不是真的分析了图片内容
  const recognition = category === 'unknown'
    ? '暂时无法从你的描述里判断图片类型（AI还不能直接读取图片内容）'
    : `根据你的描述，这张图片可能和"${CATEGORY_LABEL[category]}"有关`;

  // 安全提示：图片分析结果必须带这句话，风险等级高时再追加具体建议
  const baseDisclaimer = '图片分析仅作为辅助参考，不能替代医生诊断。';
  const riskNotice = risk.riskLevel === 'none'
    ? baseDisclaimer
    : `${baseDisclaimer} ${risk.riskNotice}`;

  return {
    category,
    recognition,
    analysis: reply.analysis,
    understanding: reply.understanding,
    suggestions: reply.suggestions,
    riskLevel: risk.riskLevel,
    riskNotice
  };
}

module.exports = { analyzeImage, classifyByCaption, CATEGORY_LABEL };
