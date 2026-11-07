// components/XiaoNuanHeader/XiaoNuanHeader.js
Component({
  properties: {
    // 根页面隐藏返回按钮，子页面保留返回入口。
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
