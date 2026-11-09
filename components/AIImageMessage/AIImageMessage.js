// components/AIImageMessage/AIImageMessage.js
const {startTypewriter}=require('../../utils/typewriter.js');
Component({
  properties: {
    animate: {type:Boolean,value:false},
    recognition: { type: String, value: '' },
    analysis: { type: String, value: '' },
    suggestions: { type: Array, value: [] },
    riskNotice: { type: String, value: '' }
  },

  data:{displayRecognition:'',displayAnalysis:'',displaySuggestions:[]},
  observers:{'recognition, analysis, suggestions':function(){
    const fields={recognition:this.properties.recognition,analysis:this.properties.analysis,suggestions:this.properties.suggestions||[]};
    const signature=JSON.stringify(fields);if(signature===this._signature)return;this._signature=signature;
    if(this._typer)this._typer.cancel();
    const render=frame=>{this.setData({displayRecognition:frame.recognition,displayAnalysis:frame.analysis,displaySuggestions:frame.suggestions});const now=Date.now();if(this.properties.animate&&(frame.recognition||frame.analysis)&&now-(this._lastProgress||0)>=180){this._lastProgress=now;this.triggerEvent('progress');}};
    if(this.properties.animate)this._typer=startTypewriter(fields,render,()=>this.triggerEvent('complete'));else render(fields);
  }},
  lifetimes:{detached(){if(this._typer)this._typer.cancel();}},
  pageLifetimes:{hide(){if(this._typer)this._typer.finish();}},
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
