'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const handler=require('../api/pro-video.js');
let ip=30;
async function invoke(method,body,extra={}){
 const headers={host:'pro.test','content-type':'application/json','x-forwarded-for':'198.51.100.'+(ip++),...extra.headers};
 const res={statusCode:200,headersOut:{},setHeader(k,v){this.headersOut[k]=v;},end(v){this.body=JSON.parse(v);}};
 await handler({method,headers,body,query:extra.query,url:extra.url||'/',socket:{remoteAddress:'203.0.113.4'}},res);
 return {status:res.statusCode,...res.body,headers:res.headersOut};
}
test('Magic Hour text-to-video creates one conservative 5-second AI job',async()=>{
 process.env.MAGIC_HOUR_API_KEY='fake-magic-key';
 let calls=0;
 global.fetch=async(url,options)=>{
  calls++;assert.equal(url,'https://api.magichour.ai/v1/text-to-video');
  assert.equal(options.method,'POST');assert.equal(options.headers.Authorization,'Bearer fake-magic-key');
  const body=JSON.parse(options.body);
  assert.equal(body.end_seconds,5);assert.equal(body.model,'ltx-2.5');assert.equal(body.resolution,'480p');assert.equal(body.audio,false);
  assert.equal(body.aspect_ratio,'9:16');assert.equal(body.style.prompt,'A cinematic city at night with flying cars');
  return {ok:true,status:200,json:async()=>({id:'video_project_123',status:'queued',credits_charged:42})};
 };
 const r=await invoke('POST',{prompt:'A cinematic city at night with flying cars',aspectRatio:'9:16'});
 assert.equal(calls,1);assert.equal(r.status,202);assert.equal(r.projectId,'video_project_123');assert.equal(r.creditsCharged,42);
});
test('Status lookup returns safe download URLs and never creates another job',async()=>{
 process.env.MAGIC_HOUR_API_KEY='fake-magic-key';
 global.fetch=async(url,options)=>{
  assert.equal(url,'https://api.magichour.ai/v1/video-projects/video_project_123');
  assert.equal(options.method,'GET');
  return {ok:true,status:200,json:async()=>({id:'video_project_123',status:'complete',credits_charged:42,downloads:[{url:'https://cdn.example/video.mp4',expires_at:'soon'}]})};
 };
 const r=await invoke('GET',undefined,{query:{id:'video_project_123'}});
 assert.equal(r.status,200);assert.equal(r.status,'complete');assert.deepEqual(r.downloads,['https://cdn.example/video.mp4']);
});
test('Missing Magic Hour key is reported without calling the provider',async()=>{
 delete process.env.MAGIC_HOUR_API_KEY;
 global.fetch=async()=>{throw Error('must not call');};
 const r=await invoke('POST',{prompt:'A cinematic sunset over the sea'});
 assert.equal(r.status,503);assert.match(r.error,/Magic Hour/);
});
test('Insufficient credits are not converted into purchases or retries',async()=>{
 process.env.MAGIC_HOUR_API_KEY='fake-magic-key';let calls=0;
 global.fetch=async()=>{calls++;return {ok:false,status:402,json:async()=>({message:'insufficient credits'})};};
 const r=await invoke('POST',{prompt:'A cinematic sunset over the sea'});
 assert.equal(r.status,402);assert.match(r.error,/لم نحاول الشراء أو الشحن/);assert.equal(calls,1);
});
test('Invalid prompts, foreign origins and methods are rejected',async()=>{
 process.env.MAGIC_HOUR_API_KEY='fake-magic-key';
 global.fetch=async()=>{throw Error('must not call');};
 assert.equal((await invoke('POST',{prompt:'short'})).status,400);
 assert.equal((await invoke('POST',{prompt:'A cinematic sunset over the sea'},{headers:{origin:'https://evil.example'}})).status,403);
 assert.equal((await invoke('PUT',{})).status,405);
});
