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
$('openStudio').addEventListener('click',()=>{dialog.showModal();tab('image')});
$('studioClose').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});

let busyImage=false;
$('studioCreateImage').addEventListener('click',()=>{
 if(busyImage)return;
 const description=$('studioImageIdea').value.trim();
 if(description.length<4)return status('studioImageStatus','اكتب عنوان أو وصف للبوستر الأول.',true);
 const ratio=$('studioImageRatio').value;
 const [w,h]=ratio==='landscape'?[1600,900]:ratio==='portrait'?[1080,1350]:[1200,1200];
 busyImage=true;$('studioCreateImage').disabled=true;
 try{
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw Error('متصفحك مش قادر يرسم الصورة.');
  const style=$('studioImageStyle').value,dim=Math.min(w,h);
  const colors=style==='poster'?['#17110d','#4b2918']:style==='illustration'?['#171823','#342d3b']:style==='cinematic'?['#091019','#292018']:['#0b0d12','#27201a'];
  const bg=ctx.createLinearGradient(0,0,w,h);bg.addColorStop(0,colors[0]);bg.addColorStop(1,colors[1]);ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
  const glow=ctx.createRadialGradient(w*.6,h*.45,0,w*.5,h*.5,w*.7);
  glow.addColorStop(0,'rgba(232,183,96,.32)');glow.addColorStop(1,'rgba(232,183,96,0)');
  ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
  ctx.save();ctx.translate(w*.5,h*.5);ctx.rotate(-.18);
  ctx.strokeStyle='rgba(240,201,120,.27)';ctx.lineWidth=Math.max(2,dim*.0015);
  for(let i=0;i<13;i++){ctx.beginPath();ctx.ellipse(0,0,w*(.15+i*.019),h*(.15+i*.021),.5,0,Math.PI*2);ctx.stroke();}
  ctx.restore();
  for(let i=0;i<70;i++){
   const seed=(i*139+23)%997;
   ctx.fillStyle='rgba(255,227,183,'+(.15+.5*Math.abs(Math.sin(i*2.3))).toFixed(2)+')';
   const z=Math.max(2,dim*(.001+i%4*.0003));
   ctx.fillRect((seed*.019%1)*w,(seed*.037%1)*h,z,z);
  }
  ctx.direction='rtl';ctx.textAlign='center';
  ctx.fillStyle='#f0c978';ctx.font='700 '+Math.round(dim*.029)+'px system-ui';
  ctx.fillText('MADAR PRO  •  DESIGN',w*.5,h*.22,w*.85);
  ctx.fillStyle='#fff6ea';ctx.font='800 '+Math.round(dim*.063)+'px system-ui';
  const chunks=description.replace(/\s+/g,' ').split(' ').slice(0,25),lines=[];let line='';
  for(const word of chunks){
   const next=line?line+' '+word:word;
   if(line&&ctx.measureText(next).width>w*.8){lines.push(line);line=word;if(lines.length>=2)break;}else line=next;
  }
  if(line)lines.push(line);
  let y=h*.47-(lines.length-1)*dim*.076/2;
  for(const text of lines.slice(0,3)){ctx.fillText(text,w*.5,y,w*.85);y+=dim*.076;}
  ctx.font='500 '+Math.round(dim*.019)+'px system-ui';ctx.fillStyle='rgba(249,220,174,.75)';
  ctx.fillText('تصميم رسومي مجاني من مدار — بدون رسوم أو حساب',w*.5,h*.83,w*.85);
  const data=canvas.toDataURL('image/png');
  const output=$('studioImageOutput'),link=$('studioImageSave');
  output.src=data;output.hidden=false;link.href=data;link.setAttribute('download','madar-pro-poster.png');
  link.removeAttribute('target');link.hidden=false;link.textContent='⬇ تحميل البوستر PNG';
  status('studioImageStatus','البوستر جاهز. ده تصميم رسومي محلي، مش صورة فوتوغرافية مولّدة بالذكاء الاصطناعي.');
 }catch(e){status('studioImageStatus','تعذر تصميم البوستر: '+String(e?.message||e),true)}
 finally{busyImage=false;$('studioCreateImage').disabled=false}
});
async function ai(question){
 if(location.protocol==='file:')throw Error('افتح مدار PRO من رابط Vercel بدل ملف HTML محلي.');
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),52000);
 try{
  const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'chat',tier:'pro',language,messages:[{role:'user',content:question.slice(0,5000)}]}),signal:controller.signal});
  const data=await response.json().catch(()=>null);
  if(!response.ok)throw Error(data?.error||'خدمة Gemini المجانية غير متاحة مؤقتًا.');
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