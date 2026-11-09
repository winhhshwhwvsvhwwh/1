const https=require('https');
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
      res.on('end',()=>{if(res.statusCode<200||res.statusCode>=300){reject(Error('报告服务调用失败，请稍后重试'));return;}try{const value=JSON.parse(data);const text=value.choices[0].message.content;if(typeof text!=='string')throw Error();resolve(text);}catch(e){reject(Error('报告服务返回格式无效'));}});
    });
    req.setTimeout(25000,()=>req.destroy(Error('报告服务响应超时，请重试')));
    req.on('error',()=>reject(Error('报告服务连接失败或超时，请重试')));req.end(body);
  });
}
module.exports={callModel};
