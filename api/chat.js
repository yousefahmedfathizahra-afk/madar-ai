'use strict';
// MADAR — secure server-side GPT endpoint. Never place API keys in browser code.
const SYSTEM = 'You are MADAR, a reliable, helpful and friendly AI assistant. Respond in English by default. When the user writes in another language, respond in their language. Be clear and accurate, admit uncertainty, and never claim to have tools or internet access you do not have. Never expose secrets.';
const counters=new Map();
function send(res,status,body){return res.status(status).json(body);}
function outputText(data) {
 if(typeof data?.output_text==='string'&&data.output_text.trim())return data.output_text.trim();
 return (data?.output||[]).flatMap(x=>x?.type==='message'?(x.content||[]):[])
 .filter(x=>x?.type==='output_text'&&typeof x.text==='string').map(x=>x.text).join('\n').trim();
}
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
 if(!process.env.OPENAI_API_KEY)return send(res,503,{error:'OpenAI key missing. Add OPENAI_API_KEY to the server environment in Vercel, then redeploy.'});
 if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))
   return send(res,415,{error:'Content-Type must be application/json.'});
 let data=req.body;
 if(typeof data==='string'){try{data=JSON.parse(data)}catch{return send(res,400,{error:'Invalid JSON request.'})}}
 if(!data||typeof data!=='object')return send(res,400,{error:'Invalid JSON request.'});
 const messages=data.messages;
 if(!Array.isArray(messages)||messages.length<1||messages.length>18||messages.at(-1)?.role!=='user'
 ||messages.some(x=>!x||!['user','assistant'].includes(x.role)||typeof x.content!=='string'||!x.content.trim()||x.content.length>5000)
 ||messages.reduce((n,m)=>n+m.content.length,0)>16000)
   return send(res,400,{error:'Invalid conversation or message too long.'});
 const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
 let e=counters.get(ip),now=Date.now();
 if(!e||now-e.start>=15*60*1000)e={start:now,count:0};
 if(e.count>=16)return send(res,429,{error:'Temporary request limit reached. Try again later.'});
 e.count++;counters.set(ip,e);
 if(counters.size>1000)for(const [ip,v]of counters)if(now-v.start>=15*60*1000)counters.delete(ip);
 const ctrl=new AbortController();
 const timer=setTimeout(()=>ctrl.abort(),25000);
 try{
  const response=await fetch('https://api.openai.com/v1/responses',{
   method:'POST',
   headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},
   body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-4.1-mini',instructions:SYSTEM,input:messages,max_output_tokens:900,store:false}),
   signal:ctrl.signal
  });
  const answer=await response.json().catch(()=>({}));
  if(!response.ok){
   const code=answer?.error?.code||'';
   if([401,403].includes(response.status))return send(res,502,{error:'OpenAI rejected the API key or its permissions.'});
   if(code==='insufficient_quota')return send(res,503,{error:'OpenAI API billing or quota is unavailable.'});
   if(response.status===429)return send(res,429,{error:'OpenAI rate limit reached. Try again later.'});
   if(code==='model_not_found')return send(res,502,{error:'Selected OpenAI model is unavailable.'});
   console.error('OpenAI returned',response.status,String(code).slice(0,40));
   return send(res,502,{error:'OpenAI returned an upstream error.'});
  }
  const reply=outputText(answer);
  if(!reply)return send(res,502,{error:'OpenAI returned an empty answer.'});
  return send(res,200,{reply});
 }catch(err){
  if(err?.name==='AbortError')return send(res,504,{error:'OpenAI timed out. Try again.'});
  console.error('OpenAI network failure',err?.name);
  return send(res,502,{error:'Cannot connect to OpenAI right now.'});
 }finally{clearTimeout(timer)}
};
