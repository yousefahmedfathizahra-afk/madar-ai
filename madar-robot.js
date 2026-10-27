/* MADAR Buddy — cursor-following robot and fast feature shortcuts.
 * No image generation, camera, tracking or background requests. */
(function(){
'use strict';
const dock=document.getElementById('madarBuddy');
const toggle=document.getElementById('madarBuddyToggle');
const panel=document.getElementById('madarBuddyPanel');
if(!dock||!toggle||!panel)return;
const eyes=[document.getElementById('buddyPupilLeft'),document.getElementById('buddyPupilRight')].filter(Boolean);
const head=document.getElementById('madarBuddyHead');
const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
let x=0,y=0,tx=0,ty=0,frameId=0,lastFocused=null;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
function renderEyes(){
 frameId=0;
 if(reduced){x=tx;y=ty;}else{x+=(tx-x)*.22;y+=(ty-y)*.22;}
 const pose='translate('+x.toFixed(2)+' '+y.toFixed(2)+')';
 for(const pupil of eyes)pupil.setAttribute('transform',pose);
 if(head)head.style.setProperty('--buddy-tilt',((reduced?0:x*.5).toFixed(2))+'deg');
 if(!reduced&&(Math.abs(x-tx)>.07||Math.abs(y-ty)>.07))frameId=requestAnimationFrame(renderEyes);
}
function schedule(){
 if(!frameId)frameId=requestAnimationFrame(renderEyes);
}
function follow(e){
 if(e.pointerType&&e.pointerType!=='mouse'&&e.pointerType!=='pen')return;
 const rect=toggle.getBoundingClientRect();
 const dx=e.clientX-(rect.left+rect.width/2);
 const dy=e.clientY-(rect.top+rect.height*.47);
 const distance=Math.max(30,Math.hypot(dx,dy));
 tx=clamp(dx/distance*8.5,-8.5,8.5);
 ty=clamp(dy/distance*6.0,-6,6);
 schedule();
}
function reset(){tx=0;ty=0;schedule()}
window.addEventListener('pointermove',follow,{passive:true});
window.addEventListener('blur',reset);
function setOpen(open){
 if(open){lastFocused=document.activeElement;panel.hidden=false;dock.dataset.open='true';toggle.setAttribute('aria-expanded','true');panel.querySelector('[data-buddy-action="chat"]')?.focus();}
 else{panel.hidden=true;dock.dataset.open='false';toggle.setAttribute('aria-expanded','false');}
}
toggle.addEventListener('click',()=>setOpen(panel.hidden));
panel.querySelector('.madar-buddy-close')?.addEventListener('click',()=>{setOpen(false);toggle.focus();});
document.addEventListener('pointerdown',e=>{if(!panel.hidden&&!dock.contains(e.target))setOpen(false);});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){e.preventDefault();setOpen(false);toggle.focus();}});
panel.addEventListener('click',e=>{
 const item=e.target.closest('[data-buddy-action]');
 if(!item)return;
 const action=item.dataset.buddyAction;
 setOpen(false);
 if(action==='chat'){
  document.getElementById('prompt')?.focus();
 }else if(action==='website'){
  if(window.MADAR_BUILDER?.openWithIdea)window.MADAR_BUILDER.openWithIdea('', 'website');
  else document.getElementById('madarBuilderBtn')?.click();
 }else if(action==='studio'){
  if(window.MADAR_STUDIO?.open)window.MADAR_STUDIO.open('project');
  else document.getElementById('madarStudioOpen')?.click();
 }else if(action==='study'){
  if(window.MADAR_STUDIO?.open)window.MADAR_STUDIO.open('study');
  else document.getElementById('madarStudioOpen')?.click();
 }
});
window.MADAR_BUDDY={open:()=>setOpen(true),close:()=>setOpen(false)};
})();