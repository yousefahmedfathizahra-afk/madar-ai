'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const handler=require('../api/pro-chat.js');
let nextIp=10;
async function invoke(body,extras={}){
 const headers={host:'pro.test','content-type':'application/json','x-forwarded-for':'198.51.100.'+(nextIp++),...extras.headers};
 const res={statusCode:200,setHeader(){},end(value){this.body=JSON.parse(value)}};
 await handler({method:extras.method||'POST',headers,body,socket:{remoteAddress:'203.0.113.7'}},res);
 return {status:res.statusCode,...res.body};
}
const req={provider:'auto',language:'ar-mixed',messages:[{role:'user',content:'2+2'}]};
test('A free PRO chat reply is returned without leaking model identity',async()=>{
 process.env.MADAR_PRO_OPENROUTER_API_KEY='fake-free-only-key';
 global.fetch=async(url,options)=>{
  assert.equal(url,'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(options.headers.Authorization,'Bearer fake-free-only-key');
  const data=JSON.parse(options.body);
  assert.equal(data.model,'openrouter/free');
  assert.equal(data.messages.at(-1).content,'2+2');
  return {ok:true,status:200,json:async()=>({choices:[{message:{content:'4'}}]})};
 };
 const r=await invoke(req);
 assert.deepEqual(r,{status:200,reply:'4'});
});
test('Free router supports image content while retaining zero-price model',async()=>{
 process.env.MADAR_PRO_OPENROUTER_API_KEY='fake-free-only-key';
 global.fetch=async(url,options)=>{
  const data=JSON.parse(options.body);
  assert.equal(data.model,'openrouter/free');
  assert.equal(data.messages.at(-1).content[1].image_url.url,'data:image/png;base64,YWJjZA==');
  return {ok:true,status:200,json:async()=>({choices:[{message:{content:'اشرح الصورة'}}]})};
 };
 const r=await invoke({...req,image:{mimeType:'image/png',data:'YWJjZA=='}});
 assert.equal(r.status,200);
 assert.equal(r.reply,'اشرح الصورة');
});
test('Every non-automatic or paid provider selector is denied',async()=>{
 process.env.MADAR_PRO_OPENROUTER_API_KEY='fake-free-only-key';
 global.fetch=async()=>{throw Error('should never fetch for paid provider');};
 for(const provider of ['gemini','deepseek','pro','openrouter/auto','unknown']){
  const r=await invoke({...req,provider});
  assert.equal(r.status,400);
 }
});
test('No dedicated PRO key returns honest message and never accesses Free secrets',async()=>{
 delete process.env.MADAR_PRO_OPENROUTER_API_KEY;
 process.env.GEMINI_API_KEY='FREE_SITE_KEY_MUST_NOT_USE';
 global.fetch=async()=>{throw Error('Must not call provider');};
 const r=await invoke(req);
 assert.equal(r.status,503);
 assert.match(r.error,/PRO/);
});
test('Reject cross-origin, invalid content type and non-POST methods',async()=>{
 assert.equal((await invoke(req,{headers:{origin:'https://evil.example'}})).status,403);
 assert.equal((await invoke(req,{headers:{'content-type':'text/plain'}})).status,415);
 assert.equal((await invoke(req,{method:'GET'})).status,405);
});
test('Graceful free-tier quota failure',async()=>{
 process.env.MADAR_PRO_OPENROUTER_API_KEY='fake-free-only-key';
 global.fetch=async()=>({ok:false,status:429,json:async()=>({error:{message:'Free tier limit'}})});
 const r=await invoke(req);
 assert.equal(r.status,429);
 assert.match(r.error,/حد استخدام/);
});

test('Invalid OpenRouter key 401 explains next step without leaking credentials',async()=>{
 process.env.MADAR_PRO_OPENROUTER_API_KEY='mock-pro-key';
 global.fetch=async()=>({ok:false,status:401,json:async()=>({error:'secret provider detail'})});
 const r=await invoke(req);
 assert.equal(r.status,503);
 assert.match(r.error,/401/);
 assert.ok(!r.error.includes('secret provider detail'));
});
test('Account permissions 403 are distinct from invalid key 401',async()=>{
 process.env.MADAR_PRO_OPENROUTER_API_KEY='mock-pro-key';
 global.fetch=async()=>({ok:false,status:403,json:async()=>({error:'provider detail'})});
 const r=await invoke(req);
 assert.equal(r.status,503);
 assert.match(r.error,/403/);
});
