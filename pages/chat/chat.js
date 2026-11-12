// pages/chat/chat.js
const api = require('../../utils/api.js');
const chatMemory = require('../../utils/chatMemory.js');
const recordStore = require('../../utils/recordStore.js');
const imageAnalysis = require('../../utils/imageAnalysis.js');
const { buildAssessmentReport } = require('../../utils/assessmentReport.js');
const { tooltipPosition } = require('../../utils/radarTooltip.js');

const ASSESSMENT_QUESTIONS = [{"title": "你的年龄是？", "options": ["A.20–24岁(较年轻阶段)", "B.25–29岁(适合建立规律备孕习惯)", "C.30–34岁(建议更关注周期和排卵)", "D.其他以上(建议结合专业指导备孕)"]}, {"title": "目前备孕多久了？", "options": ["A.<3个月(处于初期尝试阶段)", "B.3–6个月(已建立初期尝试阶段)", "C.6–12个月(建议更关注周期和排卵)", "D.>12个月(可考虑寻求专业评估)"]}, {"title": "你的月经周期通常规律吗？", "options": ["A.很规律(每月时间基本稳定)", "B.偶尔波动(偶尔提前或推迟几天)", "C.经常不规律(周期变化比较明显)", "D.不确定(暂时没有持续记录)"]}, {"title": "每次经期通常持续多久？", "options": ["A.1–2天(经期持续时间较短)", "B.3–7天(常见持续时间)", "C.>7天(持续时间相对较长)", "D.不确定(建议记录开始和结束日期)"]}, {"title": "最近生活状态怎么样？", "options": ["A.规律健康(作息和状态比较稳定)", "B.偶尔熬夜或压力大(整体状态尚可)", "C.经常熬夜或焦虑(生活节奏需调整)", "D.状态较差(建议优先改善休息与管理)"]}, {"title": "是否有想关注的生理问题？", "options": ["A.没有问题(目前没有明显异常)", "B.异常出血(出现非经期出血等情况)", "C.明显或持续疼痛(出现异常的疼痛)", "D.其他不适(还有其他身体状况)"]}];
const FEEDBACK_LABELS = {
  positive: ['已解决','理解力强','清晰易懂','对话高效','操作方便','专业全面','耐心体贴','功能齐全'],
  negative: ['答非所问','内容有误','表达难懂','建议太泛','忽略记录','感到业余','语气不舒服']
};
function feedbackTagsFor(positive, selected = []) {
  return FEEDBACK_LABELS[positive ? 'positive' : 'negative'].map(label => ({ label, selected: selected.includes(label) }));
}
let msgId = 0;
function nextId() {
  msgId += 1;
  return msgId;
}

// AI咨询兜底机制：连续几次"AI无法有效解决"就触发兜底提示
const UNRESOLVED_STREAK_LIMIT = 2;

