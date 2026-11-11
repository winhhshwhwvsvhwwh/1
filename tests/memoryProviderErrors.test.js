const assert=require('node:assert/strict');const {providerFailure}=require('../cloudfunctions/companionMemory/modelClient');
for(const [code,expected] of [['AccessDenied.Unpurchased','尚未开通'],['Workspace.AccessDenied','同一空间'],['Arrearage','额度'],['AccessDenied','访问被拒绝']]){
 const result=providerFailure(403,JSON.stringify({error:{code,message:'private patient data sk-secret'}}));assert(result.includes(expected));assert(result.includes(code.toLowerCase()));assert(result.includes('HTTP 403'));assert(!result.includes('private'));assert(!result.includes('sk-secret'));
}
assert(!providerFailure(403,JSON.stringify({error:{code:'sk-exposed-token',message:'secret'}})).includes('sk-exposed'));
assert(providerFailure(400,'{}').includes('文字模型支持的请求参数'));
console.log('PASS safe provider code and 403 service/workspace/quota distinctions; no raw messages, patient data or secrets echoed');
