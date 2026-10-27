'use strict';
const {configReady,getLink,json}=require('./_shared');
module.exports=function(req,res){
 if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
 return json(res,200,{configured:configReady(),connected:configReady()&&!!getLink(req),preview:true,
   authUrl:'/api/canva/start'});
};
