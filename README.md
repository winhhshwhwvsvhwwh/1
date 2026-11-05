# 小暖AI备孕助手 - 微信小程序

> **⚠️ 当前版本导航结构（最新）**：产品已改为「只保留AI咨询一个入口」，没有tab栏。
> - 启动页是 `pages/chat/chat`（AI咨询）；`pages/record/record`（周期记录）是从聊天里点按钮进入的二级页面，不是tab。
> - 原来的首页 / AI评估 / AI报告 / 会员中心已归档到 `_archived/pages/`（未删除，恢复方法见 `_archived/README.md`），不再进入上传包。
> - 下面的"阶段进度""目录结构"是项目早期的完整版说明，涉及 tab、首页、评估、报告、会员的部分以本提示为准。

基于微信原生小程序（JavaScript）+ 微信云开发搭建。

**当前开发进度：**
- ✅ 阶段1 项目初始化
- ✅ 阶段2 首页开发（AI IP问候、今日备孕状态卡、四宫格入口、会员入口）
- ✅ 阶段3 周期记录功能（本地存储 / 云数据库双模式）
- ✅ 阶段4 AI咨询接入真实大模型接口（云函数 `aiChat`）
- ✅ 阶段5 AI评估/报告接入真实AI分析（云函数 `aiAssessment`）
- ✅ 阶段6 会员订阅与微信支付（云函数 `createOrder` + `onPaySuccess`）
- ✅ 阶段7 数据库迁移（微信云开发数据库）
- ⬜ 阶段8 测试上线（需要你自己的真实账号资质，见下方说明）

**默认状态（开箱即用）**：`utils/constants.js` 里 `USE_CLOUD = false`，此时全部页面使用 mock 数据/本地storage，**不需要任何配置**就能在开发者工具里跑起来看效果，适合先看UI和交互。

**真实模式**：把 `USE_CLOUD` 改成 `true`，并按下面「云开发配置清单」完成配置后，AI咨询、AI评估报告、会员支付、数据存储都会走真实的云端逻辑。这几项都需要你自己的账号资质（小程序主体资质、AI服务商API Key、微信支付商户号），任何人都无法替你生成，我已经把代码和该填什么全部写好、标好位置。

## 如何打开项目

1. 下载并安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 打开开发者工具 → 导入项目 → 选择本项目根目录
3. AppID 先用"测试号"即可预览UI；要开通云开发/AI/支付，需要使用你自己申请的小程序 AppID（个人主体也可以开通云开发和AI咨询，但收款/支付需要企业主体）

## 目录结构

```
xiaonuan-ai-pregnancy-assistant/
├── app.js                    # 入口：globalData、云开发初始化(wx.cloud.init)、登录
├── app.json                  # 全局配置：页面路由、tabBar
├── app.wxss                  # 全局样式
├── project.config.json       # 开发者工具项目配置（含 cloudfunctionRoot）
├── utils/
│   ├── constants.js          # 【核心配置文件】USE_CLOUD开关、云环境ID、会员套餐、云函数名、集合名
│   ├── request.js            # 封装 wx.request（自建后端模式使用）
│   ├── api.js                # 业务接口层：按 USE_CLOUD 自动路由到 mock 或云函数
│   └── recordStore.js        # 周期记录读写层：按 USE_CLOUD 自动路由到本地storage或云数据库
├── cloudfunctions/           # 云函数（USE_CLOUD=true 时使用）
│   ├── login/                # 获取用户 openid
│   ├── aiChat/                # AI咨询：安全调用大模型API + 保存聊天记录
│   ├── aiAssessment/          # AI评估：调用大模型生成结构化报告，存入 reports 集合
│   ├── createOrder/           # 会员购买：创建云支付订单
│   ├── onPaySuccess/          # 支付成功回调：更新订单状态 + 会员到期时间
│   └── memberInfo/            # 查询当前用户会员状态
└── pages/
    ├── index/                # 首页
    ├── record/                # 周期记录
    ├── chat/                  # AI咨询
    ├── assessment/            # AI评估
    ├── report/                 # AI报告
    └── member/                 # 会员中心（含套餐选择与支付）
```

## 架构说明（为什么这么设计）

