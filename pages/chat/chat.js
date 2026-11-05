// pages/chat/chat.js
const api = require('../../utils/api.js');
const recordStore = require('../../utils/recordStore.js');
const imageAnalysis = require('../../utils/imageAnalysis.js');

const ASSESSMENT_QUESTIONS = [{"title": "你的年龄是？", "options": ["20–24岁", "25–29岁", "30–34岁", "35岁及以上"]}, {"title": "目前备孕多久了？", "options": ["少于3个月", "3–6个月", "6–12个月", "超过12个月"]}, {"title": "你的月经周期通常规律吗？", "options": ["很规律", "偶尔波动", "经常不规律", "不确定"]}, {"title": "每次经期通常持续多久？", "options": ["1–2天", "3–7天", "超过7天", "不确定"]}, {"title": "最近生活状态怎么样？", "options": ["作息和心态比较稳定", "偶尔熬夜或压力大", "经常熬夜或焦虑", "状态较差"]}, {"title": "是否有想关注的生理问题？", "options": ["目前没有明显异常", "异常出血", "明显或持续疼痛", "其他不适"]}];
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
    consultTab: 'stage', stageQuestions: ['初次备孕','备孕1–3月','备孕3–6月','备孕半年以上','周期不规律','更多备孕建议'], needQuestions: ['排卵监测','营养补充','孕前检查','生活习惯','情绪压力','周期记录'],
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
  openAssessment() {
    if (this.data.assessmentSubmitting) return;
    this.setData({ assessmentMode: 'intro', scrollToId: 'assessment-panel' });
  },
  beginAssessment() {
    this.setData({ assessmentMode: 'quiz', questionIndex: 0, selectedOption: -1, assessmentAnswers: [], currentQuestion: ASSESSMENT_QUESTIONS[0] });
  },
  restartAssessment() { this.beginAssessment(); },
  selectAssessmentOption(e) {
    if (!this.data.assessmentSubmitting) this.setData({ selectedOption: Number(e.currentTarget.dataset.index) });
  },
  previousAssessment() {
    if (this.data.assessmentSubmitting) return;
    const i = this.data.questionIndex - 1;
    if (i < 0) return;
    const old = this.data.assessmentAnswers[i];
    this.setData({ questionIndex: i, currentQuestion: ASSESSMENT_QUESTIONS[i], selectedOption: old ? ASSESSMENT_QUESTIONS[i].options.indexOf(old.answer) : -1 });
  },
  async confirmAssessment() {
    const { questionIndex: i, selectedOption: selected, assessmentSubmitting } = this.data;
    if (selected < 0 || assessmentSubmitting) return;
    const q = ASSESSMENT_QUESTIONS[i];
    const answers = this.data.assessmentAnswers.slice();
    answers[i] = { title: q.title, answer: q.options[selected] };
    this.setData({ assessmentAnswers: answers });
    if (i < ASSESSMENT_QUESTIONS.length - 1) {
      const next = answers[i + 1];
      this.setData({ questionIndex: i + 1, currentQuestion: ASSESSMENT_QUESTIONS[i + 1], selectedOption: next ? ASSESSMENT_QUESTIONS[i + 1].options.indexOf(next.answer) : -1 });
      return;
    }
    this.setData({ assessmentSubmitting: true });
    try {
      const result = await api.submitAssessment(answers);
      if (result.code !== 0 || !result.data || !result.data.assessmentId) throw new Error('submit');
      const report = await api.getReportDetail(result.data.assessmentId);
      if (report.code !== 0 || !report.data) throw new Error('report');
      this.setData({ assessmentReport: report.data, assessmentMode: 'result', scrollToId: 'assessment-panel' });
    } catch (err) {
      wx.showToast({ title: '报告生成失败，点击后可重试', icon: 'none' });
    } finally { this.setData({ assessmentSubmitting: false }); }
  },
  onPlanFromReport() {
    if (this.data.loading) return;
    const context = this.data.assessmentAnswers.map(a => a.title + a.answer).join('；');
    this.sendMessage('请结合以下填写情况提供备孕生活计划：' + context);
  },
  openFeedback(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ showFeedback: true, feedbackMessageId: id || null, feedbackText: '', feedbackPositive: true,
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
        this.setData({ messages: res.data });
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
    this.setData({ scrollToId: `msg-${lastId}` });
  }
});
