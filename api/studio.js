'use strict';
// Server-only Gemini tools for MADAR Creative Studio; never evaluate input code.
const models=['gemini-2.5-flash','gemini-3.1-flash-lite','gemini-2.5-flash-lite'];
const rate=new Map();
function reply(res,status,value){return res.status(status).json(value)}
function planFallback(idea){
 const brand=(String(idea).match(/(?:اسمه|اسمها|باسم|اسم المشروع)\s*([^،.!؟\n]{2,40})/)||[])[1]?.trim()||'مشروعي الجديد';
 return {title:brand,tagline:'انطلق بفكرتك',features:['الصفحة الرئيسية','قسم المنتجات أو الخدمات','تصميم متجاوب للموبايل','نموذج تواصل تجريبي','قسم الأسئلة الشائعة'],
 sitePrompt:'اعمل موقع عربي احترافي لمشروع '+idea.slice(0,800)+' فيه أقسام وصفحات متعددة وتصميم متجاوب وعناصر تفاعلية تجريبية، مع توضيح عدم وجود دفع أو تسجيل دخول حقيقي.',
 logoPrompt:'شعار عصري احترافي أصلي لمشروع '+brand+' يناسب نشاطه، بخلفية بسيطة وألوان متناغمة',
 socialPost:'🚀 قريبًا! إطلاق '+brand+' — تابعونا للمزيد.',
 marketingCopy:'اكتشف '+brand+'، تجربة بتصميم حديث تساعدك تحقق هدفك.',brandColors:['#7254d8','#171526']};
}
function validatePack(p){return p&&typeof p==='object'&&['title','tagline','sitePrompt','logoPrompt','socialPost','marketingCopy'].every(k=>typeof p[k]==='string'&&p[k].length>=4)&&Array.isArray(p.features)&&p.features.length>=3;}
function validateProject(p){return p&&typeof p==='object'&&['title','html','css','js','explanation'].every(k=>typeof p[k]==='string')
 &&p.html.length>=15&&p.html.length<=22000&&p.css.length<=20000&&p.js.length<=26000&&p.title.length<=110&&p.explanation.length<=800;}
