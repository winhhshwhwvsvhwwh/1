// cloudfunctions/createOrder/index.js
// 作用：创建会员购买订单，调用微信「云开发-云支付」生成支付参数，返回给前端调起 wx.requestPayment
//
// ============ 部署前必须完成 ============
// 1. 在微信支付商户平台完成企业实名认证，拿到「特约商户号」
// 2. 在云开发控制台 -> 支付 -> 关联你的商户号
// 3. 在云开发控制台 -> 环境变量 中添加：SUB_MCH_ID = 你的特约商户号
// 4. 微信云开发的云支付接口细节可能随平台更新变化，正式接入前请对照
//    微信官方最新文档核对参数是否需要调整：
//    https://developers.weixin.qq.com/miniprogram/dev/wxcloud/reference-sdk-api/pay/cloud.cloudPay.unifiedOrder.html

const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 会员套餐配置需与前端 utils/constants.js 中的 MEMBER_PLANS 保持一致
const MEMBER_PLANS = {
  vip_month: { name: 'VIP 月卡', level: 'vip', price: 1900, durationDays: 30 },
  vip_year: { name: 'VIP 年卡', level: 'vip', price: 16800, durationDays: 365 }
};

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { planId } = event;

  const plan = MEMBER_PLANS[planId];
  if (!plan) {
    return { code: 1, message: '无效的会员套餐' };
  }

  const outTradeNo = `ORDER_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  // 先落一条待支付订单，方便后续对账和支付回调更新状态
  await db.collection('orders').add({
    data: {
      outTradeNo,
      planId,
      planName: plan.name,
      level: plan.level,
      durationDays: plan.durationDays,
      totalFee: plan.price,
      status: 'pending', // pending | paid | failed
      createTime: Date.now()
    }
  });

  try {
    const payResult = await cloud.cloudPay.unifiedOrder({
      body: plan.name,
      outTradeNo,
      spbillCreateIp: '127.0.0.1',
      subMchId: process.env.SUB_MCH_ID, // TODO: 在云函数环境变量中配置
      totalFee: plan.price,
      envId: cloud.DYNAMIC_CURRENT_ENV,
      functionName: 'onPaySuccess' // 支付成功后微信会自动触发这个云函数
    });

    return { code: 0, data: payResult.payment };
  } catch (err) {
    console.error('createOrder error', err);
    return { code: 1, message: '下单失败：' + (err.message || '请稍后重试') };
  }
};
