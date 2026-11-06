// components/XiaoNuanHeader/XiaoNuanHeader.js
Component({
  properties: {
    // 是否显示返回按钮。当页面是应用的根页面（比如只有AI咨询一个入口时）没有可返回的上一页，
    // 传false隐藏；隐藏时仍保留占位，保证中间的头像和标题居中不偏移
    showBack: { type: Boolean, value: true }
  },

  data: {
    statusBarHeight: 24, navigationHeight: 44, menuWidth: 100
  },

  lifetimes: {
    attached() {
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      const menu = wx.getMenuButtonBoundingClientRect();
      const statusBarHeight = info.statusBarHeight || 20;
      this.setData({ statusBarHeight, navigationHeight: (menu.top - statusBarHeight) * 2 + menu.height, menuWidth: info.windowWidth - menu.left + 8 });
    }
  },

  methods: {
    onBack() {

      // 返回按钮：具体导航行为交给父页面处理
      this.triggerEvent('back');
    },
    onNew() { this.triggerEvent('new'); },
    onHistory() { this.triggerEvent('history'); },
    onMore() {
      this.triggerEvent('more');
    }
  }
});
