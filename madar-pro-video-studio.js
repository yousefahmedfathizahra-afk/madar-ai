(function(){
'use strict';
// Locally rendered motion graphics. No network, account, API, credits, or billing.
const $=id=>document.getElementById(id),root=$('madarVideoRoot');if(!root)return;
const idea=$('madarVideoPrompt'),quality=$('madarVideoQuality'),duration=$('madarVideoSeconds'),sample=$('madarVideoSample'),generate=$('madarVideoGenerate'),message=$('madarVideoStatus'),preview=$('madarVideoPreview'),save=$('madarVideoDownload');
let busy=false,lastURL=null;
function info(t,bad=false){message.textContent=t;message.style.color=bad?'#e7a4a1':''}
function codec(){
 if(typeof MediaRecorder==='undefined'||typeof MediaRecorder.isTypeSupported!=='function')throw Error('المتصفح لا يدعم تسجيل الفيديو.');
 const types=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm','video/mp4'];
 const t=types.find(t=>MediaRecorder.isTypeSupported(t));
 if(!t)throw Error('صيغة الفيديو غير مدعومة. جرب Chrome أو Edge.');
 return t;
}
function split(ctx,text,width){
 const words=text.replace(/\s+/g,' ').trim().split(' ').slice(0,25);let line='',lines=[];
 for(const word of words){const next=line?line+' '+word:word;
  if(line&&ctx.measureText(next).width>width){lines.push(line);line=word;if(lines.length>=2)break;}else line=next;
 }
 if(line)lines.push(line);return lines.slice(0,3);
}
function paint(ctx,w,h,t,total,heading){
 const grad=ctx.createLinearGradient(0,0,w,h);
 grad.addColorStop(0,'#090b12');grad.addColorStop(.5,'#181a20');grad.addColorStop(1,'#392715');
 ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
 const cx=w/2,cy=h/2;
 let g=ctx.createRadialGradient(cx+Math.sin(t*.5)*w*.16,cy,0,cx,cy,w*.7);
 g.addColorStop(0,'rgba(245,190,95,.25)');g.addColorStop(1,'rgba(0,0,0,0)');
 ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
 ctx.save();ctx.translate(cx,cy);ctx.rotate(t*.055);
 ctx.strokeStyle='rgba(255,201,118,.18)';ctx.lineWidth=Math.max(1,w/1550);
 for(let i=0;i<12;i++){ctx.beginPath();ctx.ellipse(0,0,w*(.12+i*.024),h*(.17+i*.023),.45,0,Math.PI*2);ctx.stroke();}
 ctx.restore();
 for(let i=0;i<95;i++){
  const z=(i*127+83)%997,x=((z*.013+t*(.002+i%4*.0006))%1)*w,y=((z*.0073+t*.0003)%1)*h;
  const a=.2+Math.abs(Math.sin(t*1.4+i))*.45;
  ctx.fillStyle='rgba(255,224,180,'+a.toFixed(3)+')';
  const sz=Math.max(1,w*(.00035+(i%3)*.0002));ctx.fillRect(x,y,sz,sz);
 }
 const fade=Math.max(0,Math.min(1,t*1.9,(total-t)*2));
 ctx.save();ctx.globalAlpha=fade;ctx.textAlign='center';ctx.direction='rtl';
 ctx.fillStyle='#f0c978';ctx.font='700 '+Math.round(w*.022)+'px system-ui';
 ctx.fillText('MADAR PRO  •  MOTION STUDIO',cx,h*.235,w*.85);
 ctx.fillStyle='#fffaf0';ctx.font='800 '+Math.round(Math.min(w*.056,h*.095))+'px system-ui';
 const lines=split(ctx,heading,w*.8),dy=h*.115,start=cy-(lines.length-1)*dy/2;
 lines.forEach((line,i)=>ctx.fillText(line,cx,start+dy*i,w*.85));
 ctx.fillStyle='rgba(245,220,170,.87)';ctx.font='500 '+Math.round(w*.017)+'px system-ui';
 ctx.fillText('موشن جرافيك أصلي مجانًا — بدون رسوم أو اشتراكات',cx,h*.79,w*.9);
 ctx.restore();
 ctx.fillStyle='rgba(245,200,116,.22)';ctx.fillRect(w*.08,h*.9,w*.84,h*.005);
 ctx.fillStyle='#f0c978';ctx.fillRect(w*.08,h*.9,w*.84*Math.min(1,t/total),h*.005);
}
async function make(sampleMode){
 if(busy)return;
 const text=idea.value.trim();if(text.length<6){info('اكتب وصف أو عنوان من 6 حروف على الأقل.',true);idea.focus();return;}
 if(typeof HTMLCanvasElement==='undefined'||typeof HTMLCanvasElement.prototype.captureStream!=='function'){info('المتصفح لا يدعم تصدير الفيديو من Canvas.',true);return;}
 let mime;try{mime=codec()}catch(e){info(e.message,true);return;}
 busy=true;generate.disabled=true;sample.disabled=true;
 if(lastURL){URL.revokeObjectURL(lastURL);lastURL=null;}
 preview.pause();preview.removeAttribute('src');preview.hidden=true;preview.load();
 save.hidden=true;save.removeAttribute('href');
 const size=quality.value==='4k'?[3840,2160]:[1920,1080];
 const total=sampleMode?3:Math.max(5,Math.min(15,Number(duration.value)||5));
 let recorder=null,stream=null,raf=0,timeout=0;
 try{
  info(sampleMode?'بنجهّز عينة متحركة قصيرة…':'بنسجّل الفيديو على جهازك — سيب الصفحة مفتوحة…');
  const canvas=document.createElement('canvas');canvas.width=size[0];canvas.height=size[1];
  const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw Error('تعذّر تهيئة الرسم.');
  paint(ctx,size[0],size[1],0,total,text);
  stream=canvas.captureStream(24);
  recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:size[0]>2000?16000000:7000000});
  const chunks=[];
  const finished=new Promise((resolve,reject)=>{
   recorder.ondataavailable=e=>{if(e.data&&e.data.size>0)chunks.push(e.data)};
   recorder.onerror=e=>reject(e.error||new Error('فشل تسجيل الفيديو.'));
   recorder.onstop=()=>{if(!chunks.length)return reject(Error('الفيديو الناتج فاضي. جرّب 1080p.'));resolve(new Blob(chunks,{type:recorder.mimeType||mime}));};
  });
  const started=performance.now();
  const frame=now=>{
   const t=Math.min(total,(now-started)/1000);
   paint(ctx,size[0],size[1],t,total,text);
   if(t>=total){if(recorder.state==='recording')recorder.stop();return;}
   if(recorder.state==='recording')raf=requestAnimationFrame(frame);
  };
  recorder.start(300);raf=requestAnimationFrame(frame);
  timeout=setTimeout(()=>{if(recorder.state==='recording')recorder.stop()},(total+1)*1000);
  const blob=await finished;
  if(!blob.size)throw Error('الملف الناتج فاضي.');
  lastURL=URL.createObjectURL(blob);
  preview.src=lastURL;preview.hidden=false;preview.controls=true;preview.load();
  save.href=lastURL;save.download='madar-pro-motion.'+(blob.type.includes('mp4')?'mp4':'webm');save.hidden=false;
  info('الفيديو جاهز. ده موشن جرافيك فعلي من المتصفح، مش فيديو AI بمشاهد واقعية.');
 }catch(e){info('تعذر إنشاء الفيديو: '+String(e?.message||e).slice(0,170)+' جرّب 1080p.',true);}
 finally{
  cancelAnimationFrame(raf);clearTimeout(timeout);
  if(recorder&&recorder.state==='recording')try{recorder.stop()}catch{}
  if(stream)stream.getTracks().forEach(track=>track.stop());
  busy=false;generate.disabled=false;sample.disabled=false;
 }
}
sample.addEventListener('click',()=>make(true));
generate.addEventListener('click',()=>make(false));
})();
