// utils/recordStore.js
// 周期记录数据读写层。
//
// USE_CLOUD=false（默认）：数据存本地 storage，无需任何配置，开箱即用。
// USE_CLOUD=true         ：数据存到微信云开发数据库 records 集合。
//
// 页面（pages/record、pages/index）只调用 getRecords / saveRecord / deleteRecord 这三个方法，
// 不关心数据到底存在本地还是云端 —— 所有方法统一返回 Promise。
// 云数据库权限规则建议设置为「仅创建者可读写」，这样 _openid 会自动写入/校验，无需自己传 userId。

const { USE_CLOUD, STORAGE_KEY, CLOUD_DB } = require('./constants.js');

/* ============ 本地 storage 实现 ============ */

function getRecordsLocal() {
  const list = wx.getStorageSync(STORAGE_KEY.RECORD_LIST) || [];
  const sorted = [...list].sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
  return Promise.resolve(sorted);
}

function saveRecordLocal(record) {
  const list = wx.getStorageSync(STORAGE_KEY.RECORD_LIST) || [];
  const newRecord = {
    id: 'r_' + Date.now(),
    startDate: record.startDate,
    endDate: record.endDate,
    cycleLength: record.cycleLength,
    periodLength: record.periodLength,
    symptoms: record.symptoms || [],
    createTime: Date.now()
  };
  list.push(newRecord);
  wx.setStorageSync(STORAGE_KEY.RECORD_LIST, list);
  return Promise.resolve(newRecord);
}

function deleteRecordLocal(id) {
  const list = wx.getStorageSync(STORAGE_KEY.RECORD_LIST) || [];
  const next = list.filter((item) => item.id !== id);
  wx.setStorageSync(STORAGE_KEY.RECORD_LIST, next);
  return Promise.resolve(next);
}

/* ============ 云数据库实现 ============ */
// 注意：以下云端实现仍是旧字段（periodDate/symptom），本次改造范围不包含数据库，
// 按需求"不要接数据库"暂不同步；后续如果要开启 USE_CLOUD=true，需要把这里的字段名
// 同步改成 startDate/endDate/periodLength/symptoms，并同步调整云函数与数据库集合结构。

function getDB() {
  return wx.cloud.database();
}

function getRecordsCloud() {
  return getDB()
    .collection(CLOUD_DB.RECORDS)
    .orderBy('periodDate', 'desc')
    .get()
    .then((res) => res.data.map((item) => ({ ...item, id: item._id })));
}

function saveRecordCloud(record) {
  return getDB()
    .collection(CLOUD_DB.RECORDS)
    .add({
      data: {
        periodDate: record.periodDate,
        cycleLength: record.cycleLength,
        symptom: record.symptom,
        createTime: Date.now()
      }
    })
    .then((res) => ({ id: res._id, ...record }));
}

function deleteRecordCloud(id) {
  return getDB()
    .collection(CLOUD_DB.RECORDS)
    .doc(id)
    .remove()
    .then(() => getRecordsCloud());
}

/* ============ 统一导出 ============ */

module.exports = {
  getRecords: () => (USE_CLOUD ? getRecordsCloud() : getRecordsLocal()),
  saveRecord: (record) => (USE_CLOUD ? saveRecordCloud(record) : saveRecordLocal(record)),
  deleteRecord: (id) => (USE_CLOUD ? deleteRecordCloud(id) : deleteRecordLocal(id))
};
