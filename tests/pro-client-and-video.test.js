'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
test('PRO video is generated locally and no paid provider or user account is used',()=>{
 const video=read('madar-pro-video-studio.js');
 assert.match(video,/new MediaRecorder/);
 assert.match(video,/captureStream\(24\)/);
 assert.match(video,/URL\.createObjectURL\(blob\)/);
 assert.match(video,/3840,2160/);
 for(const forbidden of ['puter.ai','txt2vid','fetch(','Authorization','credits','signIn('])assert.ok(!video.includes(forbidden),forbidden);
});
test('PRO poster creator is local, with no chargeable image service',()=>{
 const studio=read('pro-studio.js');
 assert.match(studio,/toDataURL\('image\/png'\)/);
 for(const forbidden of ['txt2img','puter.ai','MadarProAI','api/chat'])assert.ok(!studio.includes(forbidden),forbidden);
});
test('PRO interface has no pay/credits or account-link controls',()=>{
 const html=read('pro.html');
 for(const forbidden of ['id="proAiCredit"','id="proConnectAi"','id="madarVideoCredit"','id="madarVideoConnect"','madar-pro-client-ai.js','Connect Puter'])assert.ok(!html.includes(forbidden),forbidden);
 assert.match(html,/data-theme="dark"/);
 assert.match(html,/id="proToolsToggle"/);
 assert.match(html,/id="documentBtn"/);
 assert.match(html,/id="madarVideoRoot"/);
 assert.match(html,/madar-pro-video-studio\.js/);
});
test('Only the independent free-only PRO backend is reachable from chat UI',()=>{
 const html=read('pro.html'),api=read('api/pro-chat.js');
 assert.match(html,/fetch\('\/api\/pro-chat'/);
 assert.ok(!html.includes("fetch('/api/chat'"));
 assert.match(api,/model:'openrouter\/free'/);
 assert.ok(!api.includes('process.env.GEMINI_API_KEY'));
 assert.ok(!api.includes('process.env.OPENAI_API_KEY'));
});
