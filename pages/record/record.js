// pages/record/record.js
const recordStore = require('../../utils/recordStore.js');

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

Page({
  data: {
    today: '',

    // 第一部分：月经记录
    startDate: '',
    endDate: '',

    // 第二部分：周期参数
    cycleLength: '',
    periodLength: '',

    // 第三部分：身体状态（多选）
    symptomOptions: ['腹痛', '疲劳', '睡眠不足', '情绪波动'],
    symptoms: [],

    // 历史记录列表
    records: [],
    loading: false
  },

  onHeaderBack() { this.returnToChat(); },
  onHeaderNew() { this.returnToChat('onNewConversation'); },
  onHeaderHistory() { this.returnToChat('onHistoryClick'); },

  returnToChat(action) {
    const pages = getCurrentPages();
    const previous = pages[pages.length - 2];
    if (previous && previous.route === 'pages/chat/chat') {
      wx.navigateBack({ success: () => {
        if (action && typeof previous[action] === 'function') previous[action]();
      } });
    } else {
      wx.redirectTo({ url: '/pages/chat/chat' });
    }
  },

  onLoad() {
    this.setData({ today: formatDate(new Date()) });
    this.loadRecords();
  },

  onShow() {
    this.loadRecords();
  },

  /**
   * 读取历史记录
   * recordStore 统一返回 Promise：当前 USE_CLOUD=false，读写本地storage，不接数据库
   */
  loadRecords() {
    recordStore
      .getRecords()
      .then((records) => this.setData({ records }))
      .catch((err) => {
        console.error('loadRecords error', err);
        wx.showToast({ title: '记录加载失败', icon: 'none' });
      });
  },

  /* ============ 第一部分：月经记录 ============ */

  onStartDateChange(e) {
    this.setData({ startDate: e.detail.value });
  },

  onEndDateChange(e) {
    this.setData({ endDate: e.detail.value });
  },

  /* ============ 第二部分：周期参数 ============ */

  onCycleLengthInput(e) {
    this.setData({ cycleLength: e.detail.value });
  },

  onPeriodLengthInput(e) {
    this.setData({ periodLength: e.detail.value });
  },

  /* ============ 第三部分：身体状态（多选，点击切换） ============ */

  onSymptomToggle(e) {
    const { value } = e.currentTarget.dataset;
    const { symptoms } = this.data;
    const next = symptoms.includes(value)
      ? symptoms.filter((item) => item !== value)
      : [...symptoms, value];
    this.setData({ symptoms: next });
  },

  /* ============ 第四部分：保存数据 ============ */

  /**
   * 保存一条周期记录到本地storage
   * 数据格式：{ startDate, endDate, cycleLength, periodLength, symptoms: [] }
   */
  onSave() {
    const { startDate, endDate, cycleLength, periodLength, symptoms, loading } = this.data;
    if (loading) return;

    if (!startDate) {
      wx.showToast({ title: '请选择经期开始日期', icon: 'none' });
      return;
    }
    if (!endDate) {
      wx.showToast({ title: '请选择经期结束日期', icon: 'none' });
      return;
    }
    if (endDate < startDate) {
      wx.showToast({ title: '结束日期不能早于开始日期', icon: 'none' });
      return;
    }
    if (!cycleLength) {
      wx.showToast({ title: '请输入平均周期长度', icon: 'none' });
      return;
    }
    if (!periodLength) {
      wx.showToast({ title: '请输入经期长度', icon: 'none' });
      return;
    }

    this.setData({ loading: true });

    recordStore
      .saveRecord({
        startDate,
        endDate,
        cycleLength,
        periodLength,
        symptoms
      })
      .then(() => {
        wx.showToast({ title: '保存成功', icon: 'success' });
        this.setData({
          startDate: '',
          endDate: '',
          cycleLength: '',
          periodLength: '',
          symptoms: [],
          loading: false
        });
        this.loadRecords();
      })
      .catch((err) => {
        console.error('saveRecord error', err);
        this.setData({ loading: false });
        wx.showToast({ title: '保存失败，请稍后重试', icon: 'none' });
      });
  },

  /**
   * 删除一条记录
   */
  onDeleteRecord(e) {
    const { id } = e.currentTarget.dataset;
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除这条记录吗？',
      success: (res) => {
        if (!res.confirm) return;
        recordStore
          .deleteRecord(id)
          .then((records) => this.setData({ records }))
          .catch((err) => {
            console.error('deleteRecord error', err);
            wx.showToast({ title: '删除失败，请稍后重试', icon: 'none' });
          });
      }
    });
  }
});
