// components/AIMessageCard/AIMessageCard.js

const { highlightText } = require('../../utils/highlightText.js');
const { startTypewriter } = require('../../utils/typewriter.js');

const COLLAPSE_THRESHOLD = 120; // 超过这个字数就默认折叠，可通过 threshold 属性覆盖

Component({
  properties: {
    animate: { type: Boolean, value: false },
    understanding: { type: String, value: '' },
    analysis: { type: String, value: '' },
    suggestions: { type: Array, value: [] },
    // 兼容没有拆分成understanding/analysis字段的历史消息，保证卡片始终有内容可看
    fallbackContent: { type: String, value: '' },
    riskNotice: { type: String, value: '' },
    threshold: { type: Number, value: COLLAPSE_THRESHOLD }
  },

  data: {
    typing: false,
    expanded: false,
    isLong: false,
    previewText: '',
    understandingSegments: [], analysisSegments: [], fallbackSegments: [], previewSegments: [],
    suggestionRows: []
  },

  observers: {
    'understanding, analysis, fallbackContent, threshold, suggestions': function () {
      this.computeCollapse();
    }
  },

  lifetimes: { detached() { if(this._typer)this._typer.cancel(); } },
  pageLifetimes: { hide() { if(this._typer)this._typer.finish(); } },

  methods: {
    reportTypingProgress() {
      const now=Date.now();if(now-(this._lastProgress||0)>=180){this._lastProgress=now;this.triggerEvent('progress');}
    },
    computeCollapse() {
      const { understanding, analysis, fallbackContent, threshold, suggestions } = this.properties;
      const signature=JSON.stringify([understanding,analysis,fallbackContent,suggestions,threshold]);
      if(signature===this._signature)return;
      this._signature=signature;
      if(this._typer)this._typer.cancel();
      const fullText = [understanding, analysis].filter(Boolean).join('\n') || fallbackContent || '';
      const isLong = fullText.length > threshold;
      const previewText = isLong ? fullText.slice(0, threshold) + '...' : fullText;
      this.setData({
        isLong, previewText,
        understandingSegments: highlightText(understanding),
        analysisSegments: highlightText(analysis),
        fallbackSegments: highlightText(fallbackContent),
        previewSegments: highlightText(previewText),
        suggestionRows: (suggestions || []).map((text, id) => ({id, segments: highlightText(text, 1)})),
        expanded: false, typing:false
      });
      if(this.properties.animate){
        this.setData({expanded:true,typing:true});
        const fields={understanding,analysis,fallbackContent:!understanding&&!analysis?fallbackContent:'',suggestions:suggestions||[]};
        this._typer=startTypewriter(fields,frame=>{this.setData({
          understandingSegments:highlightText(frame.understanding),analysisSegments:highlightText(frame.analysis),
          fallbackSegments:highlightText(frame.fallbackContent),
          suggestionRows:frame.suggestions.map((text,id)=>({id,segments:highlightText(text,1)}))
        });if(frame.understanding||frame.analysis||frame.fallbackContent)this.reportTypingProgress();},()=>{this.setData({typing:false});this.triggerEvent('complete');});
      }
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