// Lightweight deterministic repair for a frequent real-world bug: a JS
// getElementById reference has a typo relative to the IDs in HTML.
// Never execute submitted scripts or invent guessed fixes with ambiguity.
function typoDistance(a,b){
 const n=a.length,m=b.length;if(Math.abs(n-m)>2||n>70||m>70)return 99;
 let row=Array.from({length:m+1},(_,i)=>i);
 for(let i=1;i<=n;i++){const next=[i];for(let j=1;j<=m;j++)next[j]=Math.min(row[j]+1,next[j-1]+1,row[j-1]+(a[i-1]===b[j-1]?0:1));row=next;}
 return row[m];
}
function simpleDomRepair(source){
 const ids=[...new Set([...source.html.matchAll(/\bid\s*=\s*["']([A-Za-z][\w-]{0,60})["']/g)].map(m=>m[1]))];
 if(!ids.length||ids.length>80||source.js.length<15)return null;
 let changes=[],result=source.js;
 result=result.replace(/getElementById\s*\(\s*(["'])([^"']{1,70})\1\s*\)/g,(original,quote,name)=>{
  if(ids.includes(name))return original;
  const options=ids.filter(id=>typoDistance(name,id)<=2);
  if(options.length!==1)return original;
  changes.push([name,options[0]]);
  return 'getElementById('+quote+options[0]+quote+')';
 });
 if(!changes.length)return null;
 return {title:'إصلاح ربط عناصر الصفحة',html:source.html,css:source.css,js:result,
  explanation:'تم تصحيح اسم العنصر في JavaScript ليتطابق مع ID الموجود في HTML: '+changes.map(x=>x[0]+' ← '+x[1]).join('، ')+'. ده إصلاح موضعي آلي؛ راجع باقي الوظائف وجرب المعاينة قبل النشر.'};
}
function jsonText(raw){const s=String(raw||'').trim();try{return JSON.parse(s)}catch{const a=s.indexOf('{'),b=s.lastIndexOf('}');if(a<0||b<a)throw Error('JSON');return JSON.parse(s.slice(a,b+1))}}
async function modelCall(key,instructions,message,deadline){
 const control=new AbortController(),clock=setTimeout(()=>control.abort(),deadline);
 try{
  for(const model of models){
   try{
    const res=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent',{
     method:'POST',signal:control.signal,headers:{'Content-Type':'application/json','x-goog-api-key':key},
     body:JSON.stringify({systemInstruction:{parts:[{text:instructions}]},contents:[{role:'user',parts:[{text:message}]}],
     generationConfig:{responseMimeType:'application/json',temperature:0.4,maxOutputTokens:10000,...(model.startsWith('gemini-2.5-')?{thinkingConfig:{thinkingBudget:0}}:{})}})});
    if(res.status===429||res.status===401||res.status===403)return null;
    if(!res.ok)continue;
    const data=await res.json().catch(()=>null),parts=data?.candidates?.[0]?.content?.parts||[];
    const s=parts.filter(x=>typeof x.text==='string').map(x=>x.text).join('\n');
    if(s)return jsonText(s);
   }catch(e){if(control.signal.aborted)break;}
  }
 }finally{clearTimeout(clock)}
 return null;
}
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='POST')return reply(res,405,{error:'POST only'});
 if(!/^application\/json\b/i.test(String(req.headers?.['content-type']||'')))return reply(res,415,{error:'JSON required'});
 if(req.headers?.origin){try{if(new URL(req.headers.origin).host!==req.headers.host)return reply(res,403,{error:'Origin denied'});}catch{return reply(res,403,{error:'Invalid origin'})}}
 let b=req.body;if(typeof b==='string'){try{b=JSON.parse(b)}catch{return reply(res,400,{error:'Invalid JSON'})}}
 if(!b||typeof b!=='object'||!['project','repair'].includes(b.action))return reply(res,400,{error:'Unknown action'});
 const ip=String(req.headers?.['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0];
 const now=Date.now(),prior=rate.get(ip);const entry=prior&&now-prior.at<900000?prior:{at:now,n:0};
 if(entry.n>=7)return reply(res,429,{error:'وصلت لحد الطلبات المؤقت. حاول بعد شوية'});
 entry.n++;rate.set(ip,entry);if(rate.size>500)for(const [ip,v] of rate)if(now-v.at>900000)rate.delete(ip);
 const key=process.env.GEMINI_API_KEY;
 if(b.action==='project'){
  const idea=typeof b.idea==='string'?b.idea.trim():'';
  if(idea.length<10||idea.length>1300)return reply(res,400,{error:'اكتب وصف مشروع من 10 إلى 1300 حرف'});
  const fallback=planFallback(idea);
  if(!key)return reply(res,200,{pack:fallback,demo:true});
  try{
   const pack=await modelCall(key,'You are MADAR Creative Studio. Return ONLY JSON fields title, tagline, features (4-6 practical short strings), sitePrompt (detailed instructions to build a responsive multi-view frontend demo), logoPrompt, socialPost, marketingCopy, brandColors (two hex strings). Respond in the idea language. Be specific to this idea, catchy and useful, without promising real payments, accounts, registered business or deployed website.',idea,11000);
   if(!validatePack(pack))return reply(res,200,{pack:fallback,demo:true});
   return reply(res,200,{demo:false,pack:{
    title:pack.title.slice(0,100),tagline:pack.tagline.slice(0,220),features:pack.features.filter(x=>typeof x==='string').slice(0,6).map(x=>x.slice(0,170)),
    sitePrompt:pack.sitePrompt.slice(0,1300),logoPrompt:pack.logoPrompt.slice(0,900),
    socialPost:pack.socialPost.slice(0,1200),marketingCopy:pack.marketingCopy.slice(0,1200),
    brandColors:Array.isArray(pack.brandColors)?pack.brandColors.filter(x=>/^#[a-f0-9]{6}$/i.test(x)).slice(0,2):[]
   }});
  }catch{return reply(res,200,{pack:fallback,demo:true})}
 }
 const source={};
 for(const k of ['html','css','js']){if(typeof b[k]!=='string'||b[k].length>11000)return reply(res,400,{error:'كود '+k+' كبير جدًا'});source[k]=b[k]}
 const problem=typeof b.problem==='string'?b.problem.trim():'';
 if(problem.length>1000||Object.values(source).join('').trim().length<20)return reply(res,400,{error:'الصق كودًا يصلح لفحصه وسبب المشكلة (اختياري)'});
 const direct=simpleDomRepair(source);
 if(direct)return reply(res,200,{project:direct,automatic:true});
 if(!key)return reply(res,503,{error:'خدمة إصلاح الأكواد غير مهيأة'});
 try{
  const project=await modelCall(key,'You are MADAR Code Repair. Fix the provided HTML, CSS and browser JavaScript with minimal changes preserving the intended design and features. Output ONLY JSON strings title, html, css, js, explanation. HTML contains body markup ONLY, CSS is a stylesheet and JS runnable browser code. Never import third-party libraries, make network requests, add iframes, collect secrets, or produce dangerous code. For missing input fields produce safe minimal corresponding strings. Describe actual changes and uncertainty in explanation; do not claim to have tested the code. Keep within 11000 characters per source field.','PROBLEM: '+problem+'\nHTML:\n'+source.html+'\nCSS:\n'+source.css+'\nJS:\n'+source.js,18000);
  if(!validateProject(project))return reply(res,502,{error:'مدار ما قدرش يرجع إصلاح كامل. الكود الأصلي ما اتغيرش. جرّب مقطع أصغر.'});
  return reply(res,200,{project});
 }catch{return reply(res,504,{error:'الإصلاح أخد وقت طويل. جرّب جزء أصغر، والكود الأصلي ما اتغيرش.'})}
};