'use strict';
// MADAR serverless Gemini chat. Does not call OpenAI.
// No preliminary ListModels call: it may hang and consume the browser's whole time budget.
// Start with the stable low-latency free model; fall back if a model is unavailable
// or returns an empty response (e.g. thinking consumed the output token budget).
const MODELS = ['gemini-2.5-flash-lite','gemini-3.5-flash-lite','gemini-3.1-flash-lite','gemini-2.5-flash','gemini-3.6-flash'];
// Use a stronger free-eligible model for harder tasks, and the faster model
// for simple conversation. No paid service or extra account settings required.
function preferredModels(question,mode){
 const text=String(question||'');
 const challenging=['code','study','write'].includes(mode)
  ||text.length>=270
  ||/(?:برمج|كود|برنامج|شفرة|خطأ برمج|رياضيات|احسب|حل المعادل|خطة تفصيلي|حلل|قارن بالتفصيل|اشرح خطوة|بحث معمق|algorithm|debug|javascript|python|typescript|react|equation|proof|analy[sz]e|step by step|detailed plan)/i.test(text);
 return challenging?['gemini-2.5-flash','gemini-2.5-flash-lite',
  'gemini-3.5-flash-lite','gemini-3.1-flash-lite','gemini-3.6-flash']:MODELS;
}

const SYSTEM = "You are MADAR AI, a friendly, capable and accurate assistant. The MADAR website was created by Youssef Ahmed (يوسف أحمد); mention this when asked who created MADAR, but never assume a visitor is Youssef or address visitors by that name unless they tell you. The underlying Gemini AI model was made by Google.\n\nRESPONSE QUALITY:\n- Answer the user's actual question directly in the first sentence; don't stall, circle around, or ask unnecessary clarifying questions.\n- Reply naturally in the user's language. In Egyptian Arabic conversations, speak clear, friendly Egyptian Arabic. If the user writes English, answer in English. Never switch languages unexpectedly.\n- Be organized and easy to read: a short opening, then concise paragraphs or numbered/bulleted lists when they help; bold important words with Markdown. Avoid long repetitive introductions, excessive headings, emoji spam, and empty encouragement.\n- For requests asking for ALL items, provide the complete set without omissions, duplicates or made-up entries. Count and check the items before answering. If the set has a conventional definition, state it briefly.\n- Example: the Arab League comprises 22 countries: Egypt, Saudi Arabia, United Arab Emirates, Jordan, Palestine, Lebanon, Syria, Iraq, Kuwait, Bahrain, Qatar, Oman, Yemen, Sudan, Libya, Tunisia, Algeria, Morocco, Mauritania, Somalia, Djibouti and Comoros. If asked for all Arab countries, give the complete 22, including Palestine, Somalia, Djibouti and Comoros.\n- Prioritize correctness over confidence: reason carefully, fix inconsistencies before answering, and say briefly when unsure or when facts change over time. Don't fabricate sources, events, browsing, image capabilities, or personal information.\n- Explain difficult subjects simply, with relevant examples if useful. For technical steps, give practical ordered instructions. If the user only wants a quick fact, be concise.\n- For photo questions, examine the actual image in the message and avoid guessing unseen details. When Wikipedia snippets are supplied, distinguish sourced facts from unsupported information and identify the source links.\n- Respect privacy, keep passwords and account secrets secret, and do not claim unrestricted real-time web search.";
// Modes change response behavior only; users still share the same safe Gemini backend.
const MODE_INSTRUCTIONS = Object.freeze({
 chat: '',
 study: 'MADAR STUDY MODE: Be a patient, encouraging tutor. Explain concepts clearly with steps and examples, especially in Arabic when asked in Arabic. Help students learn rather than blindly copying homework. If the user asks for a quiz, create a five-question interactive quiz: ask ONE question at a time, wait for their answer, give short feedback and then the next question. When all five are done, summarize their score and what to review. If a photo shows homework, explain what you can actually see rather than inventing missing text.',
 code: 'MADAR CODING MODE: Be a precise software engineer. Give correct, runnable examples when helpful, state the language, explain key steps briefly, and point out security or setup requirements. Never claim untested code was executed.',
 translate: 'MADAR TRANSLATION MODE: Translate the supplied text faithfully in the direction the user requests. If they do not specify a target language, translate Arabic into natural English and English into natural Arabic. Keep the original meaning, names and tone; avoid extra commentary unless asked.',
 write: 'MADAR WRITING MODE: Help draft and improve polished messages, posts, stories or documents in the requested language and tone. Give a practical copy-ready draft first, then brief options or edits if they would help.'
});
const counters = new Map();
function send(res, status, body) { return res.status(status).json(body); }

