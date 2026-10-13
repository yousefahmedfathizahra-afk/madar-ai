'use strict';
module.exports=function health(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 return res.status(200).json({ok:true,configured:!!process.env.GEMINI_API_KEY,provider:'gemini-free'});
};
