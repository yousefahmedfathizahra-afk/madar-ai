'use strict';
// MADAR serverless Gemini chat. Does not call OpenAI.
// No preliminary ListModels call: it may hang and consume the browser's whole time budget.
const MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.6-flash'];
const SYSTEM = 'You are MADAR AI. The MADAR website was created by Youssef Ahmed (يوسف أحمد). If anyone asks who created MADAR, tell them the creator is Youssef Ahmed (يوسف أحمد). This does not mean the visitor is Youssef Ahmed: never address someone by that name unless they identify themselves. Answer in the language of the question. MADAR uses the Gemini AI model developed by Google. Be helpful, accurate and respect user privacy.';
const counters = new Map();
function send(res, status, body) { return res.status(status).json(body); }

async function researchWikipedia(question){
 const lang=/[\u0600-\u06FF]/.test(question)?'ar':'en';
 const host='https://'+lang+'.wikipedia.org';
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),6500);
 try{
  const p=new URLSearchParams({action:'query',list:'search',srsearch:question.slice(0,150),srlimit:'3',format:'json'});
  const a=await fetch(host+'/w/api.php?'+p.toString(),{signal:ctrl.signal,headers:{'User-Agent':'MADAR-AI/1.0 (encyclopedia search)'}});
  if(!a.ok)throw Error('Wikipedia lookup failed');
  const j=await a.json();
  const pages=(j?.query?.search||[]).filter(p=>Number.isInteger(p.pageid)&&typeof p.title==='string').slice(0,3);
  if(!pages.length)return[];
  const q=new URLSearchParams({action:'query',prop:'extracts',exintro:'1',explaintext:'1',exchars:'650',pageids:pages.map(x=>x.pageid).join('|'),format:'json'});
  const b=await fetch(host+'/w/api.php?'+q.toString(),{signal:ctrl.signal,headers:{'User-Agent':'MADAR-AI/1.0 (encyclopedia search)'}});
  if(!b.ok)throw Error('Wikipedia extract failed');
  const d=await b.json();
  return pages.map(p=>({title:p.title.slice(0,140),url:host+'/?curid='+p.pageid,extract:String(d?.query?.pages?.[p.pageid]?.extract||'').slice(0,800)})).filter(x=>x.extract);
 } finally{clearTimeout(timer);}
}

