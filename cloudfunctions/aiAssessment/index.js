// cloudfunctions/aiAssessment/index.js
// 作用：接收评估问卷答案 -> 调用大模型生成结构化报告(JSON) -> 存入数据库 -> 返回 reportId
//
// ============ 部署前必须完成 ============
// 与 aiChat 云函数共用同一套环境变量：AI_API_URL / AI_API_KEY / AI_MODEL
// 智谱AI(GLM)配置示例见 cloudfunctions/aiChat/index.js 顶部注释，密钥同样只填在云函数环境变量里

const cloud = require('wx-server-sdk');
const https = require('https');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 知识要点摘要（对权威公开资料的转述，非原文摘抄），生成 suggestions 时可作为依据
const KNOWLEDGE_DIGEST = [
  '1. 备孕营养：建议每日额外补充叶酸（常见推荐约400微克/天，具体遵医嘱），保持均衡膳食。（参考：中国营养学会《备孕妇女膳食指南》）',
  '2. 孕前保健：计划怀孕前建议做孕前评估，包括慢性病管理、疫苗核查、生活方式调整等。（参考：WHO孕前保健政策简报）',
  '3. 何时需要就医评估：35岁以下规律备孕满1年未孕、或35岁及以上满6个月未孕，建议尽早就医做生育力评估。（参考：ACOG Committee Opinion No.781）',
  '4. 月经生理：周期一般分为月经期、卵泡期、排卵期、黄体期，排卵通常发生在下次月经前约14天左右，因人而异。（参考：《妇产科学》第9版）'
].join('\n');

const SYSTEM_PROMPT = `你是一名专业的备孕健康分析助手。用户会给你一份备孕状态评估问卷的答案。
可参考以下科普知识要点来生成更有依据的建议（suggestions字段），不要在JSON外提及参考文献：
${KNOWLEDGE_DIGEST}

请根据答案生成一份备孕状态分析报告，严格按照以下JSON格式返回，不要输出JSON以外的任何文字：
{
  "summary": "一句话总结用户当前备孕状态，50字以内",
  "indicators": [
    { "name": "身体状态", "score": 0到100之间的整数 },
    { "name": "心理状态", "score": 0到100之间的整数 },
    { "name": "生活习惯", "score": 0到100之间的整数 }
  ],
  "suggestions": ["建议1", "建议2", "建议3"]
}
注意：这是健康建议参考，不是医学诊断，不要出现"确诊""疾病"等诊断性词汇；如答案涉及异常症状，suggestions中应包含建议就医的内容。`;

function callAIModel(answersText) {
  return new Promise((resolve, reject) => {
    const apiUrl = process.env.AI_API_URL;
    const apiKey = process.env.AI_API_KEY;
    const model = process.env.AI_MODEL || 'glm-4-flash';

    if (!apiUrl || !apiKey) {
      reject(new Error('AI_API_URL / AI_API_KEY 未配置，请先在云函数环境变量中设置'));
      return;
    }

    const payload = JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: answersText }
      ],
      temperature: 0.3
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
            const raw = json.choices && json.choices[0] && json.choices[0].message
              ? json.choices[0].message.content
              : '';
            resolve(raw);
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
 * 从模型返回的文本中提取JSON（有些模型会在JSON外包一层```json代码块）
 */
function parseReportJSON(raw) {
  const cleaned = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned);
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { answers } = event; // [{ title, answer }]

  if (!answers || !answers.length) {
    return { code: 1, message: '缺少问卷答案' };
  }

  const answersText = answers.map((a, i) => `${i + 1}. ${a.title} 答：${a.answer}`).join('\n');

  try {
    const raw = await callAIModel(answersText);
    let report;
    try {
      report = parseReportJSON(raw);
    } catch (parseErr) {
      // 兜底：解析失败时返回一个基于原文的简化报告，保证前端不会崩
      report = {
        summary: raw.slice(0, 80) || '暂无法生成结构化报告，请稍后重试',
        indicators: [
          { name: '身体状态', score: 70 },
          { name: '心理状态', score: 70 },
          { name: '生活习惯', score: 70 }
        ],
        suggestions: ['保持规律作息', '均衡饮食', '如有疑问建议咨询专业医生']
      };
    }

    const addRes = await db.collection('reports').add({
      data: {
        ...report,
        answers,
        generateTime: new Date().toISOString().slice(0, 10),
        createTime: Date.now()
      }
    });

    return { code: 0, data: { reportId: addRes._id } };
  } catch (err) {
    console.error('aiAssessment error', err);
    return { code: 1, message: err.message || 'AI服务暂时不可用' };
  }
};
