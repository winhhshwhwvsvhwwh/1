// utils/api.js
// 业务接口统一封装。
//
// USE_CLOUD=false（默认）：所有方法返回 mock 数据（Promise），无需任何配置即可跑通全部页面。
// USE_CLOUD=true         ：按 README「云开发配置清单」完成配置后，
//                          自动改为调用 cloudfunctions/ 目录下对应的云函数。
// 页面层代码在两种模式下完全不需要改动。

const { USE_CLOUD, CLOUD_FUNCTION } = require('./constants.js');
const skillDispatcher = require('./skillDispatcher.js');
const imageSkillRouter = require('./imageSkillRouter.js');
const recordStore = require('./recordStore.js');

function callCloudFunction(name, data) {
  return new Promise((resolve, reject) => {
    if (!wx.cloud) {
      reject(new Error('当前环境不支持云开发，请检查基础库版本'));
      return;
    }
    wx.cloud.callFunction({
      name,
      data,
      success: (res) => resolve(res.result),
      fail: reject
    });
  });
}

/* ============ AI 咨询 相关 ============ */
//
// USE_CLOUD=false 时，AI回复由 utils/skillDispatcher.js 生成，
// 内部按 PRD「AI能力架构设计」走：意图识别 → Skill调度 → RAG知识库检索 →
// 风险识别（并行）→ 回复质量检测 → 组装最终文本。
// 详见 utils/intentRouter.js、utils/skills/*.js、utils/qualityCheck.js。

/**
 * 模拟AI回复生成函数（USE_CLOUD=false 时使用）
 */
function sendChatMessageMock(content,context) {
  // 本地演示等待，让用户能看清发送与加载状态；不代表模型推理耗时。
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      Promise.resolve().then(() => skillDispatcher.dispatch(content,context)).then(resolve, reject);
    }, 1200);
  });
}

/**
 * 图片咨询接口。
 * 注：当前没有接入真实的云端图像识别服务，图片本身没有被上传到任何服务器分析——
 * "分析"是根据用户输入的文字说明（caption）做的，具体见 utils/imageSkillRouter.js 头部说明。
 * @param {string} caption 用户上传图片时补充的文字说明
 */
function sendImageMessage(caption) {
  return new Promise((resolve) => {
    setTimeout(() => {
      recordStore.getRecords().then((records) => {
        const latestRecord = records && records[0];
        const result = imageSkillRouter.analyzeImage(caption, latestRecord);
        resolve({
          code: 0,
          data: {
            role: 'assistant',
            messageType: 'image_analysis',
            imageType: result.imageType,
            imageTypeLabel: imageSkillRouter.TYPE_LABEL[result.imageType],
            recognition: result.recognition,
            analysis: result.analysisLines.join('\n'),
            suggestions: result.suggestions,
            riskNotice: result.riskNotice,
            riskLevel: result.riskLevel,
            needHandoff: result.needHandoff,
            timestamp: Date.now()
          }
        });
      });
    }, 800);
  });
}

function sendChatMessage(content,context) {
  if (USE_CLOUD) {
    return callCloudFunction(CLOUD_FUNCTION.AI_CHAT, { content });
  }
  return sendChatMessageMock(content,context);
}

function getChatHistory() {
  if (USE_CLOUD) {
    return callCloudFunction(CLOUD_FUNCTION.AI_CHAT, { action: 'history' })
      .catch(() => ({ code: 0, data: [] }));
  }
  return Promise.resolve({ code: 0, data: [] });
}

/* ============ AI 评估 相关 ============ */

function getAssessmentQuestions() {
  // 问卷题目相对固定，暂不放到云函数里，直接在前端维护，方便快速调整题目
  return Promise.resolve({
    code: 0,
    data: [
      { id: 'q1', type: 'single', title: '你的年龄范围是？', options: ['20-25岁', '26-30岁', '31-35岁', '35岁以上'] },
      { id: 'q2', type: 'single', title: '备孕时长？', options: ['未开始', '3个月内', '3-6个月', '半年以上'] },
      { id: 'q3', type: 'single', title: '月经周期是否规律？', options: ['规律', '不规律', '不确定'] }
    ]
  });
}

function submitAssessmentMock() {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ code: 0, data: { assessmentId: 'mock_assessment_' + Date.now() } });
    }, 500);
  });
}

/**
 * 提交评估问卷答案
 * @param {Array} answers [{ title, answer }]，页面层已将选项索引转换为可读文本
 */
function submitAssessment(answers) {
  if (USE_CLOUD) {
    return callCloudFunction(CLOUD_FUNCTION.AI_ASSESSMENT, { answers }).then((res) => ({
      code: res.code,
      data: { assessmentId: res.data && res.data.reportId },
      message: res.message
    }));
  }
  return submitAssessmentMock();
}

/* ============ AI 报告 相关 ============ */

function getReportDetailMock(reportId) {
  return Promise.resolve({
    code: 0,
    data: {
      reportId: reportId || 'mock_report_id',
      generateTime: '2026-08-01',
      summary: '（示例数据）根据你的评估结果，整体备孕状态良好，建议保持规律作息。',
      indicators: [
        { name: '身体状态', score: 85 },
        { name: '心理状态', score: 78 },
        { name: '生活习惯', score: 90 }
      ],
      suggestions: [
        '保持规律作息，避免熬夜',
        '适度运动，每周3-4次有氧运动',
        '均衡饮食，补充叶酸'
      ]
    }
  });
}

/**
 * 获取AI报告详情
 * @param {string} reportId 云开发模式下为 reports 集合的 _id
 */
function getReportDetail(reportId) {
  if (USE_CLOUD && reportId) {
    if (!wx.cloud) return getReportDetailMock(reportId);
    return wx.cloud
      .database()
      .collection('reports')
      .doc(reportId)
      .get()
      .then((res) => ({ code: 0, data: { ...res.data, reportId } }))
      .catch(() => ({ code: 1, message: '报告获取失败' }));
  }
  return getReportDetailMock(reportId);
}

function getReportList() {
  if (USE_CLOUD && wx.cloud) {
    return wx.cloud
      .database()
      .collection('reports')
      .orderBy('createTime', 'desc')
      .get()
      .then((res) => ({ code: 0, data: res.data }))
      .catch(() => ({ code: 0, data: [] }));
  }
  return Promise.resolve({ code: 0, data: [] });
}

/* ============ 会员中心 相关 ============ */

function getMemberInfoMock() {
  return Promise.resolve({ code: 0, data: { isMember: false, level: 'normal', expireDate: null } });
}

function getMemberInfo() {
  if (USE_CLOUD) {
    return callCloudFunction(CLOUD_FUNCTION.MEMBER_INFO).catch(() => getMemberInfoMock());
  }
  return getMemberInfoMock();
}

/**
 * 创建会员购买订单，返回可直接传给 wx.requestPayment 的支付参数
 * @param {string} planId 对应 utils/constants.js 中 MEMBER_PLANS 的 id
 */
function createMemberOrder(planId) {
  if (!USE_CLOUD) {
    return Promise.reject(new Error('会员购买功能需要先完成云开发配置，详见 README'));
  }
  return callCloudFunction(CLOUD_FUNCTION.CREATE_ORDER, { planId });
}

module.exports = {
  sendChatMessage,
  sendImageMessage,
  getChatHistory,
  getAssessmentQuestions,
  submitAssessment,
  getReportDetail,
  getReportList,
  getMemberInfo,
  createMemberOrder
};
