// pages/report/report.js
const api = require('../../utils/api.js');
const app = getApp();

Page({
  data: {
    report: null,
    reportId: '',
    overallScore: 0
  },

  onLoad(options) {
    // 支持通过 navigateTo 传入 assessmentId/reportId，
    // 也支持从 globalData 中获取最近一次评估记录（tabBar 跳转场景）
    const reportId = options.reportId
      || options.assessmentId
      || app.globalData.pregnancyProfile.lastAssessmentId
      || '';

    this.setData({ reportId });
    this.loadReport(reportId);
  },

  onPullDownRefresh() {
    this.loadReport(this.data.reportId, () => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 加载AI报告详情
   * TODO: 后续对接真实后端后，api.getReportDetail 内部替换为真实接口即可
   */
  loadReport(reportId, callback) {
    api.getReportDetail(reportId).then((res) => {
      if (res.code === 0) {
        const report = res.data;
        // 综合评分：纯展示层的派生计算（3个指标的平均分），不改变数据来源
        const indicators = report.indicators || [];
        const overallScore = indicators.length
          ? Math.round(indicators.reduce((sum, item) => sum + item.score, 0) / indicators.length)
          : 0;
        this.setData({ report, overallScore });
      }
      callback && callback();
    }).catch(() => {
      callback && callback();
    });
  },

  onGoAssessment() {
    wx.switchTab({
      url: '/pages/assessment/assessment',
      fail: () => {
        wx.navigateTo({ url: '/pages/assessment/assessment' });
      }
    });
  }
});
