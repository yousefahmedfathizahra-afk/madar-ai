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
  .replace(/[\u064b-\u065f\u0670]/g,'').replace(/ـ/g,'')
  .replace(/[إأآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه')
  .replace(/\s+/g,' ').trim();
}
// Natural Egyptian-Arabic wishes and English requests are creation intents.
// Only act on an identifiable requested output, otherwise keep normal chat.
function detect(input,history=[]){
 const raw=String(input||'').trim(),text=normalize(raw);
 if(!text||text.length>1200)return null;
 const how=/^(?:(?:يا مدار|مدار|لو سمحت|بص|انا|ممكن|هو|هي|ايه|يعني)\s+){0,4}(?:ازاي|كيف|اشرح(?:لي)?|علمني|طريقه|خطوات|ليه|ايه|why|what|how|teach|explain)\s+/;
 const studying=/(?:عايز|عاوز|اريد|i want|i need)\s+(?:اعرف|اتعلم|افهم|شرح|طريقه|معلومات|to learn|to know|to understand)\s+/;
 const negation=/(?:مش عايز|مش عاوز|لا اريد|متعملش|ما تعملش|don't (?:make|create)|do not (?:make|create))/;
 if(how.test(text)||studying.test(text)||negation.test(text))return null;
 const wants=/(?:^|[\s،.!؟:])(?:اعمل(?:لي|نا|ي)?|اصنع(?:لي)?|انشئ|سوي|صمم(?:لي)?|ارسم(?:لي|ي)?|هات|طلع(?:لي)?|ابني(?:لي)?|عايز(?:ه|ها|ك|ره)?|عاوز(?:ه|ها|ك)?|محتاج(?:ه)?|نفسي\s+في|ياريت|اتمني|اريد|ابغي|ودي\s+ب|ممكن|ينفع|خلينا\s+نعمل|i want|i need|i(?:'d| would) like|i wish|can you|could you|please|make|create|build|generate|design|draw)/;
 const action=wants.exec(text);
 // "ارسملي منظر طبيعي" is clearly a picture request without the noun "صورة".
 const draw=text.match(/^(?:(?:يا مدار|مدار|لو سمحت|بص)s+){0,2}(?:ارسم(?:لي|ي)?|رسملي|draw me)s+(.+)$/);
 if(draw&&!/(?:لعبه|موقع|تطبيق|game|website|app)(?=$|[s،.!؟:])/.test(draw[1]))
  return{type:'image',prompt:draw[1].trim().slice(0,900)};
 const types=[
  {type:'image',re:/(?:^|[\s،:])(?:صوره|صور|رسمه|لوحه|image|picture|photo|drawing|artwork)(?=$|[\s،.!؟:])/g},
  {type:'builder',kind:'game',re:/(?:^|[\s،:])(?:لعبه|العاب|game|video game|3d game)(?=$|[\s،.!؟:])/g},
  {type:'builder',kind:'website',re:/(?:^|[\s،:])(?:موقع|صفحه ويب|ويب سايت|ويبسايت|website|web ?site|webpage|landing page)(?=$|[\s،.!؟:])/g},
  {type:'builder',kind:'tool',re:/(?:^|[\s،:])(?:تطبيق|ابلكيشن|اداه|app|application|tool)(?=$|[\s،.!؟:])/g}
 ];
 let found=null;
 for(const t of types){
  t.re.lastIndex=0;let match;
  while((match=t.re.exec(text))){
   const position=match.index+match[0].length-match[0].trimStart().length;
   if(action){
    if(position<action.index||position-action.index>105)continue;
   }else if(position>12||text.length>180||/^(?:كنت|ده|هي|دي|this|the|what|which)\s/.test(text)||/^(?:السباق|دي|دي جميله|جميله|حلوه|كويسه)/.test(text.slice(position+match[0].trim().length).trim()))continue;
   if(!found||position<found.position)found={type:t.type,kind:t.kind,position,word:match[0].trim()};
   break;
  }
 }
 if(found){
  const details=text.slice(found.position+found.word.length).replace(/^[\s،:.!؟]+/,'').trim();
  const before=action?text.slice(action.index+action[0].length,found.position).replace(/(?:a|an|the|some|of|for|me)/g,'').trim():'';
  const specified=details.length>=2||before.length>=3;
  if(!specified||(!before&&/^(?:حلوه|كويسه|جديده|جميله|واقعيه|3d|ثلاثيه الابعاد|بقي)\s*[.!؟]*$/.test(details)))
   return{type:'clarify',kind:found.type==='image'?'image':found.kind};
  if(found.type==='image')return{type:'image',prompt:(action?text.slice(action.index+action[0].length):text).trim().slice(0,900)};
  return{type:'builder',kind:found.kind,prompt:raw};
 }
 const last=Array.isArray(history)?[...history].reverse().find(m=>m?.role==='assistant'&&
  ['builder','image'].includes(m.toolType)&&typeof m.toolKey==='string'):null;
 const adjust=/^(?:(?:لا|بس|طب|طيب|معلش|انا|يا مدار)\s+){0,3}(?:خلي(?:ه|ها)?|عايز(?:ه|ها)?|عاوز(?:ه|ها)?|نفسي|غير|عدل|حسن|طور|زود|ضيف|شيل|كبر|صغر|بدل|بلاش|مش|make it|change|improve|update|add|remove|more)\s+/;
 if(last&&adjust.test(text)&&text.length>=7)
  return{type:'refine',kind:last.toolType,toolKey:last.toolKey,prompt:raw};
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