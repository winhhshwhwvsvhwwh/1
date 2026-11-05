// utils/qualityCheck.js
// AI回复质量验证机制（对应 PRD 8.5）
//
// 当前是规则版评分（不是真正的NLU质量评估模型），按PRD评分表的4个维度打0-2分：
// 知识准确性 / 个性化程度 / 安全性 / 问题解决度
// 用途：当分数过低（比如既没查到知识库依据，也没结合用户数据）时，
// 在回复末尾提示可以转专家咨询，呼应PRD 8.2流程图里"回复质量检测 → AI回复/专家咨询"的分支。

/**
 * @param {object} params
 * @param {boolean} params.usedKnowledge  是否命中RAG知识库
 * @param {boolean} params.usedUserData   是否结合了用户周期数据
 * @param {string}  params.riskLevel      'none' | 'medium' | 'high'
 * @param {number}  params.suggestionCount 是否给出了可执行建议
 * @returns {{ knowledgeScore: number, personalizationScore: number, safetyScore: number, solutionScore: number, totalScore: number, suggestHandoff: boolean }}
 */
function review(params) {
  const { usedKnowledge, usedUserData, riskLevel, suggestionCount } = params;

  const knowledgeScore = usedKnowledge ? 2 : 1; // 有RAG依据=2分，纯通用话术=1分
  const personalizationScore = usedUserData ? 2 : 1; // 结合了用户周期数据=2分
  const safetyScore = riskLevel === 'none' ? 1 : 2; // 主动做了风险提醒=2分
  const solutionScore = suggestionCount >= 3 ? 2 : (suggestionCount > 0 ? 1 : 0);

  const totalScore = knowledgeScore + personalizationScore + safetyScore + solutionScore; // 满分8

  // 简单阈值：既没查到知识库依据、也没结合用户数据、还没给出建议 → 质量偏低，建议转专家咨询
  const suggestHandoff = totalScore <= 3;

  return { knowledgeScore, personalizationScore, safetyScore, solutionScore, totalScore, suggestHandoff };
}

module.exports = { review };
