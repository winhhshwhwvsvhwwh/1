# 小暖 AI 备孕助手 Demo

微信原生小程序（JavaScript / WXML / WXSS）。当前只注册两个页面：聊天主页面 `pages/chat/chat` 和二级周期记录页 `pages/record/record`，没有 tabBar。

## 启动

1. 下载并解压项目，在微信开发者工具中导入包含 `app.json` 和 `project.config.json` 的目录。
2. 使用你有开发者权限的小程序 AppID；当前项目已保留配置的正式 AppID。不要上传 AppSecret 或服务端密钥。
3. 保持 `utils/constants.js` 的 `USE_CLOUD=false`，点击编译即可查看 Demo，无需安装前端依赖或部署云函数。
4. 真机预览/调试需登录有权限的微信账号。实际代码包大小以开发者工具为准；`packOptions.ignore` 已排除设计参考、测试和说明文件，避免把开发资料打进2MB主包。

## 当前行为与限制

- 文字咨询由本地规则、固定问答和知识点生成，不调用真实大模型。
- 首页和咨询标签使用完整预设问句；报告中的“生成备孕计划”直接整理当前报告的建议与分析，不重新走关键词路由。
- 反馈保存在本机最近50条，尚无服务端反馈通道。普通“没帮到我”反馈提示补充问法；内容准确性反馈提示核实；高风险只保留消息内风险卡，不重复显示底部横幅。
- 咨询服务卡为示例，尚未接入真人备孕师预约或服务记录系统。
- 自评分数、箭头和雷达图使用既有 Demo 计分规则，未经医学验证，不代表诊断、生育能力或受孕概率。
- 周期记录页、云函数模式、图片和语音咨询不在本次评审修改范围内；现有能力边界不变，不据此宣称已完成这些能力的验收。

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
node tests/highlightText.test.js
node tests/unconceivedQuestion.test.js
node tests/offlineKnowledge.test.js
node tests/reviewFlows.test.js
node tests/feedback.test.js
node tests/scrollShortcut.test.js
node tests/assessmentReport.test.js
node tests/radarTooltip.test.js
node tests/componentAssets.test.js
```

评审测试模拟 `wx`，覆盖23个预设入口、3个风险问题、负向反馈、风险横幅去重、报告计划绕过路由、接口失败提示和聚焦状态。完整回答见 `design-reference/review-fixes/self-test-output.json`。

微信开发者工具中仍需手动检查键盘聚焦、原生组件排版、风险卡对齐、四入口可读性、雷达点击以及真机上传。问卷右下赞踩图未因浏览器推测而调整，待工具内核实。周期记录、云函数、图片和语音咨询仍需分别验收。


六类本地知识已扩充：备孕计划、周期排卵、试纸解读、营养作息、孕前检查、用药注意事项。新增36条固定问答及多种问法，明确问到两个不同主题时最多合并两类说明；涉及用药时仍先提醒遵医嘱，高风险时不追加一般科普。补充信息提示用于帮助下一次完整提问，本地规则并不具备任意多轮语义理解能力。新增文案与完整测试回答见 design-reference/offline-knowledge/。


## 明确问题被“怎么办”兜底截走的修复

基础咨询只在整句属于模糊表达时追问，不再因具体问题带有“怎么办”直接回复“当然可以”。“备孕一年都没怀上孕怎么办”等问法复用已有生育评估问答；仅凭未孕描述不诊断不孕，也不按急症输出。试纸阴性疑问仍走验孕科普；大量出血、剧痛、腹痛伴出血仍优先走原高风险规则。

新增测试覆盖截图原句和9种相近表达、模糊短句、验孕疑问及混合高风险症状；未更改页面、入口或视觉，未恢复此前已撤销的周期解读流程。

本次新增医疗相关提示（供确认）：“你想了解备孕一段时间仍未怀孕该怎么办，我们先看何时需要评估，以及可以准备哪些信息。”“双方一起整理既往检查和周期记录，预约妇科或生殖医学门诊咨询；不要自行使用促排药。”年龄与时长说明复用已有本地问答，仍需结合实际未避孕性生活情况、病史和症状，不是诊断。


“小暖分析”中的重点词组按本地显示规则标为主题粉色 #FF4089：正文/折叠预览每段最多3处、每条建议最多1处；否定指令尽量整句标色。原始回答、复制文本、反馈数据及免责声明内容不变，旧消息也支持。未命中词表的文本保持原色；该规则只辅助阅读，不作新的医学判断。
