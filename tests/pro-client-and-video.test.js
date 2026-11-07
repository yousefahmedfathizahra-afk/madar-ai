'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const proClient=fs.readFileSync(path.join(root,'madar-pro-client-ai.js'),'utf8');
const videoCode=fs.readFileSync(path.join(root,'madar-pro-video-studio.js'),'utf8');
test('PRO client requires credit consent before login or chat',async()=>{
 let signIns=0,calls=0;
 const window={puter:{ai:{chat:async()=>{calls++;return {message:{content:'4'}}}},auth:{isSignedIn:()=>true,signIn:()=>{signIns++;return Promise.resolve()}}}};
 vm.runInNewContext(proClient,{window,document:{},location:{protocol:'https:'}});
 const client=window.MadarProAI;
 await assert.rejects(()=>client.connect(false),/توافق/);
 assert.equal(client.isConnected(),false);
 assert.equal(signIns,0);assert.equal(calls,0);
 await client.connect(true);
 const answer=await client.chat([{role:'user',content:'2+2'}]);
 assert.equal(answer,'4');assert.equal(calls,1);
});
test('PRO client refuses file:// logins to prevent fake working HTML',async()=>{
 const window={puter:{ai:{chat:async()=>({message:{content:'4'}})},auth:{isSignedIn:()=>true}}};
 vm.runInNewContext(proClient,{window,document:{},location:{protocol:'file:'}});
 await assert.rejects(()=>window.MadarProAI.connect(true),/file|localhost|HTML/);
});
function videoFixture(){
 const nodes={},calls=[];
 function node(id){
  if(nodes[id])return nodes[id];
  return nodes[id]={
   id,dataset:{},checked:false,hidden:false,disabled:false,style:{},value:'',
   events:{},addEventListener(n,fn){this.events[n]=fn;},removeAttribute(){},pause(){},load(){},setAttribute(){}
  };
 }
 for(const id of ['madarVideoRoot','madarVideoPrompt','madarVideoQuality','madarVideoSeconds','madarVideoGenerate','madarVideoSample','madarVideoCredit','madarVideoStatus','madarVideoPreview','madarVideoDownload','madarVideoAudio','madarVideoConnect'])node(id);
 nodes.madarVideoRoot.dataset.videoTier='pro';
 nodes.madarVideoPrompt.value='An amazing cinematic city skyline at sunset with moving camera.';
 nodes.madarVideoQuality.value='4k';nodes.madarVideoSeconds.value='10';
 let authenticated=true;
 const window={puter:{ai:{txt2vid:async(prompt,opts)=>{calls.push({prompt,opts});return {src:'https://example.invalid/sample.mp4'}}},auth:{isSignedIn:()=>authenticated}}};
 vm.runInNewContext(videoCode,{window,document:{getElementById:id=>nodes[id]||null,querySelector:()=>null},location:{protocol:'https:'},setTimeout,clearTimeout});
 return {nodes,calls,setSignedIn:value=>authenticated=value};
}
test('Video sample keeps 4K model but marks test_mode true (no credits)',async()=>{
 const {nodes,calls}=videoFixture();
 await nodes.madarVideoSample.events.click();
 assert.equal(calls.length,1);
 assert.equal(calls[0].opts.model,'kling-3.0');
 assert.equal(calls[0].opts.size,'4k');
 assert.equal(calls[0].opts.seconds,10);
 assert.equal(calls[0].opts.test_mode,true);
 assert.equal(nodes.madarVideoPreview.hidden,false);
});
test('Video generation is blocked without credit consent or login',async()=>{
 const {nodes,calls,setSignedIn}=videoFixture();
 await nodes.madarVideoGenerate.events.click();
 assert.equal(calls.length,0);
 nodes.madarVideoCredit.checked=true;setSignedIn(false);
 await nodes.madarVideoGenerate.events.click();
 assert.equal(calls.length,0);
 setSignedIn(true);
 await nodes.madarVideoGenerate.events.click();
 assert.equal(calls.length,1);
 assert.equal(calls[0].opts.test_mode,false);
});
