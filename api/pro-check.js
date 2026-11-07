'use strict';
// One-time diagnostic endpoint for PRO preview; remove immediately after verification.
// Never expose API keys, provider text, account metadata or response content.
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('X-Robots-Tag','noindex');
  if(req.method!=='GET'){res.statusCode=405;return res.end('{"error":"Method not allowed"}');}
  const key=process.env.MADAR_PRO_OPENROUTER_API_KEY||'';
  if(!key||key==='REPLACE_WITH_YOUR_OPENROUTER_API_KEY'){res.statusCode=503;return res.end('{"configured":false}');}
  const result={configured:true,credential:'unchecked',freeRouter:'unchecked'};
  const ctl=new AbortController();
  const timer=setTimeout(()=>ctl.abort(),25000);
  const classify=(code)=>code===200?'ok':code===401?'invalid_key':code===403?'forbidden':code===402?'payment_required':code===429?'rate_limited':code>=500?'upstream_unavailable':'other';
  try{
    let c;
    try{
      c=await fetch('https://openrouter.ai/api/v1/key',{headers:{Authorization:'Bearer '+key},signal:ctl.signal});
      result.credential=classify(c.status);result.credentialStatus=c.status;
    }catch(e){result.credential=e?.name==='AbortError'?'timeout':'network_error';}
    if(result.credential==='ok'){
      try{
        const r=await fetch('https://openrouter.ai/api/v1/chat/completions',{
          method:'POST',
          headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','X-Title':'MADAR PRO Diagnostic'},
          body:JSON.stringify({model:'openrouter/free',messages:[{role:'user',content:'Reply only with: OK'}],max_tokens:24,stream:false}),
          signal:ctl.signal
        });
        result.freeRouter=classify(r.status);result.routerStatus=r.status;
        // Never expose actual generated text or upstream error messages.
      }catch(e){result.freeRouter=e?.name==='AbortError'?'timeout':'network_error';}
    }
  }finally{clearTimeout(timer);}
  res.statusCode=200;res.end(JSON.stringify(result));
};