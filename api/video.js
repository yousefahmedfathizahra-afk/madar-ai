'use strict';
// MADAR AI — Magic Hour text-to-video proxy.
// The API key is server-only. Never return it or forward it to the browser.
const BASE='https://api.magichour.ai';
function send(res,status,body){return res.status(status).json(body);}
function safeMessage(){return 'مدار ما قدرش يكمّل الفيديو. جرّب لاحقًا.';}
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(!['POST','GET'].includes(req.method))return send(res,405,{error:'Method not allowed.'});
 const key=process.env.MAGIC_HOUR_API_KEY;
 if(!key)return send(res,503,{error:'خدمة الفيديو مش متصلة حاليًا.'});
 let path,options={method:req.method,headers:{Authorization:'Bearer '+key,Accept:'application/json'}};
 // Read-only quota verification. No generation is requested by the check.
 async function freeAccount(){
  try{
   const reply=await fetch(BASE+'/v1/account',{method:'GET',headers:{Authorization:'Bearer '+key,Accept:'application/json'},signal:AbortSignal.timeout(9000)});
   if(!reply.ok)return{ok:false,reason:'فحص الحصة مش متاح حاليًا.'};
   const a=await reply.json();
   const tier=String(a?.tier||a?.subscription?.tier||'').toLowerCase();
   const credits=Number(a?.credits);
   // Fail closed on paid plans, unknown account state or unexpectedly large balances.
   const ok=(tier==='free'||tier==='basic')&&!a?.subscription&&Number.isFinite(credits)&&credits>=72&&credits<=400;
   return{ok,reason:ok?'الحصة المجانية جاهزة.':'الفيديو مش متاح ضمن الحصة المجانية الحالية.'};
  }catch{return{ok:false,reason:'تعذر التحقق من الحصة المجانية.'};}
 }
 if(req.method==='GET'&&String(req.query?.check||'')==='1'){
  const state=await freeAccount();
  return send(res,state.ok?200:503,{ready:state.ok,message:state.reason});
 }
 if(req.method==='POST'){
  const free=await freeAccount();
  if(!free.ok)return send(res,503,{error:free.reason});
  const body=req.body&&typeof req.body==='object'?req.body:{};
  const prompt=String(body.prompt||'').trim();
  if(prompt.length<8||prompt.length>1800)return send(res,400,{error:'اكتب وصف فيديو من 8 إلى 1800 حرف.'});
  const aspect=['16:9','9:16','1:1'].includes(body.aspect_ratio)?body.aspect_ratio:'16:9';
  const seconds=3; // Restricted free-tier preview: no upgrade or variable-length billing.
  const name='MADAR AI video';
  path='/v1/text-to-video';
  options.method='POST';
  options.headers['Content-Type']='application/json';
  options.body=JSON.stringify({
   name,
   end_seconds:seconds,
   aspect_ratio:aspect,
   resolution:'480p',
   audio:false,
   style:{prompt},
   // Hard-pin every MADAR video request to the free LTX 2.5 model.
   // Never allow Magic Hour account tier defaults to select a paid model.
   model:'ltx-2.5'
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
  const message=response.status===401?'خدمة الفيديو مش متصلة حاليًا.':
   response.status===402?'الحصة المجانية للفيديو خلصت أو الإعدادات غير متاحة.':
   response.status===429?'خدمة الفيديو عليها ضغط حاليًا. استنى شوية قبل إعادة المحاولة.':
   safeMessage(data,response.status);
  return send(res,status,{error:message});
 }
 return send(res,200,data||{});
};
