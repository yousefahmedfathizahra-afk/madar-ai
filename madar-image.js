/* MADAR Image Studio — on-demand browser AI image generation via Puter.js.
 * Uses each user's Puter allowance (not the MADAR owner's Gemini key).
 * Nothing is generated without the visitor clicking Generate.
 */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const dialog=$('madarImageDialog');
if(!dialog)return;
const button=$('imageMakerBtn');
const prompt=$('madarImagePrompt');
const form=$('madarImageForm');
const generateButton=$('madarGenerateImage');
const state=$('madarImageState');
const image=$('madarImagePreview');
const results=$('madarImageResult');
const download=$('madarImageDownload');
const model=$('madarImageModel');
const connectButton=$('madarConnectPuter');
const accountState=$('madarPuterConnection');
let pending=false,connecting=false,bootPromise=null,everGenerated=false;
let chatImageRequest=null;
// Official @heyputer/puter.js SDK and version-pinned npm CDN backups.
const SDK_SOURCES=[
 'https://js.puter.com/v2/',
 'https://cdn.jsdelivr.net/npm/@heyputer/puter.js@2.6.4/dist/puter.cjs',
 'https://unpkg.com/@heyputer/puter.js@2.6.4/dist/puter.cjs'
];
const MODELS={
 fast:{model:'@cf/black-forest-labs/flux-1-schnell',provider:'cloudflare',steps:4},
 detailed:{model:'gemini-3.1-flash-image',provider:'gemini',quality:'1K'},
 editFallback:{model:'@cf/black-forest-labs/flux-2-dev',provider:'cloudflare',steps:25}
};
// Ground place requests BEFORE passing them to the AI image provider.
// A mosque/church/landmark named after a person must not turn into a portrait.
function normalizeLandmark(value){
 return String(value||'').normalize('NFKC').toLowerCase()
  .replace(/[\u064b-\u065f\u0670]/g,'').replace(/ـ/g,'')
  .replace(/[إأآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه')
  .replace(/\s+/g,' ').trim();
}
function prepareImagePrompt(description){
 const original=String(description||'').trim().slice(0,900);
 return [
  'Generate the image described by the user in their original language. Treat the request as the source of truth.',
  'Preserve the exact main subject, counts, specified colors, attributes, locations, materials, poses, style, visual perspective, text and spatial relationships.',
  'Words like مش, بدون, من غير, لا, not, without and no express exclusions, not subjects to include.',
  'Do not substitute another type of building, person, object, animal, landmark or symbol just because a word resembles it.',
  'No unrelated additions, watermarks or captions. Fill only details the user did not specify.',
  'USER REQUEST: '+original
 ].join('\n');
}
async function planImageRequest(description,editing=false){
 const original=String(description||'').trim().slice(0,900);
 const fallback={action:'generate',prompt:prepareImagePrompt(original)};
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),7500);
 try{
  const response=await fetch('/api/image-intent',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({prompt:original,editing:!!editing}),signal:controller.signal
  });
  if(!response.ok)return fallback;
  const plan=await response.json();
  if(plan?.action==='clarify'&&!editing&&typeof plan.question==='string'&&plan.question.trim().length>=7){
   return{action:'clarify',question:plan.question.trim().slice(0,240)};
  }
  if(plan?.action==='generate'&&typeof plan.prompt==='string'&&plan.prompt.trim().length>=30){
   return{action:'generate',prompt:plan.prompt.slice(0,3800)};
  }
 }catch(e){console.warn('MADAR optional image planner not available:',e?.name||'temporary');}
 finally{clearTimeout(timer);}
 return fallback;
}
async function imageBackup(originalPrompt,options={}){
 // Disabled by default on the backend. The server NEVER receives an API key from the browser.
 const payload={prompt:String(originalPrompt||'').slice(0,3800)};
 const input=options?.inputImage;
 if(input){
  if(typeof input==='string'&&/^data:image\/(?:png|jpeg|webp);base64,/i.test(input)){
   payload.inputImage=input;
  }else if(typeof input==='string'&&input.startsWith('blob:')){
   const response=await fetch(input);
   if(!response.ok)throw Error('تعذر قراءة الصورة الأصلية للاحتياطي.');
   const data=await response.blob();
   if(data.size>1900000)throw Error('الصورة الأصلية كبيرة جدًا للمحرّك الاحتياطي.');
   payload.inputImage=await new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result);
    reader.onerror=()=>reject(Error('تعذر تجهيز الصورة.'));
    reader.readAsDataURL(data);
   });
  }else if(input instanceof Blob&&input.size<=1900000){
   payload.inputImage=await new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result);
    reader.onerror=()=>reject(Error('تعذر تجهيز الصورة.'));
    reader.readAsDataURL(input);
   });
  }else if(typeof input==='string'&&/^https:\/\//i.test(input)){
   payload.inputImageUrl=input;
  }else throw Error('تعديل الصورة الاحتياطي يحتاج صورة أصلية بصيغة PNG أو JPEG أو WebP قابلة للقراءة.');
 }
 const response=await fetch('/api/image-backup',{
  method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify(payload)
 });
 const data=await response.json().catch(()=>null);
 if(!response.ok)throw Error(data?.error||'المحرك الاحتياطي غير متاح.');
 const src=String(data?.src||'');
 if(!/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/i.test(src))throw Error('الاحتياطي لم يرجع صورة صالحة.');
 return src;
}

