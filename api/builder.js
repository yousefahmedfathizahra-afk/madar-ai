'use strict';
// MADAR Builder — generates a self-contained HTML/CSS/JS project via existing Gemini key.
// All generated code executes only in a sandboxed iframe on the client.
const MODELS=['gemini-3.5-flash-lite','gemini-3.1-flash-lite','gemini-3.6-flash','gemini-2.5-flash-lite','gemini-2.5-flash'];
// Realistic games benefit from the more capable free-eligible model when available.
const REALISTIC_MODELS=['gemini-3.6-flash','gemini-2.5-flash','gemini-3.5-flash-lite','gemini-3.1-flash-lite','gemini-2.5-flash-lite'];
const LIMITS={prompt:1200,html:22000,css:20000,js:26000,explanation:800,previous:42000};
const requestsByIp=new Map();
const SYSTEM=[
 'You are MADAR BUILDER, a highly skilled frontend designer and browser game developer.',
 'Create a COMPLETE, FUNCTIONAL, mobile-responsive mini website, game or interactive tool from the user idea, using only vanilla HTML, CSS and JavaScript.',
 'Return ONLY a JSON object with exactly these five string fields: title, html, css, js, explanation. No Markdown.',
 'html is BODY MARKUP only, without head, html, body, script or style wrappers. css is a complete stylesheet; js is complete executable browser JavaScript, no TypeScript.',
 'Build polished professional UI with gradients, responsive layouts, emoji and CSS shapes. Avoid placeholder non-working buttons. Everything requested must actually work.',
 'For games: implement gameplay, keyboard and touch controls, collision or rules, score, restart and win or game over, when appropriate.',
 'USER INSTRUCTIONS ARE THE SPECIFICATION: implement the exact requested game genre, gameplay, appearance, camera perspective, colors, characters and features. Do not substitute a different game, invent unrelated features, or replace explicit user details with your own preferences.',
 'If refining a previous project, change exactly what the latest user asks and preserve everything else that works. The existing generated project is the starting point, not a suggestion.',
 'For websites: implement functional menus, buttons and sections. For tools: implement actual logic and responsive interface.',
 'SELF CONTAINED: NO imports, external dependencies, network calls, external scripts/styles/images/fonts, embedded frames, cookies, localStorage, sessionStorage, document redirects, popup windows, camera/microphone, file access, payments or credentials.',
 'Use only inline SVG, CSS, emoji or canvas for art. No external resources or data collection.',
 'Prefer under 6000 characters of HTML, 7000 of CSS and 10000 of JS. No missing placeholders or TODOs.',
 'When the user writes Arabic, the UI should use natural Arabic with rtl direction where sensible.',
 'Keep explanation one brief sentence in the user language; title descriptive and short.',
 'If previous source code is given, apply requested changes without breaking existing working features.',
 'Never construct malicious, deceptive or unsafe functionality.'
].join('\n');
const REALISTIC_SYSTEM=[
 'REALISTIC GAME MODE: create an immersive PLAYABLE original browser game with convincing graphics. User describes it and MADAR writes every line.',
 'Visual reference quality: third-person camera as if following an actual vehicle/character, horizon with atmospheric depth, perspective road or landscape, distant background scenery, high-contrast lighting, shaded silhouettes, depth, shadows, smooth animation, and a polished heads-up display.',
 'Avoid childish emoji, primitive squares and plain color backgrounds for the actual game world. Use procedural Canvas 2D drawing with gradients, transform projections and layered shapes. Use WebGL only if all shaders, setup and renderer are completely written and likely to run without libraries.',
 'For realistic racing: a behind-the-car view, 2.5D perspective roadway with vanishing point and curves, continuous road markings, shaded car body, wheels, exhaust/speed particles, roadside buildings or trees shrinking into the distance, other cars and collision detection.',
 'Use requestAnimationFrame with delta time, camera motion, acceleration, braking, momentum, steering inertia, sensible hitboxes, speedometer, score and meaningful win/game over with restart.',
 'Provide working keyboard controls (WASD / arrows) AND large clear touch buttons for mobile, including press and release handling. Use touch-action:none on controls, prevent default scrolling as needed.',
 'For football or other sports, apply camera perspective, shaded field, procedural athletes or vehicles, a visible ball, basic physics and realistic-feeling game rules instead of emoji-only scenes.',
 'Prioritize an original convincing 2.5D demo over an empty 3D scaffold. No remote images, models, APIs, music, libraries or external assets; all art must be drawn procedurally.',
 'Keep drawing performant: resize canvas for DPR capped at 2, avoid unbounded arrays or costly loops, cap delta time, and provide a start/pause/restart button.',
 'Make a complete playable mini-game, NOT a still image, static mock-up or placeholder. This can be 3D-inspired, but do not claim it is photorealistic AAA quality.',
 'When asked for a racing car game, choose the rich 3rd-person behind-car view by default.'
].join('\n');
function send(res,status,payload){return res.status(status).json(payload);}
function validProject(p){
 return p&&typeof p==='object'&&!Array.isArray(p)
 &&['html','css','js'].every(k=>typeof p[k]==='string'&&p[k].length<=LIMITS[k])
 &&typeof p.title==='string'&&p.title.length<=110
 &&typeof p.explanation==='string'&&p.explanation.length<=LIMITS.explanation
 &&(p.html.trim().length>=15||p.js.trim().length>=15);
}
function parseGenerated(value){
 const raw=String(value||'').trim().replace(/^\x60{3}(?:json)?\s*/i,'').replace(/\s*\x60{3}$/,'');
 let p;
 try{p=JSON.parse(raw);}
 catch{
   const first=raw.indexOf('{'),last=raw.lastIndexOf('}');
   if(first<0||last<first)throw Error('bad JSON');
   p=JSON.parse(raw.slice(first,last+1));
 }
 if(!validProject(p))throw Error('invalid project');
 return {title:p.title.trim()||'MADAR creation',html:p.html,css:p.css,js:p.js,explanation:p.explanation.trim()};
}
module.exports=async function builder(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Referrer-Policy','no-referrer');
 if(req.method!=='POST')return send(res,405,{error:'Use POST to build a project.'});
 if(req.headers?.origin){
  try{if(new URL(req.headers.origin).host!==req.headers.host)return send(res,403,{error:'Origin denied.'});}
  catch{return send(res,403,{error:'Invalid origin.'});}
 }
 if(!String(req.headers?.['content-type']||'').toLowerCase().startsWith('application/json'))
  return send(res,415,{error:'JSON requests only.'});
 const key=process.env.GEMINI_API_KEY;
 if(!key)return send(res,503,{error:'Gemini is not configured on this server.'});
 let data=req.body;
 if(typeof data==='string'){try{data=JSON.parse(data);}catch{return send(res,400,{error:'Invalid JSON.'});}}
 const prompt=data?.prompt,kind=data?.kind||'website';
 const graphics=data?.graphics===undefined?(kind==='game'?'realistic':'standard'):data.graphics;
 if(typeof prompt!=='string'||prompt.trim().length<6||prompt.length>LIMITS.prompt
  ||!['website','game','tool'].includes(kind)||!['realistic','standard'].includes(graphics))
  return send(res,400,{error:'Describe a website, game or tool in 6–1200 characters.'});
 const previous=data?.previous;
 if(previous!==undefined&&(!validProject(previous)
  ||['html','css','js'].reduce((n,k)=>n+previous[k].length,0)>LIMITS.previous))
  return send(res,400,{error:'The previous project is too large for editing.'});
 const addr=String(req.headers?.['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
 const now=Date.now();
 let entry=requestsByIp.get(addr);
 if(!entry||now-entry.start>=900000)entry={start:now,count:0};
 if(entry.count>=6)return send(res,429,{error:'Builder allows 6 generations per 15 minutes on this connection. Try again shortly.'});
 entry.count++;requestsByIp.set(addr,entry);
 if(requestsByIp.size>600)for(const [ip,v] of requestsByIp)if(now-v.start>900000)requestsByIp.delete(ip);
 const realistic=kind==='game'&&graphics==='realistic';
 const descriptions=[
  kind==='game'?'Build a PLAYABLE browser game.':kind==='tool'?'Build an INTERACTIVE utility app.':'Build a RESPONSIVE website.',
  realistic?'VISUALS: Realistic 2.5D / cinematic 3D-inspired, convincing perspective and responsive physics, not emoji or blocks.':'VISUALS: polished and responsive.',
  'USER IDEA:\n'+prompt.trim()
 ];
 if(previous)descriptions.push('PREVIOUS PROJECT FOR REFINEMENT:\n'+JSON.stringify({title:previous.title,html:previous.html,css:previous.css,js:previous.js}));
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),27000);
 let busy=false,invalid=false;
 try{
  for(const model of (realistic?REALISTIC_MODELS:MODELS)){
   let response;
   try{
    response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent',{
     method:'POST',signal:controller.signal,
     headers:{'Content-Type':'application/json','x-goog-api-key':key},
     body:JSON.stringify({
      systemInstruction:{parts:[{text:SYSTEM+(realistic?'\n'+REALISTIC_SYSTEM:'')}]},
      contents:[{role:'user',parts:[{text:descriptions.join('\n\n')}]}],
      generationConfig:{responseMimeType:'application/json',maxOutputTokens:realistic?13500:11000,temperature:0.65}
     })
    });
   }catch(error){
    if(controller.signal.aborted)return send(res,504,{error:'Builder took too long. Try a shorter project idea.'});
    busy=true;continue;
   }
   const result=await response.json().catch(()=>({}));
   if(response.status===404||response.status===400)continue;
   if(!response.ok){
    const status=String(result?.error?.status||'');
    if(response.status===429||status==='RESOURCE_EXHAUSTED')return send(res,429,{error:'The Gemini free quota is currently exhausted. Please try again later.'});
    if(response.status===401||response.status===403)return send(res,502,{error:'Gemini key was rejected. Check Google AI Studio.'});
    if([408,500,502,503,504].includes(response.status)){busy=true;continue;}
    return send(res,502,{error:'Gemini rejected this project request. Try describing a simpler project.'});
   }
   const output=(result?.candidates?.[0]?.content?.parts||[])
    .filter(v=>typeof v?.text==='string').map(v=>v.text).join('\n');
   try{return send(res,200,{project:parseGenerated(output)});}
   catch{invalid=true;continue;}
  }
  if(invalid)return send(res,422,{error:'Gemini did not return complete HTML, CSS and JS. Try a shorter idea.'});
  return send(res,busy?503:502,{error:busy?'Gemini is busy. Try again soon.':'No compatible Gemini free model is available for Builder right now.'});
 }catch(error){
  if(controller.signal.aborted)return send(res,504,{error:'Builder timed out. Try again with a simpler idea.'});
  console.warn('MADAR Builder error:',error?.name);
  return send(res,502,{error:'Could not connect to Gemini Builder.'});
 }finally{clearTimeout(timer);}
};