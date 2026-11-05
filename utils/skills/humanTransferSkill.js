// utils/skills/humanTransferSkill.js
// 类型E｜人工咨询转接Skill（对应 PRD 8.4 Skill05）
// 触发条件：1.用户主动请求人工/专家  2.AI反复无法解决用户问题
// （原PRD条件里的"高风险问题"现在归类型D「医疗风险」单独承接，riskSkill会在建议里
//  提示"可以回复'转人工'联系专业医生"，避免D和E两个类型互相打架）
// 输出：明确引导用户去正规医疗渠道咨询，同时保留继续问AI的选项
//
// 注：当前项目还没有真实的人工/专家客服通道，这里是产品架构的"预留位"，
// 不会假装真的转接到了人工。

const userContext = require('./userContext.js');

/**
 * @param {string} content 用户输入
 * @param {object} intent  intentRouter.analyzeIntent 的返回结果，
 *                         handoffReason 由 intentRouter 统一判断（'user_request' | 'unresolved'）
 * @param {object|null} latestRecord 最近一条周期记录（可能为空）
 * @returns {{ understanding: string, analysisLines: string[], suggestions: string[], handoffReason: string, usedUserData: boolean }}
 */
function handle(content, intent, latestRecord) {
  const handoffReason = (intent && intent.handoffReason) || '';

  const understanding = '这种情况呀，我建议还是交给专业医生来判断会更稳妥。';

  const analysisLinesByReason = {
    user_request: ['了解，你是想找更专业的人工/医生解答对吧，没问题。'],
    unresolved: ['看起来我刚才的回答没有说到点子上，不好意思。']
  };
  const analysisLines = analysisLinesByReason[handoffReason] || ['这类问题建议结合专业医生的意见一起判断，我这边先给你一些参考方向。'];

  // 个性化：有真实周期数据时，直接把具体数值列出来，而不是"整理一下带过去"这种空话
  const shortSummary = userContext.buildShortSummary(latestRecord);
  const dataForDoctorTip = shortSummary
    ? `就诊时可以直接把这份数据给医生看：${shortSummary}（来自你在「周期记录」里的记录），能帮医生更快了解情况`
    : '就诊前可以把「周期记录」里的数据（周期长度、经期、身体状态）整理一下带过去，医生能更快了解情况';

  const suggestions = [
    '建议去正规医院的妇科/生殖科看看，让医生结合面诊和检查结果给你判断',
    dataForDoctorTip,
    '如果只是想继续聊聊备孕相关的知识，随时可以换个问题问我'
  ];

  return {
    skillId: 'human_transfer',
    understanding,
    analysisLines,
    suggestions,
    refIds: [],
    handoffReason,
    usedUserData: !!shortSummary
  };
}

module.exports = { handle };
