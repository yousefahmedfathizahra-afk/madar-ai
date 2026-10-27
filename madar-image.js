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
 detailed:{model:'gemini-3.1-flash-image',provider:'gemini',quality:'1K'}
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
 const original=String(description||'').trim();
 const normalized=normalizeLandmark(original);
 // The best-known example from MADAR visitors:
 // "جامع عمرو ابن العاص" means the historic mosque in Old Cairo,
 // NOT a portrait of the historical person Amr ibn al-As.
 const amrMosque=/(?:^|[\s،.!؟:])(?:[لب])?(?:ال)?(?:جامع|مسجد)\s+عمرو\s+(?:بن|ابن)\s+العاص(?=$|[\s،.!؟:])/.test(normalized);
 if(amrMosque){
  return [
   'IMAGE SUBJECT: Mosque of Amr ibn al-As (Amr Ibn Al-As Mosque, جامع عمرو بن العاص) in Old Cairo, Egypt.',
   'Depict the REAL-WORLD HISTORIC MOSQUE AS AN ARCHITECTURAL BUILDING: its courtyard, colonnades, arcades, historic Islamic architecture and exterior or interior as requested.',
   'The words "Amr ibn al-As" here are part of the MOSQUE NAME, not a request to depict Amr ibn al-As as a person. NO standalone person portrait, human headshot or warrior replacing the mosque.',
   'Honor the visitor-specific view, lighting, style and composition rather than inventing other subjects.',
   'VISITOR REQUEST: '+original.slice(0,900)
  ].join('\n');
 }
 const namedPlaces=[
  {match:/(?:جامع|مسجد)\s+(?:محمد|محمّد)\s+علي(?:\s+(?:باشا|في\s+القلعه))?/,place:'Muhammad Ali Pasha Mosque at the Cairo Citadel: the monumental domed Ottoman-style mosque, NOT the human ruler Muhammad Ali Pasha.'},
  {match:/(?:جامع|مسجد)\s+السلطان\s+حسن/,place:'Sultan Hassan Mosque-Madrasa in Cairo: an enormous Mamluk stone religious complex, NOT a portrait of Sultan Hassan.'},
  {match:/(?:قلعه|قلعة)\s+(?:صلاح\s+الدين|الناصر\s+صلاح)/,place:'The historic Citadel of Salah al-Din in Cairo: stone fortress and ramparts, NOT a human portrait of Saladin.'}
 ];
 for(const place of namedPlaces){
  if(place.match.test(normalized))
   return [
     'PRIMARY SUBJECT: '+place.place,
     'Architectural landmark scene, with recognizable building architecture as the focus. Avoid replacing its namesake with a portrait.',
     'Respect additional objects, scenery, style and viewpoint explicitly requested by the visitor.',
     'VISITOR REQUEST: '+original.slice(0,900)
   ].join('\n');
 }
 // A general mosque request still needs an unmistakable MOSQUE, not an
 // unrelated building, a face, a church or a religious symbol drawn in error.
 const mosque=/(?:^|[\s،.!؟:])(?:[لب])?(?:ال)?(?:جامع|مسجد)(?=$|[\s،.!؟:])/.test(normalized);
 if(mosque){
  return [
   'CREATE AN ARCHITECTURAL IMAGE OF A MOSQUE (Islamic place of worship).',
   'VISUAL CATEGORY: mosque building itself, with traditional Islamic architectural cues such as arches, prayer hall/courtyard and a minaret or dome where appropriate to the visitor description.',
   'Do not substitute a historical person, a portrait, a church, a generic palace, an unrelated religious monument, or a different type of building.',
   'If a specific mosque name is supplied, depict the mosque as architecture. Any image generated from text is an AI illustration, NOT a verified photograph of that exact real-world site.',
   'Follow the specific location, viewpoint, details, style and extra objects requested by the visitor.',
   'VISITOR REQUEST: '+original.slice(0,900)
  ].join('\n');
 }
 // Place names may contain historical personal names. Preserve the user's place
 // as the principal visual subject; people may still appear when explicitly asked.
 const landmark=/(?:^|[\s،.!؟:])(?:[لب])?(?:ال)?(?:جامع|مسجد|كنيسه|كاتدرائيه|قصر|قلعه|متحف|برج|معبد|ضريح|مقام|هرم|اهرام|مكتبه|جامعه|مدرسه)(?=$|[\s،.!؟:])/.exec(normalized);
 if(landmark){
  const placeAt=landmark.index;
  const human=/(?:^|[\s،.!؟:])(?:شخص|رجل|شاب|ست|سيده|امراه|بنت|طفل|ناس|اشخاص|صوره شخصيه|portrait|person|man|woman|selfie)(?=$|[\s،.!؟:])/.exec(normalized);
  if(!human||human.index>placeAt){
   return [
    'PRIMARY IMAGE SUBJECT: the specific place, building, monument, or architectural landmark named below, NOT a portrait of a person whose name appears in the place name.',
    'Show the requested structure itself with appropriate architectural details and setting; follow the exact viewpoint, style, weather, colors and composition in the visitor request.',
    'People may appear only when requested as part of the scene. Do not replace the named landmark with a historical figure.',
    'VISITOR REQUEST: '+original.slice(0,900)
   ].join('\n');
  }
 }
 // For other scenes, preserve exactly what the user asked for: subject, type,
 // number, relative positions and requested style. Don't merge a person, animal,
 // monument or sports object with another named thing in the same request.
 // The generator is a drawing engine, not a real photo retrieval service.
 return [
  'GENERATE AN IMAGE of the visitor request below. Respect the actual requested subject types:',
  '- Distinguish buildings and landmarks from people whose names appear in their titles.',
  '- Distinguish animals from people, sports equipment from athletes, and real objects from logos or text.',
  '- If several objects or characters are requested, include each separately with the requested counts, positions and relationships.',
  '- Honor the requested colors, composition, location, viewpoint and visual style; do not swap the requested subject for a lookalike or add prominent unrelated subjects.',
  '- Do not invent written labels or captions that were not requested.',
  'VISITOR REQUEST: '+original.slice(0,900)
 ].join('\n');
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
 connectButton.textContent=connecting?'⏳ Connecting...':!ready?'⏳ Loading Puter...':'🔐 Connect Puter';
 accountState.textContent=connected?'✅ Puter connected — you can now generate images.':'Step 1: Connect your own Puter account to enable image creation.';
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
 loadSdk().then(()=>{updateConnection();if(!signedIn())note('Click Connect Puter first. The Puter account is separate from your MADAR account.');})
  .catch(error=>{updateConnection();note('Puter could not load: '+String(error?.message||'Try again later.').slice(0,140),true);});
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
function errorText(error){
 const code=String(error?.errorCode||error?.code||error?.name||'').toLowerCase();
 const message=String(error?.message||error?.error||'').trim();
 const lower=message.toLowerCase();
 if(code.includes('insufficient_funds')||lower.includes('insufficient funds')||lower.includes('balance'))
   return 'Your Puter account has insufficient image credits. MADAR will never charge you automatically.';
 if(code.includes('moderation_flagged')||lower.includes('safety')||lower.includes('moderation'))
   return 'The image request was declined by the safety filter. Try changing the prompt.';
 if(code.includes('not_authenticated')||code.includes('unauthoriz')||lower.includes('sign in')||lower.includes('auth token'))
   return 'Puter sign-in is required or expired. Press Connect Puter and try again.';
 if(code.includes('unsupported_origin')||lower.includes('unsupported origin'))
   return 'Puter cannot connect from this page. Open MADAR directly in your browser over HTTPS.';
 if(code.includes('popup')||lower.includes('popup')||lower.includes('blocked'))
   return 'Puter sign-in may be blocked. Allow popups for this website and press Connect Puter again.';
 if(code.includes('cancel'))return 'Sign-in or image generation was cancelled.';
 if(code.includes('rate_limit')||code.includes('too_many'))return 'Puter rate limit reached. Please try again later.';
 if(code.includes('upstream_failed')||code.includes('upstream_timeout'))
   return 'The selected image model failed at the provider. Try another model or try again later. ('+code+')';
 if(code==='network_error'||code==='request_timeout')
   return 'Cannot reach Puter image servers. Check your connection and try again. ('+code+')';
 if(code==='bad_request')
   return 'Puter rejected the request'+(message?': '+message.slice(0,180):'. Try another prompt or model.');
 if(message && message.length<=180 && !/bearer |api[_ -]?key|token=|password|https?:\/\//i.test(message))
   return 'Puter: '+message+(code?' ('+code+')':'');
 return 'Puter could not generate this image'+(code?' (error: '+code.slice(0,64)+')':'')+'. Try switching the image model.';
}
async function connect(){
 // Call signIn synchronously inside the Connect button's click handler:
 // browsers may block an auth popup if it starts after an awaited SDK load.
 if(connecting||signedIn()){updateConnection();return;}
 const puter=window.puter;
 if(!puter?.auth?.signIn){note('Image service is still loading. Wait a few seconds and try Connect Puter.',true);return;}
 connecting=true;updateConnection();
 let request;
 try{
   request=puter.auth.signIn();
   note('Complete the Puter sign-in window. Then return to MADAR.');
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
      generateFromProvider(task.prompt).then(src=>{
        if(chatImageRequest===task)chatImageRequest=null;
        if(dialog.open)dialog.close();
        task.resolve(src);
      }).catch(err=>{
        if(chatImageRequest===task)chatImageRequest=null;
        note(errorText(err),true);
        task.reject(Error(errorText(err)));
      });
    }else note('✅ Connected to Puter. Describe your image and press Generate image.');
   }
   else note('Puter sign-in did not finish. Please try Connect Puter again.',true);
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
   note('First press Connect Puter, finish signing in, then press Generate image.',true);
   updateConnection();return;
 }
 busy(true);note('Connecting to the image studio...');
 try{
   const puter=await loadSdk();
   if(!puter?.ai?.txt2img)throw Error('Image generator unavailable.');
   if(!signedIn())throw {code:'not_authenticated',message:'Puter sign-in expired'};
   note('🎨 MADAR is creating your image. This can take a little while...');
   const produced=await puter.ai.txt2img(prepareImagePrompt(description),selection);
   const source=typeof produced?.src==='string'?produced.src:'';
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
async function generateFromProvider(description){
 const instance=await loadSdk();
 if(!signedIn())throw Error('Puter sign-in is required.');
 // Use the free-allowance fast model by default, without paid calls on MADAR.
 const normalized=normalizeLandmark(description);
 // Higher-fidelity Gemini image model for buildings/landmarks; fast FLUX
 // remains the economical default for unrelated image requests.
 const architecture=/(?:^|[\s،.!؟:])(?:[لب])?(?:ال)?(?:جامع|مسجد|قلعه|قصر|كاتدرائيه|معبد|كنيسه|متحف|هرم|اهرام|برج)(?=$|[\s،.!؟:])/.test(normalized);
 const result=await instance.ai.txt2img(prepareImagePrompt(description),architecture?MODELS.detailed:MODELS.fast);
 const source=typeof result?.src==='string'?result.src:'';
 if(!source||!(source.startsWith('data:image/')||source.startsWith('blob:')||/^https:\/\//i.test(source)))
   throw Error('Puter لم يرجع صورة صالحة. حاول تاني.');
 return source;
}
async function generateFromChat(description){
 const promptText=String(description||'').trim().slice(0,900);
 if(promptText.length<3)throw Error('اكتب وصف الصورة بعد كلمة اعمل صورة.');
 if(chatImageRequest)throw Error('استنى الصورة الحالية تخلص الأول.');
 try{await loadSdk();}
 catch(e){throw Error('مش قادر أحمل خدمة الصور Puter. جرّب تغيير الشبكة أو المتصفح.');}
 if(signedIn()){
   try{return await generateFromProvider(promptText);}
   catch(e){throw Error(errorText(e));}
 }
 // Puter authentication must be initiated from the user's Connect click
 // because browsers block login popups launched asynchronously.
 return await new Promise((resolve,reject)=>{
   chatImageRequest={prompt:promptText,resolve,reject,started:false};
   prompt.value=promptText;
   open();
   note('🔐 لتوليد الصور من الشات: اضغط Connect Puter مرة واحدة، وبعدها مدار هيكمّل تلقائيًا. مفيش اشتراك مدفوع من MADAR.');
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
window.MADAR_IMAGE_STUDIO={open,generateFromChat,prepareImagePrompt};
})();
