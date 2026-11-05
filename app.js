// app.js
// 小暖AI备孕助手 - 小程序入口文件

const { USE_CLOUD, CLOUD_ENV_ID, CLOUD_FUNCTION } = require('./utils/constants.js');

App({
  /**
   * 全局数据
   */
  globalData: {
    userInfo: null,        // 微信用户信息，wx.getUserProfile 获取后写入
    isLogin: false,        // 是否已登录
    openid: null,          // 用户 openid。USE_CLOUD=true 时由云函数 login 返回
    memberInfo: {          // 会员信息，占位结构，真实数据见 utils/api.js getMemberInfo
      isMember: false,
      level: 'normal',
      expireDate: null
    },
    pregnancyProfile: {
      lastAssessmentId: null,
      lastReportId: null
    }
  },

  onLaunch() {
    this.initCloud();
    this.checkUpdate();
  },

  onShow() {},
  onHide() {},

  /**
   * 初始化微信云开发
   * USE_CLOUD=false（默认）时跳过，项目使用本地mock数据也能正常运行
   */
  initCloud() {
    if (!USE_CLOUD) return;

    if (!wx.cloud) {
      console.error('当前基础库版本过低，不支持云开发，请在开发者工具中升级基础库');
      return;
    }

    wx.cloud.init({
      env: CLOUD_ENV_ID,
      traceUser: true
    });

    // 调用 login 云函数获取 openid，云函数运行环境自带 OPENID，无需前端传递，安全可靠
    wx.cloud.callFunction({
      name: CLOUD_FUNCTION.LOGIN,
      success: (res) => {
        this.globalData.openid = res.result && res.result.openid;
        this.globalData.isLogin = !!this.globalData.openid;
      },
      fail: (err) => {
        console.error('login 云函数调用失败', err);
      }
    });
  },

  /**
   * 检查小程序版本更新
   */
  checkUpdate() {
    if (!wx.canIUse('getUpdateManager')) return;
    const updateManager = wx.getUpdateManager();
    updateManager.onCheckForUpdate(function () {});
    updateManager.onUpdateReady(function () {
      wx.showModal({
        title: '更新提示',
        content: '新版本已经准备好，是否重启应用？',
        success(res) {
          if (res.confirm) updateManager.applyUpdate();
        }
      });
    });
  }
});
