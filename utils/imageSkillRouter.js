// utils/imageSkillRouter.js
//
// 图片咨询的"图片类型识别"逻辑说明（如实告知，不是真的图像识别）：
// 当前项目没有接入真正的视觉AI/OCR能力，没法直接"看懂"图片像素内容。
// 这里的"识别图片类型"，实际上是根据用户上传图片时补充的文字说明（caption）做关键词匹配，
// 不是分析了图片本身。这是真实的技术限制，代码里如实标注，回复给用户的文案也不会
// 假装"我看到了图片里的内容"。
//
// 如果以后要接入真实的图像识别（比如智谱GLM-4V这类多模态模型，把图片转base64传给
// 视觉API做真正的内容识别），可以把 classifyImageType() 内部实现换成真实的视觉API调用，
// 上层调用方式（analyzeImage的输入输出结构）不需要变。
//
// 图片类型 → Skill 映射（按需求文档）：
//   排卵试纸   → 周期分析Skill（复用 cycleSkill）
//   周期截图   → 周期分析Skill（复用 cycleSkill）
//   检查报告   → 风险识别Skill（复用 riskSkill）
//   无法识别   → 基础咨询式的澄清引导（不编造分析内容）

const riskSkill = require('./skills/riskSkill.js');
const userContext = require('./skills/userContext.js');

const OVULATION_KEYWORDS = ['排卵试纸', '排卵棒', '试纸', 'lh', 'LH'];
const REPORT_KEYWORDS = ['检查报告', '报告单', '化验单', '检查单', 'b超', 'B超', '血常规', '抽血', '激素六项'];
const CYCLE_SCREENSHOT_KEYWORDS = ['周期截图', '经期记录', '月经记录', '周期app', '周期APP', 'app截图', '记录截图'];

const TYPE_LABEL = {
  ovulation_strip: '排卵试纸图片',
  medical_report: '检查报告图片',
  cycle_screenshot: '周期记录截图',
  unknown: '暂未识别的图片类型'
};

const SAFETY_NOTICE = '图片分析仅作为辅助参考，不能替代医生诊断。';

/**
 * 根据用户补充的文字说明，判断图片类型（不是真图像识别，见文件头说明）
 * @param {string} caption 用户上传图片时补充的文字
 * @returns {'ovulation_strip'|'medical_report'|'cycle_screenshot'|'unknown'}
 */
function classifyImageType(caption) {
  const text = caption || '';
  if (OVULATION_KEYWORDS.some((kw) => text.includes(kw))) return 'ovulation_strip';
  if (REPORT_KEYWORDS.some((kw) => text.includes(kw))) return 'medical_report';
  if (CYCLE_SCREENSHOT_KEYWORDS.some((kw) => text.includes(kw))) return 'cycle_screenshot';
  return 'unknown';
}

/**
 * 生成AI图片分析回复（AIImageMessage组件要用的结构化数据）
 * @param {string} caption 用户补充的文字说明
 * @param {object|null} latestRecord 最近一条周期记录（用于个性化，可能为空）
 * @returns {{ imageType, recognition, analysisLines, suggestions, riskLevel, riskNotice, refIds, needHandoff }}
 */
function analyzeImage(caption, latestRecord) {
  const type = classifyImageType(caption);

  // -------- 无法识别：如实引导用户补充信息，不编造分析内容 --------
  if (type === 'unknown') {
    return {
      imageType: type,
      recognition: '这张图片我没能从你的文字说明里判断出具体类型（当前还没有接入真实的图像识别能力，需要你补充说明）。',
      analysisLines: ['麻烦告诉我这张图片具体是什么，比如"这是排卵试纸"、"这是检查报告"，或者"这是周期记录截图"，我再帮你分析。'],
      suggestions: [
        '补充说明图片类型，我可以更准确地帮你分析',
        '也可以直接用文字描述你想咨询的问题',
        '如果内容比较复杂，建议直接咨询医生'
      ],
      riskLevel: 'none',
      riskNotice: SAFETY_NOTICE,
      refIds: [],
      needHandoff: false
    };
  }

  // -------- 检查报告 → 风险识别Skill --------
  if (type === 'medical_report') {
    const risk = riskSkill.assessRisk(caption || '检查报告');
    // 检查报告类内容本身就建议由医生解读，即使没命中风险规则库关键词，也不给"none"级别，
    // 至少按medium谨慎处理（不是因为检测到风险，而是这类内容本身超出AI科普的判断范围）
    const riskLevel = risk.riskLevel === 'none' ? 'medium' : risk.riskLevel;
    return {
      imageType: type,
      recognition: `检测到你上传的可能是${TYPE_LABEL[type]}（根据你的文字说明判断，不是真的读取了报告里的数值）。`,
      analysisLines: ['报告里的具体数值、指标是否正常，我没法直接读取和判断，这类结果需要结合你的具体情况，由医生专业解读才准确。'],
      suggestions: [
        '建议带着报告原件请医生当面解读具体数值',
        '保留好报告和既往病历，方便复诊时对照',
        '如果报告上有医生标注的异常指标，建议尽快就医'
      ],
      riskLevel,
      riskNotice: SAFETY_NOTICE,
      refIds: risk.refIds,
      needHandoff: riskLevel === 'high'
    };
  }

  // -------- 排卵试纸 / 周期截图 → 周期分析Skill（复用cycleSkill的真实计算逻辑） --------
  const cycleContext = userContext.buildPersonalizationContext(latestRecord);
  const recognitionText = type === 'ovulation_strip'
    ? `检测到你上传的可能是${TYPE_LABEL[type]}（根据你的文字说明判断，试纸上的深浅/双杠这类具体结果我没法直接读取）。`
    : `检测到你上传的可能是${TYPE_LABEL[type]}（根据你的文字说明判断，截图里的具体数据我没法直接读取）。`;

  const analysisLines = [];
  if (type === 'ovulation_strip') {
    analysisLines.push('排卵试纸的深浅变化建议连续几天对比着看，单张图片不容易判断准确的排卵时间点。');
  } else {
    analysisLines.push('这类截图里的数据我没法直接读取，不过可以结合你在「周期记录」里保存的数据帮你分析。');
  }
  if (cycleContext) {
    analysisLines.push(cycleContext.text);
  } else {
    analysisLines.push('你还没有在「周期记录」里添加数据，建议把截图里的关键信息同步记录一下，我能分析得更准。');
  }

  const suggestions = type === 'ovulation_strip'
    ? ['提供检测时间，方便对照排卵窗口', '结合月经周期一起判断，单次结果仅供参考', '连续记录几天的变化，趋势比单次结果更有意义']
    : ['把截图里的关键数据同步记录到「周期记录」页，方便AI后续分析', '结合基础体温、排卵试纸等多种方式交叉验证', '持续记录几个周期，规律会更清晰'];

  return {
    imageType: type,
    recognition: recognitionText,
    analysisLines,
    suggestions,
    riskLevel: 'none',
    riskNotice: SAFETY_NOTICE,
    refIds: [],
    needHandoff: false
  };
}

module.exports = { classifyImageType, analyzeImage, TYPE_LABEL, SAFETY_NOTICE };
