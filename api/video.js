'use strict';
// MADAR AI — Magic Hour text-to-video proxy.
// The API key is server-only. Never return it or forward it to the browser.
const BASE='https://api.magichour.ai';
function send(res,status,body){return res.status(status).json(body);}
function safeMessage(data,status){
 const msg=typeof data?.message==='string'?data.message:
   typeof data?.error==='string'?data.error:'تعذر الاتصال بخدمة الفيديو.';
 return String(msg).slice(0,350);
}
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(!['POST','GET'].includes(req.method))return send(res,405,{error:'Method not allowed.'});
 const key=process.env.MAGIC_HOUR_API_KEY;
 if(!key)return send(res,503,{error:'ربط Magic Hour لسه محتاج إضافة المفتاح السري في إعدادات استضافة مدار.'});
 let path,options={method:req.method,headers:{Authorization:'Bearer '+key,Accept:'application/json'}};
 if(req.method==='POST'){
  const body=req.body&&typeof req.body==='object'?req.body:{};
  const prompt=String(body.prompt||'').trim();
  if(prompt.length<8||prompt.length>1800)return send(res,400,{error:'اكتب وصف فيديو من 8 إلى 1800 حرف.'});
  const aspect=['16:9','9:16','1:1'].includes(body.aspect_ratio)?body.aspect_ratio:'16:9';
  const seconds=Math.min(15,Math.max(3,Number(body.seconds)||5));
  const name='MADAR AI video';
  path='/v1/text-to-video';
  options.method='POST';
  options.headers['Content-Type']='application/json';
  options.body=JSON.stringify({
   name,
   end_seconds:seconds,
   aspect_ratio:aspect,
   style:{prompt},
   // Let Magic Hour select LTX 2.5 for Free accounts or Kling 3.0 for paid tiers.
   // Omit resolution so the provider applies the correct plan default.
   model:'default'
  });
 }else{
  const id=String(req.query?.id||'').trim();
  if(!/^[A-Za-z0-9_-]{6,160}$/.test(id))return send(res,400,{error:'معرّف الفيديو غير صالح.'});
  path='/v1/video-projects/'+encodeURIComponent(id);
 }
 let response,data;
 try{
  response=await fetch(BASE+path,{...options,signal:AbortSignal.timeout(25000)});
  data=await response.json().catch(()=>null);
 }catch(error){
  console.error('MADAR Magic Hour request failed:',error?.name||'network');
  return send(res,502,{error:'حصلت مشكلة اتصال بخدمة الفيديو. جرّب تاني بعد شوية.'});
 }
 if(!response.ok){
  console.error('MADAR Magic Hour API status:',response.status,'code:',data?.code||data?.error_code||'unknown');
  const status=response.status===401?502:response.status===402?402:response.status===429?429:response.status>=500?502:400;
  const message=response.status===401?'مفتاح Magic Hour غير صحيح أو غير مضاف في إعدادات مدار.':
   response.status===402?'رصيد Magic Hour غير كافٍ أو الخطة لا تدعم إعدادات الفيديو المطلوبة.':
   response.status===429?'خدمة الفيديو عليها ضغط حاليًا. استنى شوية قبل إعادة المحاولة.':
   safeMessage(data,response.status);
  return send(res,status,{error:message});
 }
 return send(res,200,data||{});
};