async function researchWikipedia(question){
 const lang=/[\u0600-\u06FF]/.test(question)?'ar':'en';
 const host='https://'+lang+'.wikipedia.org';
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),6500);
 try{
  const p=new URLSearchParams({action:'query',list:'search',srsearch:question.slice(0,150),srlimit:'3',format:'json'});
  const a=await fetch(host+'/w/api.php?'+p.toString(),{signal:ctrl.signal,headers:{'User-Agent':'MADAR-AI/1.0 (encyclopedia search)'}});
  if(!a.ok)throw Error('Wikipedia lookup failed');
  const j=await a.json();
  const pages=(j?.query?.search||[]).filter(p=>Number.isInteger(p.pageid)&&typeof p.title==='string').slice(0,3);
  if(!pages.length)return[];
  const q=new URLSearchParams({action:'query',prop:'extracts',exintro:'1',explaintext:'1',exchars:'650',pageids:pages.map(x=>x.pageid).join('|'),format:'json'});
  const b=await fetch(host+'/w/api.php?'+q.toString(),{signal:ctrl.signal,headers:{'User-Agent':'MADAR-AI/1.0 (encyclopedia search)'}});
  if(!b.ok)throw Error('Wikipedia extract failed');
  const d=await b.json();
  return pages.map(p=>({title:p.title.slice(0,140),url:host+'/?curid='+p.pageid,extract:String(d?.query?.pages?.[p.pageid]?.extract||'').slice(0,800)})).filter(x=>x.extract);
 } finally{clearTimeout(timer);}
}


