// pages/chat/chat.js
const api = require('../../utils/api.js');
const recordStore = require('../../utils/recordStore.js');
const imageAnalysis = require('../../utils/imageAnalysis.js');
const { buildAssessmentReport } = require('../../utils/assessmentReport.js');

const ASSESSMENT_QUESTIONS = [{"title": "你的年龄是？", "options": ["A.20–24岁(较年轻阶段)", "B.25–29岁(适合建立规律备孕习惯)", "C.30–34岁(建议更关注周期和排卵)", "D.其他以上(建议结合专业指导备孕)"]}, {"title": "目前备孕多久了？", "options": ["A.<3个月(处于初期尝试阶段)", "B.3–6个月(已建立初期尝试阶段)", "C.6–12个月(建议更关注周期和排卵)", "D.>12个月(可考虑寻求专业评估)"]}, {"title": "你的月经周期通常规律吗？", "options": ["A.很规律(每月时间基本稳定)", "B.偶尔波动(偶尔提前或推迟几天)", "C.经常不规律(周期变化比较明显)", "D.不确定(暂时没有持续记录)"]}, {"title": "每次经期通常持续多久？", "options": ["A.1–2天(经期持续时间较短)", "B.3–7天(常见持续时间)", "C.>7天(持续时间相对较长)", "D.不确定(建议记录开始和结束日期)"]}, {"title": "最近生活状态怎么样？", "options": ["A.规律健康(作息和状态比较稳定)", "B.偶尔熬夜或压力大(整体状态尚可)", "C.经常熬夜或焦虑(生活节奏需调整)", "D.状态较差(建议优先改善休息与管理)"]}, {"title": "是否有想关注的生理问题？", "options": ["A.没有问题(目前没有明显异常)", "B.异常出血(出现非经期出血等情况)", "C.明显或持续疼痛(出现异常的疼痛)", "D.其他不适(还有其他身体状况)"]}];
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
    pageMode: 'home', showDimensions: false, reportScore: null, scoreLabel: '信息待补充', pointerAngle: null, reportAnalysis: [],
    assessmentIntro: '为了更全面地了解您的备孕状态，可以参与这套AI备孕评估。我们将结合您的周期情况、备孕阶段及生活习惯，为您生成个性化备孕报告…',
    optionItems: [], selectedOptions: [], hasSelection: false,
    consultTab: 'stage', stageQuestions: ['初次备孕','备孕1–3月','备孕3–6月','备孕半年+','周期不规律','更多'], needQuestions: ['排卵监测','营养补充','孕前检查','生活习惯','情绪压力','周期记录'],
    welcomeQuestions: ['备孕多久正常？', '如何提高受孕几率？', '备孕期间需要补充什么营养？'],
    assessmentMode: '', questionIndex: 0, selectedOption: -1,
    assessmentAnswers: [], assessmentSubmitting: false, assessmentReport: null,
    isDemo: !require('../../utils/constants.js').USE_CLOUD,
    showFeedback: false, feedbackPositive: true, feedbackText: '', feedbackMessageId: null,
    feedbackTags: ['已解决','理解力强','清晰易懂','对话高效','操作方便','专业全面','耐心体贴','功能齐全'].map(label => ({label, selected:false})),
    currentQuestion: {},
    messages: [],
    inputValue: '',
    loading: false,
    scrollToId: '',

    // ============ AI咨询兜底机制状态 ============
    unresolvedStreak: 0,   // AI连续判定"无法有效解决"的次数
    showHandoffBanner: false, // 是否显示"建议咨询专业医生"兜底提示卡
    handoffReason: '',        // 'user_feedback' | 'unresolved_streak' | 'high_risk'

    // ============ 图片咨询状态 ============
    showImagePicker: false, // 是否显示"图片咨询/拍摄图片"底部菜单
    pendingImage: '',       // 已选中、还没发送的图片临时路径
    pendingCaption: ''      // 图片预览时用户补充的文字说明
  },

  changeConsultTab(e) { this.setData({ consultTab: e.currentTarget.dataset.tab }); },
  onPageBack() {
    if (this.data.assessmentSubmitting) return;
    if (this.data.showDimensions) { this.closeReportDimensions(); return; }
    this.setData({ pageMode: 'home', assessmentMode: '', scrollToId: 'home-top' });
  },
  onNewConversation() {
    if (this.data.loading || this.data.assessmentSubmitting) return;
    this.setData({ pageMode: 'home', assessmentMode: '', messages: [], showDimensions: false, scrollToId: '', unresolvedStreak: 0, showHandoffBanner: false });
  },
  onHistoryClick() {
    if (!this.data.messages.length) { wx.showToast({ title: '暂无咨询记录', icon: 'none' }); return; }
    this.setData({ pageMode: 'chat' }); this.scrollToBottom();
  },
  openConsult() { this.setData({ pageMode: 'consult', assessmentMode: '', scrollToId: 'consult-top' }); },
  refreshQuestions() {
    const first = this.data.welcomeQuestions[0] === '备孕多久正常？';
    this.setData({ welcomeQuestions: first ? ['排卵日总是算不准怎么办？','孕前检查有哪些项目？','备孕时如何调整作息？'] : ['备孕多久正常？','如何提高受孕几率？','备孕期间需要补充什么营养？'] });
  },
  onServiceNotice() {
    wx.showModal({ title: '服务声明', content: '小暖提供备孕知识与生活建议，仅供参考，不替代医生诊断。请勿在对话中提供身份证号等无关敏感信息。反馈目前仅保存在本机。', showCancel: false });
  },
  onReadUnavailable() { wx.showToast({ title: '语音朗读暂未接入', icon: 'none' }); },
  onCopy(e) { wx.setClipboardData({ data: e.currentTarget.dataset.content || (this.data.assessmentReport && this.data.assessmentReport.summary) || '' }); },
  openAssessment() {
    if (this.data.assessmentSubmitting) return;
    this.setData({ pageMode: 'assessment', assessmentMode: 'intro', questionIndex: 0, scrollToId: 'assessment-top' });
  },
  setQuestion(index) {
    const q = ASSESSMENT_QUESTIONS[index];
    const old = this.data.assessmentAnswers[index];
    const selectedOptions = old ? (old.indices || []) : [];
    this.setData({ questionIndex: index, currentQuestion: q, selectedOptions,
      selectedOption: selectedOptions.length ? selectedOptions[0] : -1, hasSelection: selectedOptions.length > 0,
      optionItems: q.options.map((label, i) => ({ label, selected: selectedOptions.indexOf(i) >= 0 })) });
  },
  beginAssessment() {
    this.setData({ pageMode: 'assessment', assessmentMode: 'quiz', assessmentAnswers: [], scrollToId: 'assessment-panel' });
    this.setQuestion(0);
  },
  restartAssessment() { if (!this.data.assessmentSubmitting) this.beginAssessment(); },
  selectAssessmentOption(e) {
    if (this.data.assessmentSubmitting) return;
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
    if (this.data.assessmentSubmitting || this.data.questionIndex === 0) return;
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
    if (!this.data.hasSelection || this.data.assessmentSubmitting) return;
    this.saveCurrentAnswer();
    if (this.data.questionIndex < 5) { this.setQuestion(this.data.questionIndex + 1); return; }
    this.setData({ assessmentSubmitting: true });
    try {
      const answers = this.data.assessmentAnswers.map(a => ({ title: a.title, answer: a.answer }));
      const result = await api.submitAssessment(answers);
      if (result.code !== 0 || !result.data || !result.data.assessmentId) throw new Error('submit');
      const report = await api.getReportDetail(result.data.assessmentId);
      if (report.code !== 0 || !report.data) throw new Error('report');
      const calculated = buildAssessmentReport(this.data.assessmentAnswers);
      const data = { ...report.data, ...calculated };
      const a = this.data.assessmentAnswers;
      const reportAnalysis = [{ title:'周期状态', content:a[2].answer.slice(2) }, { title:'备孕时间', content:a[1].answer.slice(2) }, { title:'生活状态', content:a[4].answer.slice(2) }];
      this.setData({ assessmentReport: data, reportScore: calculated.score, scoreLabel: calculated.label, pointerAngle: calculated.pointerAngle, reportAnalysis, assessmentMode: 'result', scrollToId: 'assessment-report' });
    } catch (err) { wx.showToast({ title: '报告生成失败，点击确认可重试', icon: 'none' }); }
    finally { this.setData({ assessmentSubmitting: false }); }
  },
  openReportDimensions() {
    this.setData({ showDimensions: true }, () => wx.nextTick(() => this.drawRadar()));
  },
  closeReportDimensions() { this.setData({ showDimensions: false }); },
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
      const polygon = values => { ctx.beginPath(); values.forEach((v,i) => { const p = point(i,v); if(i) ctx.lineTo(...p); else ctx.moveTo(...p); }); ctx.closePath(); };
      ctx.lineWidth = 1; ctx.strokeStyle = '#d6cdd2';
      for(let level=1;level<=5;level++){polygon(Array(count).fill(level/5));ctx.stroke();}
      for(let i=0;i<count;i++){ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(...point(i,1));ctx.stroke();}
      const complete = indicators.every(item => item.score !== null);
      if (complete) {
        polygon(indicators.map(item => item.score/100));ctx.fillStyle='rgba(255,64,137,.12)';ctx.fill();ctx.strokeStyle='#ff4089';ctx.stroke();
      }
      indicators.forEach((item,i)=>{
        if(item.score === null) return;
        ctx.beginPath();ctx.arc(...point(i,item.score/100),3,0,Math.PI*2);ctx.fillStyle='#ff4089';ctx.fill();
      });
      ctx.fillStyle='#999';ctx.font='11px sans-serif';ctx.textAlign='center';
      indicators.forEach((item,i)=>{const p=point(i,1.3);ctx.fillText(item.name + (item.score === null ? '（待补充）' : ''),p[0],p[1]+4);});
    });
  },
  onPlanFromReport() {
    if (this.data.loading) return;
    this.setData({ showDimensions: false });
    const context = this.data.assessmentAnswers.map(a => a.title + a.answer).join('；');
    this.sendMessage('请结合以下填写情况提供备孕生活计划：' + context);
  },
  openFeedback(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ showFeedback: true, feedbackMessageId: id || null, feedbackText: '', feedbackPositive: e.currentTarget.dataset.positive !== false && e.currentTarget.dataset.positive !== 'false',
      feedbackTags: this.data.feedbackTags.map(t => ({ ...t, selected: false })) });
  },
  closeFeedback() { this.setData({ showFeedback: false }); },
  stopTap() {},
  chooseSentiment(e) { this.setData({ feedbackPositive: e.currentTarget.dataset.positive === true || e.currentTarget.dataset.positive === 'true' }); },
  toggleFeedbackTag(e) {
    const i = Number(e.currentTarget.dataset.index);
    this.setData({ feedbackTags: this.data.feedbackTags.map((t, index) => index === i ? { ...t, selected: !t.selected } : t) });
  },
  onFeedbackInput(e) { this.setData({ feedbackText: e.detail.value }); },
  submitFeedback() {
    try {
      const entries = wx.getStorageSync('xiaonuan_feedback') || [];
      wx.setStorageSync('xiaonuan_feedback', [...entries, { positive: this.data.feedbackPositive, tags: this.data.feedbackTags.filter(t => t.selected).map(t => t.label), text: this.data.feedbackText, timestamp: Date.now() }].slice(-50));
      if (!this.data.feedbackPositive && this.data.feedbackMessageId) this.onDissatisfied({ currentTarget: { dataset: { id: this.data.feedbackMessageId } } });
      this.closeFeedback();
      wx.showToast({ title: '反馈已保存在本机', icon: 'none' });
    } catch (err) { wx.showToast({ title: '保存失败，请重试', icon: 'none' }); }
  },

  onLoad() {
    this.loadHistory();
  },

  /**
   * 加载历史聊天记录
   */
  loadHistory() {
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
    wx.navigateTo({ url: '/pages/record/record' });
  },

  /* ============ 输入区域 ============ */

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
    if (question === '周期记录') { this.openRecordPage(); return; }
    this.sendMessage(question);
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
  sendMessage(content) {
    this.setData({ pageMode: 'chat', assessmentMode: '' });
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

    api.sendChatMessage(content).then((res) => {
      if (res.code === 0) {
        const assistantMsg = {
          id: nextId(),
          role: 'assistant',
          content: res.data.content,
          // 结构化字段：接口本来就会返回这些，这次只是存到页面state里给AIMessageCard用
          understanding: res.data.understanding || '',
          analysis: res.data.analysis || '',
          suggestions: res.data.suggestions || [],
          timestamp: res.data.timestamp,
          needHandoff: !!res.data.needHandoff,
          riskLevel: res.data.riskLevel || 'none',
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
  onPlusClick() {
    this.setData({ showImagePicker: true });
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
        this.setData({ pendingImage: tempFilePath, pendingCaption: '' });
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
    this.setData({ pendingImage: '', pendingCaption: '' });
  },

  /**
   * 发送图片给小暖分析：
   * 用户消息（图片缩略卡片+文字说明）→ 走 utils/imageAnalysis.js 做分类+生成回复 → AI图片分析消息
   *
   * 如实说明：这里的"图片类型识别"是根据用户补充的文字描述做关键词匹配，
   * 不是真的分析了图片像素内容——项目目前没有接入视觉/OCR模型。
   */
  onImagePreviewSend() {
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

    recordStore.getRecords().then((records) => {
      const latestRecord = records && records[0];
      const result = imageAnalysis.analyzeImage(caption, latestRecord);

      // "无法确定类型"时，和文字咨询里"知识库检索不到"是同一种"没能真正帮上忙"的信号，
      // 计入AI咨询兜底机制的连续无法解决次数
      const needHandoff = result.riskLevel === 'high' || result.category === 'unknown';

      const assistantMsg = {
        id: nextId(),
        role: 'assistant',
        type: 'image_analysis',
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
    this.setData({ pageMode: 'chat', assessmentMode: '' });
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
    setTimeout(() => {
      const assistantMsg = {
        id: nextId(),
        role: 'assistant',
        type: 'text',
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
    }, 400);
  },

  /**
   * AI回复卡片的操作按钮：查看我的周期 / 记录今天状态 / 继续咨询
   */
  onCardAction(e) {
    const { action } = e.detail;
    if (action === 'record') {
      this.openRecordPage();
    } else if (action === 'continue') {
      wx.showToast({ title: '可以继续问我哦～', icon: 'none' });
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
   * 3. 出现高风险关键词（riskLevel === 'high'）
   */
  evaluateHandoffTrigger(assistantMsg, source) {
    if (source === 'user_feedback') {
      this.setData({ showHandoffBanner: true, handoffReason: 'user_feedback' });
      return;
    }

    if (assistantMsg.riskLevel === 'high') {
      this.setData({ showHandoffBanner: true, handoffReason: 'high_risk', unresolvedStreak: 0 });
      return;
    }

    const nextStreak = assistantMsg.needHandoff ? this.data.unresolvedStreak + 1 : 0;
    const shouldShow = nextStreak >= UNRESOLVED_STREAK_LIMIT;

    this.setData({
      unresolvedStreak: nextStreak,
      showHandoffBanner: shouldShow || this.data.showHandoffBanner,
      handoffReason: shouldShow ? 'unresolved_streak' : this.data.handoffReason
    });
  },

  onDissatisfied(e) {
    const { id } = e.currentTarget.dataset;
    const messages = this.data.messages.map((m) =>
      m.id === id ? { ...m, dissatisfied: true } : m
    );
    this.setData({ messages });
    this.evaluateHandoffTrigger(null, 'user_feedback');
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
    const list = this.data.messages;
    if (!list.length) return;
    const lastId = list[list.length - 1].id;
    this.setData({ scrollToId: '' }, () => { this.setData({ scrollToId: `msg-${lastId}` }); });
  }
});
