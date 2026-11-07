(function(){
'use strict';
const $=id=>document.getElementById(id),dialog=$('proStudio'),select=$('languageSelect');
if(!dialog||!select)return;
const textByLang={
 'ar-mixed':{
  plans:'← الخطط',newChat:'محادثة جديدة',composerHint:'Enter للإرسال · Shift + Enter لسطر جديد',
  starterLabel:'أفكار تبدأ بيها',welcomeDesc:'تقدر تبدأ بسؤال، صورة، ملف، أو مشروع كامل.',
  disclaimer:'MADAR PRO Beta · ردود أوضح وTools أكتر، Chat History بيتحفظ على جهازك. مفيش دفع أو اشتراك دلوقتي.',
  placeholder:'اسأل MADAR PRO أو افتح Pro Studio لعمل Websites وGames وImages...'
 },
 en:{
  plans:'← Plans',newChat:'New Chat',composerHint:'Enter to send · Shift + Enter for a new line',
  starterLabel:'Ideas to get started',welcomeDesc:'Start with a question, image, document, or complete project.',
  disclaimer:'MADAR PRO Beta · Clearer answers and advanced tools. Chat history stays on your device. No billing.',
  placeholder:'Ask MADAR PRO or open Pro Studio for websites, games and images...'
 }};
const KEY='madar-pro-language-v1';
let language='ar-mixed';try{if(localStorage.getItem(KEY)==='en')language='en'}catch{}
function setLanguage(value){
 language=value==='en'?'en':'ar-mixed';
 select.value=language;document.documentElement.lang=language==='en'?'en':'ar';
 const t=textByLang[language];
 for(const key of ['plans','newChat','composerHint','starterLabel','welcomeDesc','disclaimer']){
  const el=document.querySelector('[data-i18n="'+key+'"]');if(el)el.textContent=t[key];
 }
 const welcome=document.querySelector('[data-i18n="welcome"]');
 if(welcome){welcome.innerHTML=language==='en'?'Welcome to <span>MADAR PRO</span>':'أهلًا بيك في <span>مدار PRO</span>'}
 $('prompt').placeholder=t.placeholder;
 try{localStorage.setItem(KEY,language)}catch{}
}
window.MadarProLanguage=()=>language;
select.addEventListener('change',e=>setLanguage(e.target.value));setLanguage(language);
function status(id,message,err=false){const el=$(id);if(!el)return;el.textContent=String(message);el.style.color=err?'#ff9d9d':''}
function tab(name){
 document.querySelectorAll('[data-studio-tab]').forEach(el=>el.setAttribute('aria-selected',String(el.dataset.studioTab===name)));
 document.querySelectorAll('[data-studio-panel]').forEach(el=>el.hidden=el.dataset.studioPanel!==name);
}
document.querySelectorAll('[data-studio-tab]').forEach(b=>b.addEventListener('click',()=>tab(b.dataset.studioTab)));
$('openStudio').addEventListener('click',()=>{dialog.showModal();tab('image');loadPuter().catch(()=>{})});
$('studioClose').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
let sdkPromise=null,busyImage=false;
function signedIn(){try{return !!window.puter?.auth?.isSignedIn?.()}catch{return false}}
function loadPuter(){
 if(window.puter?.ai?.txt2img)return Promise.resolve(window.puter);
 if(sdkPromise)return sdkPromise;
 sdkPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='https://js.puter.com/v2/';script.async=true;
  let done=false;const finish=error=>{
   if(done)return;done=true;clearTimeout(timeout);
   if(error){sdkPromise=null;status('studioImageStatus','Puter SDK unavailable. Check your connection or content blockers.',true);reject(error)}
   else{status('studioImageStatus','Puter ready. Connect your own account to generate images.');resolve(window.puter)}
  };
  const timeout=setTimeout(()=>finish(Error('Puter timeout')),15000);
  script.onload=()=>window.puter?.ai?.txt2img?finish():finish(Error('Puter image API missing'));
  script.onerror=()=>finish(Error('Puter SDK load failed'));
  document.head.append(script);
 });
 return sdkPromise;
}
$('studioConnect').addEventListener('click',()=>{
 if(signedIn())return status('studioImageStatus','Puter account already connected.');
 if(!window.puter?.auth?.signIn){loadPuter().catch(()=>{});return status('studioImageStatus','Loading Puter. Press Connect again shortly.',true)}
 let request;try{request=window.puter.auth.signIn()}catch(e){return status('studioImageStatus',e.message,true)}
 status('studioImageStatus','Complete sign-in in the Puter popup.');
 Promise.resolve(request).then(()=>status('studioImageStatus',signedIn()?'Puter connected.':'Sign-in not complete.',!signedIn())).catch(e=>status('studioImageStatus',e.message,true));
});
$('studioCreateImage').addEventListener('click',async()=>{
 if(busyImage)return;
 const idea=$('studioImageIdea').value.trim();
 if(idea.length<5)return status('studioImageStatus','اكتب Image Prompt بالتفاصيل الأول.',true);
 if(!window.puter?.ai?.txt2img){try{await loadPuter()}catch{return}}
 if(!signedIn())return status('studioImageStatus','اربط Puter account بتاعك الأول. رصيد واستهلاك الصور حسب حسابك.',true);
 const styles={photorealistic:'photorealistic luxury photography',cinematic:'cinematic film-grade lighting',product:'premium product photography',poster:'professional marketing poster', '3d':'polished 3D CGI render',illustration:'editorial illustration'};
 const ratios={square:'square 1:1',landscape:'wide 16:9',portrait:'portrait 4:5'};
 const prompt=idea+'\nProfessional art direction: '+styles[$('studioImageStyle').value]+', '+ratios[$('studioImageRatio').value]+', precise details, thoughtful composition, no random misspelled text. Respect the exact subject.';
 busyImage=true;$('studioCreateImage').disabled=true;$('studioImageOutput').hidden=true;$('studioImageSave').hidden=true;
 status('studioImageStatus','Generating premium image...');
 try{
  let img;
  try{img=await window.puter.ai.txt2img(prompt,{model:'gemini-3.1-flash-image',provider:'gemini',quality:'1K'})}
  catch{status('studioImageStatus','Premium model unavailable. Trying an alternate model...');img=await window.puter.ai.txt2img(prompt,{model:'@cf/black-forest-labs/flux-1-schnell',provider:'cloudflare',steps:4})}
  const src=typeof img?.src==='string'?img.src:'';
  if(!/^(data:image\/|blob:|https:\/\/)/.test(src))throw Error('Image provider returned no valid image.');
  $('studioImageOutput').src=src;$('studioImageOutput').hidden=false;
  const link=$('studioImageSave');link.href=src;link.hidden=false;
  if(src.startsWith('https://')){link.removeAttribute('download');link.target='_blank';link.rel='noopener noreferrer';link.textContent='Open image to save'}
  else{link.setAttribute('download','madar-pro-image.png');link.removeAttribute('target');link.textContent='Download image'}
  status('studioImageStatus','Image ready. Save it before leaving the page.');
 }catch(e){status('studioImageStatus',e.message,true)}
 finally{busyImage=false;$('studioCreateImage').disabled=false}
});
async function ai(question){
 if(window.MadarProAI?.isConnected())return window.MadarProAI.chat([{role:'user',content:question.slice(0,5000)}]);
 if(location.protocol==='file:')throw Error('شات PRO الحقيقي يحتاج التشغيل على localhost أو دومين آمن، وبعدها تفعيله من قائمة الإعدادات.');
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),52000);
 try{
  const response=await fetch('/api/pro-chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:'auto',language,messages:[{role:'user',content:question.slice(0,5000)}]}),signal:controller.signal});
  const data=await response.json().catch(()=>null);
  if(!response.ok)throw Error(response.status===404||response.status===503?'خادم PRO غير متصل. ارجع للإعدادات ••• وفعل شات PRO بحسابك.':(data?.error||'AI unavailable ('+response.status+').'));
  if(typeof data?.reply!=='string'||!data.reply.trim())throw Error('Empty AI answer.');
  return data.reply;
 }catch(e){if(e.name==='AbortError')throw Error('Request timed out. Try a shorter task.');throw e}
 finally{clearTimeout(timeout)}
}
function htmlFromAI(raw){
 let s=String(raw||'').trim();
 const begin=s.search(/<!doctype\s+html|<html\b/i);
 if(begin<0)throw Error('AI did not return an HTML document. Try again with a simpler description.');
 s=s.slice(begin);
 const end=s.search(/<\/html\s*>/i);if(end>=0)s=s.slice(0,end+7);
 if(s.length<200||!/<body\b/i.test(s)||!/<\/body>/i.test(s))throw Error('AI returned incomplete HTML. Try again with a simpler idea.');
 return s.slice(0,120000);
}
function isolatedPage(html){
 const policy='<meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39;; style-src &#39;unsafe-inline&#39;; img-src data: blob:; font-src data:; connect-src &#39;none&#39;; form-action &#39;none&#39;; base-uri &#39;none&#39;;">';
 return /<head\b[^>]*>/i.test(html)?html.replace(/<head\b[^>]*>/i,x=>x+policy):policy+html;
}
function download(html,name){
 const url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),5000);
}
const generated={platform:null,game:null};
async function build(type){
 const platform=type==='platform';
 const idea=$(platform?'studioPlatformIdea':'studioGameIdea').value.trim();
 const prefix=platform?'Platform':'Game',label='studio'+prefix+'Status';
 if(idea.length<10)return status(label,'اكتب تفاصيل أكتر للمشروع الأول.',true);
 const button=$('studioBuild'+prefix),frame=$('studio'+prefix+'Frame'),save=$('studioDownload'+prefix);
 if(button.disabled)return;
 const prompt=platform
  ? 'You are a senior frontend engineer and product designer. Create one polished responsive SINGLE-FILE web PLATFORM from this brief: '+idea+'. Type: '+$('studioPlatformType').value+'. Visual design: '+$('studioPlatformTheme').value+'. Language: '+(language==='en'?'English':'Arabic RTL first, with useful English technical terms')+'. If building an AI chat platform similar to ChatGPT, create a polished working sidebar, chat composer, model picker, chat list and demo assistant replies, clearly labeled demo. Implement meaningful frontend interactions and local sample data. No actual login, payment, database, API, external assets or libraries. Return ONLY a compact complete HTML file starting with <!doctype html>, with embedded CSS and JS. Mobile friendly and professional. Avoid ornamental star symbols. No markdown.'
  : 'Create a playable polished compact HTML5 browser game: '+idea+'. Include working keyboard and touch controls, scoring and restart. Return ONLY a complete single-file HTML document with inline CSS and JS. No remote libraries/assets, network requests or Markdown.';
 button.disabled=true;save.disabled=true;frame.hidden=true;
 status(label,'Generating '+(platform?'platform':'game')+' code...');
 try{const code=htmlFromAI(await ai(prompt));generated[type]=code;frame.srcdoc=isolatedPage(code);frame.hidden=false;save.disabled=false;status(label,'Frontend prototype ready: preview and Download HTML. Real accounts/payment require a separate backend.')}
 catch(e){status(label,e.message,true)}finally{button.disabled=false}
}
$('studioBuildPlatform').addEventListener('click',()=>build('platform'));
$('studioBuildGame').addEventListener('click',()=>build('game'));
$('studioDownloadPlatform').addEventListener('click',()=>{if(generated.platform)download(generated.platform,'madar-pro-platform.html')});
$('studioDownloadGame').addEventListener('click',()=>{if(generated.game)download(generated.game,'madar-pro-game.html')});
async function lesson(quiz){
 const topic=$('studioLearnTopic').value.trim();
 if(topic.length<4)return status('studioLearnStatus','اكتب Topic الأول.',true);
 const btn=$(quiz?'studioQuiz':'studioTeach');if(btn.disabled)return;
 btn.disabled=true;status('studioLearnStatus','Preparing the lesson...');
 try{
  const question=(quiz?'Create a five-question interactive quiz starting with ONE question and wait for the learner response.':'Explain with clear step-by-step notes, examples, a short summary and practice exercise.')+' Topic: '+topic+'. Language: '+(language==='en'?'English.':'Egyptian Arabic first with appropriate English terms.');
  const answer=await ai(question);$('studioLearnResult').textContent=answer;$('studioLearnResult').hidden=false;status('studioLearnStatus','Ready.');
 }catch(e){status('studioLearnStatus',e.message,true)}finally{btn.disabled=false}
}
$('studioTeach').addEventListener('click',()=>lesson(false));
$('studioQuiz').addEventListener('click',()=>lesson(true));
$('studioMakeDesign').addEventListener('click',async()=>{
 const idea=$('studioDesignIdea').value.trim();
 if(idea.length<8)return status('studioDesignStatus','اكتب Brand Brief الأول.',true);
 const b=$('studioMakeDesign');if(b.disabled)return;b.disabled=true;status('studioDesignStatus','Creating professional design brief...');
 try{
  const prompt='Act as senior art director and product designer. Create a comprehensive but concise visual brand and UI design brief for: '+idea+'. Include 5 HEX colors, typography, layout, marketing concept and a precise premium image-generation prompt. Use '+(language==='en'?'English':'natural Arabic with English design terms')+'.';
  $('studioDesignResult').textContent=await ai(prompt);$('studioDesignResult').hidden=false;status('studioDesignStatus','Design brief ready.');
 }catch(e){status('studioDesignStatus',e.message,true)}finally{b.disabled=false}
});
$('studioDesignToImage').addEventListener('click',()=>{
 const idea=$('studioDesignIdea').value.trim();
 if(idea)$('studioImageIdea').value=idea+'. Premium advertising composition, high-end design.';
 tab('image');$('studioImageIdea').focus();
});
})();