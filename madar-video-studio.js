(function(){
'use strict';
// MADAR AI Video Studio. Two distinct presets: Free (standard 720p), PRO (premium up to 4K).
// Puter.js User-Pays: never call a real model until explicit credit consent on this screen.
const root=document.getElementById('madarVideoRoot');
if(!root)return;
const $=id=>document.getElementById(id);
const isPro=root.dataset.videoTier==='pro';
const prompt=$('madarVideoPrompt'),quality=$('madarVideoQuality'),duration=$('madarVideoSeconds');
const generate=$('madarVideoGenerate'),sample=$('madarVideoSample'),credit=$('madarVideoCredit');
const status=$('madarVideoStatus'),preview=$('madarVideoPreview'),save=$('madarVideoDownload');
const close=$('madarVideoClose'),open=$('madarVideoOpen'),dialog=$('madarVideoDialog');
let busy=false,sdkPromise=null;
function say(msg,error){status.textContent=msg;status.style.color=error?'#e89e91':'';}
function cleanPreview(){preview.pause();preview.removeAttribute('src');preview.hidden=true;preview.load();save.hidden=true;save.removeAttribute('href');}
function safeSrc(value){return typeof value==='string'&&(/^(https:\/\/|data:video\/mp4;base64,|blob:)/.test(value));}
function ensurePuter(){
 if(window.puter?.ai?.txt2vid)return Promise.resolve(window.puter);
 if(sdkPromise)return sdkPromise;
 sdkPromise=new Promise((resolve,reject)=>{
   let script=document.querySelector('script[data-madar-puter-sdk],script[src="https://js.puter.com/v2/"]');
   if(!script){script=document.createElement('script');script.src='https://js.puter.com/v2/';script.async=true;script.dataset.madarPuterSdk='true';document.head.appendChild(script);}
   const timer=setTimeout(()=>{cleanup();sdkPromise=null;reject(new Error('تعذّر تحميل خدمة الفيديو. اتأكد من الإنترنت وجرّب تاني.'));},25000);
   function cleanup(){clearTimeout(timer);script.removeEventListener('load',onLoad);script.removeEventListener('error',onError);}
   function onLoad(){cleanup();if(window.puter?.ai?.txt2vid)resolve(window.puter);else{sdkPromise=null;reject(new Error('توليد الفيديو مش متاح حاليًا.'));}}
   function onError(){cleanup();sdkPromise=null;reject(new Error('تعذّر الاتصال بخدمة الفيديو.'));}
   script.addEventListener('load',onLoad);script.addEventListener('error',onError);
   if(window.puter?.ai?.txt2vid)onLoad();
 });
 return sdkPromise;
}
if(open&&dialog){open.addEventListener('click',()=>{if(!dialog.open)dialog.showModal();});}
if(close&&dialog){close.addEventListener('click',()=>dialog.close());}
if(dialog){dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});}
async function run(testMode){
 if(busy)return;
 const idea=prompt.value.trim();
 if(idea.length<8){say('اكتب وصف الفيديو بتفاصيل أكتر (8 حروف على الأقل).',true);prompt.focus();return;}
 if(!testMode&&!credit.checked){say('علشان نولّد فيديو حقيقي، وافق الأول على استخدام رصيد حساب Puter. تقدر تجرب العينة بدون خصم.',true);return;}
 busy=true;generate.disabled=true;sample.disabled=true;
 cleanPreview();say(testMode?'بنجهّز فيديو عينة للتجربة من غير خصم...':'بنجهّز الفيديو الحقيقي... العملية ممكن تاخد دقايق. خليك فاتح الصفحة.');
 try{
   const puter=await ensurePuter();
   if(!testMode&&puter.auth?.isSignedIn&&!await puter.auth.isSignedIn()){
     if(!puter.auth.signIn)throw new Error('لازم تسجل دخول Puter الأول عشان تستخدم رصيدك.');
     await puter.auth.signIn();
   }
   const seconds=isPro?Number(duration.value||5):5;
   // Never switch Free to the premium engine. Never spend automatically on a retry.
   const opts=isPro?
    {model:'kling-3.0',seconds,size:quality.value==='4k'?'4k':'1080p',width:quality.value==='4k'?3840:1920,height:quality.value==='4k'?2160:1080,generate_audio:!!$('madarVideoAudio')?.checked,test_mode:testMode}:
    {model:'togetherai:wan-ai/wan2.7-t2v',seconds:5,size:'1280x720',test_mode:testMode};
   const result=await puter.ai.txt2vid(idea,opts);
   const src=typeof result?.src==='string'?result.src:result?.getAttribute?.('data-source');
   if(!safeSrc(src))throw new Error('خدمة الفيديو رجّعت نتيجة غير صالحة.');
   preview.src=src;preview.hidden=false;preview.controls=true;preview.load();
   save.href=src;save.hidden=false;
   if(src.startsWith('data:')||src.startsWith('blob:')){
     save.download='madar-'+(isPro?'pro-':'')+'video.mp4';save.target='_self';
   }else{save.removeAttribute('download');save.target='_blank';save.rel='noopener noreferrer';}
   say(testMode?'دي عينة توضيحية للتجربة، مش فيديو متولّد من وصفك.':'الفيديو جاهز. افتحه أو احفظه قبل ما الرابط المؤقت ينتهي.');
 }catch(e){
   const raw=String(e?.message||'');
   if(/insufficient_funds|payment|credits|balance/i.test(raw))say('رصيد حساب Puter مش كفاية لتوليد الفيديو بالجودة دي.',true);
   else if(/cancell?ed|denied|popup/i.test(raw))say('تم إلغاء تسجيل الدخول أو العملية.',true);
   else say('تعذر توليد الفيديو: '+raw.slice(0,260),true);
 }finally{busy=false;generate.disabled=false;sample.disabled=false;}
}
generate.addEventListener('click',()=>run(false));
sample.addEventListener('click',()=>run(true));
})();