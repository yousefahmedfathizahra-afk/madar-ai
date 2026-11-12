(function(){
'use strict';
// MADAR AI Video Studio — Magic Hour server-side generation.
const root=document.getElementById('madarVideoRoot');
if(!root)return;
const $=id=>document.getElementById(id);
const prompt=$('madarVideoPrompt'),quality=$('madarVideoQuality'),duration=$('madarVideoSeconds');
const generate=$('madarVideoGenerate'),sample=$('madarVideoSample'),credit=$('madarVideoCredit');
const status=$('madarVideoStatus'),preview=$('madarVideoPreview'),save=$('madarVideoDownload');
const close=$('madarVideoClose'),open=$('madarVideoOpen'),dialog=$('madarVideoDialog');
let chatPending=null;
let busy=false,pollController=null;
function say(message,error){status.textContent=message;status.style.color=error?'#e89e91':'';}
function cleanPreview(){preview.pause();preview.removeAttribute('src');preview.hidden=true;preview.load();save.hidden=true;save.removeAttribute('href');}
function findProjectId(value){
 if(!value||typeof value!=='object')return '';
 for(const k of ['project_id','projectId','id'])if(typeof value[k]==='string'&&/^[A-Za-z0-9_-]{6,160}$/.test(value[k]))return value[k];
 for(const v of Object.values(value))if(v&&typeof v==='object'){const id=findProjectId(v);if(id)return id;}
 return '';
}
function collectUrls(value,out=[],seen=new Set()){
 if(!value||typeof value!=='object'||seen.has(value))return out;
 seen.add(value);
 for(const [key,v] of Object.entries(value)){
  if(typeof v==='string'&&/^https:\/\//i.test(v)&&/(url|video|download|output|mp4|asset)/i.test(key))out.push(v);
  else if(v&&typeof v==='object')collectUrls(v,out,seen);
 }
 return [...new Set(out)];
}
function videoUrl(data){
 const urls=collectUrls(data);
 return urls.find(u=>/\.mp4(?:[?#]|$)/i.test(u))||urls.find(u=>/video|download|output/i.test(u))||'';
}
async function request(path,options={}){
 const response=await fetch(path,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})},cache:'no-store'});
 const data=await response.json().catch(()=>null);
 if(!response.ok)throw new Error(data?.error||'خدمة الفيديو مش متاحة حاليًا.');
 return data||{};
}
async function run(){
 if(busy)return;
 const idea=prompt.value.trim();
 if(idea.length<8){say('اكتب وصف الفيديو بتفاصيل أكتر (8 حروف على الأقل).',true);prompt.focus();return;}
 if(!credit.checked){say('وافق على استخدام الحصة المجانية المتاحة قبل إنشاء الفيديو.',true);return;}
 busy=true;generate.disabled=true;sample.disabled=true;cleanPreview();
 say('مدار بيبدأ إنشاء الفيديو…');
 try{
  // One creation request only. Polling reads the same project and never creates another charge.
  const created=await request('/api/video',{method:'POST',body:JSON.stringify({
   prompt:idea,aspect_ratio:quality?.value||'16:9',seconds:Number(duration?.value)||5,audio:true
  })});
  const id=findProjectId(created);
  if(!id){
   const direct=videoUrl(created);
   if(direct){showVideo(direct);return;}
   throw new Error('الطلب اتسجل لكن معرّف الفيديو مش واضح. متعيدش الإنشاء فورًا عشان ما تستهلكش الحصة مرتين.');
  }
  say('الفيديو بيتجهّز… بنراجع نفس الطلب من غير تكرار التوليد.');
  const started=Date.now(),maxWait=8*60*1000;
  while(Date.now()-started<maxWait){
   await new Promise(resolve=>setTimeout(resolve,8000));
   const detail=await request('/api/video?id='+encodeURIComponent(id),{method:'GET'});
   const url=videoUrl(detail);
   const state=String(detail.status||detail.project?.status||detail.data?.status||'').toLowerCase();
   if(url&&(state==='complete'||state==='completed'||state==='success'||!state)){showVideo(url);return;}
   if(['failed','error','cancelled','canceled'].includes(state))throw new Error('مدار ما قدرش يكمّل إنشاء الفيديو. جرّب بعد شوية.');
   say('لسه بنرندر الفيديو… ('+Math.floor((Date.now()-started)/1000)+' ثانية)');
  }
  say('الفيديو لسه بيتجهّز؛ متعيدش التوليد فورًا عشان ما تستهلكش الحصة مرتين.',true);
 }catch(error){
  const message=String(error?.message||'خطأ غير معروف').replace(/(?:Magic Hour|LTX|Puter|Gemini|CapCut|Canva)/gi,'خدمة مدار').slice(0,300);
  say('تعذر إنشاء الفيديو: '+message,true);
  if(chatPending){const item=chatPending;chatPending=null;item.reject(Error(message));if(dialog?.open)dialog.close();}
 }
 finally{busy=false;generate.disabled=false;sample.disabled=false;}
}
// Video intent in chat opens MADAR's own confirmation dialog. Never links outside.
function generateFromChat(description,options={}){
 const text=String(description||'').trim().slice(0,1800);
 if(text.length<8)return Promise.reject(Error('اكتب وصف فيديو من 8 حروف على الأقل.'));
 if(busy||chatPending)return Promise.reject(Error('فيه طلب فيديو شغال حاليًا.'));
 prompt.value=text;credit.checked=false;
 if(!dialog.open)dialog.showModal();
 say('راجع الوصف ووافق على الحصة المجانية واضغط «ولّد الفيديو». النتيجة هتظهر في الشات.');
 return new Promise((resolve,reject)=>{
  const signal=options.signal;
  const stop=()=>{if(chatPending){chatPending=null;reject(Error('انتهى انتظار الفيديو. لو بدأ التوليد ممكن يفضل شغال؛ متعيدش الطلب فورًا.'));}};
  chatPending={resolve:v=>{signal?.removeEventListener('abort',stop);resolve(v);},reject:e=>{signal?.removeEventListener('abort',stop);reject(e);}};
  signal?.addEventListener('abort',stop,{once:true});
 });
}
function showVideo(src){
 preview.src=src;preview.hidden=false;preview.controls=true;preview.load();
 save.href=src;save.hidden=false;save.target='_blank';save.rel='noopener noreferrer';
 say('الفيديو جاهز! شغّله واحفظه من زر العرض / الحفظ.');
 if(chatPending){const item=chatPending;chatPending=null;item.resolve({url:src});if(dialog?.open)dialog.close();}
}
if(open&&dialog)open.addEventListener('click',()=>{if(!dialog.open)dialog.showModal();});
if(close&&dialog)close.addEventListener('click',()=>{if(busy){say('الفيديو بيتجهّز؛ تابع نفس الطلب.',true);return;}dialog.close();});
if(dialog)dialog.addEventListener('click',e=>{if(e.target===dialog&&!busy)dialog.close();});
if(dialog)dialog.addEventListener('close',()=>{if(chatPending&&!busy){const item=chatPending;chatPending=null;item.reject(Error('ألغيت الطلب قبل إنشائه.'));}});
if(dialog)dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
sample.addEventListener('click',()=>{
 prompt.value='لقطة سينمائية لطائرة ورقية تحلق فوق شاطئ البحر وقت الغروب، أمواج هادئة، حركة كاميرا بطيئة وانعكاس ذهبي على الماء، تفاصيل واقعية، بدون كتابة على الشاشة.';
 prompt.focus();say('حطينا لك وصفًا جاهزًا. اضغط توليد فيديو حقيقي لما تكون مستعدًا.');
});
generate.addEventListener('click',run);
window.MADAR_VIDEO_STUDIO={generateFromChat};
})();