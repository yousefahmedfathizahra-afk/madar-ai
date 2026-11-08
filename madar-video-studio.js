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
 if(!credit.checked){say('وافق الأول على استخدام رصيد Magic Hour. مش هيتم الخصم قبل ضغط زر التوليد.',true);return;}
 busy=true;generate.disabled=true;sample.disabled=true;cleanPreview();
 say('بنرسل طلب الفيديو إلى Magic Hour…');
 try{
  // One creation request only. Polling reads the same project and never creates another charge.
  const created=await request('/api/video',{method:'POST',body:JSON.stringify({
   prompt:idea,aspect_ratio:quality?.value||'16:9',seconds:Number(duration?.value)||5,audio:true
  })});
  const id=findProjectId(created);
  if(!id){
   const direct=videoUrl(created);
   if(direct){showVideo(direct);return;}
   throw new Error('الخدمة استلمت الطلب لكن لم ترجع معرّف مشروع واضح. لا تعيد التوليد قبل مراجعة حساب Magic Hour.');
  }
  say('الفيديو بيتجهّز… بنراجع نفس المشروع من غير ما نكرر طلب مدفوع.');
  const started=Date.now(),maxWait=8*60*1000;
  while(Date.now()-started<maxWait){
   await new Promise(resolve=>setTimeout(resolve,8000));
   const detail=await request('/api/video?id='+encodeURIComponent(id),{method:'GET'});
   const url=videoUrl(detail);
   const state=String(detail.status||detail.project?.status||detail.data?.status||'').toLowerCase();
   if(url&&(state==='complete'||state==='completed'||state==='success'||!state)){showVideo(url);return;}
   if(['failed','error','cancelled','canceled'].includes(state))throw new Error('خدمة الفيديو لم تكمل التوليد. راجع تفاصيل المشروع في Magic Hour.');
   say('لسه بنرندر الفيديو… ('+Math.floor((Date.now()-started)/1000)+' ثانية)');
  }
  say('الفيديو لسه بيتجهّز. طلبك محفوظ؛ اقفل النافذة وراجع مشاريع Magic Hour قبل ما تطلب فيديو جديد.',true);
 }catch(error){say('تعذر إنشاء الفيديو: '+String(error?.message||'خطأ غير معروف').slice(0,300),true);}
 finally{busy=false;generate.disabled=false;sample.disabled=false;}
}
function showVideo(src){
 preview.src=src;preview.hidden=false;preview.controls=true;preview.load();
 save.href=src;save.hidden=false;save.target='_blank';save.rel='noopener noreferrer';
 say('الفيديو جاهز! شغّله واحفظه من زر العرض / الحفظ.');
}
if(open&&dialog)open.addEventListener('click',()=>{if(!dialog.open)dialog.showModal();});
if(close&&dialog)close.addEventListener('click',()=>dialog.close());
if(dialog)dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
sample.addEventListener('click',()=>{
 prompt.value='لقطة سينمائية لطائرة ورقية تحلق فوق شاطئ البحر وقت الغروب، أمواج هادئة، حركة كاميرا بطيئة وانعكاس ذهبي على الماء، تفاصيل واقعية، بدون كتابة على الشاشة.';
 prompt.focus();say('حطينا لك وصفًا جاهزًا. اضغط توليد فيديو حقيقي لما تكون مستعدًا.');
});
generate.addEventListener('click',run);
})();