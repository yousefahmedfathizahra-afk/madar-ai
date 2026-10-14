'use strict';
// This endpoint deliberately exposes ONLY Supabase public configuration.
// Never place service_role/secret keys here.
module.exports=function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  const url=String(process.env.MADAR_SUPABASE_URL||'').trim();
  const publishableKey=String(process.env.MADAR_SUPABASE_PUBLISHABLE_KEY||'').trim();
  const validUrl=/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url);
  const validKey=/^(sb_publishable_[a-zA-Z0-9_-]+|eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)$/.test(publishableKey);
  if(!validUrl||!validKey)return res.status(200).json({configured:false});
  return res.status(200).json({configured:true,url:url.replace(/\/$/,''),publishableKey});
};
