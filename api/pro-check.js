'use strict';
module.exports=async function(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('X-Robots-Tag','noindex');
 if(req.method!=='GET'){res.statusCode=405;return res.end('{"error":"Method not allowed"}');}
 const key=process.env.MADAR_PRO_OPENROUTER_API_KEY||'';
 if(!key||key==='REPLACE_WITH_YOUR_OPENROUTER_API_KEY'){res.statusCode=503;return res.end('{"configured":false}');}
 const out={configured:true,credential:'unchecked',freeRouter:'not_tested'};
 const classify=s=>s===200?'ok':s===401?'invalid_key':s===403?'forbidden':s===402?'payment_required':s===429?'rate_limited':s>=500?'upstream_unavailable':'other';
 const c=new AbortController(),timer=setTimeout(()=>c.abort(),20000);
 try{
  try{const a=await fetch('https://openrouter.ai/api/v1/key',{headers:{Authorization:'Bearer '+key},signal:c.signal});out.credential=classify(a.status);out.credentialStatus=a.status;}catch(e){out.credential=e?.name==='AbortError'?'timeout':'network_error';}
  if(out.credential==='ok'){
   try{const a=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','X-Title':'MADAR PRO'},body:JSON.stringify({model:'openrouter/free',messages:[{role:'user',content:'Reply only OK'}],max_tokens:12,stream:false}),signal:c.signal});out.freeRouter=classify(a.status);out.routerStatus=a.status;}catch(e){out.freeRouter=e?.name==='AbortError'?'timeout':'network_error';}
  }
 }finally{clearTimeout(timer);}
 res.statusCode=200;res.end(JSON.stringify(out));
};