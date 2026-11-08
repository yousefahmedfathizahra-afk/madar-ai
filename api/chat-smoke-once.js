'use strict';
// TEMPORARY one-time smoke test for the live MADAR chat handler. Remove after use.
const chat=require('./chat');
module.exports=async function(req,res){
 res.setHeader('Cache-Control','no-store, no-cache, must-revalidate');
 res.setHeader('X-Robots-Tag','noindex');
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 let token='';
 try{token=new URL(req.url,'https://madar.invalid').searchParams.get('token')||'';}catch{}
 if(!process.env.MADAR_CHAT_TEST_TOKEN||token!==process.env.MADAR_CHAT_TEST_TOKEN)return res.status(404).json({error:'Not found'});
 const fakeReq={
  method:'POST',
  headers:{'content-type':'application/json','host':req.headers.host||'madar-ai-yousef.vercel.app','x-forwarded-for':'127.0.0.88'},
  socket:{remoteAddress:'127.0.0.88'},
  body:{mode:'chat',messages:[{role:'user',content:'كم يساوي 2+2؟ أجب بالرقم 4 فقط.'}]}
 };
 const fakeRes={
  statusCode:200,body:null,
  setHeader(){},
  status(code){this.statusCode=code;return this;},
  json(body){this.body=body;return body;}
 };
 try{
  await chat(fakeReq,fakeRes);
  const reply=String(fakeRes.body?.reply||'');
  const ok=fakeRes.statusCode===200&&reply.trim()!==''&&/(?:^|\\D)4(?:\\D|$)|٤/.test(reply);
  return res.status(ok?200:502).json({ok,status:fakeRes.statusCode,reply:reply.slice(0,180),error:fakeRes.body?.error||null});
 }catch(e){
  return res.status(502).json({ok:false,error:'Chat smoke test failed safely.',detail:String(e?.message||e).slice(0,160)});
 }
};
