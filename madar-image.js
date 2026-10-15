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
const SDK='https://js.puter.com/v2/';
const MODELS={
 fast:{model:'@cf/black-forest-labs/flux-1-schnell',provider:'cloudflare',steps:4},
 detailed:{model:'gemini-3.1-flash-lite-image',provider:'gemini',quality:'1K'}
};
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
function loadSdk(){
 if(window.puter?.ai?.txt2img)return Promise.resolve(window.puter);
 if(bootPromise)return bootPromise;
 bootPromise=new Promise((resolve,reject)=>{
   const script=document.createElement('script');
   let completed=false;
   const finish=(err)=>{
     if(completed)return;
     completed=true;
     clearTimeout(timeout);
     if(err){script.remove();reject(err);}
     else resolve(window.puter);
   };
   const timeout=setTimeout(()=>finish(Error('Loading image service timed out. Please try again.')),14000);
   script.src=SDK;
   script.async=true;
   script.crossOrigin='anonymous';
   script.onload=()=>window.puter?.ai?.txt2img?finish():finish(Error('Image service did not start.'));
   script.onerror=()=>finish(Error('Could not load the image service. Check your internet and try again.'));
   document.head.append(script);
 }).catch(error=>{bootPromise=null;throw error;});
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
function close(){
 if(pending){note('Your image is still generating. Please wait a moment.');return;}
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
   if(signedIn())note('✅ Connected to Puter. Describe your image and press Generate image.');
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
   const produced=await puter.ai.txt2img(description,selection);
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
button.addEventListener('click',open);
connectButton.addEventListener('click',connect);
$('madarImageClose').addEventListener('click',close);
dialog.addEventListener('cancel',event=>{if(pending){event.preventDefault();note('Please wait for image creation to finish.');}});
form.addEventListener('submit',generate);
for(const example of dialog.querySelectorAll('[data-image-idea]')){
 example.addEventListener('click',()=>{prompt.value=example.getAttribute('data-image-idea')||'';prompt.focus();});
}
updateConnection();
window.MADAR_IMAGE_STUDIO={open};
})();
