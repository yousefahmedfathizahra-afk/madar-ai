'use strict';
const {crypto,REDIRECT_URI,CANVA_API,configReady,decrypt,getCookie,setCookie,encrypt,json}=require('./_shared');
module.exports=async function(req,res){
 if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
 if(!configReady())return json(res,503,{error:'Canva not configured'});
 const tx=decrypt(getCookie(req,'madar_canva_auth'));
 setCookie(res,'madar_canva_auth','',0);
 const state=String(req.query?.state||''),code=String(req.query?.code||'');
 if(req.query?.error)return res.redirect(302,'/?canva=cancelled');
 if(!tx||!state||!code||Date.now()-tx.created>600000||tx.created>Date.now()+60000
  ||state.length!==String(tx.state||'').length
  ||!crypto.timingSafeEqual(Buffer.from(state),Buffer.from(String(tx.state||''))))
  return res.redirect(302,'/?canva=invalid');
 try{
  const credentials=Buffer.from(process.env.CANVA_CLIENT_ID+':'+process.env.CANVA_CLIENT_SECRET).toString('base64');
  const body=new URLSearchParams({grant_type:'authorization_code',code,code_verifier:tx.verifier,redirect_uri:REDIRECT_URI});
  const r=await fetch(CANVA_API+'/oauth/token',{method:'POST',signal:AbortSignal.timeout(12000),
   headers:{Authorization:'Basic '+credentials,'Content-Type':'application/x-www-form-urlencoded'},body});
  const j=await r.json().catch(()=>null);
  if(!r.ok||typeof j?.refresh_token!=='string'||!j?.access_token)return res.redirect(302,'/?canva=failed');
  const encrypted=encrypt({refresh:j.refresh_token,expires:Date.now()+14*86400000});
  // Browser cookies must not exceed ~4KB. Fail safely; never write tokens to client-side JS.
  if(encrypted.length>3200)return res.redirect(302,'/?canva=too_large');
  setCookie(res,'madar_canva_link',encrypted,14*86400);
  return res.redirect(302,'/?canva=connected');
 }catch(e){
  console.warn('Canva OAuth exchange failed:',String(e?.name||'unknown'));
  return res.redirect(302,'/?canva=failed');
 }
};
