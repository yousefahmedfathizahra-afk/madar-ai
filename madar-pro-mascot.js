(() => {
  'use strict';
  // MADAR PRO robot. Local UI only: never sends cursor data to a server.
  const bot=document.getElementById('madarMascot');
  const trigger=document.getElementById('madarMascotButton');
  const bubble=document.getElementById('madarMascotBubble');
  if(!bot||!trigger||!bubble)return;
  const pupils=[...bot.querySelectorAll('.madar-bot-pupil')];
  const tilt=bot.querySelector('.madar-bot-head');
  const media=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let nextFrame=0,targetX=0,targetY=0,lastX=0,lastY=0,active=false;
  const clamp=(n,low,high)=>Math.max(low,Math.min(high,n));
  function redraw(){
    nextFrame=0;
    lastX+=(targetX-lastX)*.2;lastY+=(targetY-lastY)*.2;
    for(const eye of pupils)eye.setAttribute('transform','translate('+lastX.toFixed(2)+' '+lastY.toFixed(2)+')');
    if(tilt&&!media?.matches)tilt.style.transform='rotate('+(lastX*1.9).toFixed(2)+'deg) translateY('+(lastY*.45).toFixed(2)+'px)';
    if(Math.abs(targetX-lastX)+Math.abs(targetY-lastY)>.1)nextFrame=requestAnimationFrame(redraw);
  }
  function queue(){if(!nextFrame)nextFrame=requestAnimationFrame(redraw);}
  function follow(x,y){
    if(media?.matches)return;
    const rect=trigger.getBoundingClientRect(),centerX=rect.left+rect.width/2,centerY=rect.top+rect.height*.46;
    const dx=x-centerX,dy=y-centerY,distance=Math.hypot(dx,dy)||1;
    const strength=clamp(distance/115,0,1);
    targetX=clamp(dx/distance*strength*4.4,-4.4,4.4);
    targetY=clamp(dy/distance*strength*3.3,-3.3,3.3);
    queue();
  }
  window.addEventListener('pointermove',event=>{
    if(event.pointerType!=='mouse'&&event.pointerType!=='pen')return;
    follow(event.clientX,event.clientY);
  },{passive:true});
  window.addEventListener('blur',()=>{targetX=0;targetY=0;queue()});
  function setOpen(open){
    bubble.hidden=!open;
    trigger.setAttribute('aria-expanded',String(open));
    bot.classList.toggle('is-speaking',open);
  }
  trigger.addEventListener('click',()=>setOpen(bubble.hidden));
  document.addEventListener('keydown',event=>{if(event.key==='Escape')setOpen(false);});
  document.addEventListener('click',event=>{if(!bot.contains(event.target))setOpen(false);});
  const hello=document.getElementById('madarMascotAsk');
  hello?.addEventListener('click',()=>{
    setOpen(false);
    const prompt=document.getElementById('prompt');
    if(prompt){prompt.focus();if(!prompt.value.trim())prompt.placeholder='اسأل مساعد مدار سؤالك هنا...';}
  });
  setOpen(false);
})();
