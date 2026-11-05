// pages/member/member.js
const api = require('../../utils/api.js');
const { MEMBER_PLANS, USE_CLOUD } = require('../../utils/constants.js');
const app = getApp();

const MEMBER_LEVEL_TEXT = {
  normal: '普通用户',
  vip: 'VIP会员',
  svip: 'SVIP至尊会员'
};

Page({
  data: {
    isLogin: false,
    userInfo: {},
    memberInfo: {
      isMember: false,
      level: 'normal',
      expireDate: null
    },
    memberLevelText: '',
    benefits: [
      'AI咨询无限次数',
      '专属备孕评估报告',
      '一对一AI健康顾问',
      '优先获得新功能体验'
    ],
    plans: MEMBER_PLANS,
    selectedPlanId: MEMBER_PLANS[0] && MEMBER_PLANS[0].id,
    paying: false
  },

  onLoad() {
    this.setData({
      isLogin: app.globalData.isLogin,
      userInfo: app.globalData.userInfo || {}
    });
    this.loadMemberInfo();
  },

  onShow() {
    this.setData({
      isLogin: app.globalData.isLogin,
      userInfo: app.globalData.userInfo || {}
    });
    this.loadMemberInfo();
  },

  /**
   * 获取会员信息
   * USE_CLOUD=false 时 api.getMemberInfo 返回mock数据（普通用户）
   * USE_CLOUD=true 时会调用 memberInfo 云函数查询真实会员状态
   */
  loadMemberInfo() {
    api.getMemberInfo().then((res) => {
      if (res.code === 0) {
        const memberInfo = res.data;
        this.setData({
          memberInfo,
          memberLevelText: MEMBER_LEVEL_TEXT[memberInfo.level] || '普通用户'
        });
      }
    });
  },

  /**
   * 微信登录
   */
  onLogin() {
    wx.getUserProfile({
      desc: '用于完善会员资料',
      success: (res) => {
        app.globalData.userInfo = res.userInfo;
        app.globalData.isLogin = true;
        this.setData({
          isLogin: true,
          userInfo: res.userInfo
        });
        // openid 已在 app.js onLaunch 中通过 login 云函数获取（USE_CLOUD=true 时）
      },
      fail: () => {
        wx.showToast({ title: '登录已取消', icon: 'none' });
      }
    });
  },

  onSelectPlan(e) {
    const { id } = e.currentTarget.dataset;
    this.setData({ selectedPlanId: id });
  },

  /**
   * 购买/续费会员
   * USE_CLOUD=false：提示需要先完成云开发配置（本地demo模式无法真实支付）
   * USE_CLOUD=true ：调用 createOrder 云函数下单，再用返回的支付参数调起 wx.requestPayment
   */
  onUpgrade() {
    if (!USE_CLOUD) {
      wx.showModal({
        title: '提示',
        content: '会员购买依赖微信云开发 + 微信支付商户号，当前是本地demo模式。请先按 README 完成云开发配置（USE_CLOUD 改为 true），再体验真实支付流程。',
        showCancel: false
      });
      return;
    }

    if (!this.data.isLogin) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    if (this.data.paying) return;
    this.setData({ paying: true });

    api
      .createMemberOrder(this.data.selectedPlanId)
      .then((res) => {
        if (res.code !== 0) {
          throw new Error(res.message || '下单失败');
        }
        const paymentParams = res.data;
        return new Promise((resolve, reject) => {
          wx.requestPayment({
            ...paymentParams,
            success: resolve,
            fail: reject
          });
        });
      })
      .then(() => {
        this.setData({ paying: false });
        wx.showToast({ title: '支付成功', icon: 'success' });
        // 支付成功回调 onPaySuccess 云函数会异步更新会员状态，稍等片刻再刷新
        setTimeout(() => this.loadMemberInfo(), 1500);
      })
      .catch((err) => {
        this.setData({ paying: false });
        const message = (err && err.errMsg && err.errMsg.includes('cancel'))
          ? '已取消支付'
          : (err && err.message) || '支付失败，请稍后重试';
        wx.showToast({ title: message, icon: 'none' });
      });
  },

  onGoReportList() {
    wx.navigateTo({
      url: '/pages/report/report',
      fail: () => {
        wx.switchTab({ url: '/pages/report/report' });
      }
    });
  },

  onGoChatHistory() {
    wx.switchTab({
      url: '/pages/chat/chat',
      fail: () => {
        wx.navigateTo({ url: '/pages/chat/chat' });
      }
    });
  },

  onContact() {
    wx.showToast({ title: '客服功能即将上线', icon: 'none' });
  }
});
