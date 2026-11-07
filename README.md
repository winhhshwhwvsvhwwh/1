# 小暖 AI 备孕助手 Demo

微信原生小程序（JavaScript / WXML / WXSS）。当前只注册两个页面：聊天主页面 `pages/chat/chat` 和二级周期记录页 `pages/record/record`，没有 tabBar。

## 启动

1. 下载并解压项目，在微信开发者工具中导入包含 `app.json` 和 `project.config.json` 的目录。
2. 使用你有开发者权限的小程序 AppID；当前项目已保留配置的正式 AppID。不要上传 AppSecret 或服务端密钥。
3. 保持 `utils/constants.js` 的 `USE_CLOUD=false`，点击编译即可查看 Demo，无需安装前端依赖或部署云函数。
4. 真机预览/调试需登录有权限的微信账号。实际代码包大小以开发者工具为准；`packOptions.ignore` 已排除设计参考、测试和说明文件，避免把开发资料打进2MB主包。

## 当前行为与限制

- 文字咨询由本地规则、固定问答和知识点生成，不调用真实大模型。
- 首页和咨询标签使用完整预设问句；报告中的“根据本次自评整理计划”直接整理当前报告的建议与分析，不重新走关键词路由。
- 反馈保存在本机最近50条，尚无服务端反馈通道。普通“没帮到我”反馈提示补充问法；内容准确性反馈提示核实；高风险只保留消息内风险卡，不重复显示底部横幅。
- 咨询服务卡为示例，尚未接入真人备孕师预约或服务记录系统。
- 自评分数、箭头和雷达图使用既有 Demo 计分规则，未经医学验证，不代表诊断、生育能力或受孕概率。
- 周期记录页保存后可点“查看周期解读”，自动发送“我现在处于周期哪个阶段？”，通过记录 ID 使用刚保存的数据；已有记录默认使用经期开始日期最近的一条。回复先列出所用记录，再给日期估算。缺少或无效记录不提供具体阶段；超过一个平均周期的旧记录会提示外推局限。
- 云函数模式、图片和语音咨询未在本次修改中验证。

## 目录

```text
app.js / app.json / app.wxss      小程序入口与全局配置
project.config.json              开发者工具、AppID和打包配置
pages/chat/                      首页、文字聊天、评估、报告、反馈
pages/record/                    周期记录二级页面
components/                      消息卡、风险卡、输入框、顶部栏等
utils/knowledgeBase.js           固定知识、FAQ检索和风险规则
utils/offlineFaq.js              六类新增问答、建议和补充信息提示（36条）
utils/intentRouter.js            本地意图优先级
utils/skillDispatcher.js         Skill调度
utils/skills/                    本地知识、周期、情绪、风险等模块
utils/assessmentReport.js        既有评估计分（本次未修改）
utils/radarTooltip.js            雷达节点状态描述
images/                          已提供的素材（本次未修改）
tests/                           Node回归脚本，不参与小程序打包
design-reference/                设计参考和评审输出，不参与打包
cloudfunctions/                  现有云函数，未在本次评审中修改或验证
_archived/                       归档的早期首页/会员/独立评估与报告页
```

## 本地验证

安装 Node.js 后，从项目根目录执行：

```sh
node tests/cycleFlow.test.js
node tests/offlineKnowledge.test.js
node tests/reviewFlows.test.js
node tests/feedback.test.js
node tests/scrollShortcut.test.js
node tests/assessmentReport.test.js
node tests/radarTooltip.test.js
node tests/componentAssets.test.js
```

评审测试模拟 `wx`，覆盖23个预设入口、3个风险问题、负向反馈、风险横幅去重、报告计划绕过路由、接口失败提示和聚焦状态。完整回答见 `design-reference/review-fixes/self-test-output.json`。

微信开发者工具中仍需手动检查键盘聚焦、原生组件排版、风险卡对齐、四入口可读性、雷达点击以及真机上传。问卷右下赞踩图未因浏览器推测而调整，待工具内核实。周期记录的保存→解读链路已通过 Node 模拟验证；其原生表单、云函数、图片和语音咨询仍需分别验收。


六类本地知识已扩充：备孕计划、周期排卵、试纸解读、营养作息、孕前检查、用药注意事项。新增36条固定问答及多种问法，明确问到两个不同主题时最多合并两类说明；涉及用药时仍先提醒遵医嘱，高风险时不追加一般科普。补充信息提示用于帮助下一次完整提问，本地规则并不具备任意多轮语义理解能力。新增文案与完整测试回答见 design-reference/offline-knowledge/。


## 本次入口与周期解读验收

1. 无记录：在本机无周期记录的状态下，首页 →“周期记录与解读”→ 查看必填提示 → 填写经期起止、平均周期长度、经期长度 → 保存记录 →“查看周期解读”。聊天自动出现预设问题；回复开头的日期及参数应与刚保存的一致。
2. 已有记录：同一路径进入，直接点顶部“查看周期解读”。再保存一条日期较早、参数不同的记录并点解读，确认使用的是刚保存的数据，而非另一条日期更新的记录。
3. 首页“问备孕问题”应聚焦原输入框；“查看备孕准备建议”给通用准备建议。“咨询备孕师”入口直接可见“示例”。报告按钮为“根据本次自评整理计划”，生成逻辑保持不变。
4. 微信开发者工具选 390×844：AI备孕评估 → 开始问卷，确认赞踩两个图标完整且点击区对应；咨询示例 → 切换按阶段/按需求，检查图标裁切、文字和遮挡。
5. 发送问题 →“这个回答没帮到我”→ 选“答非所问”提交，应显示已反馈不满意；点“继续提问”后检查键盘弹起时输入框可见。重新反馈选“内容有误”，应出现核实提示和“查看就医指引”。

当前执行环境未安装微信开发者工具：390×844 浏览器仅辅助核对图形与容器位置，不等于微信原生布局、点击、键盘或真机验证。没有据此改动问卷赞踩与咨询标签的既有布局。

素材核对：`images/campaign/home-features.png` 含三张卡片的图标及旧标签，`images/campaign/shortcut-consult.png` 含图标和“咨询备孕师”。当前仅以裁切容器显示其中图标，旧标签不进入可见区域；新标签用同一个可点击容器里的原生文字显示，没有盖在旧字上。无需替换 PNG 文件；所有 images 文件保持原字节。

本次周期估算文案、边界和验证范围见 `design-reference/cycle-flow-review.md`。
