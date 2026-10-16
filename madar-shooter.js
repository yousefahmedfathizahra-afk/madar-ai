/* MADAR SHADOW UNIT — original offline WebGL 3D browser game. No external assets or services. */
(()=>{'use strict';
const $=id=>document.getElementById(id),canvas=$('arena');
const gl=canvas?.getContext('webgl',{antialias:true,alpha:false,depth:true});
if(!gl){$('fallback').style.display='flex';return;}
const vs=[
'attribute vec3 pos,norm;uniform mat4 mvp,model;varying vec3 vN,vW;',
'void main(){vec4 w=model*vec4(pos,1.);vW=w.xyz;vN=normalize(mat3(model)*norm);gl_Position=mvp*vec4(pos,1.);}'
].join('\n');
const fs=[
'precision mediump float;varying vec3 vN,vW;uniform vec3 col,eye;uniform float glow;',
'void main(){vec3 n=normalize(vN);',
'float a=max(dot(n,normalize(vec3(-.5,.9,.5))),0.);float b=max(dot(n,normalize(vec3(.7,.6,-.4))),0.);',
'vec3 c=col*(.18+.78*a+.24*b);',
'float r=1./(1.+length(vW-vec3(-10.,8.,-16.))*.09);',
'float u=1./(1.+length(vW-vec3(10.,8.,-33.))*.09);',
'c+=col*vec3(.8,.08,.04)*r*.36+col*vec3(.06,.5,.9)*u*.35+col*glow*.6;',
'float fog=clamp((distance(vW,eye)-25.)/100.,0.,.88);',
'gl_FragColor=vec4(mix(c,vec3(.055,.1,.15),fog),1.);}'
].join('\n');
function shader(type,src){let s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
let program;
try{
 program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vs));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fs));
 gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('WebGL program link');gl.useProgram(program);
}catch(err){$('fallback').style.display='flex';return;}
const loc={p:gl.getAttribLocation(program,'pos'),n:gl.getAttribLocation(program,'norm'),
 m:gl.getUniformLocation(program,'model'),vp:gl.getUniformLocation(program,'mvp'),
 col:gl.getUniformLocation(program,'col'),eye:gl.getUniformLocation(program,'eye'),glow:gl.getUniformLocation(program,'glow')};
gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);
const PI=Math.PI,TWO=2*PI,clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
function mul(a,b){
 const o=new Float32Array(16);
 for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[r+4]*b[c*4+1]+a[r+8]*b[c*4+2]+a[r+12]*b[c*4+3];
 return o;
}
function model(x,y,z,sx,sy,sz,a=0){let c=Math.cos(a),s=Math.sin(a);return new Float32Array([c*sx,0,-s*sx,0,0,sy,0,0,s*sz,0,c*sz,0,x,y,z,1]);}
function perspective(fov,aspect,near,far){let t=1/Math.tan(fov/2),g=1/(near-far);return new Float32Array([t/aspect,0,0,0,0,t,0,0,0,0,(far+near)*g,-1,0,0,2*far*near*g,0]);}
function look(e,t){
 const norm=a=>{let d=Math.hypot(...a)||1;return a.map(x=>x/d);};
 let z=norm([e[0]-t[0],e[1]-t[1],e[2]-t[2]]),x=norm([z[2],0,-z[0]]);
 let y=[z[1]*x[2]-z[2]*x[1],z[2]*x[0]-z[0]*x[2],z[0]*x[1]-z[1]*x[0]];
 return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,
  -x[0]*e[0]-x[1]*e[1]-x[2]*e[2],-y[0]*e[0]-y[1]*e[1]-y[2]*e[2],-z[0]*e[0]-z[1]*e[1]-z[2]*e[2],1]);
}
function mesh(v,n){let p=gl.createBuffer(),q=gl.createBuffer();
 gl.bindBuffer(gl.ARRAY_BUFFER,p);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(v),gl.STATIC_DRAW);
 gl.bindBuffer(gl.ARRAY_BUFFER,q);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(n),gl.STATIC_DRAW);
 return{p,q,count:v.length/3};
}
function boxMesh(){
 const v=[],n=[],faces=[
  [[1,0,0],[[.5,-.5,.5],[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5]]],
  [[-1,0,0],[[-.5,-.5,-.5],[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5]]],
  [[0,1,0],[[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5],[-.5,.5,-.5]]],
  [[0,-1,0],[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5]]],
  [[0,0,1],[[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]]],
  [[0,0,-1],[[.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5]]]
 ];
 for(const [face,pts] of faces)for(const i of [0,1,2,0,2,3]){v.push(...pts[i]);n.push(...face);}
 return mesh(v,n);
}
function sphereMesh(){const v=[],n=[],rows=9,slices=12;
 const point=(a,b)=>[Math.sin(a)*Math.cos(b)*.5,Math.cos(a)*.5,Math.sin(a)*Math.sin(b)*.5];
 for(let i=0;i<rows;i++)for(let j=0;j<slices;j++){
  const a=i/rows*PI,b=(i+1)/rows*PI,c=j/slices*TWO,d=(j+1)/slices*TWO;
  const p=point(a,c),q=point(b,c),r=point(b,d),s=point(a,d);
  for(const pt of [p,q,r,p,r,s]){v.push(...pt);n.push(pt[0]*2,pt[1]*2,pt[2]*2);}
 }return mesh(v,n);
}
function cylinderMesh(){const v=[],n=[];
 for(let i=0;i<12;i++){
  const a=i/12*TWO,b=(i+1)/12*TWO,p=[Math.cos(a)*.5,Math.sin(a)*.5],q=[Math.cos(b)*.5,Math.sin(b)*.5];
  const pts=[[p[0],-.5,p[1]],[q[0],-.5,q[1]],[q[0],.5,q[1]],[p[0],.5,p[1]]];
  for(const j of [0,1,2,0,2,3]){v.push(...pts[j]);let t=j===0||j===3?a:b;n.push(Math.cos(t),0,Math.sin(t));}
  for(const pt of [[0,.5,0],[p[0],.5,p[1]],[q[0],.5,q[1]]]){v.push(...pt);n.push(0,1,0);}
  for(const pt of [[0,-.5,0],[q[0],-.5,q[1]],[p[0],-.5,p[1]]]){v.push(...pt);n.push(0,-1,0);}
 }return mesh(v,n);
}
const meshes={box:boxMesh(),ball:sphereMesh(),cyl:cylinderMesh()};
let viewProjection,eye=[0,4,9],vw=2,vh=2,aspect=1;
function resize(){
 let dpr=Math.min(1.55,window.devicePixelRatio||1),w=Math.max(2,Math.floor(canvas.clientWidth*dpr)),h=Math.max(2,Math.floor(canvas.clientHeight*dpr));
 if(w!==vw||h!==vh){vw=w;vh=h;canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}
 aspect=vw/vh;
}
window.addEventListener('resize',resize);
function draw(shape,x,y,z,sx,sy,sz,col,angle=0,glow=0){
 const m=model(x,y,z,sx,sy,sz,angle),g=meshes[shape];
 gl.bindBuffer(gl.ARRAY_BUFFER,g.p);gl.enableVertexAttribArray(loc.p);gl.vertexAttribPointer(loc.p,3,gl.FLOAT,false,0,0);
 gl.bindBuffer(gl.ARRAY_BUFFER,g.q);gl.enableVertexAttribArray(loc.n);gl.vertexAttribPointer(loc.n,3,gl.FLOAT,false,0,0);
 gl.uniformMatrix4fv(loc.m,false,m);gl.uniformMatrix4fv(loc.vp,false,mul(viewProjection,m));
 gl.uniform3fv(loc.col,col);gl.uniform1f(loc.glow,glow);gl.drawArrays(gl.TRIANGLES,0,g.count);
}
const box=(...p)=>draw('box',...p),ball=(...p)=>draw('ball',...p),cylinder=(...p)=>draw('cyl',...p);
const C={floor:[.09,.12,.14],road:[.18,.21,.23],line:[.66,.65,.60],metal:[.22,.28,.31],chrome:[.36,.42,.44],
 blue:[.11,.32,.42],red:[.38,.14,.16],green:[.26,.33,.30],city:[.045,.09,.15],
 orange:[1,.60,.19],cyan:[.09,.75,.9],black:[.04,.05,.07],boot:[.06,.063,.066],
 face:[.60,.4,.30],armor:[.12,.15,.17],uniform:[.18,.20,.21],helmet:[.32,.31,.28],
 enemy:[.42,.12,.16],danger:[.98,.10,.12],gold:[1,.76,.30],shadow:[.024,.03,.04]};
