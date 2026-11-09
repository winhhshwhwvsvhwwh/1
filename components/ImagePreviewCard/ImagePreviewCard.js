// components/ImagePreviewCard/ImagePreviewCard.js
Component({
  properties: {
    reportMode:{type:Boolean,value:false},
    reportItems:{type:Array,value:[]},
    reportWarnings:{type:Array,value:[]},
    busy:{type:Boolean,value:false},
    show: { type: Boolean, value: false },
    imageUrl: { type: String, value: '' },
    caption: { type: String, value: '' }
  },

  methods: {
    onReportItemInput(e) { if(!this.properties.busy)this.triggerEvent('itemchange',{index:Number(e.currentTarget.dataset.index),field:e.currentTarget.dataset.field,value:e.detail.value}); },
    onCaptionInput(e) {
      this.triggerEvent('captioninput', { value: e.detail.value });
    },
    onCancel() {
      this.triggerEvent('cancel');
    },
    onSend() {
      if(this.properties.busy)return;
      this.triggerEvent('send');
    }
  }
});
