// components/UserMessage/UserMessage.js
Component({
  properties: {
    content: { type: String, value: '' },
    imageUrl: { type: String, value: '' },
    voiceUrl: { type: String, value: '' },
    voiceDuration: { type: Number, value: 0 }
  },

  data: {
    playing: false
  },

  lifetimes: {
    detached() {
      if (this.audioCtx) {
        this.audioCtx.destroy();
        this.audioCtx = null;
      }
    }
  },

  methods: {
    onPlayVoice() {
      if (!this.properties.voiceUrl) return;

      if (!this.audioCtx) {
        this.audioCtx = wx.createInnerAudioContext();
        this.audioCtx.src = this.properties.voiceUrl;
        this.audioCtx.onEnded(() => this.setData({ playing: false }));
        this.audioCtx.onStop(() => this.setData({ playing: false }));
        this.audioCtx.onError((err) => {
          console.error('语音播放失败', err);
          this.setData({ playing: false });
          wx.showToast({ title: '播放失败', icon: 'none' });
        });
      }

      if (this.data.playing) {
        this.audioCtx.stop();
        this.setData({ playing: false });
      } else {
        this.audioCtx.play();
        this.setData({ playing: true });
      }
    }
  }
});
