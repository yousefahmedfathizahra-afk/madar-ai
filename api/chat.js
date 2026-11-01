'use strict';
// MADAR PRO DESIGN PREVIEW ONLY: this branch is not the production site.
// Proxy Free plan messages to MADAR's existing public chat endpoint. This
// preview has no API secrets and does not grant PRO access or charge anyone.
const UPSTREAM='https://madar-ai-yousef.vercel.app/api/chat';
const WINDOW_MS=15*60*1000;
const MAX_REQUESTS=8;
const counters=new Map();
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='POST')return res.status(405).json({error:'Use POST for chat.'});
 const origin=String(req.headers.origin||'');
 const host=String(req.headers.host||'');
 // Browsers may call only from this preview's own origin.
 if(origin&&origin!=='https://'+host)return res.status(403).json({error:'Cross-origin requests are disabled.'});
 const size=Number(req.headers['content-length']||0);
 if(size>2800000)return res.status(413).json({error:'Message is too large.'});
 const body=req.body;
 if(!body||typeof body!=='object'||!Array.isArray(body.messages)
   ||body.messages.length<1||body.messages.length>18
   ||body.messages.some(m=>!m||!['user','assistant'].includes(m.role)||typeof m.content!=='string'||m.content.length>5000)
   ||body.messages.reduce((n,m)=>n+m.content.length,0)>16000
   ||body.mode!=='chat'
   ||(body.image!=null&&(typeof body.image!=='object'||!['image/jpeg','image/png','image/webp'].includes(body.image.mimeType)||typeof body.image.data!=='string'||body.image.data.length>2100000))
 )return res.status(400).json({error:'Invalid chat input.'});
 const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim().slice(0,64);
 const now=Date.now();let entry=counters.get(ip);
 if(!entry||now-entry.start>=WINDOW_MS)entry={start:now,count:0};
 if(entry.count>=MAX_REQUESTS)return res.status(429).json({error:'معاينة مدار وصلت للحد المؤقت للرسائل. جرّب بعد شوية.'});
 entry.count++;counters.set(ip,entry);
 if(counters.size>300)for(const [key,value] of counters)if(now-value.start>=WINDOW_MS)counters.delete(key);
 const controller=new AbortController();const t=setTimeout(()=>controller.abort(),33000);
 try{
  const response=await fetch(UPSTREAM,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},
   body:JSON.stringify({messages:body.messages,mode:'chat',image:body.image||undefined}),signal:controller.signal,redirect:'error'});
  const data=await response.json().catch(()=>null);
  if(!data||typeof data!=='object')return res.status(502).json({error:'خدمة مدار رجّعت رد غير متوقع.'});
  if(!response.ok)return res.status(response.status>=400&&response.status<600?response.status:502).json({error:typeof data.error==='string'?data.error:'تعذّر الرد من مدار.'});
  if(typeof data.reply!=='string')return res.status(502).json({error:'رد غير مكتمل من مدار.'});
  return res.status(200).json({reply:data.reply,sources:Array.isArray(data.sources)?data.sources.slice(0,5):[]});
 }catch(e){
  return res.status(503).json({error:e?.name==='AbortError'?'انتهت مهلة الرد. جرّب مرة تانية.':'تعذّر الاتصال بمساعد مدار دلوقتي.'});
 }finally{clearTimeout(t);}
};