module.exports = async function chat(req,res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  if (req.method !== 'POST') return send(res,405,{error:'Method not allowed'});
  if (req.headers.origin) {
    try {
      if (new URL(req.headers.origin).host !== req.headers.host)
        return send(res,403,{error:'Origin denied.'});
    } catch { return send(res,403,{error:'Invalid origin.'}); }
  }
  const key = process.env.GEMINI_API_KEY;
  if (!key) return send(res,503,{error:'Gemini key is missing on the server. Add GEMINI_API_KEY in Vercel Production and redeploy.'});
  if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json'))
    return send(res,415,{error:'Content-Type must be application/json.'});
  let data=req.body;
  if (typeof data === 'string') {
    try { data=JSON.parse(data); }
    catch { return send(res,400,{error:'Invalid JSON request.'}); }
  }
  const messages=data?.messages;
  if (!Array.isArray(messages) || messages.length<1 || messages.length>18
    || messages[messages.length-1]?.role!=='user'
    || messages.some(m=>!m || !['user','assistant'].includes(m.role)
      || typeof m.content!=='string' || !m.content.trim() || m.content.length>5000)
    || messages.reduce((n,m)=>n+m.content.length,0)>16000)
    return send(res,400,{error:'Invalid conversation or message too long.'});
  const addr=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
  const now=Date.now();
  let entry=counters.get(addr);
  if(!entry || now-entry.start>=900000) entry={start:now,count:0};
  if(entry.count>=16) return send(res,429,{error:'MADAR request limit reached. Try again in a few minutes.'});
  entry.count++; counters.set(addr,entry);
  if(counters.size>1000) for(const [k,e] of counters) if(now-e.start>=900000) counters.delete(k);

  let image=null;
  if(data.image!==undefined){
    const obj=data.image;
    if(!obj||typeof obj!=='object'||!['image/jpeg','image/png','image/webp'].includes(obj.mimeType)
      ||typeof obj.data!=='string'||obj.data.length<24||obj.data.length>2100000
      ||obj.data.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(obj.data))
      return send(res,400,{error:'Invalid image. Upload a JPEG, PNG or WebP image under 1.5 MB.'});
    image=obj;
  }
  let sources=[],sourceNotes='';
  if(data.webSearch===true){
    try{
      sources=await researchWikipedia(messages[messages.length-1].content.trim());
      if(!sources.length)return send(res,404,{error:'No Wikipedia articles found. Try different words or use full web search.'});
      sourceNotes='\n\nWikipedia excerpts. Base your answer on these excerpts. Clearly identify them as Wikipedia sources and cite the URLs:\n'
        +sources.map((s,i)=>'['+(i+1)+'] '+s.title+'\n'+s.url+'\n'+s.extract).join('\n\n');
    }catch(err){
      console.warn('MADAR Wikipedia lookup',err?.name);
      return send(res,502,{error:'Wikipedia research is temporarily unavailable. Turn off Wikipedia research to chat normally.'});
    }
  }
  const controller=new AbortController();
  const started=Date.now();
  // Browser currently times out at 33 seconds. Allow 24 seconds for Google plus overhead.
  const timer=setTimeout(()=>controller.abort(),24000);
  const contents=messages.map((m,i)=>({
    role:m.role==='assistant'?'model':'user',parts:[{text:m.content+(i===messages.length-1?sourceNotes:'')}]
  }));
  if(image)contents[contents.length-1].parts.push({inlineData:{mimeType:image.mimeType,data:image.data}});
  let sawBusy=false;
  try {
    for (const model of MODELS) {
      for (let attempt=0;attempt<2;attempt++) {
      const endpoint='https://generativelanguage.googleapis.com/v1beta/models/'
        +model+':generateContent';
      let response;
      try {
        response=await fetch(endpoint,{
          method:'POST',signal:controller.signal,
          headers:{'x-goog-api-key':key,'Content-Type':'application/json'},
          body:JSON.stringify({
            systemInstruction:{parts:[{text:SYSTEM}]},
            contents,
            generationConfig:{
              maxOutputTokens:1024,
              temperature:0.6,
              thinkingConfig:{thinkingLevel:'minimal'}
            }
          })
        });
      } catch(err) {
        console.error('MADAR Gemini network issue:', model,err?.name,'elapsedMs',Date.now()-started);
        if(controller.signal.aborted || err?.name==='AbortError')
          return send(res,504,{error:'Gemini is not responding quickly enough. The server connection timed out; please try again.'});
        sawBusy=true;
        break; // Try another free model after a network error.
      }
      const answer=await response.json().catch(()=>({}));
      if(response.status===404) {
        console.warn('MADAR Gemini model missing:',model);
        break; // Model not enabled: try the next model.
      }
      if(!response.ok) {
        const upstreamCode=String(answer?.error?.status||'');
        console.warn('MADAR Gemini API status:',response.status,upstreamCode,'model',model);
        if(response.status===429||upstreamCode==='RESOURCE_EXHAUSTED')
          return send(res,429,{error:'Gemini free quota reached for this Google project. Check usage in Google AI Studio.'});
        if(response.status===401||response.status===403)
          return send(res,502,{error:'Gemini API key was rejected or Google restricted this project. Check Google AI Studio.'});
        if(response.status===400)
          return send(res,502,{error:'Gemini could not process this message. Try a simpler question.'});
        if([408,500,502,503,504].includes(response.status)) {
          sawBusy=true;
          if(attempt===0&&!controller.signal.aborted){
            await new Promise(resolve=>setTimeout(resolve,400));
            continue; // Retry one time after a short delay.
          }
          break; // Try the next free-tier model.
        }
        return send(res,502,{error:'The Gemini service returned an error. Try again shortly.'});
      }
      const reply=(answer?.candidates?.[0]?.content?.parts||[])
        .filter(p=>typeof p?.text==='string')
        .map(p=>p.text).join('\n').trim();
      if(!reply)return send(res,422,{error:'Gemini returned no text. Try rephrasing your question.'});
      return send(res,200,{reply,sources:sources.map(({title,url})=>({title,url}))});
      }
    }
    return send(res,sawBusy?503:502,{error:sawBusy?'Gemini is temporarily busy across all tried free models. Please try again later.':'Google has not enabled a compatible free Gemini model for this API key. Check AI Studio access.'});
  } catch(err) {
    console.error('MADAR unexpected Gemini error:',err?.name);
    if(controller.signal.aborted)return send(res,504,{error:'Gemini connection timed out. Please try again.'});
    return send(res,502,{error:'Gemini connection failed. Please try again.'});
  } finally {clearTimeout(timer);}
};
