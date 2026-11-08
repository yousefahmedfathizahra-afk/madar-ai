'use strict';
// MADAR PRO ONLY. Magic Hour Text-to-Video; never used by the free site.
// One POST creates one billable job. Never automatically retry creation.
const BASE='https://api.magichour.ai';
const limits=new Map();
function reply(res,code,data){res.statusCode=code;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store, no-cache, must-revalidate');res.setHeader('X-Content-Type-Options','nosniff');res.end(JSON.stringify(data));}
function fail(code,message){const e=new Error(message);e.statusCode=code;return e;}
function originGuard(req){
 const origin=req.headers?.origin;
 if(!origin)return;
 let parsed;try{parsed=new URL(origin);}catch{throw fail(403,'مصدر الطلب غير مسموح.');}
 if(parsed.host!==req.headers.host)throw fail(403,'افتح MADAR PRO من نفس الموقع لإرسال الفيديو.');
}
function parseBody(input){
 if(typeof input==='string'){if(input.length>6000)throw fail(413,'الوصف طويل جدًا.');try{input=JSON.parse(input);}catch{throw fail(400,'صيغة الطلب غير صحيحة.');}}
 if(!input||typeof input!=='object'||Array.isArray(input))throw fail(400,'الطلب غير صحيح.');
 const prompt=typeof input.prompt==='string'?input.prompt.trim():'';
 if(prompt.length<12||prompt.length>1800)throw fail(400,'اكتب وصف فيديو من 12 إلى 1800 حرف.');
 const aspect=input.aspectRatio||'16:9';
 if(!['16:9','9:16','1:1'].includes(aspect))throw fail(400,'نسبة أبعاد الفيديو غير مدعومة.');
 const model='ltx-2.5';
 const duration=Number(input.duration||5);
 if(![5,10,15].includes(duration))throw fail(400,'اختر مدة 5 أو 10 أو 15 ثانية.');
 return {prompt,aspect,duration,model};
}
function permit(req){
 const ip=String(req.headers?.['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim().slice(0,90),now=Date.now();
 if(limits.size>2000)limits.clear();
 let v=limits.get(ip)||{start:now,count:0,last:0};
 if(now-v.start>3600000)v={start:now,count:0,last:0};
 if(now-v.last<600000||v.count>=2)return false;
 v.count++;v.last=now;limits.set(ip,v);return true;
}
async function call(url,options){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
 try{return await fetch(url,{...options,signal:controller.signal});}
 catch(e){if(e?.name==='AbortError')throw fail(504,'خدمة توليد الفيديو تأخرت. احتفظ برقم المشروع إن ظهر ولا تضغط إنشاء مرة أخرى قبل مراجعة الحالة.');throw fail(502,'تعذر الاتصال بخدمة توليد الفيديو.');}
 finally{clearTimeout(timer);}
}
function keyOrThrow(){const key=process.env.MAGIC_HOUR_API_KEY||'';if(!key||key==='PASTE_MAGIC_HOUR_API_KEY_HERE')throw fail(503,'مفتاح Magic Hour لم يُضف بعد إلى إعدادات MADAR PRO Preview.');return key;}
async function providerError(response,data){
 const detail=String(data?.error?.message||data?.message||data?.error_description||'').slice(0,220);
 if(response.status===401)throw fail(503,'مفتاح Magic Hour غير صالح أو غير مفعّل (401). راجع المفتاح في Vercel.');
 if(response.status===402)throw fail(402,'Magic Hour رفض الطلب بسبب الرصيد أو أهلية الخطة (402). '+detail);
 if(response.status===403)throw fail(403,'Magic Hour رفض الصلاحيات (403). '+detail);
 if(response.status===429)throw fail(429,'طلبات Magic Hour كثيرة حاليًا. '+detail);
 throw fail(502,'Magic Hour رفض الطلب ('+response.status+'). '+detail);
}
async function createVideo(req,res){
 if(!String(req.headers?.['content-type']||'').toLowerCase().startsWith('application/json'))throw fail(415,'Content-Type must be application/json.');
 if(!permit(req))throw fail(429,'لحماية رصيد الفيديو: الحد الأقصى فيديوهان في الساعة، مع انتظار 10 دقائق بين الطلبات من نفس الاتصال.');
 const body=parseBody(req.body),key=keyOrThrow();
 // Hard-pin the free LTX 2.5 model. Never route MADAR PRO video requests to paid Kling/Veo models. Omit resolution so Magic Hour applies its free-tier default.
 const response=await call(BASE+'/v1/text-to-video',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({name:'MADAR PRO AI Video',end_seconds:body.duration,aspect_ratio:body.aspect,style:{prompt:body.prompt},model:body.model,audio:true})});
 const data=await response.json().catch(()=>null);
 if(!response.ok)await providerError(response,data);
 const project=data?.project||data?.data||data||{};
 const id=project.id||project.project_id||project.projectId||data?.id||data?.project_id;
 if(typeof id!=='string'||!id)throw fail(502,'Magic Hour لم يرجع رقم مشروع صالح. لا تعِد الإرسال تلقائيًا؛ راجع سجل المشاريع أولًا.');
 return reply(res,202,{projectId:id,status:project.status||data?.status||'queued',creditsCharged:project.credits_charged??data?.credits_charged??null,model:'ltx-2.5',duration:body.duration});
}

function readQuery(req,name){
 let value=req.query?.[name];
 if(value===undefined){try{value=new URL(req.url,'https://madar-pro.invalid').searchParams.get(name);}catch{}}
 return value;
}
async function checkAccount(req,res){
 const key=keyOrThrow();
 // Official read-only account endpoint: confirms the actual subscription tier and available credits.
 const response=await call(BASE+'/v1/account',{method:'GET',headers:{Authorization:'Bearer '+key,'Accept':'application/json'}});
 const data=await response.json().catch(()=>null);
 if(!response.ok)await providerError(response,data);
 const subscription=data?.subscription||null;
 return reply(res,200,{connected:true,provider:'Magic Hour',readOnly:true,tier:data?.tier||'unknown',credits:Number.isFinite(Number(data?.credits))?Number(data.credits):null,subscriptionName:subscription?.name||null,subscriptionStatus:subscription?.status||null});
}

function readProjectId(req){
 let id=req.query?.id;
 if(!id){try{id=new URL(req.url,'https://madar-pro.invalid').searchParams.get('id');}catch{}}
 if(typeof id!=='string'||id.length<6||id.length>180||!/^[A-Za-z0-9_-]+$/.test(id))throw fail(400,'رقم مشروع الفيديو غير صحيح.');
 return id;
}
async function getVideo(req,res){
 const id=readProjectId(req),key=keyOrThrow();
 const response=await call(BASE+'/v1/video-projects/'+encodeURIComponent(id),{method:'GET',headers:{Authorization:'Bearer '+key,'Accept':'application/json'}});
 const data=await response.json().catch(()=>null);
 if(!response.ok)await providerError(response);
 const p=data?.project||data?.data||data||{};
 const rawDownloads=Array.isArray(p.downloads)?p.downloads:(Array.isArray(data?.downloads)?data.downloads:[]);
 const downloads=rawDownloads.map(x=>typeof x==='string'?x:(x?.url||x?.download_url||x?.downloadUrl)).filter(x=>typeof x==='string'&&/^https:\/\//i.test(x)).slice(0,4);
 const status=String(p.status||data.status||'processing').toLowerCase();
 const single=p.download?.url||p.download_url||data?.download?.url||'';if(!downloads.length&&/^https:\/\//i.test(single))downloads.push(single);
 return reply(res,200,{projectId:id,status,downloads,creditsCharged:p.credits_charged??data?.credits_charged??null,error:status==='error'||status==='failed'?(p.error?.message||data?.error?.message||'فشل توليد الفيديو.'):null});
}
module.exports=async function handler(req,res){
 res.setHeader('Referrer-Policy','no-referrer');
 try{
  originGuard(req);
  if(req.method==='POST')return await createVideo(req,res);
  if(req.method==='GET'){if(readQuery(req,'check')==='1')return await checkAccount(req,res);return await getVideo(req,res);}
  res.setHeader('Allow','GET, POST');return reply(res,405,{error:'GET or POST only'});
 }catch(e){return reply(res,e?.statusCode||500,{error:e?.statusCode?e.message:'حصل خطأ غير متوقع في استوديو الفيديو.'});}
};
