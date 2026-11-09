// Local text history only; no images, audio, credentials or remote synchronization.
const KEY='xiaonuan_text_history_v1';
const FIELDS=['id','role','content','understanding','analysis','suggestions','timestamp','riskLevel','riskNotice','needHandoff','dissatisfied','type'];
function clean(messages){
 if(!Array.isArray(messages))return [];
 return messages.filter(m=>m&&['user','assistant'].includes(m.role)&&!m.imageUrl&&!m.audioUrl&&!m.voiceUrl&&!['image','image_analysis','report_analysis','voice','audio'].includes(m.type)).slice(-100).map(m=>{
 const row={animate:false};for(const field of FIELDS){const v=m[field];if(typeof v==='string')row[field]=v.slice(0,20000);else if(typeof v==='number'&&Number.isFinite(v)||typeof v==='boolean')row[field]=v;else if(field==='suggestions'&&Array.isArray(v))row[field]=v.filter(x=>typeof x==='string').slice(0,30).map(x=>x.slice(0,2000));}return row;
 });
}
function read(){try{return clean(wx.getStorageSync(KEY));}catch(e){return [];}}
function save(messages){try{wx.setStorageSync(KEY,clean(messages));return true;}catch(e){return false;}}
function clear(){wx.removeStorageSync(KEY);}
module.exports={read,save,clear,clean};
