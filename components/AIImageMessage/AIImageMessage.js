// components/AIImageMessage/AIImageMessage.js
Component({
  properties: {
    recognition: { type: String, value: '' },
    analysis: { type: String, value: '' },
    suggestions: { type: Array, value: [] },
    riskNotice: { type: String, value: '' }
  },

  methods: {
    /**
     * 底部操作按钮：继续咨询 / 查看周期 / 咨询医生
     * 具体跳转/弹窗逻辑交给父页面处理，组件只负责派发事件
     */
    onActionTap(e) {
      const { action } = e.currentTarget.dataset;
      this.triggerEvent('action', { action });
    }
  }
});
