// components/XiaoNuanHeader/XiaoNuanHeader.js
Component({
  properties: {
    // 是否显示返回按钮。当页面是应用的根页面（比如只有AI咨询一个入口时）没有可返回的上一页，
    // 传false隐藏；隐藏时仍保留占位，保证中间的头像和标题居中不偏移
    showBack: { type: Boolean, value: true }
  },

  data: {
    statusBarHeight: 0
  },

  lifetimes: {
    attached() {
      // 页面用的是默认导航栏（chat.json没有设置navigationStyle:custom），
      // 这里不需要额外让出状态栏高度；保留这个字段是为了以后如果改成自定义导航栏时方便扩展，
      // 当前统一置0，不影响现有页面结构。
      this.setData({ statusBarHeight: 0 });
    }
  },

  methods: {
    onBack() {
      if (!this.properties.showBack) return;
      // 返回按钮：具体导航行为交给父页面处理
      this.triggerEvent('back');
    },
    onMore() {
      this.triggerEvent('more');
    }
  }
});
