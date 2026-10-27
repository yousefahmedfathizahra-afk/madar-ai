/* MADAR BUILDER: natural-language website/game maker.
 * Gemini runs on /api/builder with the existing backend key.
 * Generated JS runs ONLY in an opaque-origin sandboxed iframe with restrictive CSP.
 */
(function(){
'use strict';
const get=id=>document.getElementById(id);
const dialog=get('madarBuilderDialog');
if(!dialog)return;
const form=get('madarBuilderForm');
const idea=get('madarBuilderIdea');
const kind=get('madarBuilderKind');
const graphics=get('madarBuilderGraphics');
const graphicsRow=get('madarBuilderGraphicsRow');
const submit=get('madarBuilderGenerate');
const status=get('madarBuilderStatus');
const results=get('madarBuilderResults');
const frame=get('madarBuilderPreview');
const heading=get('madarBuilderProjectTitle');
const description=get('madarBuilderExplanation');
const download=get('madarBuilderDownload');
const apply=get('madarBuilderApply');
const refine=get('madarBuilderRefine');
const device=get('madarBuilderDevice');
const editor={html:get('madarBuilderHtml'),css:get('madarBuilderCss'),js:get('madarBuilderJs')};
const CACHE='madar_builder_last_v1';
const POLICY=[
 "default-src 'none'",
 "script-src 'unsafe-inline'",
 "style-src 'unsafe-inline'",
 "img-src data: blob:",
 "font-src data:",
 "media-src data: blob:",
 "connect-src 'none'",
 "frame-src 'none'",
 "object-src 'none'",
 "worker-src 'none'",
 "form-action 'none'",
 "base-uri 'none'",
 "navigate-to 'none'"
].join('; ');
let current=null,busy=false,requestController=null;
function updateGraphicsChoice(){graphicsRow.hidden=kind.value!=='game';}
function report(message,error=false){
 status.textContent=String(message||'');
 status.classList.toggle('bad',!!error);
}
function validProject(p){
 return p&&typeof p==='object'&&typeof p.title==='string'
  &&['html','css','js'].every(key=>typeof p[key]==='string')
  &&typeof p.explanation==='string'
  &&p.html.length<=22000&&p.css.length<=20000&&p.js.length<=26000
  &&p.title.length<=110&&p.explanation.length<=800;
}
function save(){
 if(!current)return;
 try{localStorage.setItem(CACHE,JSON.stringify(current));}
 catch{report('Preview ready. Browser storage is full, so download your project to keep it.',true);}
}
function load(){
 try{
  const saved=JSON.parse(localStorage.getItem(CACHE)||'null');
  return validProject(saved)?saved:null;
 }catch{return null;}
}
// The user-supplied snippets are never added to the MADAR parent DOM.
// The iframe is sandboxed without allow-same-origin and cannot read MADAR cookies,
// storage or conversations. Its CSP also blocks network requests.
function standalone(p){
 const title=String(p.title||'MADAR Project').replace(/[&<>"']/g,c=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
 })[c]);
 const css=String(p.css||'').replace(/<\s*\/\s*style/gi,'<\\/style');
 const js=String(p.js||'').replace(/<\s*\/\s*script/gi,'<\\/script');
 return '<!doctype html>\n<html lang="en">\n<head>\n'
  +'<meta charset="utf-8">\n'
  +'<meta name="viewport" content="width=device-width,initial-scale=1">\n'
  +'<meta name="referrer" content="no-referrer">\n'
  +'<meta http-equiv="Content-Security-Policy" content="'+POLICY+'">\n'
  +'<title>'+title+'</title>\n<style>\n'+css+'\n</style>\n</head>\n'
  +'<body>\n'+String(p.html||'')+'\n<script>\n'+js+'\n<\/script>\n</body>\n</html>';
}
function refresh(){
 if(!current)return;
 // DOM property writes, no innerHTML in the privileged parent document.
 frame.srcdoc=standalone(current);
 heading.textContent=current.title||'MADAR creation';
 description.textContent=current.explanation||'Your project is ready. Edit, preview and download it.';
 results.hidden=false;
 for(const key of ['html','css','js'])editor[key].value=current[key];
 save();
}
function open(){
 if(!dialog.open)dialog.showModal();
 if(!current)current=load();
 if(current&&results.hidden)refresh();
 const chatDraft=get('prompt')?.value?.trim()||'';
 if(chatDraft&&!idea.value.trim())idea.value=chatDraft.slice(0,1200);
 idea.focus();
}
function stop(){
 requestController?.abort();
 requestController=null;
 busy=false;
 submit.disabled=false;
 submit.textContent='✨ Build project';
 refine.disabled=!current;
}
function close(){
 stop();
 dialog.close();
}
function setBusy(value){
 busy=value;
 submit.disabled=value;
 submit.textContent=value?'⏳ MADAR is building...':'✨ Build project';
 refine.disabled=value||!current;
 apply.disabled=value;
 download.disabled=value||!current;
}
function errorMessage(response,data){
 if(data?.error&&typeof data.error==='string')return data.error.slice(0,300);
 if(response.status===429)return 'Gemini free quota or Builder request limit reached. Please try later.';
 if(response.status===504)return 'This project took too long. Try a simpler idea.';
 return 'MADAR Builder is temporarily unavailable. Try again.';
}
async function generate(keepPrevious){
 if(busy)return;
 const prompt=idea.value.trim();
 if(prompt.length<6){report('اكتب فكرتك في 6 حروف على الأقل، زي: اعملي لعبة سباق عربيات.',true);idea.focus();return;}
 if(prompt.length>1200){report('Shorten your idea to 1200 characters.',true);return;}
 const previous=keepPrevious&&current?current:undefined;
 setBusy(true);
 report(previous?'✨ Updating your existing project with Gemini...':'✨ Gemini is building your project. This may take around 10–30 seconds...');
 const controller=new AbortController();
 requestController=controller;
 const timer=setTimeout(()=>controller.abort(),33000);
 try{
  const response=await fetch('/api/builder',{
   method:'POST',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({prompt,kind:kind.value,graphics:kind.value==='game'?graphics.value:'standard',previous}),
   signal:controller.signal
  });
  const type=response.headers?.get('content-type')||'';
  const data=type.includes('application/json')?await response.json().catch(()=>null):null;
  if(!response.ok)throw Error(errorMessage(response,data));
  if(!validProject(data?.project))throw Error('Gemini returned an incomplete project. Try again.');
  current=data.project;
  refresh();
  report(data.fallback?'🧩 خادم الذكاء الاصطناعي اتأخر؛ جهّزنا قالب موقع تجريبي جاهز للمعاينة والتعديل والتحميل.':'✅ المشروع جاهز! جربه في المعاينة وعدّل الكود أو نزّله كملف HTML.');
  results.scrollIntoView({behavior:'smooth',block:'nearest'});
 }catch(error){
  report(error?.name==='AbortError'
   ?'Building was cancelled or took too long. Try a smaller project.'
   :String(error?.message||'Builder could not complete this project.'),true);
 }finally{
  clearTimeout(timer);
  requestController=null;
  setBusy(false);
 }
}
form.addEventListener('submit',event=>{event.preventDefault();generate(false);});
kind.addEventListener('change',updateGraphicsChoice);
refine.addEventListener('click',()=>generate(true));
function applyEdits(){
 if(!current||busy)return;
 const changes=Object.fromEntries(['html','css','js'].map(key=>[key,editor[key].value]));
 if(changes.html.length>22000||changes.css.length>20000||changes.js.length>26000){
  report('One of your code files is too large. Shorten it before previewing.',true);return;
 }
 current={...current,...changes};
 refresh();
 report('✅ Updated preview using your edited HTML, CSS and JavaScript.');
}
apply.addEventListener('click',applyEdits);
// Export a portable static project. We write ZIP "store" records ourselves,
// without third-party CDNs, so download also works on offline and restricted browsers.
function zipBytes(files){
 const encoder=new TextEncoder(),parts=[],directory=[];
 const crcTable=new Uint32Array(256);
 for(let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=c&1?(0xedb88320^(c>>>1)):(c>>>1);crcTable[i]=c>>>0;}
 const crc32=(bytes)=>{let c=0xffffffff;for(const x of bytes)c=crcTable[(c^x)&255]^(c>>>8);return(c^0xffffffff)>>>0;};
 let position=0;
 for(const [name,content] of files){
  const file=encoder.encode(content),fileName=encoder.encode(name),crc=crc32(file);
  if(fileName.length>255)throw Error('Filename too long');
  const local=new Uint8Array(30+fileName.length),view=new DataView(local.buffer);
  view.setUint32(0,0x04034b50,true);view.setUint16(4,20,true);view.setUint16(6,0x0800,true);
  view.setUint32(14,crc,true);view.setUint32(18,file.length,true);view.setUint32(22,file.length,true);
  view.setUint16(26,fileName.length,true);local.set(fileName,30);
  parts.push(local,file);
  const central=new Uint8Array(46+fileName.length),dir=new DataView(central.buffer);
  dir.setUint32(0,0x02014b50,true);dir.setUint16(4,20,true);dir.setUint16(6,20,true);dir.setUint16(8,0x0800,true);
  dir.setUint32(16,crc,true);dir.setUint32(20,file.length,true);dir.setUint32(24,file.length,true);
  dir.setUint16(28,fileName.length,true);dir.setUint32(42,position,true);central.set(fileName,46);
  directory.push(central);position+=local.length+file.length;
 }
 const offset=position;
 for(const record of directory){parts.push(record);position+=record.length;}
 const end=new Uint8Array(22),dv=new DataView(end.buffer);
 dv.setUint32(0,0x06054b50,true);dv.setUint16(8,directory.length,true);dv.setUint16(10,directory.length,true);
 dv.setUint32(12,position-offset,true);dv.setUint32(16,offset,true);parts.push(end);
 return new Blob(parts,{type:'application/zip'});
}
function filename(){
 return String(current?.title||'madar-site').normalize('NFKC')
  .replace(/[^\p{L}\p{N}_-]+/gu,'-').slice(0,55).replace(/^-+|-+$/g,'')||'madar-site';
}
function downloadZip(){
 if(!current||busy)return;
 const title=String(current.title||'MADAR Site').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 // Keep a strong static-site CSP in the export; never let generated projects
 // access MADAR cookies, execute third-party scripts, or send network requests.
 const policy=POLICY.replace("script-src 'unsafe-inline'","script-src 'self' 'unsafe-inline'")
  .replace("style-src 'unsafe-inline'","style-src 'self' 'unsafe-inline'");
 const index='<!doctype html>\n<html lang="ar" dir="auto"><head><meta charset="utf-8">'+
  '<meta name="viewport" content="width=device-width,initial-scale=1">'+
  '<meta http-equiv="Content-Security-Policy" content="'+policy+'">'+
  '<meta name="referrer" content="no-referrer"><title>'+title+'</title>'+
  '<link rel="stylesheet" href="style.css"></head><body>\n'+current.html+
  '\n<script src="script.js"></script></body></html>';
 const readme='# '+current.title+'\n\n'+current.explanation+
  '\n\nGenerated by MADAR AI Site Builder.\n\nFILES:\n- index.html: site pages and markup\n- style.css: responsive styles\n- script.js: client-side interactions\n\nHOW TO USE:\nOpen index.html in a browser or deploy this folder on a static HTTPS host such as Vercel.\n\nIMPORTANT: This is a static frontend demo. Real payments, logins, databases, email, booking and server functions require your own backend and secure environment variables. Generated code needs testing and review before production. The CSP intentionally blocks external network requests.\n';
 const zip=zipBytes([['index.html',index],['style.css',current.css],['script.js',current.js],['README.md',readme]]);
 const url=URL.createObjectURL(zip),anchor=document.createElement('a');
 anchor.href=url;anchor.download=filename()+'.zip';anchor.style.display='none';
 document.body.append(anchor);anchor.click();anchor.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
 report('✅ نزل ملف ZIP فيه صفحات HTML والتصميم CSS والكود JavaScript، جاهز للتعديل أو الرفع على استضافة ثابتة.');
}
function downloadHtml(){
 if(!current||busy)return;
 // Download a stand-alone HTML file (containing all three code files + CSP).
 const blob=new Blob([standalone(current)],{type:'text/html;charset=utf-8'});
 const url=URL.createObjectURL(blob);
 const safe=String(current.title||'madar-builder').normalize('NFKC')
  .replace(/[^\p{L}\p{N}_-]+/gu,'-').slice(0,55).replace(/^-+|-+$/g,'');
 const a=document.createElement('a');
 a.href=url;
 a.download=(safe||'madar-builder')+'.html';
 a.style.display='none';
 document.body.append(a);
 a.click();
 a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
 report('⬇ Downloaded a self-contained HTML project. Open it in any modern browser.');
}
download.addEventListener('click',downloadHtml);
get('madarBuilderDownloadZip')?.addEventListener('click',downloadZip);
get('madarBuilderFullscreen')?.addEventListener('click',()=>{if(frame.requestFullscreen)frame.requestFullscreen().catch(()=>report('المتصفح لا يدعم تكبير المعاينة هنا.',true));});
device.addEventListener('click',()=>{
 const small=frame.classList.toggle('mobile');
 device.textContent=small?'🖥 Desktop view':'📱 Mobile view';
});
get('madarBuilderBtn').addEventListener('click',open);
get('madarBuilderClose').addEventListener('click',close);
dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
for(const sample of dialog.querySelectorAll('[data-builder-idea]')){
 sample.addEventListener('click',()=>{
  idea.value=sample.getAttribute('data-builder-idea')||'';
  kind.value=sample.getAttribute('data-builder-kind')||'website';
  graphics.value=sample.getAttribute('data-builder-graphics')||'realistic';
  updateGraphicsChoice();
  idea.focus();
 });
}
// Project source stays only in browser local storage. No secrets, chats or account
// tokens are transferred to the iframe or included in downloaded projects.
// Use realistic 2.5D mode for games by default; classic mode is optional.
graphics.value='realistic';
updateGraphicsChoice();
const restored=load();
if(restored){current=restored;report('Your last project is saved. Open Builder to preview it.');}
function setProject(project){
 if(!validProject(project))throw Error('Invalid MADAR Builder project.');
 current=project;refresh();
}
function downloadProject(project){
 if(!validProject(project))throw Error('Invalid MADAR Builder project.');
 const previous=current;
 current=project;
 try{downloadHtml();}
 finally{current=previous;}
}
window.MADAR_BUILDER={open,setProject,standalone,downloadProject,validProject};
})();