// pages/assessment/assessment.js
const api = require('../../utils/api.js');
const app = getApp();

Page({
  data: {
    questions: [],   // 问卷题目列表
    answers: {},     // { [questionId]: selectedOptionIndex }
    submitting: false
  },

  onLoad() {
    this.loadQuestions();
  },

  /**
   * 加载评估问卷题目
   * TODO: 后续从后端/数据库获取真实题目，当前使用 api.js 中的 mock 数据
   */
  loadQuestions() {
    api.getAssessmentQuestions().then((res) => {
      if (res.code === 0) {
        this.setData({ questions: res.data });
      }
    });
  },

  /**
   * 选择选项
   */
  onSelectOption(e) {
    const { qid, optindex } = e.currentTarget.dataset;
    this.setData({
      [`answers.${qid}`]: Number(optindex)
    });
  },

  /**
   * 提交评估
   */
  onSubmit() {
    const { questions, answers } = this.data;

    const unanswered = questions.find((q) => answers[q.id] === undefined);
    if (unanswered) {
      wx.showToast({ title: '还有题目未作答哦', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });

    // 将 { qid: optionIndex } 转换为 [{ title, answer }]，
    // USE_CLOUD=true 时会传给 aiAssessment 云函数用于生成AI报告；
    // USE_CLOUD=false 时 api.submitAssessment 内部会忽略这个参数、直接返回mock数据
    const answerList = questions.map((q) => ({
      title: q.title,
      answer: q.options[answers[q.id]]
    }));

    api.submitAssessment(answerList).then((res) => {
      this.setData({ submitting: false });
      if (res.code === 0) {
        const { assessmentId } = res.data;
        app.globalData.pregnancyProfile.lastAssessmentId = assessmentId;

        wx.showToast({ title: '提交成功', icon: 'success' });

        setTimeout(() => {
          wx.switchTab({
            url: '/pages/report/report',
            fail: () => {
              wx.navigateTo({ url: `/pages/report/report?reportId=${assessmentId}` });
            }
          });
        }, 800);
      } else {
        wx.showToast({ title: res.message || '提交失败，请稍后重试', icon: 'none' });
      }
    }).catch(() => {
      this.setData({ submitting: false });
      wx.showToast({ title: '提交失败，请稍后重试', icon: 'none' });
    });
  }
});
