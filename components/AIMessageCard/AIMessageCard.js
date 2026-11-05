// components/AIMessageCard/AIMessageCard.js

const COLLAPSE_THRESHOLD = 120; // 超过这个字数就默认折叠，可通过 threshold 属性覆盖

Component({
  properties: {
    understanding: { type: String, value: '' },
    analysis: { type: String, value: '' },
    suggestions: { type: Array, value: [] },
    // 兼容没有拆分成understanding/analysis字段的历史消息，保证卡片始终有内容可看
    fallbackContent: { type: String, value: '' },
    threshold: { type: Number, value: COLLAPSE_THRESHOLD }
  },

  data: {
    expanded: false,
    isLong: false,
    previewText: ''
  },

  observers: {
    'understanding, analysis, fallbackContent, threshold': function () {
      this.computeCollapse();
    }
  },

  methods: {
    computeCollapse() {
      const { understanding, analysis, fallbackContent, threshold } = this.properties;
      const fullText = [understanding, analysis].filter(Boolean).join('\n') || fallbackContent || '';
      const isLong = fullText.length > threshold;
      this.setData({
        isLong,
        previewText: isLong ? fullText.slice(0, threshold) + '...' : fullText,
        expanded: false
      });
    },

    onToggleExpand() {
      this.setData({ expanded: !this.data.expanded });
    },

    /**
     * 底部操作按钮：查看我的周期 / 记录今天状态 / 继续咨询
     * 具体跳转/发送逻辑交给父页面（chat.js）处理，组件只负责派发事件
     */
    onActionTap(e) {
      const { action } = e.currentTarget.dataset;
      this.triggerEvent('action', { action });
    }
  }
});
