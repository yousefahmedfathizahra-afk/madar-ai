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
let pending=false,bootPromise=null,everGenerated=false;
const SDK='https://js.puter.com/v2/';
const MODELS={
 fast:{model:'@cf/black-forest-labs/flux-1-schnell',provider:'cloudflare',steps:4},
 detailed:{model:'gemini-3.1-flash-lite-image',provider:'gemini',quality:'1K'}
};
function note(message,bad=false){
 state.textContent=message||'';
 state.style.color=bad?'#f4a8b7':'var(--text)';
}
function busy(value){
 pending=value;
 generateButton.disabled=value;
 generateButton.textContent=value?'⏳ Generating...':'✦ Generate image';
 model.disabled=value;
 prompt.readOnly=value;
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
 loadSdk().catch(()=>{note('Image service is loading slowly. Try Generate when ready.',true);});
}
function close(){
 if(pending){note('Your image is still generating. Please wait a moment.');return;}
 dialog.close();
}
function errorText(error){
 const c=String(error?.code||'').toLowerCase();
 const message=String(error?.message||'').toLowerCase();
 if(c.includes('insufficient_funds')||message.includes('insufficient')||message.includes('balance'))
   return 'Your Puter image allowance has run out. You can wait for the next free allowance or choose whether to add credit in Puter. MADAR will not charge you.';
 if(c.includes('canceled')||c.includes('cancelled')||message.includes('cancel'))
   return 'Image creation was cancelled. You can try again whenever you want.';
 if(c.includes('blocked')||message.includes('popup')||message.includes('blocked'))
   return 'Allow the Puter sign-in window or popups for MADAR and try again.';
 if(c==='bad_request'||message.includes('invalid prompt'))
   return 'That image request could not be processed. Try a different description.';
 if(message.includes('not signed')||message.includes('auth'))
   return 'Sign in to your Puter account to generate images, then try again.';
 return 'Image generation could not finish. Check your connection or Puter allowance and try again.';
}
async function generate(event){
 event.preventDefault();
 if(pending)return;
 const description=prompt.value.trim();
 if(description.length<3){note('اكتب وصف للصورة الأول، زي: أسد لابس تاج في الفضاء.',true);prompt.focus();return;}
 if(description.length>900){note('Please shorten the image description to 900 characters.',true);return;}
 const selection=MODELS[model.value];
 if(!selection){note('Please choose an image model.',true);return;}
 busy(true);results.hidden=true;note('Connecting to the image studio...');
 try{
   const puter=await loadSdk();
   if(!puter?.ai?.txt2img)throw Error('Image generator unavailable.');
   note('You may be asked to sign in to Puter. It uses your own free allowance, not the MADAR owner’s billing.');
   if(puter.auth?.isSignedIn && !puter.auth.isSignedIn() && typeof puter.auth.signIn==='function'){
     await puter.auth.signIn();
   }
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
$('madarImageClose').addEventListener('click',close);
dialog.addEventListener('cancel',event=>{if(pending){event.preventDefault();note('Please wait for image creation to finish.');}});
form.addEventListener('submit',generate);
for(const example of dialog.querySelectorAll('[data-image-idea]')){
 example.addEventListener('click',()=>{prompt.value=example.getAttribute('data-image-idea')||'';prompt.focus();});
}
window.MADAR_IMAGE_STUDIO={open};
})();
