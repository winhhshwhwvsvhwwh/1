// OPENID is always obtained from WeChat, never from a caller-provided owner field.
const cloud=require('wx-server-sdk'),crypto=require('crypto');
const {createHandler}=require('./core'),{callModel}=require('./modelClient');
cloud.init({env:cloud.DYNAMIC_CURRENT_ENV});const db=cloud.database();
const collection='xiaonuan_memory';
function docId(owner){return crypto.createHash('sha256').update(owner).digest('hex');}
async function get(document){try{const res=await document.get();return res.data||{};}catch(e){if(e.code==='DATABASE_DOCUMENT_NOT_EXIST'||/document.*(not exist|not found)|document_not_exist/i.test(e.message||e.errMsg||''))return {};throw e;}}
const store={read:owner=>get(db.collection(collection).doc(docId(owner))),update:(owner,apply)=>db.runTransaction(async transaction=>{const document=transaction.collection(collection).doc(docId(owner));const current=await get(document);const next=apply(current);const {_id,...data}=next;await document.set({data});return data;})};
exports.main=createHandler({getContext:()=>cloud.getWXContext(),store,callModel});
