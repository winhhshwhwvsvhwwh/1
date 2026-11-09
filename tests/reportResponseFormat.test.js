const assert=require('node:assert/strict');
const {parseJSON,createHandler,validateItems}=require('../cloudfunctions/reportInterpretation/core');
assert.deepEqual(parseJSON('{"items":[]}'),{items:[]});
assert.deepEqual(parseJSON('识别结果如下：\n```json\n{"items":[]}\n```\n请核对。'),{items:[]});
for(const input of ['{"items":[','模型没有按要求输出。','sk-secret clinical text'])assert.throws(()=>parseJSON(input),/RPT-JSON/);
for(const input of ['null','[]','"text"'])assert.throws(()=>parseJSON(input),/RPT-SCHEMA/);
assert.throws(()=>parseJSON(''),/RPT-EMPTY/);assert.throws(()=>validateItems([null]),/无效指标/);
(async()=>{
 const imageBase64=Buffer.from([255,216]).toString('base64');
 for(const [output,code] of [['not JSON secret-private','RPT-JSON'],['null','RPT-SCHEMA'],['{"items":[null]}','RPT-SCHEMA']]){
 const handle=createHandler({getContext:()=>({OPENID:'synthetic'}),callModel:async()=>output});
 const result=await handle({action:'recognize',imageBase64,mime:'image/jpeg'});
 assert.equal(result.code,1);assert(result.message.includes(code));assert(!result.message.includes('secret-private'));
 }
 const handle=createHandler({getContext:()=>({OPENID:'synthetic'}),callModel:async()=>{throw Error('private internal failure')}});
 assert((await handle({action:'recognize',imageBase64,mime:'image/jpeg'})).message.includes('RPT-RECOGNIZE'));
 console.log('PASS report JSON/fenced JSON, malformed/truncated/empty/schema failures, safe stage errors; no fabricated medical data');
})().catch(e=>{console.error(e);process.exitCode=1});