const seed=i=>{let n=Math.sin(i*82.333+11.719)*43758.5453;return n-Math.floor(n);};


function sceneWorld(){
 box(0,-.23,-24,75,.42,125,C.floor);box(0,-.005,-25,17,.06,118,C.road);
 for(let i=0;i<24;i++){
  let z=14-i*5;
  for(const x of [-8.3,8.3])box(x,.033,z,.14,.025,2.2,C.line);
  box(0,.036,z,.09,.025,2.0,C.line);
 }
 // Stacked freight containers and warehouse walls on both sides of the combat lane.
 for(let i=0;i<9;i++)for(const side of [-1,1]){
  let z=12-i*13,x=side*(16+(i%2)*1.2),col=[C.blue,C.red,C.green][(i+side+4)%3];
  box(x,1.47,z,7.6,2.9,5.3,col);box(x,2.95,z,7.8,.14,5.5,C.metal);
  for(let j=-2;j<=2;j++)box(x+j*1.25,1.4,z+2.68,.07,2.7,.07,C.chrome);
  if(i%3===0){box(x,4.44,z,7.3,2.8,5.3,C.green);box(x,5.88,z,7.6,.14,5.5,C.chrome);}
 }
 // Low cover in the arena.
 for(let i=0;i<12;i++){
  const z=-12-i*6.6,x=(i%2?1:-1)*(7.7+seed(i)*3);
  box(x,.76,z,2.75,1.5,1.7,i%3?C.blue:C.red);box(x,1.54,z,2.91,.13,1.86,C.chrome);
  for(let j=-1;j<=1;j++)box(x+j*.72,.75,z+.87,.05,1.3,.05,C.metal);
 }
 // Heavy barrels and metal road barriers.
 for(let i=0;i<16;i++){
  let z=10-i*6.8,x=(i%2?1:-1)*(11.0+seed(i+50)*2);
  cylinder(x,.49,z,.8,.97,.8,C.metal);cylinder(x,.98,z,.83,.10,.83,C.chrome);
 }
 // Industrial floodlights.
 for(let i=0;i<6;i++){
  let z=4-i*18;
  for(let side of [-1,1]){
   let x=side*10.6;
   box(x,3.9,z,.31,7.8,.31,C.chrome);box(x,7.79,z,1.2,.27,1.2,C.black);
   box(x,7.63,z,1.01,.11,.95,i%2?C.cyan:C.orange,0,1.7);
  }
  box(0,8.1,z,21.5,.18,.19,C.metal);
 }
 // Distant skyline, port cranes and neon road reflectors.
 for(let i=0;i<16;i++){
  let x=(i-8)*7,z=-106-5*seed(i+20),h=7+seed(i+30)*19;
  box(x,h/2-.2,z,4.3,h,3.5,C.city);
  for(let j=0;j<4;j++)box(x-1.2+j*.8,2+(j*2)%Math.max(4,h-2),z+1.78,.25,.30,.05,j%2?C.cyan:C.orange,0,.3);
 }
 for(let side of [-1,1]){
  let x=side*28;
  box(x,11,-59,.35,22,.37,C.metal);
  box(x,22,-55,11,.26,.25,C.chrome,side*.2);
 }
 for(let i=0;i<14;i++)for(let side of [-1,1]){
  let z=11-i*7.6;
  box(side*9.25,.17,z,.45,.27,.5,C.metal);
  box(side*9.25,.34,z,.33,.10,.35,side>0?C.cyan:C.orange,0,1.4);
 }
}
function relative(x,z,angle,dx,dz){let c=Math.cos(angle),s=Math.sin(angle);return [x+dx*c+dz*s,z-dx*s+dz*c];}
function soldier(x,z,angle,bad=false,stride=0){
 const outfit=bad?C.enemy:C.uniform,vest=bad?C.enemy:C.armor;
 box(x,.03,z,.82,.02,.72,C.shadow,angle);
 for(let side of [-1,1]){
  let p=relative(x,z,angle,side*.24,Math.sin(stride+side)*.075);
  box(p[0],.28,p[1],.26,.54,.30,C.boot,angle);
  box(p[0],.64,p[1],.25,.43,.29,outfit,angle);
  p=relative(x,z,angle,side*.24,-.17);
  box(p[0],.09,p[1],.28,.17,.40,C.boot,angle);
 }
 let p=relative(x,z,angle,0,.15);box(p[0],1.26,p[1],.82,.92,.52,outfit,angle);
 p=relative(x,z,angle,0,-.31);box(p[0],1.29,p[1],.70,.78,.19,vest,angle);
 p=relative(x,z,angle,0,.39);box(p[0],1.28,p[1],.64,.81,.32,C.metal,angle);
 p=relative(x,z,angle,0,-.43);box(p[0],1.42,p[1],.51,.19,.05,bad?C.danger:C.cyan,angle,bad?1.3:.55);
 p=relative(x,z,angle,0,0);box(p[0],.84,p[1],.86,.16,.49,C.black,angle);
 p=relative(x,z,angle,0,-.04);ball(p[0],1.89,p[1],.46,.53,.44,C.face);
 p=relative(x,z,angle,0,-.04);ball(p[0],2.14,p[1],.52,.30,.52,bad?C.enemy:C.helmet);
 p=relative(x,z,angle,0,-.3);box(p[0],2.02,p[1],.44,.11,.10,C.black,angle);
 if(bad){p=relative(x,z,angle,0,-.37);box(p[0],1.97,p[1],.42,.08,.08,C.danger,angle,1.4);}
 else{p=relative(x,z,angle,.25,-.01);ball(p[0],1.98,p[1],.12,.26,.12,C.black);}
 for(const side of [-1,1]){
  p=relative(x,z,angle,side*.52,-.19);box(p[0],1.30,p[1],.28,.69,.28,vest,angle);
  p=relative(x,z,angle,side*.31,-.44);box(p[0],1.13,p[1],.19,.20,.22,C.face,angle);
 }
 p=relative(x,z,angle,.04,-.68);box(p[0],1.32,p[1],.20,.20,.96,C.black,angle);
 p=relative(x,z,angle,.04,-1.21);box(p[0],1.32,p[1],.10,.11,.65,C.chrome,angle);
 p=relative(x,z,angle,.08,-.94);box(p[0],1.55,p[1],.14,.18,.26,C.black,angle);
 p=relative(x,z,angle,.07,-.65);box(p[0],1.08,p[1],.16,.28,.23,C.black,angle);
}
const player={x:0,z:6,hp:100,ammo:30,reserve:120,kills:0,score:0,wave:1,shot:0,recoil:0,invincible:0,reload:0,hit:0};
const enemies=[],sparks=[],tracers=[],keys=new Set();
let mode='menu',yaw=0,pitch=0,time=0,lastFrame=0,betweenWaves=0,trigger=false,noticeLeft=0,damageLeft=0;
const stickState={x:0,y:0,id:null};
function hud(){
 $('hp').textContent=Math.ceil(player.hp);$('hpFill').style.width=player.hp+'%';
 $('ammo').textContent=player.ammo+' / '+player.reserve;
 $('kills').textContent=player.kills;$('wave').textContent=player.wave;
}
function notice(message){$('killNotice').textContent=message;$('killNotice').style.opacity='1';noticeLeft=1.1;}
function spawnWave(){
 enemies.length=0;
 for(let i=0;i<Math.min(3+player.wave,9);i++){
  enemies.push({x:(i%2?1:-1)*(1.9+(i%4)*2),z:-17-i*6.3-player.wave,
    hp:2+Math.floor(player.wave/2),shoot:.8+seed(i+player.wave)*2,
    phase:i*1.7,stun:0,alive:true});
 }
 $('objective').textContent='الموجة '+player.wave+' — اهزم جميع الأعداء وحافظ على صحتك';
}
function reset(){
 Object.assign(player,{x:0,z:6,hp:100,ammo:30,reserve:120,kills:0,score:0,wave:1,shot:0,recoil:0,invincible:0,reload:0,hit:0});
 yaw=pitch=time=betweenWaves=0;trigger=false;keys.clear();stickState.x=stickState.y=0;
 sparks.length=0;tracers.length=0;spawnWave();hud();
}
function setMode(next){
 mode=next;
 if(next==='playing'){$('overlay').hidden=true;return;}
 $('overlay').hidden=false;
 $('start').textContent=next==='over'?'↻ العب من جديد':next==='paused'?'▶ كمل المهمة':'▶ ابدأ المهمة';
 $('gameStatus').textContent=next==='over'?'انتهت المهمة! قضيت على '+player.kills+' خصم ووصلت للموجة '+player.wave+'.':'';
}
