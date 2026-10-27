'use strict';
// Quick Gemini content/layout brief used to tailor the reliable static-site
// fallback when full site code is too slow or fails quality checks.
const CATEGORIES=new Set(['store','food','education','community','clinic','company','general']);
function clean(s,max){return typeof s==='string'?s.trim().slice(0,max):''}
function parseBrief(data){
 const p=typeof data==='string'?JSON.parse(data):data;
 if(!p||typeof p!=='object'||Array.isArray(p))return null;
 const category=CATEGORIES.has(p.category)?p.category:null;
 const items=Array.isArray(p.items)?p.items.slice(0,6).map(x=>[
  clean(x?.title,70),clean(x?.detail,42),clean(x?.icon,5)
 ]).filter(x=>x[0].length>1&&x[1].length>0):[];
 const accent=/^#[0-9a-fA-F]{6}$/.test(p.accentColor||'')?p.accentColor:null;
 return{
  category,brand:clean(p.brand,45),hero:clean(p.hero,98),
  subtitle:clean(p.subtitle,240),items,accent
 };
}
async function siteSpec(prompt,key){
 if(!key)return null;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6800);
 try{
  const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent',{
   method:'POST',signal:controller.signal,
   headers:{'x-goog-api-key':key,'Content-Type':'application/json'},
   body:JSON.stringify({
    systemInstruction:{parts:[{text:[
     'You are MADAR SITE PLANNER. Extract a concise professional website style-and-content brief from a visitor request, not site code.',
     'Return only valid JSON keys: category, brand, hero, subtitle, items, accentColor. category must be one of store, food, education, community, clinic, company, general.',
     'brand is the actual website/project brand if named; otherwise invent a short appropriate brand. hero is a compelling short custom homepage heading. subtitle describes the real offering in 1-2 sentences.',
     'items must be exactly 6 relevant example items with keys title, detail, icon. For stores/restaurants, detail is a sample price in Egyptian pounds if the user wants Arabic/Egypt; for education it is lessons/level; for other projects it describes a service or feature. icon is one fitting emoji.',
     'accentColor is a six-digit color hex appropriate to the requested brand. Respect the requested colors, sector, name, audience, style and UI language.',
     'Make the content concrete and SPECIFIC to the request. Do not claim actual registered users, transactions, medical outcomes, working databases or payment functionality. Output JSON only.'
    ].join('\n')}]},
    contents:[{role:'user',parts:[{text:String(prompt||'').slice(0,1200)}]}],
    generationConfig:{responseMimeType:'application/json',maxOutputTokens:1150,temperature:0.45}
   })
  });
  if(!r.ok)return null;
  const j=await r.json().catch(()=>null);
  const out=j?.candidates?.[0]?.content?.parts?.filter(x=>typeof x.text==='string').map(x=>x.text).join('\n').trim();
  if(!out)return null;
  return parseBrief(out);
 }catch{return null}
 finally{clearTimeout(timer)}
}
module.exports={siteSpec,parseBrief};
