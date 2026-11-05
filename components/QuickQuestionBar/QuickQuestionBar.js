// components/QuickQuestionBar/QuickQuestionBar.js
Component({
  properties: {
    // "人工咨询"不是一个真的问题，点击后不发消息，而是走转人工确认流程（parent里特殊处理）
    questions: {
      type: Array,
      value: ['我的排卵期', '备孕多久正常', '身体状态', '人工咨询']
    }
  },

  methods: {
    onTap(e) {
      const { question } = e.currentTarget.dataset;
      this.triggerEvent('select', { question });
    }
  }
});
