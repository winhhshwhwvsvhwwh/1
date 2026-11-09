const assert=require('node:assert/strict');
const {providerFailure}=require('../cloudfunctions/reportInterpretation/modelClient');
for(const [status,body,expected] of [[401,'','密钥'],[403,'','权限'],[404,'','接口'],[429,'','受限'],[400,'','参数'],[500,'','暂时异常'],[400,JSON.stringify({error:{code:'Arrearage',message:'private medical report sk-secret'}}),'额度']]){
 const message=providerFailure(status,body);assert(message.includes(expected));assert(message.includes('HTTP '+status));assert(!message.includes('sk-secret'));assert(!message.includes('private medical'));
}
assert(!providerFailure(418,'sensitive invalid response').includes('sensitive'));
console.log('PASS provider HTTP/configuration errors actionable; raw response, report data and credentials not echoed');
