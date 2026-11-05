// utils/request.js
// 统一封装 wx.request，后续接入真实后端时无需改动业务代码

const { BASE_URL, STORAGE_KEY } = require('./constants.js');

/**
 * 发起请求
 * @param {Object} options
 * @param {string} options.url      接口路径（相对路径，会自动拼接 BASE_URL）
 * @param {string} [options.method] 请求方法，默认 GET
 * @param {Object} [options.data]   请求参数
 * @param {boolean} [options.showLoading] 是否显示 loading，默认 true
 */
function request(options) {
  const { url, method = 'GET', data = {}, showLoading = true } = options;

  if (showLoading) {
    wx.showLoading({ title: '加载中...', mask: true });
  }

  const token = wx.getStorageSync(STORAGE_KEY.TOKEN) || '';

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${BASE_URL}${url}`,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : ''
      },
      success(res) {
        // TODO: 根据真实后端返回结构调整判断逻辑
        if (res.statusCode === 200) {
          resolve(res.data);
        } else {
          wx.showToast({ title: '请求失败', icon: 'none' });
          reject(res);
        }
      },
      fail(err) {
        wx.showToast({ title: '网络异常，请稍后重试', icon: 'none' });
        reject(err);
      },
      complete() {
        if (showLoading) {
          wx.hideLoading();
        }
      }
    });
  });
}

module.exports = {
  get: (url, data, showLoading) => request({ url, method: 'GET', data, showLoading }),
  post: (url, data, showLoading) => request({ url, method: 'POST', data, showLoading }),
  request
};
