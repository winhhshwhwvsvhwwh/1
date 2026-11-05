// components/ImagePreviewCard/ImagePreviewCard.js
Component({
  properties: {
    show: { type: Boolean, value: false },
    imageUrl: { type: String, value: '' },
    caption: { type: String, value: '' }
  },

  methods: {
    onCaptionInput(e) {
      this.triggerEvent('captioninput', { value: e.detail.value });
    },
    onCancel() {
      this.triggerEvent('cancel');
    },
    onSend() {
      this.triggerEvent('send');
    }
  }
});
