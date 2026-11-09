const assert=require('node:assert/strict');let stored;global.wx={getStorageSync:()=>stored,setStorageSync:(k,v)=>stored=JSON.parse(JSON.stringify(v)),removeStorageSync:()=>stored=undefined};
const memory=require('../utils/chatMemory');
assert.deepEqual(memory.read(),[]);memory.save([{id:1,role:'user',content:'基础体温怎么记录？'},{id:2,role:'assistant',analysis:'原始回答',suggestions:['建议'],animate:true},{id:3,role:'user',type:'image',imageUrl:'temporary',content:'报告'}]);
assert.equal(memory.read().length,2);assert.equal(memory.read()[1].animate,false);assert.equal(memory.read()[1].analysis,'原始回答');assert.equal(memory.read()[0].content,'基础体温怎么记录？');
memory.save(Array.from({length:120},(_,id)=>({id,role:'user',content:'test'})));assert.equal(memory.read().length,100);assert.equal(memory.read()[0].id,20);
stored={invalid:true};assert.deepEqual(memory.read(),[]);memory.clear();assert.deepEqual(memory.read(),[]);
wx.setStorageSync=()=>{throw Error('full')};assert.equal(memory.save([]),false);
console.log('PASS local history roundtrip, full answer, no typing replay, image exclusion, bounded storage, corrupt data, clear and storage failure');
