// components/ChatInput/ChatInput.js
//
// 语音消息：用微信小程序原生的 RecorderManager + InnerAudioContext 实现，
// 是真实可用的录音/播放能力，不需要额外后端。
// 但要说清楚边界：这里只做"录音消息"，AI没法真正听懂语音内容里说了什么——
// 项目目前没有接语音转文字/语音理解的能力，收到语音后AI会如实告知"还没法听懂"，
// 具体回复逻辑在 pages/chat/chat.js 的 onVoiceSend 里处理，不在这个组件内编造理解结果。

const CANCEL_THRESHOLD = 80; // 上滑超过这个像素距离，判定为"取消发送"

Component({
  properties: {
    value: { type: String, value: '' }
  },

  data: {
    recording: false,
    willCancel: false,
    recordSeconds: 0
  },

  lifetimes: {
    attached() {
      this.recorderManager = wx.getRecorderManager();
      this.startY = 0;
      this.cancelled = false;

      this.recorderManager.onStop((res) => {
        this.clearTimer();
        this.setData({ recording: false, willCancel: false });

        if (this.cancelled) {
          return; // 用户上滑取消，不发送
        }
        // duration 单位是毫秒；太短的录音（误触）不当作有效消息发送
        if (!res.tempFilePath || res.duration < 1000) {
          wx.showToast({ title: '说话时间太短', icon: 'none' });
          return;
        }
        this.triggerEvent('voicesend', {
          tempFilePath: res.tempFilePath,
          duration: Math.round(res.duration / 1000)
        });
      });

      this.recorderManager.onError((err) => {
        console.error('录音失败', err);
        this.clearTimer();
        this.setData({ recording: false, willCancel: false });
        wx.showToast({ title: '录音失败，请检查麦克风权限', icon: 'none' });
      });
    },

    detached() {
      this.clearTimer();
    }
  },

  methods: {
    onInput(e) {
      this.triggerEvent('input', { value: e.detail.value });
    },
    // 按键盘"发送"键触发（confirm-type="send"），是文字消息的发送入口
    onConfirm() {
      this.triggerEvent('confirm');
    },
    onEmoji() {
      this.triggerEvent('unavailable', { feature: '表情' });
    },
    // 加号按钮：打开"图片咨询/拍摄图片"菜单，交给父页面处理弹出逻辑
    onPlus() {
      this.triggerEvent('plus');
    },

    /* ============ 语音：按住说话 ============ */

    onVoiceTouchStart(e) {
      this.cancelled = false;
      this.startY = (e.touches && e.touches[0] && e.touches[0].clientY) || 0;
      this.setData({ recording: true, willCancel: false, recordSeconds: 0 });

      this.recorderManager.start({
        duration: 60000, // 最长60秒，够表达一次问题了
        format: 'mp3'
      });

      this.timer = setInterval(() => {
        this.setData({ recordSeconds: this.data.recordSeconds + 1 });
      }, 1000);
    },

    onVoiceTouchMove(e) {
      if (!this.data.recording) return;
      const moveY = (e.touches && e.touches[0] && e.touches[0].clientY) || 0;
      const delta = this.startY - moveY;
      const willCancel = delta > CANCEL_THRESHOLD;
      if (willCancel !== this.data.willCancel) {
        this.setData({ willCancel });
      }
    },

    onVoiceTouchEnd() {
      if (!this.data.recording) return;
      this.cancelled = this.data.willCancel;
      this.recorderManager.stop();
    },

    clearTimer() {
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    }
  }
});
