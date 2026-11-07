# 评审问题修复报告

## 范围与未修改内容

未新增产品功能；素材、计分文件和计分模板逐文件哈希核对未变。周期记录页、云函数、图片分析与语音处理不在本次验收范围，相关页面/函数/素材未修改。输入组件只增加现有“继续咨询”的聚焦绑定，没有改动录音或图片处理。整体视觉保持，仅调整评审要求的反馈点击区、风险卡宽度与四快捷入口排版。

## 1. 预设入口与计划回复

- [utils/knowledgeBase.js:87](../../utils/knowledgeBase.js#L87)：补12条固定问答，附关键词和建议，来源标为Demo内部文案；已有医学条目不冒充新文献。
- [utils/skills/knowledgeSkill.js:77](../../utils/skills/knowledgeSkill.js#L77)：命中固定FAQ后使用对应答案与建议。
- [utils/intentRouter.js:76](../../utils/intentRouter.js#L76)：风险识别仍先于知识；计划/已命中FAQ先于情绪和周期分支。
- [pages/chat/chat.js:33](../../pages/chat/chat.js#L33) 与 [pages/chat/chat.wxml:53](../../pages/chat/chat.wxml#L53)：标签拆分label与question。
- [pages/chat/chat.js:237](../../pages/chat/chat.js#L237)：只整理既有报告suggestions和reportAnalysis，直接写入一条生活计划回复，末尾注明Demo规则模板，不调用意图路由。

## 2. 负向反馈

- [pages/chat/chat.wxml:117](../../pages/chat/chat.wxml#L117)：没帮到我显式传false。
- [pages/chat/chat.js:254](../../pages/chat/chat.js#L254)：只有true/字符串true为满意。
- [pages/chat/chat.js:663](../../pages/chat/chat.js#L663)：普通反馈换问法；内容有误才提示核实/医生；已有高风险卡不另弹底部横幅。
- [pages/chat/chat.wxml:279](../../pages/chat/chat.wxml#L279)：提交按钮文案。

## 3. 健康边界与风险

- [pages/chat/chat.js:431](../../pages/chat/chat.js#L431)：保存文字回复riskNotice。
- [components/AIMessageCard/AIMessageCard.js:12](../../components/AIMessageCard/AIMessageCard.js#L12)、[components/AIMessageCard/AIMessageCard.wxml:40](../../components/AIMessageCard/AIMessageCard.wxml#L40)、[components/AIMessageCard/AIMessageCard.wxss:105](../../components/AIMessageCard/AIMessageCard.wxss#L105)：免责声明置于折叠区外，适用于短回复、折叠回复和模板计划。
- [utils/knowledgeBase.js:104](../../utils/knowledgeBase.js#L104)、[utils/knowledgeBase.js:166](../../utils/knowledgeBase.js#L166)、[utils/skills/riskSkill.js:18](../../utils/skills/riskSkill.js#L18)：按等级、同等级优先级只选一条指导，避免同时输出等待和立即就医。新增用药规则，已确认腹痛+出血high。
- [components/RiskWarningCard/RiskWarningCard.wxss:5](../../components/RiskWarningCard/RiskWarningCard.wxss#L5)：风险卡宽度与AI卡统一。
- [utils/skillDispatcher.js:77](../../utils/skillDispatcher.js#L77)：移除“能对接专业医生”的未实现承诺。

## 4. 其他问题

- [pages/chat/chat.js:442](../../pages/chat/chat.js#L442)：非0返回toast。
- [pages/chat/chat.js:328](../../pages/chat/chat.js#L328)、[components/ChatInput/ChatInput.js:14](../../components/ChatInput/ChatInput.js#L14)、[components/ChatInput/ChatInput.wxml:17](../../components/ChatInput/ChatInput.wxml#L17)：“继续咨询”聚焦现有输入框。
- [pages/chat/chat.wxml:41](../../pages/chat/chat.wxml#L41)：示例服务标注；欢迎语使用“备孕知识”。
- [pages/chat/chat.wxml:2](../../pages/chat/chat.wxml#L2)、[components/XiaoNuanHeader/XiaoNuanHeader.wxml:3](../../components/XiaoNuanHeader/XiaoNuanHeader.wxml#L3)：首页隐藏返回箭头。
- [pages/chat/chat.wxss:647](../../pages/chat/chat.wxss#L647)：增大字号、颜色对比与点击区。
- [pages/chat/chat.wxss:113](../../pages/chat/chat.wxss#L113)：四入口一屏放下，原PNG未改。
- [README.md:1](../../README.md#L1)：按当前两页结构重写启动说明与范围。

## 自测输出

运行 `node tests/reviewFlows.test.js`：**23/23命中，0个“没有找到直接对应”**。测试没有删除断言或把兜底句改名来规避检查；另断言每个入口needHandoff=false，并模拟连续点击两张首页卡片验证不弹兜底。

| 入口 | 实际发送问句 | 路由 | 结果 |
| --- | --- | --- | --- |
| 备孕计划 | 帮我制定一个备孕计划 | A | 命中，无兜底 |
| 知识科普 | 备孕知识科普 | A | 命中，无兜底 |
| 用药建议 | 备孕期间用药有哪些注意事项？ | D | 命中，无兜底 |
| 备孕多久正常？ | 备孕多久正常？ | A | 命中，无兜底 |
| 如何提高受孕几率？ | 如何提高受孕几率？ | A | 命中，无兜底 |
| 备孕期间需要补充什么营养？ | 备孕期间需要补充什么营养？ | A | 命中，无兜底 |
| 排卵日总是算不准怎么办？ | 排卵日总是算不准怎么办？ | A | 命中，无兜底 |
| 孕前检查有哪些项目？ | 孕前检查有哪些项目？ | A | 命中，无兜底 |
| 备孕时如何调整作息？ | 备孕时如何调整作息？ | A | 命中，无兜底 |
| 初次备孕 | 初次备孕需要关注什么？ | A | 命中，无兜底 |
| 备孕1–3月 | 备孕1–3个月需要关注什么？ | A | 命中，无兜底 |
| 备孕3–6月 | 备孕3–6个月需要关注什么？ | A | 命中，无兜底 |
| 备孕半年+ | 备孕半年以上需要关注什么？ | A | 命中，无兜底 |
| 周期不规律 | 月经周期不规律时，备孕需要关注什么？ | B | 命中，无兜底 |
| 更多 | 备孕知识科普主要包括哪些内容？ | A | 命中，无兜底 |
| 排卵监测 | 排卵监测时如何记录排卵相关变化？ | A | 命中，无兜底 |
| 营养补充 | 备孕期间需要补充什么营养？ | A | 命中，无兜底 |
| 孕前检查 | 备孕前需要做哪些孕前检查？ | A | 命中，无兜底 |
| 生活习惯 | 备孕生活习惯需要注意什么？ | A | 命中，无兜底 |
| 情绪压力 | 备孕时感到压力，如何调整情绪？ | C | 命中，无兜底 |
| 周期记录 | 如何记录月经周期？ | B | 命中，无兜底 |
| 推荐问题1 | 排卵日总是算不准怎么办？ | A | 命中，无兜底 |
| 推荐问题2 | 我的试纸结果怎么看？ | A | 命中，无兜底 |

### 三个风险问题的完整回答

#### 我下腹疼痛还有出血 → high

```text
你提到的这个情况我认真看了一下，确实需要留意一下~

腹痛同时伴有出血，建议尽快前往妇科或急诊评估；若疼痛剧烈、出血量大、头晕或晕厥，请立即就医。Demo无法判断具体原因，不建议仅等待观察。

给你几个具体建议：
1. 请按以上提示就医，不依赖Demo判断病因。
2. 就诊前可以把「周期记录」里的数据整理一下带过去，方便医生快速了解情况；不要为整理资料耽误就医。
3. 不要自行判断病因或用药；就医优先，不要等待Demo回复。
```
#### 我吃二甲双胍可以备孕吗 → medium

```text
你提到的这个情况我认真看了一下，确实需要留意一下~

用药请遵医嘱，不要自行用药或停药，用药前咨询医生或药师。Demo不判断某种药是否适合你，不提供剂量、换药或停药方案。

给你几个具体建议：
1. 用药前咨询医生或药师，并说明备孕计划。
2. 整理正在使用的药物和补充剂清单，供专业人员核对。
3. 遵医嘱，不要自行用药、换药或停药。
```
#### 我阴道大量出血，肚子剧痛 → high

```text
你提到的这个情况我认真看了一下，确实需要留意一下~

大量出血、剧烈疼痛或晕厥可能需要紧急处置，请立即前往急诊或联系当地急救服务，不要等待观察；Demo无法判断具体原因。

给你几个具体建议：
1. 请按以上提示就医，不依赖Demo判断病因。
2. 就诊前可以把「周期记录」里的数据整理一下带过去，方便医生快速了解情况；不要为整理资料耽误就医。
3. 不要自行判断病因或用药；就医优先，不要等待Demo回复。
```

完整机器输出：[self-test-output.json](self-test-output.json)。

另通过反馈独立状态、本机存储、报告计划绕过API、接口非0提示、聚焦状态、最高风险选择、WXML/WXSS实际编译。浏览器375×813及320/414宽度验证了折叠回复免责声明可见、两种卡片同宽、四入口完整显示。

## 不能在微信开发者工具内替代验证的项目

- 当前环境没有微信开发者工具，未宣称完成开发者工具或真机验收。
- 请手动确认“继续咨询”是否弹出原生键盘，输入后失焦行为是否正常。
- 请检查首页返回箭头、示例标注、四入口缩放后的文字可读性、AI/风险卡是否对齐，以及原生组件是否遮挡。
- 问卷右下赞踩小条：按要求未因浏览器推测改动。素材和该组件样式保持原样，待你在微信开发者工具确认是否只有半边显示或图标偏小。
- 雷达图逻辑未改；请手动回归原生canvas显示与点击。
- 周期记录页、云函数模式、图片和语音咨询不在评审修改范围，不据本轮测试声称通过；需另行手动验收。
- 真实代码包体积和二维码上传仍以微信开发者工具为准。

## 医疗文案确认

全部新增/改写的相关文案单列于[medical-copy.md](medical-copy.md)，请逐项确认；腹痛伴出血high级别已确认。