// Use the server clock on every request; never freeze a calendar year into the model prompt.
function liveDateInfo(now = new Date()) {
  const zone = 'Africa/Cairo';
  const year = new Intl.DateTimeFormat('en-US',{year:'numeric',timeZone:zone}).format(now);
  const arabicDate = new Intl.DateTimeFormat('ar-EG',{dateStyle:'full',timeZone:zone}).format(now);
  const englishDate = new Intl.DateTimeFormat('en-GB',{
    weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:zone
  }).format(now);
  return { year, arabicDate, englishDate, utc:now.toISOString() };
}
function directCurrentDateAnswer(question, info) {
  let q = String(question||'').normalize('NFKC').toLowerCase()
    .replace(/[\u064b-\u065f\u0670]/g,'')
    .replace(/[؟?!،.,:;]+/g,' ').replace(/\s+/g,' ').trim();
  if (!q || q.length > 100) return null;
  const asksYear = /(?:سنه|سنة|عام)\s*(?:كام|كم|ايه|اي|حاليا|دلوقتي|الان|اليوم)|(?:احنا|نحن|حنا)\s+(?:في|فى)\s+(?:سنه|سنة|عام)|(?:في|فى)\s+(?:اي|ايه)\s+(?:سنه|سنة|عام)|(?:what year is it|what is the (?:current )?year|which year is it|current year)/i.test(q);
  const asksDate = /(?:تاريخ\s+(?:النهارده|النهاردة|اليوم)|(?:النهارده|النهاردة|اليوم)\s+(?:كام|كم)|(?:احنا|نحن)\s+يوم\s+ايه|(?:what(?:'s| is) (?:today'?s|the) date|what day is it today|today'?s date))/i.test(q);
  if(asksYear) return /[\u0600-\u06ff]/.test(q)
    ? 'إحنا دلوقتي في سنة **'+info.year+'**.'
    : 'The current year is **'+info.year+'**.';
  if(asksDate) return /[\u0600-\u06ff]/.test(q)
    ? 'النهارده **'+info.arabicDate+'** (بتوقيت القاهرة).'
    : 'Today in Cairo, Egypt is **'+info.englishDate+'**.';
  return null;
}
function liveDateSystemInstruction(info) {
  return '\n\nCURRENT DATE — FROM THE LIVE SERVER CLOCK, NOT TRAINING DATA: '
    +'The year RIGHT NOW is '+info.year+'. The date in Cairo (Africa/Cairo) is '
    +info.englishDate+'; current UTC timestamp: '+info.utc+'. '
    +'For questions about the current year, current date, today, yesterday, tomorrow, or relative dates, '
    +'base your answer on this live date, NEVER on stale training-era dates (such as 2024). '
    +'If the user is in another time zone, use their specified time zone or clarify it when material. '
    +'For time-sensitive external news or facts you cannot verify, acknowledge the limitation rather than invent updates.';
}

// Certain closed-set factual questions can be answered reliably without wasting API calls.
// This also guards against partial lists when a lightweight model is under a token limit.
const ARAB_LEAGUE_COUNTRIES = [
  'الأردن','الإمارات العربية المتحدة','البحرين','الجزائر','جزر القمر',
  'جيبوتي','السعودية','السودان','سوريا','الصومال','العراق','عُمان',
  'فلسطين','قطر','الكويت','لبنان','ليبيا','مصر','المغرب','موريتانيا','اليمن','تونس'
];
function directArabCountriesAnswer(question){
  const q=String(question||'').normalize('NFKC').toLowerCase()
    .replace(/[\u064b-\u065f\u0670]/g,'').replace(/[؟?!،.,:;]+/g,' ')
    .replace(/\s+/g,' ').trim();
  if(q.length>130)return null; // Long/multi-part questions deserve a contextual model response.
  const arabicTarget=/(?:الدول|البلاد|البلدان)\s+(?:ال)?عرب(?:ية|يه)?/.test(q);
  const arabicRequest=/(?:كل|جميع|اسماء|أسماء|اذكر|اكتب|ما هي|ايه هي|قائمة|عدد|كم عدد)/.test(q);
  const englishTarget=/\barab(?:ic)? countries\b/.test(q);
  const englishRequest=/\b(?:list|name|all|which|what|how many)\b/.test(q);
  if(!((arabicTarget&&arabicRequest)||(englishTarget&&englishRequest)))return null;
  if(englishTarget&&!arabicTarget){
    const en=['Jordan','United Arab Emirates','Bahrain','Algeria','Comoros',
     'Djibouti','Saudi Arabia','Sudan','Syria','Somalia','Iraq','Oman','Palestine',
     'Qatar','Kuwait','Lebanon','Libya','Egypt','Morocco','Mauritania','Yemen','Tunisia'];
    return 'The **22 Arab countries** (members of the Arab League) are:\n\n'
      +en.map((v,i)=>(i+1)+'. '+v).join('\n')
      +'\n\n**Total: 22 countries.**';
  }
  return 'الدول العربية **٢٢ دولة**، وهي الدول الأعضاء في جامعة الدول العربية:\n\n'
    +ARAB_LEAGUE_COUNTRIES.map((name,i)=>(i+1)+'. '+name).join('\n')
    +'\n\n**المجموع: ٢٢ دولة.**';
}

module.exports = async function chat(req,res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  if (req.method !== 'POST') return send(res,405,{error:'Method not allowed'});
  if (req.headers.origin) {
    try {
      if (new URL(req.headers.origin).host !== req.headers.host)
        return send(res,403,{error:'Origin denied.'});
    } catch { return send(res,403,{error:'Invalid origin.'}); }
  }
  const key = process.env.GEMINI_API_KEY;
  if (!key) return send(res,503,{error:'Gemini key is missing on the server. Add GEMINI_API_KEY in Vercel Production and redeploy.'});
  if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json'))
    return send(res,415,{error:'Content-Type must be application/json.'});
  let data=req.body;
  if (typeof data === 'string') {
    try { data=JSON.parse(data); }
    catch { return send(res,400,{error:'Invalid JSON request.'}); }
  }
  const mode=data?.mode===undefined?'chat':data.mode;
  if(typeof mode!=='string'||!Object.prototype.hasOwnProperty.call(MODE_INSTRUCTIONS,mode))
    return send(res,400,{error:'Please select a valid MADAR mode.'});
  const messages=data?.messages;
  if (!Array.isArray(messages) || messages.length<1 || messages.length>18
    || messages[messages.length-1]?.role!=='user'
    || messages.some(m=>!m || !['user','assistant'].includes(m.role)
      || typeof m.content!=='string' || !m.content.trim() || m.content.length>5000)
    || messages.reduce((n,m)=>n+m.content.length,0)>16000)
    return send(res,400,{error:'Invalid conversation or message too long.'});
  const addr=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
  const now=Date.now();
  let entry=counters.get(addr);
  if(!entry || now-entry.start>=900000) entry={start:now,count:0};
  if(entry.count>=16) return send(res,429,{error:'MADAR request limit reached. Try again in a few minutes.'});
  entry.count++; counters.set(addr,entry);
  if(counters.size>1000) for(const [k,e] of counters) if(now-e.start>=900000) counters.delete(k);

  let image=null;
  if(data.image!==undefined){
    const obj=data.image;
    if(!obj||typeof obj!=='object'||!['image/jpeg','image/png','image/webp'].includes(obj.mimeType)
      ||typeof obj.data!=='string'||obj.data.length<24||obj.data.length>2100000
      ||obj.data.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(obj.data))
      return send(res,400,{error:'Invalid image. Upload a JPEG, PNG or WebP image under 1.5 MB.'});
    image=obj;
  }
  const currentDate=liveDateInfo();
  const currentQuestion=messages[messages.length-1].content;
  const directDateAnswer=mode==='chat' && !image && data.webSearch!==true
    ? directCurrentDateAnswer(currentQuestion,currentDate) : null;
  if(directDateAnswer)return send(res,200,{reply:directDateAnswer,sources:[]});
  const directAnswer=mode==='chat' && !image && data.webSearch!==true
    ? directArabCountriesAnswer(currentQuestion) : null;
  if(directAnswer)return send(res,200,{reply:directAnswer,sources:[]});
  let sources=[],sourceNotes='';
  if(data.webSearch===true){
    try{
      sources=await researchWikipedia(messages[messages.length-1].content.trim());
      if(!sources.length)return send(res,404,{error:'No Wikipedia articles found. Try different words or use full web search.'});
      sourceNotes='\n\nWikipedia excerpts. Base your answer on these excerpts. Clearly identify them as Wikipedia sources and cite the URLs:\n'
        +sources.map((s,i)=>'['+(i+1)+'] '+s.title+'\n'+s.url+'\n'+s.extract).join('\n\n');
    }catch(err){
      console.warn('MADAR Wikipedia lookup',err?.name);
      return send(res,502,{error:'Wikipedia research is temporarily unavailable. Turn off Wikipedia research to chat normally.'});
    }
  }
  const controller=new AbortController();
  const started=Date.now();
  // Browser currently times out at 33 seconds. Allow 24 seconds for Google plus overhead.
  const timer=setTimeout(()=>controller.abort(),24000);
  const contents=messages.map((m,i)=>({
    role:m.role==='assistant'?'model':'user',parts:[{text:m.content+(i===messages.length-1?sourceNotes:'')}]
  }));
  if(image)contents[contents.length-1].parts.push({inlineData:{mimeType:image.mimeType,data:image.data}});
  let sawBusy=false,sawEmpty=false,sawBadRequest=false,sawQuota=false;
  let emptyReason='';
  try {
    for (const model of preferredModels(messages[messages.length-1].content,mode)) {
      for (let attempt=0;attempt<2;attempt++) {
      const endpoint='https://generativelanguage.googleapis.com/v1beta/models/'
        +model+':generateContent';
      let response;
      try {
        response=await fetch(endpoint,{
          method:'POST',signal:controller.signal,
          headers:{'x-goog-api-key':key,'Content-Type':'application/json'},
          body:JSON.stringify({
            systemInstruction:{parts:[{text:SYSTEM+liveDateSystemInstruction(currentDate)+(MODE_INSTRUCTIONS[mode]?'\n\n'+MODE_INSTRUCTIONS[mode]:'')}]},
            contents,
            generationConfig:{
              maxOutputTokens:3072,
              // Gemini 2.5 Flash/Lite supports disabled thinking, so all output
              // tokens are available for a visible answer. Gemini 3 uses levels.
              thinkingConfig:model.startsWith('gemini-2.5-')
                ?{thinkingBudget:0}:{thinkingLevel:'low'}
            }
          })
        });
      } catch(err) {
        console.error('MADAR Gemini network issue:', model,err?.name,'elapsedMs',Date.now()-started);
        if(controller.signal.aborted || err?.name==='AbortError')
          return send(res,504,{error:'Gemini is not responding quickly enough. The server connection timed out; please try again.'});
        sawBusy=true;
        break; // Try another free model after a network error.
      }
      const answer=await response.json().catch(()=>({}));
      if(response.status===404) {
        console.warn('MADAR Gemini model missing:',model);
        break; // Model not enabled: try the next model.
      }
      if(!response.ok) {
        const upstreamCode=String(answer?.error?.status||'');
        console.warn('MADAR Gemini API status:',response.status,upstreamCode,'model',model);
        if(response.status===429||upstreamCode==='RESOURCE_EXHAUSTED'){
          // Each Gemini free-tier model can have different quota; try a fallback.
          sawQuota=true;
          break;
        }
        if(response.status===401||response.status===403)
          return send(res,502,{error:'Gemini API key was rejected or Google restricted this project. Check Google AI Studio.'});
        if(response.status===400){
          // Model-specific thinking settings can be unsupported; keep trying.
          sawBadRequest=true;
          break;
        }
        if([408,500,502,503,504].includes(response.status)) {
          sawBusy=true;
          if(attempt===0&&!controller.signal.aborted){
            await new Promise(resolve=>setTimeout(resolve,400));
            continue; // Retry one time after a short delay.
          }
          break; // Try the next free-tier model.
        }
        return send(res,502,{error:'The Gemini service returned an error. Try again shortly.'});
      }
      const candidates=Array.isArray(answer?.candidates)?answer.candidates:[];
      // Do not display model reasoning ("thought" parts) to visitors.
      const reply=candidates.map(candidate=>(candidate?.content?.parts||[])
        .filter(p=>typeof p?.text==='string'&&p.thought!==true)
        .map(p=>p.text).join('\n').trim()).find(Boolean);
      if(reply)return send(res,200,{reply,sources:sources.map(({title,url})=>({title,url}))});
      const finish=candidates.map(c=>String(c?.finishReason||'')).filter(Boolean).join(',');
      const block=String(answer?.promptFeedback?.blockReason||'');
      // Only log diagnostics, never log user messages, keys, or image bytes.
      console.warn('MADAR Gemini empty candidate:',model,
        'finishReason',finish||'none','blockReason',block||'none',
        'candidateCount',candidates.length,'elapsedMs',Date.now()-started);
      if(block||/(?:SAFETY|PROHIBITED_CONTENT|BLOCKLIST|SPII)/.test(finish))
        return send(res,422,{error:'Gemini could not answer this request because its safety filter blocked the response. Try a different request.'});
      sawEmpty=true;emptyReason=finish||'EMPTY';
      break; // Try next Gemini model, rather than failing the entire chat.

      }
    }
    if(sawQuota)return send(res,429,{error:'Gemini free quota or per-model request limit was reached across the available models. Please try again later.'});
    if(sawEmpty)return send(res,502,{error:'Gemini did not return an answer after trying alternative models. Please send the message again shortly.',reason:emptyReason});
    if(sawBusy)return send(res,503,{error:'Gemini is temporarily busy across all tried free models. Please try again later.'});
    return send(res,502,{error:sawBadRequest
      ?'Gemini rejected this message or its model settings. Try again with a shorter message.'
      :'No compatible Gemini model is enabled for this API key. Check Google AI Studio access.'});
  } catch(err) {
    console.error('MADAR unexpected Gemini error:',err?.name);
    if(controller.signal.aborted)return send(res,504,{error:'Gemini connection timed out. Please try again.'});
    return send(res,502,{error:'Gemini connection failed. Please try again.'});
  } finally {clearTimeout(timer);}
};
