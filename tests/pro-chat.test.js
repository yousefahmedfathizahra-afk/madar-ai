'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const handler=require('../api/pro-chat.js');
const TEST_IPS=['10.91.1.1','10.91.1.2','10.91.1.3','10.91.1.4','10.91.1.5','10.91.1.6','10.91.1.7'];
let index=0;
async function invoke(body,extras={}){
 const headers={'host':'pro.local','content-type':'application/json','x-forwarded-for':TEST_IPS[index++%TEST_IPS.length],...(extras.headers||{})};
 const res={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},end(json){this.payload=JSON.parse(json);}};
 await handler({method:extras.method||'POST',headers,body,socket:{remoteAddress:'test'}},res);
 return {status:res.statusCode,...res.payload};
}
function sample(provider){return {provider,messages:[{role:'user',content:'2+2'}],language:'ar-mixed'};}
test('Gemini returns an actual reply on PRO-only route',async()=>{
 process.env.MADAR_PRO_GEMINI_API_KEY='mock-gemini-key';
 global.fetch=async(url,opts)=>{
  assert.match(url,/generativelanguage\.googleapis\.com/);
  assert.equal(opts.headers['x-goog-api-key'],'mock-gemini-key');
  assert.equal(JSON.parse(opts.body).contents.at(-1).parts[0].text,'2+2');
  return {ok:true,status:200,json:async()=>({candidates:[{content:{parts:[{text:'4'}]}}]})};
 };
 const r=await invoke(sample('gemini'));
 assert.equal(r.status,200);assert.equal(r.reply,'4');assert.equal('model' in r,false);assert.equal('provider' in r,false);
});
test('DeepSeek R1 uses free OpenRouter model and returns a real reply',async()=>{
 process.env.MADAR_PRO_OPENROUTER_API_KEY='mock-openrouter-key';
 global.fetch=async(url,opts)=>{
  assert.equal(url,'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(JSON.parse(opts.body).model,'deepseek/deepseek-r1:free');
  return {ok:true,status:200,json:async()=>({choices:[{message:{content:'4'}}]})};
 };
 const r=await invoke(sample('deepseek'));
 assert.equal(r.status,200);assert.equal(r.reply,'4');assert.equal('model' in r,false);assert.equal('provider' in r,false);
});
test('Paid Gemini Pro is blocked by default',async()=>{
 delete process.env.MADAR_PRO_ALLOW_PAID_MODELS;
 const r=await invoke(sample('pro'));assert.equal(r.status,403);assert.match(r.error,/مدفوع/);
});
test('Invalid provider is rejected',async()=>{
 const r=await invoke(sample('unknown'));assert.equal(r.status,400);
});
test('Cross-origin browser requests are blocked',async()=>{
 const r=await invoke(sample('auto'),{headers:{origin:'https://not-pro.local'}});
 assert.equal(r.status,403);
});
test('GET is rejected',async()=>{const r=await invoke({}, {method:'GET'});assert.equal(r.status,405);});
test('No provider keys returns honest error without touching Free key',async()=>{
 delete process.env.MADAR_PRO_GEMINI_API_KEY;
 delete process.env.MADAR_PRO_OPENROUTER_API_KEY;
 process.env.GEMINI_API_KEY='free-key-MUST-NOT-USE';
 global.fetch=async()=>{throw new Error('Free should not be called');};
 const r=await invoke(sample('auto'));assert.equal(r.status,503);assert.match(r.error,/PRO/);
});

test('Auto uses vision route for an attached photo',async()=>{
 process.env.MADAR_PRO_GEMINI_API_KEY='mock-gemini-key';
 process.env.MADAR_PRO_OPENROUTER_API_KEY='mock-openrouter-key';
 global.fetch=async(url,opts)=>{
  assert.match(url,/generativelanguage\.googleapis\.com/);
  const req=JSON.parse(opts.body);
  assert.equal(req.contents.at(-1).parts[1].inline_data.mime_type,'image/png');
  assert.equal(req.generationConfig.thinkingConfig.thinkingLevel,'medium');
  assert.equal(req.generationConfig.temperature,undefined);
  return {ok:true,status:200,json:async()=>({candidates:[{content:{parts:[{text:'الصورة واضحة'}]}}]})};
 };
 const r=await invoke({provider:'auto',messages:[{role:'user',content:'اشرح الصورة'}],image:{mimeType:'image/png',data:'YWJjZA=='}});
 assert.equal(r.status,200);assert.equal(r.reply,'الصورة واضحة');
});
test('Automatic routing hides the provider name from the reply payload',async()=>{
 process.env.MADAR_PRO_GEMINI_API_KEY='mock-gemini-key';
 global.fetch=async()=>({ok:true,status:200,json:async()=>({candidates:[{content:{parts:[{text:'نجح'}]}}]})});
 const r=await invoke(sample('auto'));
 assert.equal(r.status,200);assert.deepEqual(Object.keys(r).sort(),['reply','status']);
});