function note(message,bad=false){
 state.textContent=message||'';
 state.style.color=bad?'#f4a8b7':'var(--text)';
}
function signedIn(){
 try{return !!(window.puter?.auth?.isSignedIn?.());}catch{return false;}
}
function updateConnection(){
 const ready=!!(window.puter?.ai?.txt2img&&window.puter?.auth?.signIn);
 const connected=ready&&signedIn();
 connectButton.disabled=connecting||!ready;
 connectButton.hidden=connected;
 connectButton.textContent=connecting?'⏳ جاري الربط...':!ready?'⏳ جاري التحميل...':'🔐 ربط خدمة الصور';
 accountState.textContent=connected?'✅ خدمة الصور جاهزة.':'اربط حساب خدمة صور خارجية في نافذة تسجيل الدخول بموافقتك عند أول استخدام.';
 generateButton.disabled=pending||!connected;
}
function busy(value){
 pending=value;
 generateButton.disabled=value;
 generateButton.textContent=value?'⏳ Generating...':'✦ Generate image';
 model.disabled=value;
 prompt.readOnly=value;
 if(!value)updateConnection();
}
function loadSource(url,timeoutMs){
 return new Promise((resolve,reject)=>{
   // Classic cross-site scripts load without the "crossorigin" attribute.
   const script=document.createElement('script');
   let settled=false;
   const finish=(error)=>{
     if(settled)return;
     settled=true;clearTimeout(timer);
     script.onload=null;script.onerror=null;
     if(error){script.remove();reject(error);}else resolve(window.puter);
   };
   const timer=setTimeout(()=>finish(Error('Source timed out')),timeoutMs);
   script.src=url;
   script.async=true;
   script.onload=()=>{
     Promise.resolve().then(()=>{
       if(window.puter?.ai?.txt2img)finish();
       else setTimeout(()=>window.puter?.ai?.txt2img
         ? finish() : finish(Error('SDK loaded without image API')),250);
     });
   };
   script.onerror=()=>finish(Error('Script was blocked or unreachable'));
   document.head.append(script);
 });
}
function loadSdk(){
 if(window.puter?.ai?.txt2img)return Promise.resolve(window.puter);
 if(bootPromise)return bootPromise;
 bootPromise=(async()=>{
   for(let index=0;index<SDK_SOURCES.length;index++){
     if(window.puter?.ai?.txt2img)return window.puter;
     const url=SDK_SOURCES[index];
     const name=index===0?'Puter official':index===1?'jsDelivr backup':'unpkg backup';
     note('Loading image tools from '+name+'...'+(index?' (backup '+index+')':''));
     try{return await loadSource(url,9000);}
     catch(error){
       console.warn('MADAR Puter SDK source unavailable:',name,String(error?.message||'failed').slice(0,75));
     }
   }
   throw Error('Could not reach Puter or its backup libraries. Try Chrome or Edge, disable content blockers for MADAR, or switch between Wi-Fi and mobile data.');
 })().catch(error=>{bootPromise=null;throw error;});
 return bootPromise;
}
function open(){
 if(!dialog.open){
   dialog.showModal();
   if(!everGenerated)results.hidden=true;
   const current=$('prompt')?.value?.trim()||'';
   if(current&&!prompt.value.trim())prompt.value=current.slice(0,900);
   prompt.focus();
 }
 // Warm the SDK while the visitor chooses a prompt; do not sign in or generate.
 updateConnection();
 loadSdk().then(()=>{updateConnection();if(!signedIn())note('اربط حساب خدمة الصور عند أول استخدام.');})
  .catch(error=>{updateConnection();note('تعذّر تجهيز الصور. جرّب تحديث الصفحة.',true);});
}
function cancelChatImage(){
 if(chatImageRequest&&!chatImageRequest.started){
  const task=chatImageRequest;chatImageRequest=null;
  task.reject(Error('تم إلغاء تسجيل الدخول لإنشاء الصورة. تقدر تبعت الطلب تاني من الشات.'));
 }
}
function close(){
 if(pending){note('Your image is still generating. Please wait a moment.');return;}
 cancelChatImage();
 dialog.close();
}
function validGeneratedImage(result){
 const src=typeof result==='string'?result:(result&&typeof result.src==='string'?result.src:'');
 return /^(?:data:image\/(?:png|jpeg|webp);base64,|blob:|https:\/\/)/i.test(src)?src:'';
}
function retryableImageError(error){
 const value=String(error?.errorCode||error?.code||'')+' '+String(error?.message||'');
 return !/(?:safety|moderation|insufficient|balance|credit|quota|unauthoriz|auth token|popup|cancel|bad_request)/i.test(value);
}
function errorText(error){
 const code=String(error?.errorCode||error?.code||error?.name||'').toLowerCase();
 const msg=String(error?.message||error?.error||'').toLowerCase();
 if(/insufficient|balance|credit|quota/.test(code+' '+msg))return 'الحصة المجانية للصور خلصت أو غير متاحة للحساب. مفيش شراء تلقائي.';
 if(/moderation|safety/.test(code+' '+msg))return 'تعذر إنشاء الصورة بسبب ضوابط الأمان. جرّب وصفًا مختلفًا.';
 if(/not_authenticated|unauthoriz|sign in|auth token/.test(code+' '+msg))return 'اربط حساب خدمة الصور مرة واحدة وبعدها جرّب تاني.';
 if(/popup|blocked window/.test(code+' '+msg))return 'المتصفح منع نافذة الربط. اسمح بالنوافذ المنبثقة.';
 if(/cancel/.test(code+' '+msg))return 'تم إلغاء طلب الصورة.';
 if(/rate.limit|too.many/.test(code+' '+msg))return 'طلبات الصور وصلت للحد المتاح. جرّب بعد شوية.';
 return 'مدار ما قدرش يعمل الصورة حاليًا بعد تجربة البدائل. جرّب وصف تاني.';
}
async function connect(){
 // Call signIn synchronously inside the Connect button's click handler:
 // browsers may block an auth popup if it starts after an awaited SDK load.
 if(connecting||signedIn()){updateConnection();return;}
 const puter=window.puter;
 if(!puter?.auth?.signIn){note('خدمة الصور لسه بتتحمّل. جرّب زر الربط بعد شوية.',true);return;}
 connecting=true;updateConnection();
 let request;
 try{
   request=puter.auth.signIn();
   note('كمّل تسجيل الدخول في نافذة الخدمة الخارجية وارجع لمدار.');
 }catch(error){
   connecting=false;updateConnection();note(errorText(error),true);return;
 }
 try{
   await request;
   if(signedIn()){
    if(chatImageRequest&&!chatImageRequest.started){
      const task=chatImageRequest;
      task.started=true;
      note('🎨 جاري توليد الصورة وإرسالها إلى الشات...');
      generateFromProvider(task.prompt,task.options).then(src=>{
        if(chatImageRequest===task)chatImageRequest=null;
        if(dialog.open)dialog.close();
        task.resolve(src);
      }).catch(err=>{
        if(chatImageRequest===task)chatImageRequest=null;
        note(errorText(err),true);
        task.reject(Error(errorText(err)));
      });
    }else note('✅ خدمة الصور جاهزة.');
   }
   else note('ربط خدمة الصور ما اكتملش. جرّب تاني.',true);
 }catch(error){note(errorText(error),true);}
 finally{connecting=false;updateConnection();}
}
async function generate(event){
 event.preventDefault();
 if(pending)return;
 const description=prompt.value.trim();
 if(description.length<3){note('اكتب وصف للصورة الأول، زي: أسد لابس تاج في الفضاء.',true);prompt.focus();return;}
 if(description.length>900){note('Please shorten the image description to 900 characters.',true);return;}
 const selection=MODELS[model.value];
 if(!selection){note('Please choose an image model.',true);return;}
 if(!signedIn()){
   note('اربط حساب خدمة الصور من الزر، وبعدها مدار هيكمل التوليد.',true);
   updateConnection();return;
 }
 busy(true);note('Connecting to the image studio...');
 try{
   const puter=await loadSdk();
   if(!puter?.ai?.txt2img)throw Error('Image generator unavailable.');
   if(!signedIn())throw {code:'not_authenticated',message:'Puter sign-in expired'};
   note('🎨 MADAR is creating your image. This can take a little while...');
   const planned=await planImageRequest(description,false);
   if(planned.action==='clarify'){note(planned.question,true);return;}
   const source=await generateFromProvider(description,{imagePlan:planned,modelPreference:model.value});
   if(!source || !(source.startsWith('data:image/')||source.startsWith('blob:')||/^https:\/\//i.test(source)))
     throw Error('Image provider did not return a usable image.');
   image.src=source;
   image.alt='AI-generated image: '+description.slice(0,170);
   results.hidden=false;everGenerated=true;
   download.href=source;
   if(source.startsWith('data:')||source.startsWith('blob:')){
     download.setAttribute('download','MADAR-AI-image.png');
     download.textContent='⬇ Save image';
   }else{
     download.removeAttribute('download');
     download.textContent='↗ Open image to save';
   }
   note('✅ Your image is ready! Save it before leaving this page.');
 }catch(error){
   note(errorText(error),true);
   console.warn('MADAR Image Studio:',String(error?.code||error?.name||'unavailable').slice(0,60));
 }finally{busy(false);}
}
async function generateFromProvider(description,options={}){
 const instance=await loadSdk();
 if(!signedIn())throw Error('Puter sign-in is required.');
 // Use the free-allowance fast model by default, without paid calls on MADAR.
 const normalized=normalizeLandmark(description);
 // Higher-fidelity Gemini image model for buildings/landmarks; fast FLUX
 // remains the economical default for unrelated image requests.
 const architecture=/(?:^|[\s،.!؟:])(?:[لب])?(?:ال)?(?:جامع|مسجد|قلعه|قصر|كاتدرائيه|معبد|كنيسه|متحف|هرم|اهرام|برج)(?=$|[\s،.!؟:])/.test(normalized);
 // Send the original image to the image-edit model. Never claim that
 // re-generating from a text description is an edit of the original.
 const original=options?.inputImage;
 let editSource=original;
 if(typeof original==='string'&&original.startsWith('blob:')){
  const loaded=await fetch(original);
  if(!loaded.ok)throw Error('الصورة الأصلية مش متاحة للتعديل؛ ارفعها تاني.');
  editSource=await loaded.blob();
 }
 const useEdit=!!editSource;
 const plan=options.imagePlan||await planImageRequest(description,useEdit);
 if(plan.action==='clarify')return{clarification:plan.question};
 const params=useEdit?{...MODELS.detailed,input_images:[editSource]}:MODELS.detailed;
 const actualPrompt=useEdit
  ?'EDIT THE PROVIDED ORIGINAL IMAGE. Keep unchanged everything the user did not request changing. '+plan.prompt
  :plan.prompt;
 const first=useEdit?params:(options.modelPreference==='detailed'?MODELS.detailed:MODELS.fast);
 const alternate=useEdit?{...MODELS.editFallback,input_images:[editSource]}:(first===MODELS.fast?MODELS.detailed:MODELS.fast);
 let lastError=null;
 for(const candidate of [first,alternate]){
  try{
   const result=await instance.ai.txt2img(actualPrompt,candidate);
   const src=validGeneratedImage(result);
   if(src)return src;
   throw Error('Image response missing data');
  }catch(error){
   lastError=error;
   if(!retryableImageError(error))break;
  }
 }
 throw lastError||Error('Image temporarily unavailable');
}
async function generateFromChat(description,options={}){
 const promptText=String(description||'').trim().slice(0,900);
 if(promptText.length<3)throw Error('اكتب وصف الصورة بعد كلمة اعمل صورة.');
 if(chatImageRequest)throw Error('استنى الصورة الحالية تخلص الأول.');
 const imagePlan=await planImageRequest(promptText,!!options.inputImage);
 if(imagePlan.action==='clarify')return{clarification:imagePlan.question};
 const readyOptions={...options,imagePlan};
 try{await loadSdk();}
 catch(e){throw Error('خدمة الصور غير متاحة حاليًا. جرّب تحديث الصفحة أو شبكة مختلفة.');}
 if(signedIn()){
   try{return await generateFromProvider(promptText,readyOptions);}
   catch(e){throw Error(errorText(e));}
 }
 // Puter authentication must be initiated from the user's Connect click
 // because browsers block login popups launched asynchronously.
 return await new Promise((resolve,reject)=>{
   chatImageRequest={prompt:promptText,options:readyOptions,resolve,reject,started:false};
   prompt.value=promptText;
   open();
   note('🔐 كمّل ربط حساب خدمة الصور مرة واحدة، وبعدها مدار هيكمل '+(options?.inputImage?'تعديل الصورة الأصلية':'توليد الصورة')+' في الشات.');
 });
}

button.addEventListener('click',open);
connectButton.addEventListener('click',connect);
$('madarImageClose').addEventListener('click',close);
dialog.addEventListener('cancel',event=>{if(pending){event.preventDefault();note('Please wait for image creation to finish.');}else cancelChatImage();});
dialog.addEventListener('close',cancelChatImage);
form.addEventListener('submit',generate);
for(const example of dialog.querySelectorAll('[data-image-idea]')){
 example.addEventListener('click',()=>{prompt.value=example.getAttribute('data-image-idea')||'';prompt.focus();});
}
updateConnection();
function openWithIdea(description){
 prompt.value=String(description||'').slice(0,900);
 open();prompt.focus();
}
window.MADAR_IMAGE_STUDIO={open,openWithIdea,generateFromChat,prepareImagePrompt};
})();
