const https=require('https');
function providerFailure(status,data){
  let code='';try{const body=JSON.parse(data);code=String(body.error&&body.error.code||body.code||'').toLowerCase();}catch(e){}
  const suffix='（HTTP '+status+'）';
  if(status===401||/invalid_api_key|invalidapikey/.test(code))return '报告模型密钥无效或地域不匹配，请核对云函数 REPORT_API_KEY 与服务地域'+suffix;
  if(status===402||/arrearage|insufficient_quota|insufficient_balance/.test(code))return '报告模型服务额度不足或账号欠费，请检查百炼额度与账单'+suffix;
  if(status===403)return '报告模型访问被拒绝，请检查服务开通状态、模型权限和密钥所属空间'+suffix;
  if(status===404||/modelnotfound|model_not_found/.test(code))return '报告模型或接口地址不可用，请检查 REPORT_MODEL 和 REPORT_API_URL'+suffix;
  if(status===429)return '报告模型请求受限，请检查服务额度和限流设置后重试'+suffix;
  if(status===400)return '报告模型拒绝请求参数，请检查视觉模型是否支持图片输入及当前参数'+suffix;
  if(status>=500)return '报告模型服务暂时异常，请稍后重试'+suffix;
  return '报告模型请求失败，请核对服务配置'+suffix;
}
function callModel(messages,env=process.env){
  const endpoint=env.REPORT_API_URL||'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
  const key=env.REPORT_API_KEY,model=env.REPORT_MODEL||'qwen-vl-plus';
  if(!key) return Promise.reject(Object.assign(Error('报告识别服务尚未配置'),{code:'NOT_CONFIGURED'}));
  let url;try{url=new URL(endpoint);}catch(e){return Promise.reject(Error('报告服务地址无效'));}
  if(url.protocol!=='https:'||url.username||url.password) return Promise.reject(Error('报告服务必须使用HTTPS地址'));
  const payload={model,messages,temperature:0.1};
  const tokens=Number(env.REPORT_MAX_TOKENS);if(Number.isInteger(tokens)&&tokens>=256&&tokens<=12000)payload.max_tokens=tokens;
  const body=JSON.stringify(payload);
  return new Promise((resolve,reject)=>{
    const req=https.request(url,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+key,'Content-Length':Buffer.byteLength(body)}},res=>{
      res.setEncoding('utf8');
      let data='';res.on('data',chunk=>{data+=chunk;if(Buffer.byteLength(data)>1024*1024){req.destroy();reject(Error('报告服务响应过大'));}});
      res.on('end',()=>{if(res.statusCode<200||res.statusCode>=300){reject(Error(providerFailure(res.statusCode,data)));return;}try{const value=JSON.parse(data);const choice=value.choices&&value.choices[0];
        if(choice&&choice.finish_reason==='length'){reject(Error('报告模型输出被截断（RPT-TRUNCATED），请裁剪为较少指标，或按模型限制调整 REPORT_MAX_TOKENS'));return;}
        if(choice&&choice.finish_reason==='content_filter'){reject(Error('报告模型未提供内容（RPT-FILTERED），请核对服务限制'));return;}
        const text=choice&&choice.message&&choice.message.content;if(typeof text!=='string')throw Error();resolve(text);
      }catch(e){reject(Error('报告服务返回格式无效（RPT-RESPONSE），请检查是否使用OpenAI兼容接口'));}});
    });
    req.setTimeout(25000,()=>req.destroy(Error('报告服务响应超时，请重试')));
    req.on('error',()=>reject(Error('报告服务连接失败或超时，请重试')));req.end(body);
  });
}
module.exports={callModel,providerFailure};
