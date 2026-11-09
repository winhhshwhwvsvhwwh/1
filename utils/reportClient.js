const { REPORT_VISION }=require('./constants');
const MAX_BYTES=512*1024;
function nativeCall(method,args){return new Promise((resolve,reject)=>wx[method]({...args,success:resolve,fail:reject}));}
function ready(){
  if(!REPORT_VISION||!REPORT_VISION.enabled||!REPORT_VISION.envId)throw Error('报告识别服务尚未启用。需先开通视觉模型，并配置、部署报告云函数；当前不会上传图片。');
  if(!wx.cloud||!wx.cloud.callFunction)throw Error('当前环境不支持报告云服务，请升级微信并检查云开发配置');
  wx.cloud.init({env:REPORT_VISION.envId,traceUser:false});
}
async function imagePayload(filePath){
  let path=filePath;let info=await nativeCall('getFileInfo',{filePath:path});
  if(info.size>MAX_BYTES){
    const dimensions=await nativeCall('getImageInfo',{src:path});
    for(const quality of [80,60]){
      const compressed=await nativeCall('compressImage',{src:filePath,quality,compressedWidth:Math.min(dimensions.width,1600)});path=compressed.tempFilePath;
      info=await nativeCall('getFileInfo',{filePath:path});if(info.size<=MAX_BYTES)break;
    }
  }
  if(info.size>MAX_BYTES)throw Error('报告图片较大，请裁剪到需要解读的指标区域，保持文字清晰后重试');
  const data=await new Promise((resolve,reject)=>wx.getFileSystemManager().readFile({filePath:path,encoding:'base64',success:resolve,fail:reject}));
  const mime=data.data.startsWith('/9j/')?'image/jpeg':data.data.startsWith('iVBORw0KGgo')?'image/png':'';
  if(!mime)throw Error('请使用JPG或PNG格式的清晰报告图片');
  return {imageBase64:data.data,mime};
}
async function invoke(data){
  let response;try{response=await wx.cloud.callFunction({name:REPORT_VISION.functionName||'reportInterpretation',data,config:{env:REPORT_VISION.envId}});}catch(e){throw Error('报告服务连接失败，请检查云开发配置或稍后重试');}
  const result=response.result;if(!result||result.code!==0)throw Error(result&&result.message||'报告处理失败，请稍后重试');return result.data;
}
async function recognizeReport(filePath,question){ready();const image=await imagePayload(filePath);return invoke({action:'recognize',...image,question});}
async function interpretReport(items,question){ready();return invoke({action:'interpret',items,question,confirmed:true});}
module.exports={recognizeReport,interpretReport};
