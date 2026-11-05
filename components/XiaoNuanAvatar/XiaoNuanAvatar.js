// components/XiaoNuanAvatar/XiaoNuanAvatar.js
Component({
  properties: {
    // 传入设计稿标注的px值即可，组件内部按 1px = 2rpx 自动换算
    // 顶部导航用48，消息区域用40
    size: {
      type: Number,
      value: 40
    }
  },

  data: {
    sizeRpx: 80
  },

  observers: {
    size(val) {
      this.setData({ sizeRpx: (val || 40) * 2 });
    }
  }
});
