// cloudfunctions/aiChat/index.js
// 作用：接收用户消息 -> 调用大模型API生成回复 -> 保存聊天记录到数据库 -> 返回AI回复
//
// 为什么要放在云函数里而不是小程序前端直接调用AI接口？
// 因为AI服务商的 API Key 一旦写在前端代码里，任何人反编译小程序都能拿到并盗用。
// 云函数运行在服务端，API Key 存放在云函数的环境变量里，前端永远看不到。
//
// ============ 部署前必须完成 ============
// 1. 在云开发控制台 -> 云函数 -> aiChat -> 配置 -> 环境变量 中添加：
//    AI_API_KEY   = 你的大模型服务商API Key（切勿写入代码/仓库，只填在这里）
//    AI_API_URL   = 大模型服务商的接口地址（OpenAI兼容格式）
//                   智谱AI(GLM)示例：https://open.bigmodel.cn/api/paas/v4/chat/completions
//                   其他国产大模型（DeepSeek / Moonshot / 通义千问）同理，换地址和key即可
//    AI_MODEL     = 使用的模型名称
//                   智谱AI示例：'glm-4-flash'（免费/低成本） 或 'glm-4-plus'（效果更强）
// 2. 右键 aiChat 文件夹 -> 上传并部署：云端安装依赖

const cloud = require('wx-server-sdk');
const https = require('https');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 知识要点摘要（对权威公开资料的转述，非原文摘抄），供真实AI接口作答时参考并标注来源
const KNOWLEDGE_DIGEST = [
  '1. 备孕营养：建议每日额外补充叶酸（常见推荐约400微克/天，具体遵医嘱），保持均衡膳食。（参考：中国营养学会《备孕妇女膳食指南》）',
  '2. 孕前保健：计划怀孕前建议做孕前评估，包括慢性病管理、疫苗核查、生活方式调整等。（参考：WHO孕前保健政策简报）',
  '3. 何时需要就医评估：35岁以下规律备孕满1年未孕、或35岁及以上满6个月未孕，建议尽早就医做生育力评估。（参考：ACOG Committee Opinion No.781）',
  '4. 月经生理：周期一般分为月经期、卵泡期、排卵期、黄体期，排卵通常发生在下次月经前约14天左右，因人而异。（参考：《妇产科学》第9版）'
].join('\n');

const SYSTEM_PROMPT =
  '你是"小暖"，一位专业、温暖、有耐心的备孕咨询助手。\n' +
  '你必须严格按照下面的JSON格式返回，不要输出JSON以外的任何文字（不要有开头寒暄、不要有markdown代码块标记）：\n' +
  '{\n' +
  '  "understanding": "对用户问题的理解，一两句话，口语化",\n' +
  '  "analysis": "结合科普知识要点和用户情况的分析结果，可以是1-3句话",\n' +
  '  "suggestions": ["建议1", "建议2", "建议3"],\n' +
  '  "riskNotice": "风险提醒/是否需要就医的说明，一两句话"\n' +
  '}\n' +
  '每个字段内的文字要口语化、自然，像朋友聊天一样，可以用"~""哦""呀"这类语气词，避免"根据你的描述"这种模板开场白；' +
  '但整体输出结构必须是上面这个JSON，不能只返回一段普通聊天文字，也不能省略任何一个字段。\n' +
  'suggestions 固定给3条具体可执行的建议。riskNotice 即使当前问题没有明显风险，也要给一句"仅为科普参考，不能替代医生诊断"之类的兜底提醒。\n' +
  '如果用到了下面的科普知识要点，可以在 analysis 或 riskNotice 字段里自然地提一句参考来源（比如"这部分参考了xxx"），不用做成正式的文献列表。\n\n' +
  '【科普知识要点】\n' + KNOWLEDGE_DIGEST + '\n\n' +
  '【必须遵守的红线】（依据国家卫健委《互联网诊疗管理办法（试行）》及《医务人员互联网健康科普负面行为清单（试行）》）\n' +
  '- 不得做出诊断性结论，不得替代医生处方或治疗方案；\n' +
  '- 涉及异常症状（如疼痛、出血、周期紊乱等）或具体医疗决策时，riskNotice 必须明确建议用户前往正规医院就诊，由医生结合检查结果判断，但语气要自然关心，不要生硬地贴免责声明。';

// AI咨询兜底机制用：高风险关键词（服务端独立维护一份精简版——云函数是独立部署单元，
// 不能 require utils/knowledgeBase.js，这份表和 utils/knowledgeBase.js 里 RISK_LIBRARY 的
// high级别关键词保持一致，后续如果调整风险规则库，这里也要同步改）
const HIGH_RISK_KEYWORDS = [
  '剧烈疼痛', '大量出血', '腹痛难忍', '晕厥',
  '一年没有怀孕', '一年未孕', '两年没有怀孕', '备孕失败', '一直没怀孕', '一直没成功', '一直没怀上', '怀不上'
];

function detectRiskLevel(content) {
  return HIGH_RISK_KEYWORDS.some((kw) => content.includes(kw)) ? 'high' : 'none';
}

/**
 * 从大模型返回文本中提取JSON对象。
 * 大模型有时会在JSON外面包一层```json代码块，这里做个宽松处理。
 */
