'use strict';
const {CANVA_API,configReady,getLink,freshToken,json,sameOrigin,crypto}=require('./_shared');
function safeError(data,status){
 const code=String(data?.error?.code||data?.error?.status||'').slice(0,70);
 if(status===429)return 'Canva AI credits or request limit reached. No image was generated.';
 if(status===403)return 'Your Canva account or integration is not enabled for preview image generation.';
 if(status===401)return 'Canva authorization expired. Please reconnect your account.';
 return 'Canva image generation request failed'+(code?' ('+code+')':'')+'.';
}
module.exports=async function(req,res){
 if(!['GET','POST'].includes(req.method))return json(res,405,{error:'Method not allowed'});
 if(!configReady())return json(res,503,{error:'Canva developer integration has not been configured.'});
 if(!getLink(req))return json(res,401,{error:'Connect your Canva account to MADAR first.',authUrl:'/api/canva/start'});
 if(req.method==='POST'&&!sameOrigin(req))return json(res,403,{error:'Invalid request origin.'});
 let path,method,body;
 if(req.method==='POST'){
  if(!String(req.headers['content-type']||'').startsWith('application/json'))return json(res,415,{error:'Expected JSON'});
  const data=typeof req.body==='object'?req.body:{};
  const prompt=String(data?.prompt||'').trim();
  if(prompt.length<3||prompt.length>900)return json(res,400,{error:'Image description must be 3–900 characters.'});
  method='POST';path='/image-generations';
  body=JSON.stringify({prompt,aspect_ratio:'square',idempotency_key:crypto.randomUUID(),asset_upload:{type:'none'}});
 }else{
  const job=String(req.query?.job||'');
  if(!/^[a-zA-Z0-9_-]{1,130}$/.test(job))return json(res,400,{error:'Invalid job identifier'});
  method='GET';path='/image-generations/'+encodeURIComponent(job);
 }
 try{
  const token=await freshToken(req,res);
  if(!token)return json(res,401,{error:'Please reconnect Canva.',authUrl:'/api/canva/start'});
  const response=await fetch(CANVA_API+path,{method,signal:AbortSignal.timeout(16000),
   headers:{Authorization:'Bearer '+token,...(method==='POST'?{'Content-Type':'application/json'}:{})},body});
  const data=await response.json().catch(()=>null);
  if(!response.ok)return json(res,response.status===429?429:502,{error:safeError(data,response.status)});
  const job=data?.job;
  if(!job?.id||!['in_progress','success','failed'].includes(job.status))
   return json(res,502,{error:'Unexpected Canva image job response'});
  if(job.status==='failed')return json(res,502,{error:'Canva could not produce this image.'});
  const url=String(job?.result?.image?.url||'');
  if(job.status==='success'&& !/^https:\/\//i.test(url))
   return json(res,502,{error:'Canva returned no secure image URL'});
  return json(res,200,{jobId:job.id,status:job.status,...(url?{url}:{}),source:'Canva AI'});
 }catch(err){
  console.warn('Canva image API unavailable:',String(err?.name||'unknown'));
  return json(res,502,{error:'Canva image service is not responding.'});
 }
};
