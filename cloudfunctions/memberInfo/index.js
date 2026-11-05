// cloudfunctions/memberInfo/index.js
// 作用：查询当前用户的会员状态

const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async () => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  const res = await db.collection('members').where({ _openid: openid }).get();
  const member = res.data[0];

  if (!member) {
    return {
      code: 0,
      data: { isMember: false, level: 'normal', expireDate: null }
    };
  }

  const now = Date.now();
  const isMember = member.isMember && member.expireTime > now;

  return {
    code: 0,
    data: {
      isMember,
      level: isMember ? member.level : 'normal',
      expireDate: member.expireTime ? new Date(member.expireTime).toISOString().slice(0, 10) : null
    }
  };
};