Page({
  data: {
    // { id, role, content, understanding, analysis, suggestions, timestamp, needHandoff, riskLevel, dissatisfied }
    answerTyping: false, pageMode: 'home', showDimensions: false, reportScore: null, scoreLabel: '信息待补充', pointerAngle: null, reportAnalysis: [],
    assessmentIntro: '为了更全面地了解您的备孕状态，可以参与这套AI备孕评估。我们将结合您的周期情况、备孕阶段及生活习惯，为您生成个性化备孕报告…',
    radarNodes: [], radarTooltip: null,
    optionItems: [], selectedOptions: [], hasSelection: false,
    consultTab: 'stage',
    stageQuestions: [{"label": "初次备孕", "question": "初次备孕需要关注什么？"}, {"label": "备孕1–3月", "question": "备孕1–3个月需要关注什么？"}, {"label": "备孕3–6月", "question": "备孕3–6个月需要关注什么？"}, {"label": "备孕半年+", "question": "备孕半年以上需要关注什么？"}, {"label": "周期不规律", "question": "月经周期不规律时，备孕需要关注什么？"}, {"label": "更多", "question": "备孕知识科普主要包括哪些内容？"}],
    needQuestions: [{"label": "排卵监测", "question": "排卵监测时如何记录排卵相关变化？"}, {"label": "营养补充", "question": "备孕期间需要补充什么营养？"}, {"label": "孕前检查", "question": "备孕前需要做哪些孕前检查？"}, {"label": "生活习惯", "question": "备孕生活习惯需要注意什么？"}, {"label": "情绪压力", "question": "备孕时感到压力，如何调整情绪？"}, {"label": "周期记录", "question": "如何记录月经周期？"}],
    welcomeQuestions: ['备孕多久正常？', '如何提高受孕几率？', '备孕期间需要补充什么营养？'],
    assessmentMode: '', questionIndex: 0, selectedOption: -1,
    assessmentAnswers: [], assessmentSubmitting: false, assessmentReport: null,
    isDemo: !require('../../utils/constants.js').USE_CLOUD,
    showFeedback: false, feedbackPositive: true, feedbackText: '', feedbackMessageId: null,
    feedbackTags: feedbackTagsFor(true),
    feedbackSelections: { positive: [], negative: [] },
    currentQuestion: {},
    messages: [],
    inputValue: '', inputFocused: false,
    loading: false,
    showAssessmentCelebration: false,
    scrollToId: '',
    showScrollShortcut: false,
    scrollShortcutBottom: 140,

    // ============ AI咨询兜底机制状态 ============
    unresolvedStreak: 0,   // AI连续判定"无法有效解决"的次数
    showHandoffBanner: false, // 是否显示补充提问/核实提示
    handoffReason: '',        // 'feedback_rephrase' | 'feedback_medical' | 'unresolved_streak'

    // ============ 图片咨询状态 ============
    showImagePicker: false, // 是否显示"图片咨询/拍摄图片"底部菜单
    pendingImage: '',       // 已选中、还没发送的图片临时路径
    imageIntent:'general', reportItems:[], reportWarnings:[], reportBusy:false,
    pendingCaption: ''      // 图片预览时用户补充的文字说明
  },

  cancelThinkingAction() {
    if(this._thinkingActionTimer){clearTimeout(this._thinkingActionTimer);this._thinkingActionTimer=null;}
    if(this._thinkingActionResolve){this._thinkingActionResolve(false);this._thinkingActionResolve=null;}
  },
  showThinkingThen(action, before={}) {
    if(this.data.loading||this.data.assessmentSubmitting)return Promise.resolve(false);
    this.setData({...before,loading:true,scrollToId:'',showScrollShortcut:false},()=>this.setData({scrollToId:'chat-bottom'}));
    return new Promise(resolve=>{
      this._thinkingActionResolve=resolve;
      this._thinkingActionTimer=setTimeout(()=>{
        this._thinkingActionTimer=null;this._thinkingActionResolve=null;
        this.setData({loading:false});
        try{action();resolve(true);}catch(e){wx.showToast({title:'暂时无法完成，请重试',icon:'none'});resolve(false);}
      },900);
    });
  },
  waitForThinking(started,riskLevel) {
    const remaining=riskLevel==='high'?0:Math.max(0,900-(Date.now()-started));
    return remaining?new Promise(resolve=>setTimeout(resolve,remaining)):Promise.resolve();
  },

  onMedicationAdvice() {
    if (!this.data.loading) this.sendMessage('备孕期间用药有哪些注意事项？');
  },
  refreshScrollShortcut() {
    if (typeof wx.createSelectorQuery !== 'function') return;
    const query = wx.createSelectorQuery().in(this);
    query.select('.msg-list').boundingClientRect();
    query.select('.scroll-content').boundingClientRect();
    query.select('.bottom-dock').boundingClientRect();
    query.exec(rects => {
      if (!rects[0] || !rects[1]) return;
      this._scrollViewportHeight = rects[0].height;
      if (rects[2]) {
        const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
        this.setData({ scrollShortcutBottom: windowInfo.windowHeight - rects[2].top + 20 });
      }
      const eligible = this.data.pageMode === 'consult' || this.data.pageMode === 'chat' || (this.data.pageMode === 'assessment' && this.data.assessmentMode === 'result');
      this.setData({ showScrollShortcut: eligible && !this.data.showDimensions && !this._scrollingToEnd && !(this.data.answerTyping && !this._answerFollowPaused) && rects[1].bottom - rects[0].bottom > 16 });
    });
  },
  onMessageScroll(e) {
    const eligible = this.data.pageMode === 'consult' || this.data.pageMode === 'chat' || (this.data.pageMode === 'assessment' && this.data.assessmentMode === 'result');
    if (!eligible || this.data.showDimensions) {
      if (this.data.showScrollShortcut) this.setData({ showScrollShortcut: false });
      return;
    }
    if (!this._scrollViewportHeight) { this.refreshScrollShortcut(); return; }
    const remaining = e.detail.scrollHeight - e.detail.scrollTop - this._scrollViewportHeight;
    if (this._scrollingToEnd && remaining <= 16) this._scrollingToEnd = false;
    const show = !this._scrollingToEnd && !(this.data.answerTyping && !this._answerFollowPaused) && remaining > 16;
    if (show !== this.data.showScrollShortcut) this.setData({ showScrollShortcut: show });
  },
  onScrollShortcut() {
    this._answerFollowPaused=false;
    this._scrollingToEnd = true;
    this.setData({ scrollToId: '', showScrollShortcut: false }, () => this.setData({ scrollToId: 'chat-bottom' }));
  },
  onScrollTouchStart(e) {
    this._scrollingToEnd=false;
    this._scrollTouchY=e&&e.touches&&e.touches[0]?e.touches[0].clientY:null;
  },
  onScrollTouchMove(e) {
    const touch=e.touches&&e.touches[0];
    // A finger moving down scrolls toward older messages. Pause before the next typing tick.
    if(touch&&this._scrollTouchY!==null&&this._scrollTouchY!==undefined&&touch.clientY-this._scrollTouchY>6){
      this._answerFollowPaused=true;this._scrollingToEnd=false;
      this.setData({scrollToId:'',showScrollShortcut:true});
    }
  },
  onScrollTouchEnd() { this._scrollTouchY=null; },
  onReady() { this.refreshScrollShortcut(); },
  onResize() { if (this.data.showDimensions) this.drawRadar(); else this.refreshScrollShortcut(); },
  changeConsultTab(e) { this.setData({ consultTab: e.currentTarget.dataset.tab }); },
  onPageBack() {
    this.closeAssessmentCelebration();
    if (this.data.assessmentSubmitting) return;
    const cancelWait=!!this._thinkingActionTimer;this.cancelThinkingAction();
    if (this.data.showDimensions) { this.closeReportDimensions(); return; }
    this.setData({ loading:cancelWait?false:this.data.loading,pageMode: 'home', assessmentMode: '', showScrollShortcut: false, scrollToId: 'home-top',messages:this.data.messages.map(item=>({...item,animate:false})) });
  },
  onAnswerTypingProgress() {
    if(!this.data.answerTyping)this.setData({answerTyping:true});
    if(this._answerFollowPaused)return;
    this._scrollingToEnd=true;
    this.setData({scrollToId:'',showScrollShortcut:false},()=>{
      if(!this._answerFollowPaused)this.setData({scrollToId:'chat-bottom'});
    });
  },
  onAnswerTypingComplete(e) {
    const id=e.currentTarget.dataset.id;
    this.setData({answerTyping:false,messages:this.data.messages.map(item=>String(item.id)===String(id)?{...item,animate:false}:item)});
    if(!this._answerFollowPaused){this._scrollingToEnd=true;this.setData({scrollToId:''},()=>{if(!this._answerFollowPaused)this.setData({scrollToId:'chat-bottom'});});}
  },
  onHide() { this.closeAssessmentCelebration();const cancelWait=!!(this._thinkingActionTimer||this._voiceReplyTimer);this.cancelThinkingAction();if(this._voiceReplyTimer){clearTimeout(this._voiceReplyTimer);this._voiceReplyTimer=null;}chatMemory.save(this.data.messages); this.setData({answerTyping:false,loading:cancelWait?false:this.data.loading,messages:this.data.messages.map(item=>({...item,animate:false}))}); },
  onUnload() { this._pageGone=true;if(this._celebrationTimer){clearTimeout(this._celebrationTimer);this._celebrationTimer=null;}this.cancelThinkingAction();if(this._voiceReplyTimer)clearTimeout(this._voiceReplyTimer);chatMemory.save(this.data.messages); this._reportRequest=(this._reportRequest||0)+1; },
  onNewConversation() {
    if (this.data.loading || this.data.assessmentSubmitting) return;
    const reset=()=>{try{chatMemory.clear();}catch(e){wx.showToast({title:'清除失败，请重试',icon:'none'});return;}
      this.setData({ pageMode:'home',assessmentMode:'',showScrollShortcut:false,messages:[],showDimensions:false,scrollToId:'',unresolvedStreak:0,showHandoffBanner:false });};
    if(!this.data.messages.length){reset();return;}
    wx.showModal({title:'开始新对话',content:'将清除本机保存的聊天记录，周期记录会保留。是否继续？',success:res=>{if(res.confirm)reset();}});
  },
  onDimensionsHistory() {
    this.closeReportDimensions();
    this.onHistoryClick();
  },
  onHistoryClick() {
    if (!this.data.messages.length) { wx.showToast({ title: '暂无咨询记录', icon: 'none' }); return; }
    this.setData({ pageMode: 'chat' }); this.scrollToBottom();
  },
  onCycleInterpretation(record) { this.sendMessage('我现在处于周期哪个阶段？',{cycleRecord:record}); },
  openConsult() { return this.showThinkingThen(()=>{this._scrollingToEnd=false;this.setData({pageMode:'consult',assessmentMode:'',scrollToId:'consult-top'},()=>this.refreshScrollShortcut());}); },
  refreshQuestions() {
    const first = this.data.welcomeQuestions[0] === '备孕多久正常？';
    this.setData({ welcomeQuestions: first ? ['排卵日总是算不准怎么办？','孕前检查有哪些项目？','备孕时如何调整作息？'] : ['备孕多久正常？','如何提高受孕几率？','备孕期间需要补充什么营养？'] });
  },
  onServiceNotice() {
    wx.showModal({ title: '服务声明', content: '小暖提供备孕知识与生活建议，仅供参考，不替代医生诊断。请勿在对话中提供身份证号等无关敏感信息。反馈目前仅保存在本机。', showCancel: false });
  },
  onPrivacyExplanation() {
    wx.showModal({ title: '隐私提示', content: '请勿在对话中提供身份证号等无关敏感信息。当前Demo的反馈保存在本机；如启用云服务，请先阅读并确认相应隐私说明。', showCancel: false });
  },
  onScoreExplanation() {
    wx.showModal({ title: '自评说明', content: '分数按已填写的四项Demo规则计算，每项最多25分；未知项不计算总分。规则未经医学验证，不代表诊断、生育能力或受孕概率。身体不适时请结合具体症状咨询医生。', showCancel: false });
  },
  onReadUnavailable() { wx.showToast({ title: '语音朗读暂未接入', icon: 'none' }); },
  copyText(content) {
    if (typeof content !== 'string' || !content.trim()) {
      wx.showToast({ title: '暂无可复制的内容', icon: 'none' });
      return;
    }
    wx.setClipboardData({
      data: content,
      success: () => wx.showToast({ title: '已复制', icon: 'success' }),
      fail: () => wx.showToast({ title: '复制失败，请重试', icon: 'none' })
    });
  },
  onCopy(e) {
    this.copyText(e.currentTarget.dataset.content || (this.data.assessmentReport && this.data.assessmentReport.summary) || '');
  },
  openAssessment() {
    this._scrollingToEnd = false;
    if (this.data.assessmentSubmitting) return;
    return this.showThinkingThen(()=>this.setData({ pageMode:'assessment',assessmentMode:'intro',showScrollShortcut:false,questionIndex:0,scrollToId:'assessment-top' }));
  },
  setQuestion(index) {
    const q = ASSESSMENT_QUESTIONS[index];
    const old = this.data.assessmentAnswers[index];
    const selectedOptions = old ? (old.indices || []) : [];
    this.setData({ questionIndex: index, currentQuestion: q, selectedOptions,
      selectedOption: selectedOptions.length ? selectedOptions[0] : -1, hasSelection: selectedOptions.length > 0,
      optionItems: q.options.map((label, i) => ({ label, selected: selectedOptions.indexOf(i) >= 0 })) });
  },
  beginAssessment() { return this.showThinkingThen(()=>{this.setData({pageMode:'assessment',assessmentMode:'quiz',showScrollShortcut:false,assessmentAnswers:[],scrollToId:'assessment-panel'});this.setQuestion(0);}); },
  restartAssessment() { if (!this.data.assessmentSubmitting) this.beginAssessment(); },
  selectAssessmentOption(e) {
    if (this.data.assessmentSubmitting||this.data.loading) return;
    const index = Number(e.currentTarget.dataset.index);
    if (!Number.isInteger(index) || index < 0 || index > 3) return;
    let selected = this.data.selectedOptions.slice();
    if (this.data.questionIndex !== 5) selected = [index];
    else if (index === 0) selected = selected.indexOf(0) >= 0 ? [] : [0];
    else {
      selected = selected.filter(i => i !== 0);
      selected = selected.indexOf(index) >= 0 ? selected.filter(i => i !== index) : [...selected, index].sort();
    }
    this.setData({ selectedOptions: selected, selectedOption: selected.length ? selected[0] : -1, hasSelection: selected.length > 0,
      optionItems: this.data.currentQuestion.options.map((label, i) => ({ label, selected: selected.indexOf(i) >= 0 })) });
  },
  previousAssessment() {
    if (this.data.assessmentSubmitting || this.data.loading || this.data.questionIndex === 0) return;
    this.saveCurrentAnswer(); this.setQuestion(this.data.questionIndex - 1);
  },
  saveCurrentAnswer() {
    const answers = this.data.assessmentAnswers.slice();
    const indices = this.data.selectedOptions.slice();
    if (indices.length) answers[this.data.questionIndex] = { title: this.data.currentQuestion.title, indices, answer: indices.map(i => this.data.currentQuestion.options[i]).join('；') };
    else delete answers[this.data.questionIndex];
    this.setData({ assessmentAnswers: answers });
  },
  async confirmAssessment() {
    if (!this.data.hasSelection || this.data.assessmentSubmitting||this.data.loading) return;
    this.saveCurrentAnswer();
    if (this.data.questionIndex < 5) return this.showThinkingThen(()=>this.setQuestion(this.data.questionIndex+1));
    const thinkingStarted=Date.now();
    this.setData({assessmentSubmitting:true,loading:true,scrollToId:''},()=>this.setData({scrollToId:'chat-bottom'}));
    try {
      const answers = this.data.assessmentAnswers.map(a => ({ title: a.title, answer: a.answer }));
      const result = await api.submitAssessment(answers);
      if (result.code !== 0 || !result.data || !result.data.assessmentId) throw new Error('submit');
      const report = await api.getReportDetail(result.data.assessmentId);
      if (report.code !== 0 || !report.data) throw new Error('report');
      await this.waitForThinking(thinkingStarted);
      if(this._pageGone)return;
      const calculated = buildAssessmentReport(this.data.assessmentAnswers);
      const data = { ...report.data, ...calculated };
      const a = this.data.assessmentAnswers;
      const reportAnalysis = [{ title:'周期状态', content:a[2].answer.slice(2) }, { title:'备孕时间', content:a[1].answer.slice(2) }, { title:'生活状态', content:a[4].answer.slice(2) }];
      this.setData({ assessmentReport: data, reportScore: calculated.score, scoreLabel: calculated.label, pointerAngle: calculated.pointerAngle, reportAnalysis, assessmentMode: 'result', scrollToId: 'assessment-report' }, () => {this.refreshScrollShortcut();this.startAssessmentCelebration();});
    } catch (err) { wx.showToast({ title: '报告生成失败，点击确认可重试', icon: 'none' }); }
    finally { if(!this._pageGone)this.setData({assessmentSubmitting:false,loading:false}); }
  },
  startAssessmentCelebration() {
    if(this._pageGone)return;
    if(this._celebrationTimer)clearTimeout(this._celebrationTimer);
    this.setData({showAssessmentCelebration:true});
    this._celebrationTimer=setTimeout(()=>this.closeAssessmentCelebration(),8000);
  },
  closeAssessmentCelebration() {
    if(this._celebrationTimer){clearTimeout(this._celebrationTimer);this._celebrationTimer=null;}
    if(this.data.showAssessmentCelebration)this.setData({showAssessmentCelebration:false});
  },
  onAssessmentCelebrationError() {
    if(!this.data.showAssessmentCelebration)return;
    this.closeAssessmentCelebration();
    wx.showToast({title:'动效未播放，评估结果已生成',icon:'none'});
  },

  openReportDimensions() {
    if (!this.data.assessmentReport) return;
    this.setData({ showDimensions: true, showScrollShortcut: false, radarTooltip: null, radarNodes: [] }, () => wx.nextTick(() => this.drawRadar()));
  },
  closeReportDimensions() { this.setData({ showDimensions: false, radarTooltip: null }, () => this.refreshScrollShortcut()); },
  onRadarNodeTap(e) { this.selectRadarNode(Number(e.currentTarget.dataset.index)); },
  selectRadarNode(index) {
    const node = this.data.radarNodes[index];
    const indicator = this.data.assessmentReport && this.data.assessmentReport.indicators[index];
    if (!node || !indicator || !this._radarSize) return;
    this.setData({ radarTooltip: { ...tooltipPosition(node, this._radarSize.width, this._radarSize.height, indicator.tooltip), text: indicator.tooltip, name: indicator.name, tone: indicator.tone, index } });
  },
  closeRadarTooltip() { this.setData({ radarTooltip: null }); },
  drawRadar() {
    const query = wx.createSelectorQuery().in(this);
    query.select('#radar-canvas').fields({ node: true, size: true }).exec(res => {
      if (!res[0] || !res[0].node) return;
      const { node: canvas, width, height } = res[0];
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      const dpr = info.pixelRatio || 1; canvas.width = width * dpr; canvas.height = height * dpr;
      const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
      const cx = width/2, cy = height/2 + 8, radius = Math.min(width * .25, height * .32);
      const indicators = this.data.assessmentReport.indicators;
      const count = indicators.length;
      const point = (i, amount) => { const angle = -Math.PI/2 + i*2*Math.PI/count; return [cx + Math.cos(angle)*radius*amount, cy + Math.sin(angle)*radius*amount]; };
      this._radarSize = { width, height };
      const radarNodes = indicators.map((item,i) => { const p = point(i,item.score === null ? 1 : item.score/100); return { x:p[0],y:p[1],name:item.name }; });
      const selectedIndex = this.data.radarTooltip ? this.data.radarTooltip.index : 0;
      this.setData({ radarNodes }, () => this.selectRadarNode(selectedIndex));
      const polygon = values => { ctx.beginPath(); values.forEach((v,i) => { const p = point(i,v); if(i) ctx.lineTo(...p); else ctx.moveTo(...p); }); ctx.closePath(); };
      ctx.lineWidth = 1; ctx.strokeStyle = '#d6cdd2';
      for(let level=1;level<=5;level++){polygon(Array(count).fill(level/5));ctx.stroke();}
      for(let i=0;i<count;i++){ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(...point(i,1));ctx.stroke();}
      const complete = indicators.every(item => item.score !== null);
      if (complete) {
        polygon(indicators.map(item => item.score/100));ctx.fillStyle='rgba(255,64,137,.12)';ctx.fill();ctx.strokeStyle='#ff4089';ctx.stroke();
      }
      indicators.forEach((item,i)=>{
        if(item.score === null) { const p=point(i,1);ctx.beginPath();ctx.arc(...p,3,0,Math.PI*2);ctx.strokeStyle='#aaa';ctx.stroke();return; }
        ctx.beginPath();ctx.arc(...point(i,item.score/100),3,0,Math.PI*2);ctx.fillStyle='#ff4089';ctx.fill();
      });
      ctx.fillStyle='#999';ctx.font='11px sans-serif';ctx.textAlign='center';
      indicators.forEach((item,i)=>{const p=point(i,1.3);ctx.fillText(item.name + (item.score === null ? '（待补充）' : ''),p[0],p[1]+4);});
    });
  },
  onPlanFromReport() {
    if (this.data.loading || !this.data.assessmentReport) return;
    const suggestions = (this.data.assessmentReport.suggestions || []).slice();
    const analysis = this.data.reportAnalysis.map(item => item.title + '：' + item.content).join('\n');
    const notice = 'Demo 规则模板，仅供参考。';
    const userMessage = { id: nextId(), role: 'user', content: '生成备孕生活计划', timestamp: Date.now() };
    const reply = {
      id: nextId(), role: 'assistant', type: 'plan',
      understanding: '备孕生活计划：以下根据本次自评已有的建议与分析整理，不重新判断健康状态。',
      analysis, suggestions, riskNotice: notice, riskLevel: 'none', needHandoff: false, dissatisfied: false, timestamp: Date.now()
    };
    reply.content = [reply.understanding, analysis, ...suggestions.map((text,i) => (i+1) + '. ' + text), notice].filter(Boolean).join('\n\n');
    return this.showThinkingThen(()=>{reply.animate=true;this.setData({messages:[...this.data.messages,reply]});this.scrollToBottom();},{showDimensions:false,pageMode:'chat',assessmentMode:'',messages:[...this.data.messages,userMessage],showHandoffBanner:false});
  },
  openFeedback(e) {
    const { id, positive } = e.currentTarget.dataset;
    const feedbackPositive = positive === true || positive === 'true';
    this.setData({ showFeedback: true, feedbackMessageId: id || null, feedbackText: '', feedbackPositive,
      feedbackSelections: { positive: [], negative: [] }, feedbackTags: feedbackTagsFor(feedbackPositive) });
  },
  closeFeedback() { this.setData({ showFeedback: false }); },
  stopTap() {},
  chooseSentiment(e) {
    const positive = e.currentTarget.dataset.positive === true || e.currentTarget.dataset.positive === 'true';
    const key = positive ? 'positive' : 'negative';
    this.setData({ feedbackPositive: positive, feedbackTags: feedbackTagsFor(positive, this.data.feedbackSelections[key]) });
  },
  toggleFeedbackTag(e) {
    const i = Number(e.currentTarget.dataset.index);
    if (!Number.isInteger(i) || i < 0 || i >= this.data.feedbackTags.length) return;
    const feedbackTags = this.data.feedbackTags.map((t, index) => index === i ? { ...t, selected: !t.selected } : t);
    const key = this.data.feedbackPositive ? 'positive' : 'negative';
    this.setData({ feedbackTags, feedbackSelections: { ...this.data.feedbackSelections, [key]: feedbackTags.filter(t => t.selected).map(t => t.label) } });
  },
  onFeedbackInput(e) { this.setData({ feedbackText: e.detail.value }); },
  submitFeedback() {
    try {
      const entries = wx.getStorageSync('xiaonuan_feedback') || [];
      wx.setStorageSync('xiaonuan_feedback', [...entries, { positive: this.data.feedbackPositive, tags: this.data.feedbackTags.filter(t => t.selected).map(t => t.label), text: this.data.feedbackText, timestamp: Date.now() }].slice(-50));
      if (!this.data.feedbackPositive && this.data.feedbackMessageId) this.onDissatisfied({ currentTarget: { dataset: { id: this.data.feedbackMessageId } } }, this.data.feedbackTags.filter(t => t.selected).map(t => t.label));
      this.closeFeedback();
      wx.showToast({ title: '反馈已保存在本机', icon: 'none' });
    } catch (err) { wx.showToast({ title: '保存失败，请重试', icon: 'none' }); }
  },

  onLoad(options={}) {
    this._pageGone=false;
    this.loadHistory();
    if(options.interpretCycle==='1')recordStore.getRecords().then(records=>this.onCycleInterpretation(records.find(record=>record.id===options.recordId))).catch(()=>wx.showToast({title:'周期记录读取失败',icon:'none'}));
  },

  /**
   * 加载历史聊天记录
   */
  loadHistory() {
    const local=chatMemory.read();
    if(local.length){msgId=Math.max(msgId,...local.map(m=>Number(m.id)||0));this.setData({messages:local});return;}
    api.getChatHistory().then((res) => {
      if (res.code === 0 && res.data.length) {
        msgId = Math.max(msgId, ...res.data.map(m => Number(m.id) || 0));
        this.setData({ messages: res.data, pageMode: 'chat' });
        this.scrollToBottom();
      }
    });
  },

  /* ============ 顶部导航栏 ============ */

  onHeaderMore() {
    wx.showActionSheet({
      itemList: ['清空聊天记录（暂未开放）', '关于小暖'],
      success: (res) => {
        if (res.tapIndex === 1) {
          wx.showModal({
            title: '关于小暖',
            content: '小暖是你的AI备孕助手，结合备孕知识库和你的周期记录，陪你了解备孕相关的问题。内容仅供参考，不能替代医生诊断。',
            showCancel: false
          });
        }
      }
    });
  },

  /**
   * 打开「周期记录」页。
   * 应用只有AI咨询一个入口、没有tab栏，周期记录是从聊天里进入的二级页面，
   * 直接 navigateTo 即可（自带返回按钮，返回后聊天记录还在）。
   */
  openRecordPage() {
    return this.showThinkingThen(()=>wx.navigateTo({url:'/pages/record/record'}));
  },

  /* ============ 输入区域 ============ */

  focusChatInput() {
    this.setData({ inputFocused: false }, () => {
      const focus = () => this.setData({ inputFocused: true });
      if (typeof wx.nextTick === 'function') wx.nextTick(focus); else focus();
    });
  },
  onInputBlur() { this.setData({ inputFocused: false }); },
  onInputChange(e) {
    this.setData({ inputValue: e.detail.value });
  },

  onInputUnavailable(e) {
    const { feature } = e.detail;
    wx.showToast({ title: `${feature}暂未开放，先用文字聊聊吧～`, icon: 'none' });
  },

  /**
   * 发送（键盘发送键触发，chat-input组件里confirm-type="send"）
   */
  onSend() {
    const content = this.data.inputValue.trim();
    if (!content || this.data.loading) return;
    this.setData({ inputValue: '' });
    this.sendMessage(content);
  },

  /* ============ 欢迎首屏 ============ */

  onWelcomeCardTap(e) {
    const { question } = e.currentTarget.dataset;
    if (this.data.loading) return;
    if (typeof question === 'string' && question.trim()) this.sendMessage(question);
  },

  onStartChat() {
    if (this.data.loading) return;
    // 复用基础咨询Skill的打招呼场景，给一个友好的开场
    this.sendMessage('你好');
  },

  /**
   * 快捷问题栏：点击预设问题，自动发送进入聊天（复用同一条发送链路，不是新的业务逻辑）
   * "人工咨询"是特殊项，不发消息，走转人工的二次确认流程
   */
  onQuickQuestion(e) {
    const { question } = e.detail;
    if (!question || this.data.loading) return;
    if (question === '人工咨询') {
      this.onTransferConfirm();
      return;
    }
    this.sendMessage(question);
  },

  /**
   * 转人工二次确认："是否需要专业咨询？"，确认后复用已有的人工咨询引导弹窗
   */
  onTransferConfirm() {
    wx.showModal({
      title: '转人工咨询',
      content: '是否需要专业咨询？',
      confirmText: '需要',
      cancelText: '再想想',
      success: (res) => {
        if (res.confirm) {
          this.onGoHandoff();
        }
      }
    });
  },

  /**
   * 统一的发送逻辑：手动输入发送 / 欢迎卡片 / 快捷问题，都走这一个方法，
   * 调用的还是原来的 api.sendChatMessage，接口和数据处理没有变化。
   */
  sendMessage(content, context) {
    this.setData({ pageMode: 'chat', assessmentMode: '' }, () => this.refreshScrollShortcut());
    const userMsg = {
      id: nextId(),
      role: 'user',
      content,
      timestamp: Date.now()
    };

    this.setData({
      messages: [...this.data.messages, userMsg],
      loading: true
    });
    this.scrollToBottom();

    api.sendChatMessage(content,context).then((res) => {
      if(this._pageGone)return;
      if (res.code === 0) {
        const assistantMsg = {
          id: nextId(),
          role: 'assistant',
          content: res.data.content,
          animate:res.data.riskLevel!=='high',
          // 结构化字段：接口本来就会返回这些，这次只是存到页面state里给AIMessageCard用
          understanding: res.data.understanding || '',
          analysis: res.data.analysis || '',
          suggestions: res.data.suggestions || [],
          timestamp: res.data.timestamp,
          needHandoff: !!res.data.needHandoff,
          riskLevel: res.data.riskLevel || 'none',
          riskNotice: res.data.riskNotice || '',
          dissatisfied: false
        };
        this.setData({
          messages: [...this.data.messages, assistantMsg],
          loading: false
        });
        this.scrollToBottom();
        this.evaluateHandoffTrigger(assistantMsg, 'ai_signal');
      } else {
        this.setData({ loading: false });
        wx.showToast({ title: '暂时无法回复，请稍后重试', icon: 'none' });
      }
    }).catch(() => {
      this.setData({ loading: false });
      wx.showToast({ title: 'AI暂时无法回复，请稍后再试', icon: 'none' });
    });
  },

  /* ============ 图片咨询 ============ */

  /**
   * 点击"+"按钮：弹出"图片咨询/拍摄图片"菜单
   */
  onPlusClick() { this.setData({ showImagePicker:true,imageIntent:'general',reportItems:[],reportWarnings:[],reportBusy:false }); },
  onReportClick() { return this.showThinkingThen(()=>wx.showToast({title:'报告图片识别暂未开启',icon:'none'})); },
  onProfileClick() {
    wx.showActionSheet({itemList:['查看本机周期记录','查看本机聊天记录','存储说明'],success:res=>{
      if(res.tapIndex===0)this.openRecordPage();
      if(res.tapIndex===1)this.onHistoryClick();
      if(res.tapIndex===2)wx.showModal({title:'本机存储',content:'周期记录和文字聊天保存在当前设备，不上传云端，不跨设备同步。清除小程序数据后会丢失。',showCancel:false});
    }});
  },

  onImagePickerCancel() {
    this.setData({ showImagePicker: false });
  },

  /**
   * 选择了"图片咨询"（相册）或"拍摄图片"（相机）
   */
  onImagePickerSelect(e) {
    const { action } = e.detail; // 'album' | 'camera'
    this.setData({ showImagePicker: false });

    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: [action === 'camera' ? 'camera' : 'album'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        // 当前USE_CLOUD=false，直接用本地临时路径展示预览即可；
        // 如果以后接入真实的图片分析后端，这里需要先 wx.cloud.uploadFile 上传，
        // 拿到云端fileID后再传给后端做视觉分析
        this.setData({ pendingImage:tempFilePath,pendingCaption:'',reportItems:[],reportWarnings:[],reportBusy:false });
      },
      fail: (err) => {
        // 用户主动取消选择时err.errMsg会包含cancel，不需要额外提示
        if (err.errMsg && err.errMsg.indexOf('cancel') === -1) {
          wx.showToast({ title: '选择图片失败，请重试', icon: 'none' });
        }
      }
    });
  },

  onPendingCaptionInput(e) {
    this.setData({ pendingCaption: e.detail.value });
  },

  onImagePreviewCancel() {
    this._reportRequest=(this._reportRequest||0)+1;
    this.setData({pendingImage:'',pendingCaption:'',reportItems:[],reportWarnings:[],reportBusy:false});
  },
  onReportItemChange(e) {
    if(this.data.reportBusy)return;
    const {index,field,value}=e.detail;
    if(!Number.isInteger(index)||index<0||index>=this.data.reportItems.length||!['name','value','unit','referenceRange','flag'].includes(field))return;
    this.setData({reportItems:this.data.reportItems.map((item,i)=>i===index?{...item,[field]:value}:item)});
  },
  async handleReportPreview() { wx.showToast({title:'报告图片解读已停用',icon:'none'}); },

  /**
   * 发送图片给小暖分析：
   * 用户消息（图片缩略卡片+文字说明）→ 走 utils/imageAnalysis.js 做分类+生成回复 → AI图片分析消息
   *
   * 如实说明：这里的"图片类型识别"是根据用户补充的文字描述做关键词匹配，
   * 不是真的分析了图片像素内容——项目目前没有接入视觉/OCR模型。
   */
  onImagePreviewSend() {
    if(this.data.imageIntent==='report')return this.handleReportPreview();
    if(imageAnalysis.classifyByCaption(this.data.pendingCaption)==='exam_report'){
      wx.showToast({title:'报告图片解读已停用，请使用文字咨询或个人档案',icon:'none'});
      return;
    }
    const imageUrl = this.data.pendingImage;
    const caption = this.data.pendingCaption.trim();
    if (!imageUrl || this.data.loading) return;

    const userMsg = {
      id: nextId(),
      role: 'user',
      type: 'image',
      imageUrl,
      content: caption,
      timestamp: Date.now()
    };

    this.setData({
      pageMode: 'chat', assessmentMode: '',
      messages: [...this.data.messages, userMsg],
      pendingImage: '',
      pendingCaption: '',
      loading: true
    });
    this.scrollToBottom();

    const thinkingStarted=Date.now();
    recordStore.getRecords().then(async (records) => {
      const latestRecord = records && records[0];
      const result = imageAnalysis.analyzeImage(caption, latestRecord);
      await this.waitForThinking(thinkingStarted,result.riskLevel);
      if(this._pageGone)return;

      // "无法确定类型"时，和文字咨询里"知识库检索不到"是同一种"没能真正帮上忙"的信号，
      // 计入AI咨询兜底机制的连续无法解决次数
      const needHandoff = result.riskLevel === 'high' || result.category === 'unknown';

      const assistantMsg = {
        id: nextId(),
        role: 'assistant',
        type: 'image_analysis',
        animate:result.riskLevel!=='high',
        recognition: result.recognition,
        analysis: result.analysis,
        suggestions: result.suggestions,
        riskNotice: result.riskNotice,
        riskLevel: result.riskLevel,
        needHandoff,
        timestamp: Date.now(),
        dissatisfied: false
      };

      this.setData({
        messages: [...this.data.messages, assistantMsg],
        loading: false
      });
      this.scrollToBottom();
      this.evaluateHandoffTrigger(assistantMsg, 'ai_signal');
    }).catch(() => {
      this.setData({ loading: false });
      wx.showToast({ title: '分析失败，请稍后再试', icon: 'none' });
    });
  },

  /**
   * AI图片分析卡片的操作按钮：继续咨询 / 查看周期 / 咨询医生
   */
  onImageCardAction(e) {
    const { action } = e.detail;
    if (action === 'viewCycle') {
      this.openRecordPage();
    } else if (action === 'doctor') {
      this.onGoHandoff();
    } else if (action === 'continue') {
      wx.showToast({ title: '可以继续问我哦～', icon: 'none' });
    }
  },

  /* ============ 语音消息 ============ */

  /**
   * 收到ChatInput录好的语音（真实录音，tempFilePath是本地临时文件）：
   * 1. 用户语音气泡（可点击播放）入列表
   * 2. AI如实回复"还没法听懂语音内容"——项目没有接语音转文字/语音理解能力，
   *    不假装理解了语音里说了什么，这一点和图片咨询的"无法识别"分支是同一个原则。
   */
  onVoiceSend(e) {
    const { tempFilePath, duration } = e.detail;
    this.setData({ pageMode: 'chat', assessmentMode: '' }, () => this.refreshScrollShortcut());
    if (!tempFilePath || this.data.loading) return;

    const userMsg = {
      id: nextId(),
      role: 'user',
      type: 'voice',
      voiceUrl: tempFilePath,
      voiceDuration: duration,
      timestamp: Date.now()
    };

    this.setData({
      messages: [...this.data.messages, userMsg],
      loading: true
    });
    this.scrollToBottom();

    // 不需要真的调用AI接口分析语音内容（没有这个能力），本地直接生成一句诚实的回复，
    // 但依然接入AI咨询兜底机制的判断逻辑，保持行为一致
    this._voiceReplyTimer=setTimeout(() => {
      this._voiceReplyTimer=null;
      if(this._pageGone)return;
      const assistantMsg = {
        id: nextId(),
        role: 'assistant',
        type: 'text',animate:true,
        content: '收到你的语音啦~不过AI目前还没法直接听懂语音里说的内容（这需要接入语音转文字的能力，现在还没有），麻烦你用文字告诉我具体想问什么，我能更准确地帮你分析哦。',
        understanding: '收到你的语音啦~不过AI目前还没法直接听懂语音里说的内容（这需要接入语音转文字的能力，现在还没有），麻烦你用文字告诉我具体想问什么，我能更准确地帮你分析哦。',
        analysis: '',
        suggestions: [],
        timestamp: Date.now(),
        needHandoff: true, // 没能真正帮上忙，计入兜底机制的连续无法解决次数
        riskLevel: 'none',
        dissatisfied: false
      };

      this.setData({
        messages: [...this.data.messages, assistantMsg],
        loading: false
      });
      this.scrollToBottom();
      this.evaluateHandoffTrigger(assistantMsg, 'ai_signal');
    }, 900);
  },

  /**
   * AI回复卡片的操作按钮：查看我的周期 / 记录今天状态 / 继续咨询
   */
  onCardAction(e) {
    const { action } = e.detail;
    if (action === 'record') {
      this.openRecordPage();
    } else if (action === 'continue') {
      this.focusChatInput();
    } else if (action === 'copy') {
      const id = e.currentTarget && e.currentTarget.dataset.id;
      const message = this.data.messages.find(item => item.role === 'assistant' && String(item.id) === String(id));
      this.copyText(message ? message.content : '');
    }
  },

  /**
   * 风险提醒卡片 —— "继续AI了解"：先不打断对话，收起提醒，用户可以继续往下聊
   */
  onRiskContinue() {
    wx.showToast({ title: '好的，有需要随时告诉我～', icon: 'none' });
  },

  /**
   * 风险提醒卡片 —— "咨询专业医生"：复用已有的人工咨询引导弹窗
   */
  onRiskDoctor() {
    this.onGoHandoff();
  },

  /**
   * ============ AI咨询兜底机制 ============
   * 触发条件：
   * 1. 用户点击"不满意"（onDissatisfied 直接调用，source='user_feedback'）
   * 2. AI连续两次判定"无法有效解决"（这里统计 needHandoff 连续为true的次数）
   * 3. 高风险只保留消息内风险卡，底部横幅不重复出现
   */
  evaluateHandoffTrigger(assistantMsg, source, reasons = []) {
    if (source === 'user_feedback') {
      if (assistantMsg && assistantMsg.riskLevel === 'high') {
        this.setData({ showHandoffBanner: false });
        return;
      }
      this.setData({ showHandoffBanner: true, handoffReason: reasons.includes('内容有误') ? 'feedback_medical' : 'feedback_rephrase' });
      return;
    }
    if (assistantMsg.riskLevel === 'high') {
      this.setData({ showHandoffBanner: false, handoffReason: '', unresolvedStreak: 0 });
      return;
    }
    const nextStreak = assistantMsg.needHandoff ? this.data.unresolvedStreak + 1 : 0;
    const shouldShow = nextStreak >= UNRESOLVED_STREAK_LIMIT;
    this.setData({ unresolvedStreak: nextStreak, showHandoffBanner: shouldShow || this.data.showHandoffBanner, handoffReason: shouldShow ? 'unresolved_streak' : this.data.handoffReason });
  },
  onDissatisfied(e, reasons = []) {
    const { id } = e.currentTarget.dataset;
    const message = this.data.messages.find(m => m.id === id);
    this.setData({ messages: this.data.messages.map(m => m.id === id ? { ...m, dissatisfied: true } : m) });
    this.evaluateHandoffTrigger(message, 'user_feedback', reasons);
  },
  onHandoffBannerAction() {
    if (this.data.handoffReason === 'feedback_medical') this.onGoHandoff();
    else { this.setData({ showHandoffBanner: false }); this.focusChatInput(); }
  },
  onCloseHandoffBanner() {
    this.setData({ showHandoffBanner: false });
  },

  /**
   * 点击"人工咨询"入口
   * 当前项目还没有真实人工客服通道，这里如实展示引导信息，不假装真的转接了人工
   */
  onGoHandoff() {
    wx.showModal({
      title: '建议咨询专业医生',
      content: '建议你前往正规医院的妇科/生殖科就诊，由医生结合面诊和检查结果给出判断。就诊前可以把「周期记录」里的数据整理一下带过去，方便医生更快了解你的情况。',
      confirmText: '我知道了',
      showCancel: false,
      success: () => {
        this.setData({ showHandoffBanner: false });
      }
    });
  },

  scrollToBottom() {
    chatMemory.save(this.data.messages);
    const list = this.data.messages;
    if (!list.length) return;
    this._answerFollowPaused=false;
    this._scrollingToEnd=true;
    this.setData({ scrollToId:'',showScrollShortcut:false },()=>this.setData({scrollToId:'chat-bottom'}));
  }
});
