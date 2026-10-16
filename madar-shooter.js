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
