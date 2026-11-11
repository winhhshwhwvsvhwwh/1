const {MEMORY_CLOUD}=require('./constants');const facts=require('./profileFacts');
const KEY='xiaonuan_cloud_memory_consent_v1';
function modal(options){return new Promise(resolve=>wx.showModal({...options,success:resolve,fail:()=>resolve({confirm:false})}));}
function available(){return !!(MEMORY_CLOUD&&MEMORY_CLOUD.enabled&&MEMORY_CLOUD.envId&&wx.cloud&&wx.cloud.callFunction);}
function active(){try{return available()&&wx.getStorageSync(KEY)===true;}catch(e){return false;}}
async function consent(force=false){
 if(!available())return false;
 let saved;try{saved=wx.getStorageSync(KEY);}catch(e){}
 if(!force&&typeof saved==='boolean')return saved;
 const res=await modal({title:'启用云端个人记忆',content:'将保存你确认的档案和今后的文字对话，并将近期对话与档案发给模型帮助回答。可在个人档案里清除或关闭；此前本机聊天不会自动上传。是否启用？',confirmText:'启用',cancelText:'仅本机'});
 try{wx.setStorageSync(KEY,!!res.confirm);}catch(e){return false;}return !!res.confirm;
}
async function invoke(action,extra={}){
 if(!available())throw Error('云端记忆尚未配置');
 wx.cloud.init({env:MEMORY_CLOUD.envId,traceUser:false});let res;
 try{res=await wx.cloud.callFunction({name:MEMORY_CLOUD.functionName,data:{action,...extra},config:{env:MEMORY_CLOUD.envId}});}catch(e){throw Error('云端记忆连接失败，请检查 companionMemory 是否部署及数据库配置');}
 if(!res.result||res.result.code!==0)throw Error(res.result&&res.result.message||'云端记忆处理失败');return res.result.data;
}
async function confirmFacts(content){
 const proposed=facts.extract(content);if(!Object.keys(proposed).length)return;
 const current=(await invoke('status')).profile||{};const patch={};Object.keys(proposed).forEach(k=>{if(current[k]!==proposed[k])patch[k]=proposed[k];});
 if(!Object.keys(patch).length)return;
 const choice=await modal({title:'确认保存到个人档案',content:facts.describe(patch)+'\n仅保存你确认的信息；取消仅不写入档案；本轮文字仍按已启用的聊天记忆保存。',confirmText:'保存档案'});
 if(choice.confirm)await invoke('saveProfile',{profile:patch,confirmed:true});
}
async function chat(content,localReply){
 if(!await consent())return localReply;
 try{await confirmFacts(content);const data=await invoke('chat',{content,localAdvice:localReply.data.content});return {code:0,data};}
 catch(e){wx.showToast({title:'云端记忆未完成，本次使用本地回答',icon:'none'});const data={...localReply.data};data.understanding='本次云端记忆或模型服务未完成，未确认保存本轮对话。原因：'+e.message+'。以下为本地规则回答。\n'+data.understanding;data.content=[data.understanding,data.analysis,...data.suggestions,data.riskNotice].join('\n\n');data.meta={...data.meta,memoryFallback:true};return {code:0,data};}
}
async function saveCycleRecord(record){
 if(!active())return false;
 const cycleRecord={startDate:record.startDate,endDate:record.endDate,cycleLength:Number(record.cycleLength),periodLength:Number(record.periodLength),symptoms:record.symptoms||[]};
 const choice=await modal({title:'保存周期记录到云端档案',content:facts.describe({cycleRecord}),confirmText:'确认同步'});
 if(!choice.confirm)return false;
 await invoke('saveProfile',{profile:{cycleRecord,cycleLength:cycleRecord.cycleLength,periodLength:cycleRecord.periodLength},confirmed:true});return true;
}
async function resetHistory(){if(active())await invoke('clearHistory',{confirmed:true});}
async function manage(){
 if(!available()){wx.showModal({title:'个人档案尚未连接',content:'请部署 companionMemory 云函数并配置云环境。',showCancel:false});return null;}
 if(!await consent(!active()))return null;
 const selection=await new Promise(resolve=>wx.showActionSheet({itemList:['查看个人档案','修改个人档案','恢复云端聊天记录','清除个人档案','清除全部云端记忆','关闭云端记忆'],success:resolve,fail:()=>resolve({tapIndex:-1})}));
 const index=selection.tapIndex;
 if(index===5){wx.setStorageSync(KEY,false);wx.showToast({title:'已关闭；已有云端数据未删除',icon:'none'});return null;}
 if(index===0){const {profile}=await invoke('status');await modal({title:'我的个人档案',content:facts.describe(profile||{}),showCancel:false});}
 if(index===1){const edit=await modal({title:'修改个人档案',editable:true,placeholderText:'例如：我32岁，备孕半年，周期28天，经期5天',content:'填写要更新的信息，下一步会再次确认。'});if(edit.confirm){const profile=facts.extract(edit.content||'');if(!Object.keys(profile).length)throw Error('未识别到支持的档案信息，请按示例填写');await confirmFacts(edit.content);}}
 if(index===2)return (await invoke('status')).history||[];
 if(index===3||index===4){const choice=await modal({title:'确认清除',content:index===3?'清除档案和全部云端聊天，避免旧对话仍包含已删除的个人信息。本机聊天及周期记录不受影响。':'清除档案和全部云端聊天。本机聊天及周期记录不受影响。'});if(choice.confirm){await invoke('clearAll',{confirmed:true});wx.showToast({title:'云端记忆已清除',icon:'none'});}}
 return null;
}
module.exports={chat,manage,resetHistory,saveCycleRecord,active};
