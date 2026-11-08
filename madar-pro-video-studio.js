(function(){
'use strict';
// MADAR PRO only: AI video generation through the server-side Magic Hour key.
const $=id=>document.getElementById(id),root=$('madarVideoRoot');if(!root)return;
const idea=$('madarVideoPrompt'),aspect=$('madarVideoAspect'),model=$('madarVideoModel'),duration=$('madarVideoDuration'),generate=$('madarVideoGenerate'),message=$('madarVideoStatus'),preview=$('madarVideoPreview'),save=$('madarVideoDownload');
let busy=false,activeProject=null,pollTimer=null;
function info(t,bad=false){message.textContent=t;message.style.color=bad?'#e7a4a1':''}
function setBusy(v){busy=v;generate.disabled=v;generate.textContent=v?'⏳ جاري العمل…':(activeProject?'↻ متابعة حالة الفيديو':'🎬 إنشاء فيديو بالذكاء الاصطناعي');}
function resetPreview(){preview.pause();preview.removeAttribute('src');preview.hidden=true;preview.load();save.hidden=true;save.removeAttribute('href');}
function updateDurations(){
 if(duration){
  const options=[['5','5 ثوانٍ'],['10','10 ثوانٍ'],['15','15 ثانية']];
  const previous=duration.value;
  duration.innerHTML=options.map(([v,label])=>'<option value="'+v+'">'+label+'</option>').join('');
  duration.value=options.some(([v])=>v===previous)?previous:'5';
 }
 if(aspect){
  const ratios=[['16:9','أفقي · YouTube'],['9:16','رأسي · Reels / TikTok'],['1:1','مربع · Instagram']];
  const old=aspect.value;
  aspect.innerHTML=ratios.map(([v,label])=>'<option value="'+v+'">'+label+'</option>').join('');
  aspect.value=ratios.some(([v])=>v===old)?old:'16:9';
 }
}
if(model){model.addEventListener('change',updateDurations);updateDurations();}
function displayVideo(url,credits){
 preview.src=url;preview.hidden=false;preview.controls=true;preview.load();
 save.href=url;save.target='_blank';save.rel='noopener noreferrer';save.textContent='↗ فتح / تحميل الفيديو';save.hidden=false;
 info('🎉 الفيديو جاهز!'+(credits!=null?' الكريدت المستخدمة: '+credits:''));
 setBusy(false);activeProject=null;try{sessionStorage.removeItem('madarProVideoProject');}catch{}
}
async function readJson(response){
 const data=await response.json().catch(()=>({}));
 if(!response.ok){const error=new Error(data.error||'تعذر الاتصال بخدمة الفيديو ('+response.status+').');error.status=response.status;throw error;}
 return data;
}
async function poll(id,knownCredits){
 activeProject=id;let tries=0;
 while(activeProject===id&&tries<60){
  tries++;
  try{
   const r=await fetch('/api/pro-video?id='+encodeURIComponent(id),{method:'GET',cache:'no-store',headers:{Accept:'application/json'}});
   const d=await readJson(r),s=String(d.status||'processing').toLowerCase();
   if(['complete','completed','succeeded','success'].includes(s)){
    if(d.downloads&&d.downloads.length){displayVideo(d.downloads[0],d.creditsCharged??knownCredits);return;}
    throw new Error('الفيديو اكتمل لكن رابط التنزيل لم يظهر بعد. احتفظ برقم المشروع: '+id);
   }
   if(['error','failed','canceled','cancelled'].includes(s)){activeProject=null;try{sessionStorage.removeItem('madarProVideoProject');}catch{}throw new Error(d.error||'فشل توليد الفيديو. لم نعد إرسال الطلب.');}
   info('🎬 مدار بيولّد الفيديو بالذكاء الاصطناعي… الحالة: '+s+' ('+tries+'/60).');
  }catch(e){
   if(e?.message?.includes('الفيديو اكتمل')){info(e.message,true);setBusy(false);return;}
   if(e?.status&&e.status<500){info(e.message,true);setBusy(false);return;}
   if(e?.message?.includes('فشل توليد الفيديو')||(!activeProject&&e?.message)){info(e.message,true);setBusy(false);return;}
   // A temporary status-read failure does not create another generation.
   if(tries%4===0)info('الفيديو قيد المعالجة. بنحاول نقرأ الحالة فقط؛ مش بننشئ فيديو جديد.');
  }
  if(tries<60)await new Promise(resolve=>{pollTimer=setTimeout(resolve,8000);});
 }
 if(activeProject===id){info('الفيديو لسه بيتعالج. رقم المشروع محفوظ؛ اضغط متابعة حالة الفيديو لاحقًا من غير ما ننشئ طلبًا جديدًا.',true);setBusy(false);}
}
async function start(){
 if(busy)return;
 if(activeProject){setBusy(true);info('بنستكمل متابعة الفيديو السابق من غير إنشاء طلب جديد…');await poll(activeProject,null);return;}
 const prompt=idea.value.trim();
 if(prompt.length<12){info('اكتب وصفًا أوضح للفيديو (12 حرفًا على الأقل).',true);idea.focus();return;}
 const chosenModel='kling-3.0';
 const modelName='Kling 3.0';
 if(!window.confirm('توليد فيديو PRO باستخدام '+modelName+' بدقة 1080p ومدة '+(duration?.value||8)+' ثانية. العملية قد تخصم كريدت من اشتراكك المدفوع. هل تريد المتابعة؟'))return;
 resetPreview();setBusy(true);info('بنرسل طلبًا واحدًا إلى Magic Hour… لا تغلق الصفحة.');
 try{
  const r=await fetch('/api/pro-video',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({prompt,aspectRatio:aspect.value||'16:9',duration:Number(duration?.value)||8,model:chosenModel})});
  const d=await readJson(r);
  if(!d.projectId)throw new Error('الخدمة لم ترجع رقم مشروع. راجع مكتبة Magic Hour قبل إعادة المحاولة.');
  activeProject=d.projectId;try{sessionStorage.setItem('madarProVideoProject',d.projectId);}catch{}
  info('تم قبول طلب '+'Kling 3.0'+' بدقة 1080p. '+(d.creditsCharged!=null?' تقدير الكريدت: '+d.creditsCharged+'.':'')+' جاري متابعة النتيجة…');
  await poll(d.projectId,d.creditsCharged);
 }catch(e){info(String(e?.message||e).slice(0,260),true);setBusy(false);}
}
generate.addEventListener('click',start);
const resume=()=>{let id='';try{id=sessionStorage.getItem('madarProVideoProject')||'';}catch{}if(id&&!busy){setBusy(true);info('بنسترجع حالة آخر فيديو…');poll(id,null);}};
resume();
async function verifyMagicHourAccount(){
 try{
  const r=await fetch('/api/pro-video?check=1',{method:'GET',cache:'no-store',headers:{Accept:'application/json'}});
  const d=await readJson(r);
  const tier=String(d.tier||'unknown').toUpperCase();
  if(d.tier==='free'){
   info('مفتاح Magic Hour متصل، لكن الحساب المرتبط به FREE ('+(d.credits??0)+' كريدت). لازم مفتاح من حساب Creator/PRO/Business المدفوع عشان Kling 3.0 يشتغل.',true);
  }else{
   info('حساب Magic Hour '+tier+' متصل بنجاح. الرصيد المتاح: '+(d.credits??'غير متاح')+' كريدت.');
  }
 }catch(e){info('تعذر التحقق من خطة Magic Hour: '+String(e?.message||e).slice(0,180),true);}
}
verifyMagicHourAccount();
})();
