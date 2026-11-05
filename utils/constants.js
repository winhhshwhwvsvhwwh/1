// utils/constants.js
// 全局常量配置。
//
// ============ 重要：以下开关和ID需要你自己填写 ============
// USE_CLOUD      : 是否启用微信云开发（数据库/云函数/云支付）。
//                  false = 纯本地demo模式（默认，无需任何配置即可运行）
//                  true  = 真实模式，需要先完成下面的配置清单（见 README「云开发配置清单」）
// CLOUD_ENV_ID   : 云开发环境ID，在微信开发者工具「云开发」控制台可以查到
module.exports = {
  USE_CLOUD: false,                    // TODO: 完成云开发配置后改为 true
  CLOUD_ENV_ID: 'your-cloud-env-id',   // TODO: 替换为你的云开发环境ID

  // TODO: 若不使用云开发、而是自建后端服务器，替换为真实后端域名
  BASE_URL: 'https://your-api-domain.example.com',

  // 接口路径（自建后端模式使用），统一在此维护，方便对接
  API_PATH: {
    LOGIN: '/api/user/login',
    USER_INFO: '/api/user/info',
    CHAT_SEND: '/api/ai/chat/send',
    CHAT_HISTORY: '/api/ai/chat/history',
    ASSESSMENT_SUBMIT: '/api/ai/assessment/submit',
    ASSESSMENT_QUESTIONS: '/api/ai/assessment/questions',
    REPORT_DETAIL: '/api/ai/report/detail',
    REPORT_LIST: '/api/ai/report/list',
    MEMBER_INFO: '/api/member/info',
    MEMBER_UPGRADE: '/api/member/upgrade',
    RECORD_LIST: '/api/record/list',
    RECORD_SAVE: '/api/record/save',
    RECORD_DELETE: '/api/record/delete'
  },

  // 云函数名称（云开发模式使用），对应 cloudfunctions/ 目录下的各个文件夹
  CLOUD_FUNCTION: {
    LOGIN: 'login',
    AI_CHAT: 'aiChat',
    AI_ASSESSMENT: 'aiAssessment',
    CREATE_ORDER: 'createOrder',
    MEMBER_INFO: 'memberInfo'
  },

  // 云数据库集合名称
  CLOUD_DB: {
    RECORDS: 'records',
    CHAT_HISTORY: 'chat_history',
    ASSESSMENTS: 'assessments',
    REPORTS: 'reports',
    MEMBERS: 'members',
    ORDERS: 'orders'
  },

  // 会员等级
  MEMBER_LEVEL: {
    NORMAL: 'normal',
    VIP: 'vip',
    SVIP: 'svip'
  },

  // 会员套餐（用于会员中心展示与下单，价格单位：分，微信支付要求金额单位为分）
  // TODO: 改成你实际的定价
  MEMBER_PLANS: [
    { id: 'vip_month', name: 'VIP 月卡', level: 'vip', price: 1900, priceText: '¥19/月', durationDays: 30 },
    { id: 'vip_year', name: 'VIP 年卡', level: 'vip', price: 16800, priceText: '¥168/年', durationDays: 365 }
  ],

  // 本地缓存 key
  STORAGE_KEY: {
    TOKEN: 'token',
    USER_INFO: 'userInfo',
    CHAT_DRAFT: 'chatDraft',
    RECORD_LIST: 'recordList'   // 周期记录本地存储 key，USE_CLOUD=false 时使用
  }
};
