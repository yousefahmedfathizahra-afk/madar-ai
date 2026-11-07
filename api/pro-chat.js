'use strict';
/**
 * MADAR PRO ONLY. Independent endpoint: /api/pro-chat.
 * Does not read GEMINI_API_KEY, import api/chat.js, or modify the free chat.
 * Requires separate MADAR_PRO_* secrets configured only when deploying PRO.
 *
 * Providers:
 *   gemini  : Google Gemini 3.8 Flash (Free Tier may be available, subject to quota)
 *   deepseek: DeepSeek R1 via OpenRouter free route (limited and may be unavailable)
 *   pro    : Google Gemini 3.1 Pro Preview (PAID and opt-in only)
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
  if(!['auto','gemini','deepseek','pro'].includes(provider))throw fail(400,'الموديل غير مدعوم.');
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
async function fromGemini(key,model,ctx){
  const contents=ctx.messages.map((m,i)=>{
    const parts=[{text:m.content}];
    if(ctx.image&&i===ctx.messages.length-1)parts.push({inline_data:{mime_type:ctx.image.mimeType,data:ctx.image.data}});
    return {role:m.role==='assistant'?'model':'user',parts};
  });
  const response=await callProvider('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent',{
    method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},
    body:JSON.stringify({
      systemInstruction:{parts:[{text:systemPrompt(ctx.language)}]},
      contents,
      generationConfig:{maxOutputTokens:MAX_OUTPUT,temperature:0.55,thinkingConfig:{thinkingLevel:model==='gemini-3.1-pro-preview'?'high':'medium'}}
    })
  });
  const data=await response.json().catch(()=>null);
  if(!response.ok){
    if(response.status===429)throw fail(429,'رصيد أو عدد طلبات مدار PRO وصل للحد المتاح. جرّب لاحقًا.');
    if(response.status===401||response.status===403)throw fail(503,'مفتاح Gemini الخاص بـ PRO ليس لديه صلاحية للنموذج.');
    throw fail(502,'MADAR PRO لم يتمكن من معالجة الطلب ('+response.status+').');
  }
  const answer=(data?.candidates?.[0]?.content?.parts||[]).filter(p=>typeof p.text==='string'&&!p.thought).map(p=>p.text).join('\n').trim();
  if(!answer)throw fail(502,'مدار PRO رجّع رد فاضي. جرّب مرة تانية.');
  return answer;
}
async function fromOpenRouter(key,ctx){
  if(ctx.image)throw fail(400,'موديل DeepSeek R1 المجاني هنا للنص فقط. اختار Gemini لتحليل الصور.');
  const response=await callProvider('https://openrouter.ai/api/v1/chat/completions',{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+key,'X-Title':'MADAR PRO'},
    body:JSON.stringify({
      model:'deepseek/deepseek-r1:free',
      messages:[{role:'system',content:systemPrompt(ctx.language)},...ctx.messages.map(m=>({role:m.role,content:m.content}))],
      max_tokens:MAX_OUTPUT,temperature:0.45,stream:false
    })
  });
  const data=await response.json().catch(()=>null);
  if(!response.ok){
    if(response.status===429)throw fail(429,'OpenRouter Free وصل للحد اليومي أو حد السرعة. جرّب Gemini أو لاحقًا.');
    if(response.status===401||response.status===403)throw fail(503,'مفتاح OpenRouter الخاص بـ PRO غير صالح أو لا يملك صلاحية.');
    throw fail(502,'DeepSeek R1 المجاني غير متاح الآن ('+response.status+').');
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
    const geminiKey=process.env.MADAR_PRO_GEMINI_API_KEY;
    const routerKey=process.env.MADAR_PRO_OPENROUTER_API_KEY;
    let provider=data.provider;
    if(provider==='auto'){
      // Vision requires multimodal Gemini. For difficult code/math use R1 when configured.
      // Otherwise prefer the responsive Gemini route.
      const last=data.messages[data.messages.length-1]?.content||'';
      const complex=last.length>140 && /(debug|refactor|algorithm|reasoning|prove|theorem|code|bug|typescript|python|java|البرمجة|الاخطاء|الأخطاء|خوارزم|مسألة رياض|برهان)/i.test(last);
      provider=data.image?'gemini':complex&&routerKey?'deepseek':geminiKey?'gemini':routerKey?'deepseek':'none';
    }
    if(provider==='none')throw fail(503,'PRO غير متصل بعد: يحتاج مفتاح API مستقل خاص ببرو. مدار المجاني لم يتغير.');
    if(provider==='pro'&&process.env.MADAR_PRO_ALLOW_PAID_MODELS!=='true')throw fail(403,'Gemini Pro المدفوع معطل افتراضيًا لتجنب أي تكلفة.');
    if((provider==='gemini'||provider==='pro')&&!geminiKey)throw fail(503,'مفتاح Gemini المستقل لمدار PRO غير مضبوط.');
    if(provider==='deepseek'&&!routerKey)throw fail(503,'مفتاح OpenRouter المستقل لمدار PRO غير مضبوط.');
    const model=provider==='pro'?'gemini-3.1-pro-preview':provider==='gemini'?'gemini-3.8-flash':'deepseek/deepseek-r1:free';
    const answer=provider==='deepseek'?await fromOpenRouter(routerKey,data):await fromGemini(geminiKey,model,data);
    return reply(res,200,{reply:answer});
  }catch(e){return reply(res,e?.statusCode||500,{error:e?.statusCode?e.message:'حصل خطأ غير متوقع في PRO. جرّب تاني.'});}
};
