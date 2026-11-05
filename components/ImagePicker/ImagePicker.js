// components/ImagePicker/ImagePicker.js
Component({
  properties: {
    show: { type: Boolean, value: false }
  },

  methods: {
    noop() {
      // 阻止点击面板本身时冒泡触发遮罩层的关闭逻辑
    },
    onMaskTap() {
      this.triggerEvent('cancel');
    },
    onCancel() {
      this.triggerEvent('cancel');
    },
    onSelect(e) {
      const { action } = e.currentTarget.dataset; // 'album' | 'camera'
      this.triggerEvent('select', { action });
    }
  }
});
