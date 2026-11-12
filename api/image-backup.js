'use strict';
// Optional OpenAI image fallback. Disabled unless the owner enables it explicitly.
// The project owner's API key is stored ONLY in Vercel environment variables.
// These in-memory limits are a defense in depth, not a billing cap
// (serverless instances do not share counters). Set a real API project budget.
const hits=new Map(), dailyHits=new Map();
let activeRequests=0;
function send(res,status,payload){return res.status(status).json(payload);}
function enabled(){
 return process.env.OPENAI_IMAGE_FALLBACK_ENABLED==='true'&&Boolean(process.env.OPENAI_API_KEY);
}
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Referrer-Policy','no-referrer');
 if(req.method==='GET')return send(res,200,{enabled:enabled()});
 if(req.method!=='POST')return send(res,405,{error:'POST required'});
 if(!enabled())return send(res,503,{error:'خدمة الصور الاحتياطية غير مفعلة حاليًا.'});
 if(req.headers.origin){
  try{if(new URL(req.headers.origin).host!==req.headers.host)return send(res,403,{error:'Origin denied'});}
  catch{return send(res,403,{error:'Origin invalid'});}
 }
 if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))
  return send(res,415,{error:'JSON required'});
 const prompt=String(req.body?.prompt||'').trim();
 const input=String(req.body?.inputImage||'');
 const externalInput=String(req.body?.inputImageUrl||'');
 if(prompt.length<5||prompt.length>3800)return send(res,400,{error:'وصف الصورة غير صالح.'});
 if(input&&externalInput)return send(res,400,{error:'اختار صورة أصلية واحدة.'});
 if(input&&(!/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/i.test(input)||input.length>2400000))
  return send(res,400,{error:'الصورة الأصلية أكبر من المسموح.'});
 let imageUrl='';
 if(externalInput){
  try{
   const url=new URL(externalInput);
   if(url.protocol!=='https:'||url.username||url.password
     ||/^(?:localhost|127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|\[|0\.0\.0\.0)/i.test(url.hostname)
     ||url.hostname.endsWith('.local')||url.hostname.endsWith('.internal'))
    return send(res,400,{error:'رابط الصورة غير صالح.'});
   imageUrl=url.href;
  }catch{return send(res,400,{error:'رابط الصورة غير صالح.'});}
 }
 const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
 const now=Date.now();
 const item=hits.get(ip);
 const current=item&&now-item.start<3600000?item:{start:now,count:0};
 const day=new Date(now).toISOString().slice(0,10);
 const today=dailyHits.get(ip);
 const daily=today?.day===day?today:{day,count:0};
 if(current.count>=2||daily.count>=4||activeRequests>=2){
  res.setHeader('Retry-After','3600');
  return send(res,429,{error:'الحد المؤقت للصور الاحتياطية اتملأ. جرّب لاحقًا.'});
 }
 current.count++;hits.set(ip,current);
 daily.count++;dailyHits.set(ip,daily);
 if(hits.size>1200)for(const [id,x] of hits)if(now-x.start>3600000)hits.delete(id);
 if(dailyHits.size>1200)for(const [id,x] of dailyHits)if(x.day!==day)dailyHits.delete(id);
 activeRequests++;
 const model='gpt-image-2';
 const headers={Authorization:'Bearer '+process.env.OPENAI_API_KEY};
 let endpoint='https://api.openai.com/v1/images/generations',body;
 if(input){
  endpoint='https://api.openai.com/v1/images/edits';
  const match=/^data:(image\/(?:png|jpeg|webp));base64,(.*)$/i.exec(input);
  const imageBytes=Buffer.from(match[2],'base64');
  if(imageBytes.length>1750000)return send(res,400,{error:'الصورة الأصلية كبيرة جدًا.'});
  const form=new FormData();
  form.append('model',model);form.append('prompt',prompt);
  form.append('quality','low');form.append('size','1024x1024');form.append('output_format','jpeg');form.append('output_compression','65');
  form.append('image',new Blob([imageBytes],{type:match[1]}),'input.'+(match[1].endsWith('png')?'png':match[1].endsWith('webp')?'webp':'jpg'));
  body=form;
 }else{
  headers['Content-Type']='application/json';
  const request={model,prompt,quality:'low',size:'1024x1024',output_format:'jpeg',output_compression:65};
  if(imageUrl){
   endpoint='https://api.openai.com/v1/images/edits';
   request.images=[{image_url:imageUrl}];
  }
  body=JSON.stringify(request);
 }
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),53000);
 try{
  const response=await fetch(endpoint,{method:'POST',headers,body,signal:controller.signal});
  const result=await response.json().catch(()=>null);
  if(!response.ok){
   // Do not disclose upstream account, project, API key or billing details.
   return send(res,response.status===429?429:502,{error:'خدمة الصور الاحتياطية مشغولة أو غير متاحة حاليًا.'});
  }
  const base64=String(result?.data?.[0]?.b64_json||'');
  if(!base64||!(/^[A-Za-z0-9+/=]+$/.test(base64)))return send(res,502,{error:'الاحتياطي لم يرجع صورة.'});
  return send(res,200,{src:'data:image/jpeg;base64,'+base64});
 }catch(err){
  return send(res,err?.name==='AbortError'?504:502,{error:'تعذر تشغيل الصور الاحتياطية حاليًا.'});
 }finally{clearTimeout(timer);activeRequests=Math.max(0,activeRequests-1);}
};
