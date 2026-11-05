// cloudfunctions/login/index.js
// 作用：返回当前用户的 openid（云函数运行环境自动注入，无需前端传递，避免伪造）

const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  return {
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID || null
  };
};
