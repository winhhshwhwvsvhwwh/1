// pages/index/index.js
const app = getApp();
const recordStore = require('../../utils/recordStore.js');

const DEFAULT_CYCLE_STATUS = {
  cycleDay: 0,
  phase: '暂无数据',
  daysToOvulation: 0,
  progress: 0
};

/**
 * 根据最近一条周期记录，估算今日备孕状态
 * 这是一个简化的示例算法，仅用于demo展示；
 * TODO: 阶段8接入AI接口后，可用更精准的模型代替这里的规则计算
 * 注：latestRecord 字段为 { startDate, endDate, cycleLength, periodLength, symptoms }
 */
function calcCycleStatus(latestRecord) {
  if (!latestRecord) return DEFAULT_CYCLE_STATUS;

  const cycleLength = Number(latestRecord.cycleLength) || 28;
  const startDate = new Date(latestRecord.startDate);
  const today = new Date();

  const diffDays = Math.floor((today - startDate) / (24 * 60 * 60 * 1000));
  // 若已经超过一个周期，按最近一个周期取模，避免天数无限增长
  const cycleDay = (diffDays % cycleLength) + 1;

  const ovulationDay = Math.round(cycleLength / 2); // 排卵日简化为周期中点
  const daysToOvulation = ovulationDay - cycleDay;

  let phase = '黄体期';
  if (cycleDay <= 5) {
    phase = '月经期';
  } else if (Math.abs(daysToOvulation) <= 2) {
    phase = '排卵期';
  } else if (cycleDay < ovulationDay) {
    phase = '卵泡期';
  }

  const progress = Math.min(100, Math.round((cycleDay / cycleLength) * 100));

  return {
    cycleDay,
    phase,
    daysToOvulation: daysToOvulation > 0 ? daysToOvulation : 0,
    progress
  };
}

Page({
  data: {
    userName: '姐妹',

    // AI IP 问候语
    greeting: '你好，我是小暖，陪你记录每一次备孕变化。',

    // 今日备孕状态卡片，默认无数据状态，onShow 时会用真实记录覆盖
    cycleStatus: DEFAULT_CYCLE_STATUS,
    hasRecord: false,

    // 四宫格功能入口
    entries: [
      { name: 'AI咨询', desc: '一对一智能问答', icon: '💬', path: '/pages/chat/chat', ready: true },
      { name: '周期记录', desc: '记录经期与状态', icon: '📅', path: '/pages/record/record', ready: true },
      { name: '备孕评估', desc: '了解备孕状态', icon: '📋', path: '/pages/assessment/assessment', ready: true },
      { name: '我的报告', desc: '查看AI分析报告', icon: '📊', path: '/pages/report/report', ready: true }
    ]
  },

  onLoad() {
    // TODO: 后续接入登录/用户信息接口后，替换为真实用户昵称
    const userInfo = app.globalData.userInfo;
    if (userInfo && userInfo.nickName) {
      this.setData({ userName: userInfo.nickName });
    }
  },

  onShow() {
    this.refreshCycleStatus();
  },

  /**
   * 根据周期记录（utils/recordStore.js）刷新今日备孕状态
   * 阶段7接数据库后，recordStore 内部实现替换即可，这里逻辑不需要改动
   */
  refreshCycleStatus() {
    recordStore
      .getRecords()
      .then((records) => {
        const latestRecord = records[0];
        this.setData({
          cycleStatus: calcCycleStatus(latestRecord),
          hasRecord: !!latestRecord
        });
      })
      .catch((err) => {
        console.error('refreshCycleStatus error', err);
      });
  },

  /**
   * 四宫格功能入口点击跳转
   */
  onEntryTap(e) {
    const { path, ready } = e.currentTarget.dataset;
    if (!path) return;

    if (!ready) {
      wx.showToast({ title: '功能开发中，敬请期待', icon: 'none' });
      return;
    }

    wx.switchTab({
      url: path,
      fail: () => {
        // 非 tabBar 页面时使用 navigateTo 兜底
        wx.navigateTo({ url: path });
      }
    });
  },

  /**
   * 底部会员入口点击跳转
   */
  onMemberTap() {
    wx.switchTab({
      url: '/pages/member/member',
      fail: () => {
        wx.navigateTo({ url: '/pages/member/member' });
      }
    });
  }
});
