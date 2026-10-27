'use strict';
// MADAR Canva Connect API: per-visitor OAuth session, never owner's credentials.
// Server-side AES-GCM cookies. In preview, Canva image generation requires asset:write.
const crypto=require('node:crypto');
const REDIRECT_URI='https://madar-ai-yousef.vercel.app/api/canva/callback';
const AUTH_URL='https://www.canva.com/api/oauth/authorize';
const CANVA_API='https://api.canva.com/rest/v1';
function configReady(){
 return !!(process.env.CANVA_CLIENT_ID&&process.env.CANVA_CLIENT_SECRET&&
   process.env.CANVA_COOKIE_SECRET&&process.env.CANVA_COOKIE_SECRET.length>=32);
}
function key(){
 if(!configReady())throw Error('Canva configuration missing');
 return crypto.createHash('sha256').update(process.env.CANVA_COOKIE_SECRET).digest();
}
function encrypt(obj){
 const nonce=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key(),nonce);
 const text=Buffer.from(JSON.stringify(obj),'utf8');
 const ciphertext=Buffer.concat([cipher.update(text),cipher.final()]);
 return Buffer.concat([nonce,cipher.getAuthTag(),ciphertext]).toString('base64url');
}
function decrypt(payload){
 try{
  const bytes=Buffer.from(String(payload||''),'base64url');
  if(bytes.length<29)return null;
  const dec=crypto.createDecipheriv('aes-256-gcm',key(),bytes.subarray(0,12));
  dec.setAuthTag(bytes.subarray(12,28));
  return JSON.parse(Buffer.concat([dec.update(bytes.subarray(28)),dec.final()]).toString('utf8'));
 }catch{return null;}
}
function getCookie(req,name){
 const raw=String(req.headers.cookie||'');
 for(const pair of raw.split(';')){
  const i=pair.indexOf('=');
  if(i>0&&pair.slice(0,i).trim()===name)return pair.slice(i+1).trim();
 }
 return '';
}
function setCookie(res,name,value,ttlSeconds){
 const cookie=name+'='+value+'; Path=/api/canva; HttpOnly; Secure; SameSite=Lax; Max-Age='+ttlSeconds;
 const existing=res.getHeader('Set-Cookie');
 res.setHeader('Set-Cookie',existing?[].concat(existing,cookie):cookie);
}
function json(res,code,payload){
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 return res.status(code).json(payload);
}
function sameOrigin(req){
 try{return !req.headers.origin||new URL(req.headers.origin).host===req.headers.host}
 catch{return false}
}
function getLink(req){
 const session=decrypt(getCookie(req,'madar_canva_link'));
 if(!session||typeof session.refresh!=='string'||session.expires<Date.now())return null;
 return session;
}
async function freshToken(req,res){
 const session=getLink(req);
 if(!session)return null;
 const credential=Buffer.from(process.env.CANVA_CLIENT_ID+':'+process.env.CANVA_CLIENT_SECRET).toString('base64');
 const body=new URLSearchParams({grant_type:'refresh_token',refresh_token:session.refresh});
 const timeout=AbortSignal.timeout(12000);
 const r=await fetch(CANVA_API+'/oauth/token',{method:'POST',signal:timeout,
  headers:{Authorization:'Basic '+credential,'Content-Type':'application/x-www-form-urlencoded'},body});
 const data=await r.json().catch(()=>null);
 if(!r.ok||!data?.access_token||!data?.refresh_token){
  setCookie(res,'madar_canva_link','',0);
  return null;
 }
 setCookie(res,'madar_canva_link',encrypt({refresh:data.refresh_token,expires:Date.now()+86400000*14}),86400*14);
 return data.access_token;
}
module.exports={crypto,REDIRECT_URI,AUTH_URL,CANVA_API,configReady,encrypt,decrypt,getCookie,setCookie,json,sameOrigin,getLink,freshToken};
