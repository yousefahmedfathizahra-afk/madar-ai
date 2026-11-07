'use strict';
/**
 * MADAR PRO ONLY. Independent endpoint: /api/pro-chat.
 * Does not read GEMINI_API_KEY, import api/chat.js, or modify the free chat.
 * Requires separate MADAR_PRO_* secrets configured only when deploying PRO.
 *
 * Providers:
 *   openrouter/free: randomly routes to a $0 text/vision model; hard free-only.
 *   No pay-as-you-go providers or credit-consuming fallbacks are invoked.
 */
const MAX_BODY = 1900000; // allows bounded image attachments; text remains capped
const MAX_OUTPUT = 5500;
const MAX_INPUT = 19000;
const MAX_IMAGE_BYTES_B64 = 1700000;
const limits = new Map();
function reply(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}
function fail(status, message) {
  const e = new Error(message);
  e.statusCode = status;
  return e;
}
function permitRequest(req) {
  const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'anonymous').split(',')[0].trim().slice(0,90);
  const now=Date.now();
  // Best-effort per-instance guard. Production needs durable rate limiting + authentication.
  if(limits.size>1500) limits.clear();
  const value=limits.get(ip)||{start:now,count:0};
  if(now-value.start>60000){value.start=now;value.count=0;}
  value.count++;limits.set(ip,value);
  return value.count<=8;
}
function parseRequest(data) {
  if(typeof data==='string'){if(data.length>MAX_BODY)throw fail(413,'الطلب كبير جدًا.');try{data=JSON.parse(data);}catch{throw fail(400,'الـ JSON غير صحيح.');}}
  if(!data||typeof data!=='object'||Array.isArray(data))throw fail(400,'طلب غير صحيح.');
  if(JSON.stringify(data).length>MAX_BODY)throw fail(413,'الطلب كبير جدًا.');
  const language=data.language==='en'?'en':'ar-mixed';
  if(data.language!==undefined&&!['en','ar-mixed'].includes(data.language))throw fail(400,'اختيار اللغة غير صحيح.');
  const provider=data.provider||'auto';
  if(provider!=='auto')throw fail(400,'مدار PRO في الوضع المجاني التلقائي فقط.');
  if(!Array.isArray(data.messages)||data.messages.length<1||data.messages.length>40)throw fail(400,'محتوى المحادثة غير صحيح.');
  const messages=[];
  for(const m of data.messages.slice(-20)){
    if(!m||!['user','assistant'].includes(m.role)||typeof m.content!=='string')throw fail(400,'صيغة رسالة غير صحيحة.');
    const content=m.content.trim();
    if(content)messages.push({role:m.role,content:content.slice(0,15000)});
  }
  if(!messages.length||messages[messages.length-1].role!=='user')throw fail(400,'آخر رسالة لازم تكون من المستخدم.');
  let remaining=MAX_INPUT;
  const trimmed=[];
  for(let i=messages.length-1;i>=0;i--){
    const size=messages[i].content.length;
    if(size>remaining)break;
    trimmed.unshift(messages[i]);
    remaining-=size;
  }
  if(!trimmed.length)throw fail(413,'الرسالة كبيرة جدًا.');
  let image=null;
  if(data.image!=null){
    const x=data.image;
    if(!x||!['image/jpeg','image/png','image/webp'].includes(x.mimeType)||typeof x.data!=='string' ||x.data.length>MAX_IMAGE_BYTES_B64|| !/^[A-Za-z0-9+/]+={0,2}$/.test(x.data))throw fail(400,'الصورة غير مدعومة أو كبيرة.');
    image={mimeType:x.mimeType,data:x.data};
  }
  return {language,provider,messages:trimmed,image};
}
function systemPrompt(language){
  const lang=language==='en'
   ?'Respond in clear English. Be accurate, pragmatic, structured, and honest about uncertainty.'
   :'اتكلم مصري طبيعي، مع المصطلحات التقنية الإنجليزية المناسبة. قدم إجابات دقيقة ومنظمة، واشرح خطوات الكود بوضوح.';
  return 'You are MADAR PRO, a highly capable AI assistant for coding, learning, design and web development. Never claim to have tested or deployed code unless you really have. Never fabricate web access, images, files or sources. Avoid decorative stars. '+lang;
}
async function callProvider(url,options){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),45000);
  try{return await fetch(url,{...options,signal:controller.signal});}
  catch(e){if(e?.name==='AbortError')throw fail(504,'خدمة النموذج تأخرت في الرد. جرّب تاني.');throw fail(502,'تعذر الاتصال بمزود الذكاء الاصطناعي.');}
  finally{clearTimeout(timeout);}
}
async function fromOpenRouter(key,ctx){
  // Free router can select a vision-capable free model when an image is attached.
  const response=await callProvider('https://openrouter.ai/api/v1/chat/completions',{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+key,'X-Title':'MADAR PRO'},
    body:JSON.stringify({
      model:'openrouter/free', // hard-pinned to free-only router, no paid fallback
      messages:[{role:'system',content:systemPrompt(ctx.language)},...ctx.messages.map((m,i)=>{
        const parts=(ctx.image&&i===ctx.messages.length-1)?[
          {type:'text',text:m.content},
          {type:'image_url',image_url:{url:'data:'+ctx.image.mimeType+';base64,'+ctx.image.data}}
        ]:m.content;
        return {role:m.role,content:parts};
      })],
      max_tokens:Math.min(MAX_OUTPUT,3500),stream:false
    })
  });
  const data=await response.json().catch(()=>null);
  if(!response.ok){
    if(response.status===429)throw fail(429,'حد استخدام مدار PRO اتملأ مؤقتًا. جرّب لاحقًا.');
    if(response.status===401||response.status===403)throw fail(503,'خدمة مدار PRO تحتاج إعداد صلاحيات الاتصال.');
    throw fail(502,'محرك مدار PRO غير متاح مؤقتًا ('+response.status+').');
  }
  const answer=data?.choices?.[0]?.message?.content;
  if(typeof answer!=='string'||!answer.trim())throw fail(502,'مدار PRO لم يُرجع إجابة نهائية. جرّب تاني.');
  return answer.trim();
}
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  // Same-origin requests only. Do not send CORS access headers.
  if(req.method!=='POST')return reply(res,405,{error:'POST only'});
  try{
    const origin=req.headers?.origin;
    if(origin){let host;try{host=new URL(origin).host;}catch{throw fail(403,'Origin مرفوض.');}
      if(host!==req.headers.host)throw fail(403,'يجب فتح MADAR PRO على نفس الدومين الخاص بخادمه.');
    }
    if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))throw fail(415,'Content-Type must be application/json.');
    if(!permitRequest(req))throw fail(429,'طلبات كثيرة من نفس الاتصال. جرّب بعد دقيقة.');
    const data=parseRequest(req.body);
    // Strict no-payment rule: only OpenRouter's documented zero-price free router.
    // A dedicated PRO key is required; never read the Free site's keys.
    const key=process.env.MADAR_PRO_OPENROUTER_API_KEY;
    if(!key)throw fail(503,'شات PRO المجاني محتاج توصيل مفتاح الخدمة المستقل من صاحب المنصة. مش مطلوب أي حاجة من المستخدم.');
    const answer=await fromOpenRouter(key,data);
    return reply(res,200,{reply:answer});
  }catch(e){return reply(res,e?.statusCode||500,{error:e?.statusCode?e.message:'حصل خطأ غير متوقع في PRO. جرّب تاني.'});}
};