- **页面代码永远不直接碰 AI Key / 支付密钥**。这些密钥只存在云函数的环境变量里，小程序前端拿不到、反编译也看不到。
- **`api.js` / `recordStore.js` 是唯一的路由层**。所有页面只调用这两个文件暴露的方法，内部按 `USE_CLOUD` 开关切到 mock、本地storage 或云函数/云数据库。这样你可以随时切换模式，页面代码不用改。
- **数据库集合**（`USE_CLOUD=true` 时会用到，需要在云开发控制台手动创建）：
  - `records` — 周期记录，权限建议「仅创建者可读写」
  - `chat_history` — AI咨询历史，权限建议「仅创建者可读写」
  - `reports` — AI评估报告，权限建议「仅创建者可读写」
  - `members` — 会员状态，权限建议「仅创建者可读，不可写」（会员状态只能由 `onPaySuccess` 云函数以管理员权限写入，防止用户自己改自己是不是会员）
  - `orders` — 支付订单，权限建议「仅创建者可读，不可写」

## 云开发配置清单（USE_CLOUD 改为 true 之前必须做完）

### 1. 开通云开发
1. 微信开发者工具顶部菜单 → 云开发 → 开通
2. 记下环境ID，填入 `utils/constants.js` 的 `CLOUD_ENV_ID`
3. 把 `utils/constants.js` 的 `USE_CLOUD` 改为 `true`

### 2. 创建数据库集合
云开发控制台 → 数据库 → 新建集合：`records`、`chat_history`、`reports`、`members`、`orders`（按上面建议设置权限）

### 3. 部署云函数
每个 `cloudfunctions/` 下的文件夹都要：右键 → 上传并部署：云端安装依赖。共6个：`login`、`aiChat`、`aiAssessment`、`createOrder`、`onPaySuccess`、`memberInfo`

### 4. 配置AI接口密钥（aiChat、aiAssessment 两个云函数都要配）
云开发控制台 → 云函数 → 对应函数 → 配置 → 环境变量，添加：
- `AI_API_URL`：大模型服务商的接口地址（默认按 OpenAI 兼容格式实现，DeepSeek / 通义千问 / Moonshot 等国产大模型基本都提供兼容接口，换个地址就能用）
- `AI_API_KEY`：你申请的 API Key
- `AI_MODEL`：模型名称，例如 `deepseek-chat`

### 5. 配置微信支付（可选，不做会员功能可跳过）
1. 完成小程序主体的企业认证 + 微信支付商户号申请
2. 云开发控制台 → 支付 → 关联商户号
3. `createOrder` 云函数的环境变量中添加 `SUB_MCH_ID`（你的特约商户号）
4. ⚠️ 云支付相关接口 `cloud.cloudPay.unifiedOrder` 的参数细节可能随微信平台更新，正式上线前请对照当时的官方文档核对一遍：
   https://developers.weixin.qq.com/miniprogram/dev/wxcloud/reference-sdk-api/pay/cloud.cloudPay.unifiedOrder.html
5. 会员套餐价格在 `utils/constants.js` 的 `MEMBER_PLANS` 里改成你实际的定价（单位是"分"）

### 6. 验证
- AI咨询页面发一条消息，能收到基于真实模型的回复，而不是"（示例回复）..."
- AI评估页面提交问卷后，报告页显示的是模型生成的内容
- 周期记录保存后，云开发控制台的 `records` 集合里能看到新数据
- （如果做了支付）会员中心选套餐 → 开通会员 → 拉起真实支付 → 支付成功后会员状态自动更新

## 阶段8：测试上线前还需要你自己完成的事

这些都涉及真实资质和外部审核，属于任何AI工具都无法替你完成的部分：
1. 小程序主体资质（个人/企业）、AppID 替换测试号
2. 服务器域名配置（微信公众平台 → 开发管理 → 开发设置，如果用云函数则一般无需额外配置合法域名）
3. 隐私协议、用户信息保护指引（小程序涉及收集用户健康类数据，微信审核对此类目会重点关注，建议提前准备好隐私政策页面）
4. 提交审核时选择合适的服务类目（健康类小程序审核会更严格，AI咨询类内容建议标注"仅供参考，不构成医学诊断"）
5. 真实机型/多分辨率测试

## 待补充资源
- `pages/member/member.wxml` 中头像默认引用了 `/images/default-avatar.png`，项目未包含该图片，可自行放入 `images/` 目录，或替换为图标/emoji
- tabBar 当前使用纯文字（未配置图标），如需图标可在 `app.json` 的 `tabBar.list` 中补充 `iconPath` / `selectedIconPath`