function parseStructuredReply(rawText) {
  const cleaned = rawText.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(cleaned);

  const understanding = typeof parsed.understanding === 'string' ? parsed.understanding.trim() : '';
  const analysis = typeof parsed.analysis === 'string' ? parsed.analysis.trim() : '';
  const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions.filter((s) => typeof s === 'string' && s.trim()) : [];
  const riskNotice = typeof parsed.riskNotice === 'string' ? parsed.riskNotice.trim() : '';

  // 四个字段必须都有内容，任何一个缺失都视为格式不合规，交给上层做兜底处理
  if (!understanding || !analysis || suggestions.length === 0 || !riskNotice) {
    throw new Error('AI返回内容缺少必需字段（understanding/analysis/suggestions/riskNotice）');
  }

  return { understanding, analysis, suggestions, riskNotice, usedFallback: false };
}

/**
 * 兜底结构化回复：当大模型没有按JSON格式返回时使用，
 * 保证接口对外承诺的"四段式结构化回复"这个契约不会被破坏。
 */
function buildFallbackReply(rawText) {
  return {
    understanding: '收到你的问题，我来帮你看看~',
    analysis: (rawText && rawText.trim()) || '这个问题我需要再想想，建议换个方式问我，或者稍后再试一次。',
    suggestions: [
      '保持规律作息、均衡饮食，双方共同补充叶酸等孕前营养素',
      '坚持记录周期数据，有助于更准确地判断身体状态',
      '如果这个问题比较复杂，也可以直接前往正规医院咨询医生'
    ],
    riskNotice: '以上内容仅为健康科普参考，不能替代医生诊断；如有明显不适，建议及时就医。',
    usedFallback: true
  };
}

/**
 * 调用大模型API（OpenAI兼容格式），返回结构化的四段式回复
 * @returns {Promise<{ understanding: string, analysis: string, suggestions: string[], riskNotice: string }>}
 */
function callAIModel(userContent, history) {
  return new Promise((resolve, reject) => {
    const apiUrl = process.env.AI_API_URL; // 例如 'https://api.deepseek.com/chat/completions'
    const apiKey = process.env.AI_API_KEY;
    const model = process.env.AI_MODEL || 'glm-4-flash';

    if (!apiUrl || !apiKey) {
      reject(new Error('AI_API_URL / AI_API_KEY 未配置，请先在云函数环境变量中设置'));
      return;
    }

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: userContent }
    ];

    const payload = JSON.stringify({
      model,
      messages,
      temperature: 0.7
    });

    const url = new URL(apiUrl);
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(payload)
        }
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.error) {
              reject(new Error(json.error.message || 'AI接口返回错误'));
              return;
            }
            const rawText = json.choices && json.choices[0] && json.choices[0].message
              ? json.choices[0].message.content
              : '';

            try {
              resolve(parseStructuredReply(rawText));
            } catch (parseErr) {
              // 大模型偶尔没遵守JSON格式约定时，不直接把整个接口跑挂，走兜底结构化回复
              console.error('AI回复解析失败，使用兜底结构化回复', parseErr, rawText);
              resolve(buildFallbackReply(rawText));
            }
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/**
 * 把结构化四字段拼成聊天气泡展示用的文本，风格与 utils/skillDispatcher.js（mock路径）保持一致：
 * 自然段落 + 轻量过渡语，不用方括号标题，但四个部分都必须在。
 */
function formatDisplayText({ understanding, analysis, suggestions, riskNotice }) {
  return [
    understanding,
    analysis,
    '给你几个具体建议：\n' + suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n'),
    riskNotice
  ]
    .filter(Boolean)
    .join('\n\n');
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { content, action } = event;

  // 获取历史聊天记录（供前端页面加载时展示，此前分析发现这个分支缺失，这次一并补上）
  if (action === 'history') {
    try {
      const historyRes = await db
        .collection('chat_history')
        .where({ _openid: openid })
        .orderBy('timestamp', 'asc')
        .limit(50)
        .get();
      return { code: 0, data: historyRes.data };
    } catch (err) {
      console.error('aiChat history error', err);
      return { code: 0, data: [] };
    }
  }

  if (!content || !content.trim()) {
    return { code: 1, message: '消息内容不能为空' };
  }

  try {
    // 取最近10条历史消息作为上下文（用组装好的展示文本 content 字段，保持对话上下文连贯）
    const historyRes = await db
      .collection('chat_history')
      .where({ _openid: openid })
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();
    const history = historyRes.data.reverse();

    // AI咨询接口契约：必须返回结构化的四段式回复，不是一段普通聊天文本
    const structured = await callAIModel(content, history);
    const displayContent = formatDisplayText(structured);
    const timestamp = Date.now();
    // riskLevel：服务端关键词检测；needHandoff：命中高风险 或 大模型没按格式返回（用了兜底回复）
    const riskLevel = detectRiskLevel(content);
    const needHandoff = riskLevel === 'high' || structured.usedFallback;

    // 保存本轮对话（用户消息 + AI结构化回复，assistant消息同时存展示文本和四个结构化字段）
    await db.collection('chat_history').add({
      data: { role: 'user', content, timestamp }
    });
    await db.collection('chat_history').add({
      data: {
        role: 'assistant',
        content: displayContent,
        understanding: structured.understanding,
        analysis: structured.analysis,
        suggestions: structured.suggestions,
        riskNotice: structured.riskNotice,
        riskLevel,
        needHandoff,
        timestamp: timestamp + 1
      }
    });

    return {
      code: 0,
      data: {
        role: 'assistant',
        content: displayContent,
        understanding: structured.understanding,
        analysis: structured.analysis,
        suggestions: structured.suggestions,
        riskNotice: structured.riskNotice,
        riskLevel,
        needHandoff,
        timestamp: timestamp + 1
      }
    };
  } catch (err) {
    console.error('aiChat error', err);
    return { code: 1, message: err.message || 'AI服务暂时不可用' };
  }
};
