'use strict';
const {crypto,REDIRECT_URI,AUTH_URL,configReady,encrypt,setCookie,json}=require('./_shared');
module.exports=async function(req,res){
 if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
 if(!configReady())return json(res,503,{error:'Canva integration is awaiting owner setup in Canva Developers.'});
 const state=crypto.randomBytes(20).toString('base64url');
 const verifier=crypto.randomBytes(48).toString('base64url');
 const challenge=crypto.createHash('sha256').update(verifier).digest('base64url');
 // OAuth transaction lives in an encrypted, per-browser, short-lived httpOnly cookie.
 setCookie(res,'madar_canva_auth',encrypt({state,verifier,created:Date.now()}),600);
 const u=new URL(AUTH_URL);
 u.searchParams.set('response_type','code');
 u.searchParams.set('client_id',process.env.CANVA_CLIENT_ID);
 u.searchParams.set('scope','asset:write');
 u.searchParams.set('redirect_uri',REDIRECT_URI);
 u.searchParams.set('code_challenge_method','S256');
 u.searchParams.set('code_challenge',challenge);
 u.searchParams.set('state',state);
 res.setHeader('Cache-Control','no-store');
 return res.redirect(302,u.href);
};
