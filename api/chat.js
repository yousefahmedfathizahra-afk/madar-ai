'use strict';
// MADAR: free-tier Gemini AI endpoint. Uses only GEMINI_API_KEY from server environment.
// OPENAI_API_KEY is deliberately not used: this route never charges OpenAI.
const SYSTEM = 'You are MADAR, a reliable, helpful and friendly AI assistant. Respond in English by default. When the user writes in another language, respond in their language. Be clear and accurate, admit uncertainty, and never claim to have tools or internet access you do not have. Never expose secrets.';
const counters=new Map();
const MODEL='gemini-2.5-flash-lite';
function send(res,status,body){return res.status(status).json(body);}
module.exports=async function chat(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  if(req.method!=='POST')return send(res,405,{error:'Method not allowed'});
  const origin=req.headers.origin;
  if(origin){
    try{if(new URL(origin).host!==req.headers.host)return send(res,403,{error:'Origin denied.'});}
    catch{return send(res,403,{error:'Invalid origin.'});}
  }
  const key=process.env.GEMINI_API_KEY;
  if(!key)return send(res,503,{error:'Free AI key missing. Create a free Gemini API key in Google AI Studio, add it to Vercel as GEMINI_API_KEY for Production, then redeploy.'});
  if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))
    return send(res,415,{error:'Content-Type must be application/json.'});
  let data=req.body;
  if(typeof data==='string'){try{data=JSON.parse(data);}catch{return send(res,400,{error:'Invalid JSON request.'});}}
  if(!data||typeof data!=='object')return send(res,400,{error:'Invalid JSON request.'});
  const messages=data.messages;
  if(!Array.isArray(messages)||messages.length<1||messages.length>18||messages.at(-1)?.role!=='user'
  ||messages.some(x=>!x||!['user','assistant'].includes(x.role)||typeof x.content!=='string'||!x.content.trim()||x.content.length>5000)
  ||messages.reduce((n,m)=>n+m.content.length,0)>16000)
    return send(res,400,{error:'Invalid conversation or message too long.'});
  const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
  const now=Date.now();
  let entry=counters.get(ip);
  if(!entry||now-entry.start>=15*60*1000)entry={start:now,count:0};
  if(entry.count>=16)return send(res,429,{error:'MADAR free demo: temporary request limit reached. Try again later.'});
  entry.count++;counters.set(ip,entry);
  if(counters.size>1000)for(const [addr,v]of counters)if(now-v.start>=15*60*1000)counters.delete(addr);
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),25000);
  try{
    const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+MODEL+':generateContent',{
      method:'POST',
      headers:{'x-goog-api-key':key,'Content-Type':'application/json'},
      body:JSON.stringify({
        systemInstruction:{parts:[{text:SYSTEM}]},
        contents:messages.map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.content}]})),
        generationConfig:{maxOutputTokens:1200,temperature:0.7}
      }),
      signal:ctrl.signal
    });
    const answer=await response.json().catch(()=>({}));
    if(!response.ok){
      const code=String(answer?.error?.status||'');
      if(response.status===429||code==='RESOURCE_EXHAUSTED')
        return send(res,429,{error:'Gemini free usage limit reached for now. Try again after the limit resets.'});
      if(response.status===401||response.status===403)
        return send(res,502,{error:'Gemini API key was rejected or free tier is unavailable for this account. Check Google AI Studio.'});
      if(response.status===404)
        return send(res,502,{error:'Gemini free model is unavailable for this account.'});
      if(response.status===400)
        return send(res,502,{error:'Gemini refused the request. Check the API key and model availability.'});
      console.error('Gemini upstream error',response.status,code.slice(0,40));
      return send(res,502,{error:'Free AI server is temporarily unavailable.'});
    }
    const reply=(answer?.candidates?.[0]?.content?.parts||[]).filter(p=>typeof p?.text==='string').map(p=>p.text).join('\n').trim();
    if(!reply)return send(res,422,{error:'Gemini returned no text for this request. Try rephrasing your question.'});
    return send(res,200,{reply});
  }catch(err){
    if(err?.name==='AbortError')return send(res,504,{error:'Free AI timed out. Please try again.'});
    console.error('Gemini network failure',err?.name);
    return send(res,502,{error:'Cannot connect to Gemini right now.'});
  }finally{clearTimeout(timer);}
};
