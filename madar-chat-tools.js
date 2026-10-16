/* MADAR chat actions — "اعمل صورة" / "اعمل لعبة" with no mode/button selection.
 * Explicit intent recognition only; ordinary questions stay with Gemini chat.
 * Chat attachments are displayed safely; projects saved on user's device (not chat cloud).
 */
(function(){
'use strict';
const PROJECTS_KEY='madar_chat_projects_v1';
const MAX_PROJECTS=4;
const projects=new Map(),pictures=new Map();
function normalize(text){
 return String(text||'').normalize('NFKC').toLowerCase()
 .replace(/[\u064b-\u065f\u0670]/g,'').replace(/[ـ]/g,'')
 .replace(/\s+/g,' ').trim();
}
function detect(input){
 const text=normalize(input);
 if(!text||text.length>1200)return null;
 // Learning HOW to make a game is a question, not a request to build it.
 if(/^(?:ازاي|إزاي|كيف|طريقة|علمني|علمنى|اشرح|how (?:do|can|to)|tutorial|teach me)\s/.test(text))return null;
 const arabicRequest=/(?:^|[\s،.!؟])(?:اعمللي|اعمل لي|اعملي|اعمل|انشئ|أنشئ|اصنع|صمم|سوي|سوى|هات|عايزة|عايز|محتاج|ممكن\s+تعملي|ممكن\s+تعمل|ممكن\s+تصمم|ابنيل[يي]|ابني)\s*(?:لي|لنا|لينا)?\s*/;
 const ar=arabicRequest.exec(text);
 const en=/\b(?:make|create|build|generate|design|draw)\s+(?:me\s+)?(?:(?:a|an|some)\s+)?/i.exec(text);
 let tail=(ar?text.slice(ar.index+ar[0].length):en?text.slice(en.index+en[0].length):'').trim();
 const directDraw=/^(?:ارسم|ارسمي|ارسملي|ارسم لي|رسملي|طلّع لي|طلعلي)\s+/.exec(text);
 if(directDraw)return{type:'image',prompt:text.slice(directDraw[0].length).trim()||text};
 const directGenerate=/^(?:ولّد|ولد|توليد|generate)\s+(?:لي\s+)?(?:صورة|صوره|image|picture|photo)\s*/.exec(text);
 if(directGenerate)return{type:'image',prompt:text.slice(directGenerate[0].length).trim()||text};
 if(!tail)return null;
 // Explicit creation commands only. Do not hijack normal photo analysis.
 const targets=[
  {type:'image',regex:/^(?:صورة|صوره|صور|رسمة|رسمه|لوحة|image|picture|photo|drawing|artwork)(?=\s|$)/},
  {type:'builder',kind:'game',regex:/^(?:لعبة|لعبه|العاب|ألعاب|game|video game|3d game)(?=\s|$)/},
  {type:'builder',kind:'website',regex:/^(?:موقع|موقع ويب|صفحة ويب|ويب سايت|website|web\s?site|webpage|landing page)(?=\s|$)/},
  {type:'builder',kind:'tool',regex:/^(?:تطبيق|ابلكيشن|أداة|اداة|app|application|tool)(?=\s|$)/}
 ];
 for(const t of targets){
  const match=tail.match(t.regex);
  if(match){
   const content=tail.slice(match[0].length).trim().replace(/^(?:ل|عن|فيه|في|of|for)\s+/,'');
   if(t.type==='image')return{type:'image',prompt:content.length>=3?content:text};
   return{type:'builder',kind:t.kind,prompt:text};
  }
 }
 return null;
}
function restore(){
 try{
  const data=JSON.parse(localStorage.getItem(PROJECTS_KEY)||'[]');
  if(Array.isArray(data))for(const x of data.slice(0,MAX_PROJECTS)){
   if(typeof x?.id==='string'&&window.MADAR_BUILDER?.validProject(x.project))projects.set(x.id,x.project);
  }
 }catch{}
}
function cacheProject(project){
 const id=globalThis.crypto?.randomUUID?.()||Date.now()+'-'+Math.random().toString(36).slice(2);
 projects.set(id,project);
 while(projects.size>MAX_PROJECTS)projects.delete(projects.keys().next().value);
 try{localStorage.setItem(PROJECTS_KEY,JSON.stringify([...projects].map(([key,p])=>({id:key,project:p}))));}catch{}
 return id;
}
async function run(request,options={}){
 if(request?.type==='image'){
  const maker=window.MADAR_IMAGE_STUDIO;
  if(!maker?.generateFromChat)throw Error('خدمة الصور مش جاهزة. حدّث الصفحة وجرب تاني.');
  const source=await maker.generateFromChat(request.prompt);
  const id=globalThis.crypto?.randomUUID?.()||Date.now()+'-'+Math.random().toString(36).slice(2);
  pictures.set(id,source);
  return{toolType:'image',toolKey:id,content:'🎨 خلصت الصورة! هتلاقيها هنا تحت. تقدر تحفظها على جهازك. (الصور مش بتتحفظ في سجل الشات بعد إعادة فتح الصفحة.)'};
 }
 if(request?.type==='builder'){
  const result=await fetch('/api/builder',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({prompt:request.prompt,kind:request.kind,graphics:request.kind==='game'?'realistic':'standard'}),
   signal:options.signal
  });
  const payload=await result.json().catch(()=>null);
  if(!result.ok)throw Error(String(payload?.error||'تعذر بناء المشروع. حاول تاني.').slice(0,300));
  const project=payload?.project;
  if(!window.MADAR_BUILDER?.validProject(project))throw Error('الذكاء الاصطناعي رجّع مشروع ناقص. حاول تاني.');
  const id=cacheProject(project);
  const what=request.kind==='game'?'اللعبة':request.kind==='website'?'الموقع':'التطبيق';
  return{toolType:'builder',toolKey:id,content:'🎮 جاهز! مدار بنى '+what+' **'+project.title+'**. تقدر تجرّبه مباشرة تحت، وتحفظه كملف HTML. '+(project.explanation||'')};
 }
 throw Error('نوع الطلب غير معروف.');
}
function element(tag,cls,text){
 const node=document.createElement(tag);if(cls)node.className=cls;
 if(text!==undefined)node.textContent=text;return node;
}
function render(message,body){
 if(message?.toolType==='image'){
  const src=pictures.get(message.toolKey);
  if(!src){
   body.append(element('p','madar-tool-note','الصورة اتعملت قبل كده، لكن مش متخزنة بعد تحديث الصفحة. ابعت وصفها تاني عشان مدار يعملها من جديد.'));return;
  }
  const holder=element('div','madar-chat-image-wrap');
  const img=element('img','madar-chat-image');
  img.src=src;img.alt='الصورة اللي أنشأها مدار';
  img.loading='lazy';
  holder.append(img);
  const action=element('a','madar-chat-action',src.startsWith('data:')||src.startsWith('blob:')?'⬇ حفظ الصورة':'↗ افتح الصورة واحفظها');
  action.href=src;action.rel='noopener noreferrer';
  if(src.startsWith('data:')||src.startsWith('blob:'))action.download='MADAR-AI.png';else action.target='_blank';
  holder.append(action);body.append(holder);
  return;
 }
 if(message?.toolType==='builder'){
  const project=projects.get(message.toolKey);
  if(!project){
   body.append(element('p','madar-tool-note','المشروع متاح على الجهاز اللي اتعمل عليه فقط، وممكن يكون اتشال من ذاكرة المتصفح. ابعت الطلب تاني عشان مدار يعمله.'));return;
  }
  const card=element('section','madar-chat-project');
  const header=element('div','madar-chat-project-title','🎮 '+project.title);
  const frame=element('iframe','madar-chat-game-frame');
  frame.title='مشروع بناه MADAR: '+project.title;
  frame.setAttribute('sandbox','allow-scripts');
  frame.setAttribute('referrerpolicy','no-referrer');
  frame.setAttribute('loading','lazy');
  frame.srcdoc=window.MADAR_BUILDER.standalone(project);
  const actions=element('div','madar-chat-tool-actions');
  const save=element('button','madar-chat-action','⬇ تنزيل المشروع');
  save.type='button';
  save.addEventListener('click',()=>{
   try{window.MADAR_BUILDER.downloadProject(project);}
   catch{window.MADAR_APP?.notice('تعذر تنزيل المشروع. جرب تاني.');}
  });
  const edit=element('button','madar-chat-action madar-chat-action-secondary','✏️ تعديل اللعبة');
  edit.type='button';
  edit.addEventListener('click',()=>{
   window.MADAR_BUILDER?.setProject(project);
   window.MADAR_BUILDER?.open();
  });
  actions.append(save,edit);
  card.append(header,frame,actions);
  const disclaimer=element('p','madar-tool-note','اللعبة شغالة في إطار آمن؛ اضغط داخلها للتحكم. ممكن تحتاج تعديلات لو Gemini رجّع كود مش مكتمل.');
  card.append(disclaimer);
  body.append(card);
 }
}
restore();
window.MADAR_CHAT_TOOLS={detect,run,render};
})();