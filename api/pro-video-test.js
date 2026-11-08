'use strict';
// TEMPORARY one-time end-to-end test for MADAR PRO. Remove after use.
module.exports=async function(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('Content-Type','application/json; charset=utf-8');
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 const token=String(req.query?.token||new URL(req.url,'https://madar-pro.invalid').searchParams.get('token')||'');
 if(!process.env.MADAR_PRO_TEST_TOKEN||token!==process.env.MADAR_PRO_TEST_TOKEN)return res.status(404).json({error:'Not found'});
 const key=process.env.MAGIC_HOUR_API_KEY;
 if(!key)return res.status(503).json({error:'Missing Magic Hour key'});
 try{
  const upstream=await fetch('https://api.magichour.ai/v1/text-to-video',{
   method:'POST',
   headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Accept':'application/json'},
   body:JSON.stringify({
    name:'MADAR PRO one-time Kling 3.0 integration test',
    end_seconds:5,
    aspect_ratio:'16:9',
    style:{prompt:'A cinematic aerial shot of the Pyramids of Giza at golden hour, smooth slow camera push-in, realistic desert atmosphere, detailed ancient stone textures, natural warm sunlight.'},
    model:'kling-3.0',
    audio:true,
    resolution:'1080p'
   })
  });
  const data=await upstream.json().catch(()=>null);
  if(!upstream.ok){
   const detail=String(data?.error?.message||data?.message||'').slice(0,250);
   return res.status(upstream.status).json({accepted:false,status:upstream.status,error:detail||'Magic Hour rejected the test request.'});
  }
  const id=data?.id||data?.project_id||data?.project?.id||data?.data?.id;
  if(!id)return res.status(502).json({accepted:false,error:'Magic Hour returned no project ID.',response:data});
  return res.status(202).json({accepted:true,projectId:id,status:data?.status||'queued',creditsCharged:data?.credits_charged??null,model:'kling-3.0',resolution:'1080p',duration:5,audio:true});
 }catch(e){
  return res.status(502).json({accepted:false,error:'Could not reach Magic Hour.'});
 }
};
