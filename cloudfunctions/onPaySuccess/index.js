// cloudfunctions/onPaySuccess/index.js
// 作用：微信支付成功后，云开发会自动触发本函数（由 createOrder 中的 functionName 指定）。
// 在这里把订单标记为已支付，并更新用户的会员状态（写入/续期 members 集合）。
//
// 注意：event 的具体字段以微信云开发官方文档为准，正式接入前请核对：
// https://developers.weixin.qq.com/miniprogram/dev/wxcloud/reference-sdk-api/pay/cloud.cloudPay.unifiedOrder.html

const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event) => {
  // event 中通常包含 outTradeNo（下单时生成的商户订单号）等信息
  const { outTradeNo, openid } = event;

  if (!outTradeNo) {
    console.error('onPaySuccess: 缺少 outTradeNo', event);
    return { code: 1, message: '缺少订单号' };
  }

  try {
    const orderRes = await db.collection('orders').where({ outTradeNo }).get();
    const order = orderRes.data[0];
    if (!order) {
      console.error('onPaySuccess: 找不到对应订单', outTradeNo);
      return { code: 1, message: '订单不存在' };
    }

    // 标记订单已支付
    await db.collection('orders').doc(order._id).update({
      data: { status: 'paid', paidTime: Date.now() }
    });

    // 计算新的会员到期时间：如果已是会员且未过期，则在原到期时间基础上累加；否则从今天开始算
    const memberOpenid = openid || order._openid;
    const memberRes = await db.collection('members').where({ _openid: memberOpenid }).get();
    const existing = memberRes.data[0];

    const now = Date.now();
    const baseTime = existing && existing.expireTime && existing.expireTime > now
      ? existing.expireTime
      : now;
    const newExpireTime = baseTime + order.durationDays * 24 * 60 * 60 * 1000;

    if (existing) {
      await db.collection('members').doc(existing._id).update({
        data: { level: order.level, expireTime: newExpireTime, isMember: true }
      });
    } else {
      await db.collection('members').add({
        data: { level: order.level, expireTime: newExpireTime, isMember: true }
      });
    }

    return { code: 0 };
  } catch (err) {
    console.error('onPaySuccess error', err);
    return { code: 1, message: err.message };
  }
};
