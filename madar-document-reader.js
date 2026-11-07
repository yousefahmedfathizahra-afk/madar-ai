(function () {
'use strict';
/**
 * MADAR document extractor (client-side only). No raw file bytes are uploaded.
 * Supported: UTF-8 text/code, PDF, DOCX, PPTX, XLSX. Limited text excerpts go to chat.
 * Heavy document parsers are lazy-loaded only when the user selects that file type.
 */
const TEXT_EXT = new Set(['txt','md','markdown','csv','json','jsonl','log','html','htm','css','js','jsx','ts','tsx','py','java','c','cpp','h','hpp','go','rs','sql','sh','bat','ini','xml','yml','yaml','svg','tex']);
const FORMATS = new Set([...TEXT_EXT,'pdf','docx','pptx','xlsx']);
const MAX_FILE_BYTES=10*1024*1024;
const PDF_URL='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDF_WORKER_URL='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const MAMMOTH_URL='https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.9.1/mammoth.browser.min.js';
const JSZIP_URL='https://cdn.jsdelivr.net/npm/jszip@3.10.2/dist/jszip.min.js';
const loads = {};
function extOf(name){return String(name||'').split('.').pop().toLowerCase();}
function safeName(name){return String(name||'file').replace(/[\r\n\u0000-\u001F]/g,' ').slice(0,120);}
function loadJs(key,url,ready){
 if(ready())return Promise.resolve();
 if(loads[key])return loads[key];
 loads[key]=new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  const timeout=setTimeout(()=>{script.remove();loads[key]=null;reject(new Error('تعذر تحميل قارئ المستندات. تأكد من اتصال الإنترنت وحاول مجددًا.'));},18000);
  script.async=true;script.src=url;script.crossOrigin='anonymous';
  script.onload=()=>{clearTimeout(timeout);if(ready())resolve();else{loads[key]=null;reject(new Error('تعذر تشغيل مكتبة قراءة المستند.'));}};
  script.onerror=()=>{clearTimeout(timeout);loads[key]=null;reject(new Error('المتصفح لم يتمكن من تحميل قارئ الملف.'));};
  document.head.append(script);
 });
 return loads[key];
}
function xmlNodes(xml,ns,name){return Array.from(xml.getElementsByTagNameNS(ns,name));}
const SHEET_NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const DRAW_NS='http://schemas.openxmlformats.org/drawingml/2006/main';
function extractXml(xml){const d=new DOMParser().parseFromString(xml,'application/xml');if(d.getElementsByTagName('parsererror').length)throw Error('محتوى المستند غير صالح.');return d;}
async function readPdf(file,limit){
 await loadJs('pdf',PDF_URL,()=>!!window.pdfjsLib?.getDocument);
 window.pdfjsLib.GlobalWorkerOptions.workerSrc=PDF_WORKER_URL;
 const pdf=await window.pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
 const parts=[];
 let length=0;
 try{
  for(let pageNo=1;pageNo<=Math.min(pdf.numPages,30);pageNo++){
   const page=await pdf.getPage(pageNo);
   const rows=await page.getTextContent();
   const line='[صفحة '+pageNo+']\n'+rows.items.map(x=>x.str||'').join(' ');
   parts.push(line);length+=line.length;if(length>=limit+1000)break;
  }
 }finally{try{await pdf.destroy()}catch{}}
 return {text:parts.join('\n'),pages:pdf.numPages};
}
async function readDocx(file){
 await loadJs('mammoth',MAMMOTH_URL,()=>!!window.mammoth?.extractRawText);
 const result=await window.mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()});
 return {text:String(result.value||'')};
}
async function readOffice(file,kind,limit){
 await loadJs('jszip',JSZIP_URL,()=>!!window.JSZip?.loadAsync);
 const zip=await window.JSZip.loadAsync(await file.arrayBuffer());
 let text='';
 if(kind==='pptx'){
  const names=Object.keys(zip.files).filter(k=>/^ppt\/slides\/slide\d+\.xml$/i.test(k)).sort((a,b)=>Number(a.match(/slide(\d+)/i)[1])-Number(b.match(/slide(\d+)/i)[1])).slice(0,25);
  for(const name of names){
   const doc=extractXml(await zip.file(name).async('text'));
   const words=xmlNodes(doc,DRAW_NS,'t').map(n=>n.textContent).filter(Boolean);
   text+='[شريحة '+name.match(/slide(\d+)/i)[1]+']\n'+words.join(' ')+'\n';
   if(text.length>=limit+1000)break;
  }
 }else{
  let shared=[];
  const sharedFile=zip.file('xl/sharedStrings.xml');
  if(sharedFile){
   const d=extractXml(await sharedFile.async('text'));
   shared=xmlNodes(d,SHEET_NS,'si').slice(0,10000).map(node=>xmlNodes(node,SHEET_NS,'t').map(t=>t.textContent).join(''));
  }
  const sheets=Object.keys(zip.files).filter(k=>/^xl\/worksheets\/sheet\d+\.xml$/i.test(k)).sort().slice(0,8);
  for(const name of sheets){
   const d=extractXml(await zip.file(name).async('text'));
   text+='[ورقة '+name.match(/sheet(\d+)/i)[1]+']\n';
   const rows=xmlNodes(d,SHEET_NS,'row').slice(0,150);
   for(const row of rows){
    const values=xmlNodes(row,SHEET_NS,'c').slice(0,30).map(c=>{
     const v=xmlNodes(c,SHEET_NS,'v')[0]?.textContent||'';
     if(c.getAttribute('t')==='s')return shared[Number(v)]||'';
     if(c.getAttribute('t')==='inlineStr')return xmlNodes(c,SHEET_NS,'t').map(x=>x.textContent).join('');
     return v;
    });
    text+=values.join(' | ')+'\n';if(text.length>=limit+1000)break;
   }
   if(text.length>=limit+1000)break;
  }
 }
 return {text};
}
async function read(file,options={}){
 if(!file||typeof file.name!=='string')throw Error('اختار ملف صالح الأول.');
 const extension=extOf(file.name);
 if(!FORMATS.has(extension))throw Error('نوع الملف ده مش مدعوم. جرّب PDF أو Word أو PowerPoint أو Excel أو TXT أو ملف كود.');
 if(file.size>MAX_FILE_BYTES)throw Error('الحد الأقصى للملف 10 ميجابايت. قلّل حجمه وجرّب تاني.');
 if(file.size<1)throw Error('الملف فاضي.');
 const maxChars=Math.min(14000,Math.max(1000,Number(options.maxChars)||4000));
 let result;
 try{
  if(TEXT_EXT.has(extension))result={text:await file.text()};
  else if(extension==='pdf')result=await readPdf(file,maxChars);
  else if(extension==='docx')result=await readDocx(file);
  else result=await readOffice(file,extension,maxChars);
 }catch(e){throw Error('مش قادر أقرأ '+extension.toUpperCase()+' ده: '+String(e?.message||'').slice(0,180));}
 const raw=String(result.text||'').replace(/\u0000/g,'').replace(/\r\n/g,'\n').trim();
 if(!raw)throw Error('الملف مفيهوش نص قابل للقراءة. لو PDF عبارة عن صور ممسوحة، ابعت صور الصفحات من زر الصورة.');
 const clipped=raw.slice(0,maxChars);
 return {name:safeName(file.name),kind:extension,text:clipped,truncated:raw.length>maxChars || (extension==='pdf'&&result.pages>30),size:file.size};
}
window.MadarDocumentReader=Object.freeze({read,formats:[...FORMATS],maxFileBytes:MAX_FILE_BYTES});
})();
