'use strict';
// Generic text-to-image intent planner. A brief semantic pass avoids brittle subject keywords.
const recent=new Map();
function send(res,code,obj){return res.status(code).json(obj);}
function clean(text){return String(text||'').trim().slice(0,900);}
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='POST')return send(res,405,{error:'Use POST'});
 if(req.headers.origin){
  try{if(new URL(req.headers.origin).host!==req.headers.host)return send(res,403,{error:'Origin denied'});}
  catch{return send(res,403,{error:'Invalid origin'});}
 }
 if(!String(req.headers['content-type']||'').startsWith('application/json'))return send(res,415,{error:'JSON required'});
 const prompt=clean(req.body?.prompt),editing=req.body?.editing===true;
 if(prompt.length<3)return send(res,400,{error:'Describe the image'});
 const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0];
 const now=Date.now(),last=recent.get(ip);
 const counter=last&&now-last.since<60000?last:{since:now,count:0};
 if(counter.count>=15)return send(res,429,{error:'Try again shortly'});
 counter.count++;recent.set(ip,counter);
 if(recent.size>500)for(const [id,val] of recent)if(now-val.since>60000)recent.delete(id);
 const apiKey=process.env.GEMINI_API_KEY;
 if(!apiKey)return send(res,503,{error:'Planning unavailable'});
 const instruction=[
  'You are an expert text-to-image visual request interpreter for a multilingual image generation service.',
  'Return ONE JSON object: {"action":"generate","prompt":"..."} OR {"action":"clarify","question":"..."}; nothing else.',
  'Never replace the requested subject with a similar word. Interpret Arabic and English correctly.',
  'Preserve the actual requested subject, counts, colors, negatives ("مش","بدون","من غير","not","without"), accessories, text, style, setting, layout, viewpoints and all other constraints.',
  'In generate prompt, restate every constraint clearly as a concrete visual brief in English, and preserve Arabic text verbatim when the user requests words inside the picture.',
  'If a user requests an actual existing episode, copyrighted film frame or real named location photo, do not invent a verified real photo. Your prompt may describe an original illustration unless prohibited by policy.',
  'Ask exactly ONE concise question in the user’s language only if a missing fact makes the central subject genuinely ambiguous (e.g. bare حلقات could refer to earrings, television episodes or lessons).',
  'Do not ask about optional artistic details: choose reasonable defaults. Generate directly for all clear requests.',
  'For editing, never ask a question: use the supplied image and preserve unrequested content.',
  'This is interpretation, not rendering; do not add unrelated themes or subjects.',
  'The generated prompt must start with the core positive subject and list any exclusions separately. Maximum 2600 characters.'
 ].join('\n');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6500);
 try{
  const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent',{
   method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},signal:controller.signal,
   body:JSON.stringify({
    systemInstruction:{parts:[{text:instruction}]},
    contents:[{role:'user',parts:[{text:'Image request ('+(editing?'edit':'generate')+'):\n'+prompt}]}],
    generationConfig:{responseMimeType:'application/json',temperature:0.2,maxOutputTokens:900}
   })
  });
  if(!response.ok)return send(res,503,{error:'Semantic planner busy'});
  const payload=await response.json();
  const raw=(payload?.candidates?.[0]?.content?.parts||[]).map(x=>x?.text||'').join('').trim();
  const result=JSON.parse(raw);
  if(!editing&&result?.action==='clarify'&&typeof result.question==='string'&&result.question.length>=7)
   return send(res,200,{action:'clarify',question:result.question.slice(0,240)});
  if(result?.action==='generate'&&typeof result.prompt==='string'&&result.prompt.length>=20)
   return send(res,200,{action:'generate',prompt:result.prompt.slice(0,3800)});
  return send(res,503,{error:'Planner result incomplete'});
 }catch(err){return send(res,503,{error:'Planner temporarily unavailable'});}
 finally{clearTimeout(timer);}
};
