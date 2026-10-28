/* MADAR Creative Studio — five integrated workflows. No generated source
 * executes in this privileged page; code goes to MADAR Builder's sandbox. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const dlg=$('madarStudioDialog');
if(!dlg)return;
const start=$('madarStudioOpen'),close=$('madarStudioClose');
const status=$('madarStudioStatus'),progress=$('madarStudioProgress');
const tabs=[...dlg.querySelectorAll('[data-studio-tab]')];
const panels=[...dlg.querySelectorAll('[data-studio-panel]')];
const idea=$('studioProjectIdea'),topic=$('studioStudyTopic'),game=$('studioGameIdea'),design=$('studioDesignIdea');
const codeIds=['studioHtml','studioCss','studioJs'];
let savedPack=null,loading=false,abort=null;
function say(t,bad=false){
 status.textContent=String(t||'');status.classList.toggle('studio-error',!!bad);
}
function open(tab){
 if(!dlg.open)dlg.showModal();
 changeTab(tab||'project');
}
function hide(){
 abort?.abort();abort=null;loading=false;
 progress.hidden=true;
 dlg.close();
}
function changeTab(name){
 tabs.forEach(x=>{const active=x.dataset.studioTab===name;x.classList.toggle('active',active);x.setAttribute('aria-selected',String(active));});
 panels.forEach(x=>{x.hidden=x.dataset.studioPanel!==name;});
 say('');
}
function setBusy(b){
 loading=b;progress.hidden=!b;
 dlg.querySelectorAll('[data-studio-action="project"],[data-studio-action="repair"]').forEach(x=>x.disabled=b);
}
function textNode(parent,tag,text,cls){
 const x=document.createElement(tag);
 if(cls)x.className=cls;
 x.textContent=String(text||'');
 parent.append(x);return x;
}
function promptToBuilder(value,type){
 hide();
 if(!window.MADAR_BUILDER?.openWithIdea)return window.MADAR_APP?.notice('مولّد المشاريع مش جاهز. حدّث الصفحة.');
 window.MADAR_BUILDER.openWithIdea(String(value||''),type);
}
function promptToImage(value){
 hide();
 if(!window.MADAR_IMAGE_STUDIO?.openWithIdea)return window.MADAR_APP?.notice('استوديو الصور مش جاهز. حدّث الصفحة.');
 window.MADAR_IMAGE_STUDIO.openWithIdea(String(value||''));
}
function toChat(value){
 hide();window.MADAR_APP?.sendText(String(value||'').slice(0,4500));
}
async function api(action,body){
 if(loading)throw Error('فيه طلب شغال بالفعل.');
 setBusy(true);
 const controller=new AbortController();abort=controller;
 const timer=setTimeout(()=>controller.abort(),26000);
 try{
  const r=await fetch('/api/studio',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({...body,action}),signal:controller.signal});
  const d=await r.json().catch(()=>null);
  if(!r.ok)throw Error(d?.error||'تعذر الاتصال بمدار ستوديو.');
  return d;
 }catch(e){
  if(e.name==='AbortError')throw Error('الطلب اتلغى أو أخد وقت أطول من المتوقع. جرّب تاني.');
  throw e;
 }finally{clearTimeout(timer);abort=null;setBusy(false);}
}
async function projectPack(){
 if(loading)return;
 const value=idea.value.trim();
 if(value.length<10){say('اوصف فكرة المشروع في 10 حروف على الأقل.',true);idea.focus();return;}
 say('...');
 try{
  const d=await api('project',{idea:value});
  const p=d.pack;
  if(!p||!Array.isArray(p.features))throw Error('النتيجة ناقصة.');
  savedPack=p;
  const out=$('studioProjectResult');out.replaceChildren();out.hidden=false;
  textNode(out,'h3',p.title,'studio-result-title');
  textNode(out,'p',p.tagline,'studio-result-subtitle');
  if(d.demo)textNode(out,'p','دي خطة بداية تجريبية لأن خدمة الذكاء الاصطناعي كانت مش متاحة. ممكن تخصصها قبل التنفيذ.','studio-note');
  textNode(out,'h4','مميزات المشروع');
  const ul=document.createElement('ul');out.append(ul);
  for(const f of p.features.slice(0,7))textNode(ul,'li',f);
  textNode(out,'h4','نص الإعلان الجاهز');
  textNode(out,'p',p.socialPost,'studio-copy-text');
  textNode(out,'h4','وصف تسويقي');
  textNode(out,'p',p.marketingCopy,'studio-copy-text');
  if(Array.isArray(p.brandColors)&&p.brandColors.length){
   const colors=document.createElement('div');colors.className='studio-swatches';out.append(colors);
   for(const hex of p.brandColors){if(!/^#[0-9a-f]{6}$/i.test(hex))continue;const sw=document.createElement('span');sw.style.backgroundColor=hex;sw.title=hex;colors.append(sw);}
  }
  const buttons=document.createElement('div');buttons.className='studio-buttons';out.append(buttons);
  const site=textNode(buttons,'button','🌐 ابني الموقع');site.type='button';site.onclick=()=>promptToBuilder(p.sitePrompt,'website');
  const logo=textNode(buttons,'button','🎨 صمم الشعار');logo.type='button';logo.onclick=()=>promptToImage(p.logoPrompt);
  const copy=textNode(buttons,'button','📋 انسخ إعلان المشروع');copy.type='button';copy.onclick=async()=>{
   try{await navigator.clipboard.writeText(p.socialPost);say('تم نسخ الإعلان.');}
   catch{say('انسخ الإعلان من النص الظاهر فوق.',true);}
  };
  say(d.demo?'خطة أولية جاهزة، تقدر تبني منها موقعًا أو شعارًا.':'✅ جهزت خطة المشروع والشعار ونص الإعلان.');
 }catch(e){say(e.message||'تعذر تجهيز المشروع.',true);}
}
async function repair(){
 if(loading)return;
 const body=Object.fromEntries(codeIds.map((x,i)=>[['html','css','js'][i],$(x).value]));
 body.problem=$('studioProblem').value;
 if(Object.values(body).join('').trim().length<20){say('الصق كود HTML أو CSS أو JS الأول.',true);return;}
 try{
  const d=await api('repair',body);
  if(!window.MADAR_BUILDER?.validProject(d.project))throw Error('الكود الناتج ناقص، لم يتم تغيير الأصل.');
  const p=d.project;
  const out=$('studioRepairResult');out.replaceChildren();out.hidden=false;
  textNode(out,'h3','✅ اقتراح إصلاح: '+p.title);
  textNode(out,'p',p.explanation,'studio-copy-text');
  textNode(out,'p','راجع الإصلاح واختبره بنفسك قبل النشر. المعاينة معزولة ولا تملك صلاحية الوصول لحسابك.','studio-note');
  const button=textNode(out,'button','▶ معاينة الإصلاح وتعديل الكود');
  button.type='button';button.onclick=()=>{hide();window.MADAR_BUILDER.setProject(p);window.MADAR_BUILDER.open();};
  say('مدار رجع نسخة مقترحة للإصلاح. الملف الأصلي لم يتغيّر.');
 }catch(e){say(e.message||'تعذر إصلاح الكود.',true);}
}
start?.addEventListener('click',()=>open('project'));
close?.addEventListener('click',hide);
dlg.addEventListener('cancel',e=>{e.preventDefault();hide();});
for(const t of tabs)t.addEventListener('click',()=>changeTab(t.dataset.studioTab));
dlg.querySelector('[data-studio-action="project"]')?.addEventListener('click',projectPack);
dlg.querySelector('[data-studio-action="repair"]')?.addEventListener('click',repair);
dlg.querySelector('[data-studio-action="study-explain"]')?.addEventListener('click',()=>{
 const t=topic.value.trim();if(!t)return say('اكتب موضوع أو درس الأول.',true);
 toChat('اشرحلي الدرس ده بالمصري مع أمثلة بسيطة خطوة بخطوة: '+t);
});
dlg.querySelector('[data-studio-action="study-quiz"]')?.addEventListener('click',()=>{
 const t=topic.value.trim();if(!t)return say('اكتب المادة أو الدرس الأول.',true);
 toChat('امتحني في '+t+' بخمس أسئلة، سؤال واحد كل مرة، استنى إجابتي وصححها واجمع الدرجة.');
});
// Guided language tutoring. The user chooses a language, level and topic.
const learnLang=$('studioLearnLang'),learnLevel=$('studioLearnLevel'),learnOther=$('studioLearnOther');
const LANGUAGE_LOCALES={
 'الإنجليزية':'en-US','الفرنسية':'fr-FR','الإسبانية':'es-ES','الألمانية':'de-DE',
 'الإيطالية':'it-IT','التركية':'tr-TR','البرتغالية':'pt-BR','الروسية':'ru-RU',
 'الصينية الماندرين':'zh-CN','اليابانية':'ja-JP','الكورية':'ko-KR','الهندية':'hi-IN',
 'الأردية':'ur-PK','الإندونيسية':'id-ID','السويدية':'sv-SE','الهولندية':'nl-NL',
 'السواحيلية':'sw-KE','العربية':'ar-EG'
};
function selectedLanguage(){
 const lang=learnLang.value==='other'?learnOther.value.trim():learnLang.value;
 if(!lang||lang.length>70){say('اختار اسم اللغة الأول.',true);return null;}
 return lang;
}
function voiceLanguage(lang){
 const select=$('madarVoiceLang'),quick=$('madarVoiceQuick');
 const code=LANGUAGE_LOCALES[lang]||'auto';
 select.value=code; if(quick)quick.value=code;
 return code;
}
learnLang.addEventListener('change',()=>{
 const other=learnLang.value==='other';
 learnOther.hidden=!other;
 $('studioLearnOtherLabel').hidden=!other;
 if(other)learnOther.focus();
});
function languageTask(kind){
 const lang=selectedLanguage();if(!lang)return;
 const level=learnLevel.value,topic=$('studioLearnTopic').value.trim().slice(0,250)||'المحادثات اليومية';
 voiceLanguage(lang);
 const pre='أنت مدرس لغات تفاعلي في مدار AI. اللغة الهدف: '+lang+'. مستوى الطالب: '+level+'. موضوع الدرس: '+topic+'. استخدم العربية المصرية في الشرح عند الحاجة، واظهر جملًا سليمة باللغة الهدف مع ترجمتها العربية ونطق مكتوب تقريبي إن أمكن. صحح الأخطاء بأدب وبدقة؛ لو مش متأكد من النطق قل ذلك ولا تخمن. ';
 if(kind==='lesson')toChat(pre+'ابدأ درسًا منظمًا من المستوى ده: 8 كلمات مفيدة و5 جمل أمثلة وقاعدة قصيرة ثم تمرين بسيط، واستنى إجابتي قبل التصحيح.');
 if(kind==='quiz')toChat(pre+'اعملي اختبارًا تفاعليًا من خمس أسئلة مناسبة للمستوى، سؤال واحد في كل مرة، واستنى الإجابة وصححها واجمع الدرجة في الآخر.');
 if(kind==='chat')toChat(pre+'ابدأ محادثة باللغة الهدف معايا، جملة واحدة أو سؤال واحد كل مرة، واستنى ردي، وبعده صحح أخطائي وفسر المعنى بالعربية المختصرة.');
}
for(const [action,kind] of [['lang-lesson','lesson'],['lang-quiz','quiz'],['lang-chat','chat']]){
 dlg.querySelector('[data-studio-action="'+action+'"]')?.addEventListener('click',()=>languageTask(kind));
}
dlg.querySelector('[data-studio-action="lang-speak"]')?.addEventListener('click',()=>{
 const lang=selectedLanguage();if(!lang)return;
 const phrase=$('studioPronounce').value.trim();
 if(!phrase)return say('اكتب الجملة اللي عايز تسمع نطقها الأول.',true);
 const code=voiceLanguage(lang);
 if(code==='auto')say('اللغة دي ممكن ما يكونش ليها صوت على جهازك. هيتم استخدام الصوت المتاح.',false);
 window.MADAR_FEATURES?.speak(phrase);
});
dlg.querySelector('[data-studio-action="lang-mic"]')?.addEventListener('click',()=>{
 const lang=selectedLanguage();if(!lang)return;
 voiceLanguage(lang);
 hide();
 window.MADAR_APP?.setDraft('');
 $('madarMicBtn')?.click();
});
dlg.querySelector('[data-studio-action="study-photo"]')?.addEventListener('click',()=>{
 hide();window.MADAR_APP?.setDraft('اشرح المسألة الموجودة في الصورة خطوة بخطوة، واقرأ السؤال بدقة قبل الحل.');
 $('photoInput')?.click();
});
dlg.querySelector('[data-studio-action="game"]')?.addEventListener('click',()=>{
 const t=game.value.trim();if(t.length<6)return say('اوصف اللعبة الأول.',true);
 promptToBuilder('اعمل لعبة قابلة للعب: '+t,'game');
});
dlg.querySelector('[data-studio-action="design"]')?.addEventListener('click',()=>{
 const t=design.value.trim();if(t.length<4)return say('اوصف التصميم الأول.',true);
 promptToImage(t);
});
dlg.querySelectorAll('[data-studio-example]').forEach(b=>b.addEventListener('click',()=>{
 const target=$(b.dataset.studioTarget);
 if(target){target.value=b.dataset.studioExample||'';target.focus();}
}));
dlg.querySelector('[data-studio-action="code-sample"]')?.addEventListener('click',()=>{
 $('studioHtml').value='<button id="hello">اضغط هنا</button><p id="out"></p>';
 $('studioCss').value='button { background: purple; color: white; padding: 12px; }';
 $('studioJs').value='document.getElementById("helloo").addEventListener("click",()=>{document.getElementById("out").textContent="تم!";});';
 $('studioProblem').value='الزرار مش بيشتغل لأن JavaScript فيه اسم ID غلط، أصلحه.';
 say('جهزت مثال بكود فيه مشكلة للتجربة.');
});
window.MADAR_STUDIO={open};
})();
