import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { Vector3, Quaternion } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { HALF_L, HALF_W, GOAL_W, GOAL_H, GOAL_D, BOX_L, BOX_W, AREA_L, AREA_W, BALL_R, TEAM_SIZE } from './core.mjs';

const KITS=[
 {shirt:'#1c7ed6',shorts:'#f8f9fa',socks:'#1c7ed6',gk:'#fcc419'},
 {shirt:'#e03131',shorts:'#212529',socks:'#e03131',gk:'#37b24d'},
];
const SKINS=['#f1c27d','#e0ac69','#c68642','#ffdbac','#8d5524'];
const HAIR=['#2b1d0e','#4a3222','#1a1a1a','#8a5a2b','#d9a441'];
const CONFETTI=['#ffd43b','#ff6b6b','#4dabf7','#69db7c','#f783ac','#ffffff'];

export function createWorld(canvas){
 const engine=new Engine(canvas,true,{preserveDrawingBuffer:true,stencil:true});
 engine.setHardwareScalingLevel(1/Math.min(devicePixelRatio||1,1.5));
 const scene=new Scene(engine);
 scene.clearColor=Color4.FromHexString('#101a36ff');
 scene.fogMode=Scene.FOGMODE_LINEAR;scene.fogStart=90;scene.fogEnd=200;scene.fogColor=Color3.FromHexString('#101a36');
 const camera=new FreeCamera('broadcast camera',new Vector3(0,24,-36),scene);
 camera.inputs.clear();camera.minZ=.3;camera.maxZ=400;camera.fov=.78;
 const hemi=new HemisphericLight('stadium',new Vector3(0,1,0),scene);hemi.intensity=.85;hemi.groundColor=Color3.FromHexString('#3b4a6b');
 const sun=new DirectionalLight('floodlights',new Vector3(-.3,-1,.45),scene);sun.intensity=.8;sun.diffuse=Color3.FromHexString('#fff8e6');

 const mats=new Map();
 function mat(color,{glow=0,alpha=1,spec=.1}={}){
  const key=`${color}/${glow}/${alpha}/${spec}`;if(mats.has(key))return mats.get(key);
  const m=new StandardMaterial(key,scene);m.diffuseColor=Color3.FromHexString(color);m.specularColor=new Color3(spec,spec,spec);
  if(glow)m.emissiveColor=m.diffuseColor.scale(glow);if(alpha<1)m.alpha=alpha;mats.set(key,m);return m;
 }
 function texMat(name,w,h,draw,{alpha=false,glow=0}={}){
  const tex=new DynamicTexture(name,{width:w,height:h},scene,true);const ctx=tex.getContext();draw(ctx,w,h);tex.update();tex.hasAlpha=alpha;tex.anisotropicFilteringLevel=8;
  const m=new StandardMaterial(name,scene);m.diffuseTexture=tex;m.specularColor=new Color3(.05,.05,.05);if(alpha){m.useAlphaFromDiffuseTexture=true;}
  if(glow)m.emissiveColor=new Color3(glow,glow,glow);return m;
 }

 // 잔디와 라인
 const GW=HALF_L*2+10,GH=HALF_W*2+10,PX=32;
 const pitchMat=texMat('pitch',GW*PX,GH*PX,(c,w,h)=>{
  const bands=16;for(let i=0;i<bands;i++){c.fillStyle=i%2?'#3f9a3c':'#48a844';c.fillRect(i*w/bands,0,w/bands+1,h);}
  // 잔디 결
  for(let i=0;i<9000;i++){c.fillStyle=`rgba(${Math.random()<.5?'20,60,20':'120,200,110'},.08)`;c.fillRect(Math.random()*w,Math.random()*h,2,5);}
  const X=x=>(x+GW/2)*PX,Y=z=>(z+GH/2)*PX;
  c.strokeStyle='#f4fff0';c.lineWidth=.14*PX;c.lineJoin='round';
  c.strokeRect(X(-HALF_L),Y(-HALF_W),HALF_L*2*PX,HALF_W*2*PX);
  c.beginPath();c.moveTo(X(0),Y(-HALF_W));c.lineTo(X(0),Y(HALF_W));c.stroke();
  c.beginPath();c.arc(X(0),Y(0),5*PX,0,Math.PI*2);c.stroke();
  c.fillStyle='#f4fff0';c.beginPath();c.arc(X(0),Y(0),.25*PX,0,Math.PI*2);c.fill();
  for(const sx of [-1,1]){
   const gx=sx*HALF_L;
   c.strokeRect(X(Math.min(gx,gx-sx*BOX_L)),Y(-BOX_W/2),BOX_L*PX,BOX_W*PX);
   c.strokeRect(X(Math.min(gx,gx-sx*AREA_L)),Y(-AREA_W/2),AREA_L*PX,AREA_W*PX);
   c.beginPath();c.arc(X(gx-sx*7.5),Y(0),.22*PX,0,Math.PI*2);c.fill();
   c.beginPath();c.arc(X(gx-sx*7.5),Y(0),5*PX,sx>0?Math.PI*.72:-Math.PI*.28,sx>0?Math.PI*1.28:Math.PI*.28);c.stroke();
   for(const sz of [-1,1]){c.beginPath();c.arc(X(gx),Y(sz*HALF_W),1*PX,0,Math.PI*2);c.stroke();}
  }
  // 넓은 테두리 잔디는 조금 어둡게
  c.fillStyle='rgba(0,30,0,.18)';c.fillRect(0,0,w,Y(-HALF_W)-.1*PX);c.fillRect(0,Y(HALF_W)+.1*PX,w,h);c.fillRect(0,0,X(-HALF_L)-.1*PX,h);c.fillRect(X(HALF_L)+.1*PX,0,w,h);
 });
 const pitch=MeshBuilder.CreateGround('pitch',{width:GW,height:GH},scene);pitch.material=pitchMat;pitch.isPickable=false;
 const outer=MeshBuilder.CreateGround('track',{width:180,height:140},scene);outer.position.y=-.03;outer.material=mat('#2c3e50');outer.isPickable=false;

 // 광고판
 const ads=['인혁 월드','INHYUK FC','⚽ 3D SOCCER','골! 골! 골!','인혁 월드'];
 const adMats=ads.map((t,i)=>texMat(`ad ${i}`,1024,96,(c,w,h)=>{const g=c.createLinearGradient(0,0,w,0);g.addColorStop(0,['#1c7ed6','#e03131','#7048e8','#f08c00','#0ca678'][i]);g.addColorStop(1,['#4dabf7','#ff8787','#b197fc','#ffd43b','#63e6be'][i]);c.fillStyle=g;c.fillRect(0,0,w,h);c.fillStyle='#fff';c.font='bold 64px Arial, "Apple SD Gothic Neo", sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(t,w/2,h/2+4);},{glow:.55}));
 function adBoard(x,z,len,ry,k){const b=MeshBuilder.CreatePlane('ad board',{width:len,height:.9},scene);b.position.set(x,.45,z);b.rotation.y=ry;b.material=adMats[k%adMats.length];b.material.backFaceCulling=false;b.isPickable=false;}
 for(let i=0;i<5;i++){adBoard(-HALF_L+6.4+i*12.8,HALF_W+3,12.4,0,i);adBoard(-HALF_L+6.4+i*12.8,-HALF_W-3,12.4,Math.PI,i+2);}
 for(const sx of [-1,1])for(const sz of [-1,1])adBoard(sx*(HALF_L+4),sz*(GOAL_W/2+6),10,sx*Math.PI/2,sz>0?1:3);

 // 관중석 (먼 쪽, 양 끝)
 const crowdMat=texMat('crowd',1024,256,(c,w,h)=>{
  c.fillStyle='#2b3350';c.fillRect(0,0,w,h);
  const cols=['#1c7ed6','#4dabf7','#e03131','#ff8787','#ffd43b','#ffffff','#f783ac','#69db7c','#ff922b','#845ef7'];
  for(let row=0;row<16;row++){c.fillStyle=row%2?'#343d5e':'#262e4a';c.fillRect(0,row*16,w,3);
   for(let i=0;i<86;i++){const x=i*12+(row%2)*6+Math.random()*3,y=row*16+5;c.fillStyle=cols[Math.random()*cols.length|0];c.fillRect(x,y,8,8);c.fillStyle='#f1c27d';c.fillRect(x+2,y-3,4,4);}}
 });
 crowdMat.emissiveColor=new Color3(.35,.35,.4);crowdMat.backFaceCulling=false;
 const stands=[];
 function stand(x,z,len,ry){
  const root=new TransformNode('stand',scene);root.position.set(x,0,z);root.rotation.y=ry;
  const slope=MeshBuilder.CreatePlane('stand crowd',{width:len,height:16},scene);slope.parent=root;slope.position.set(0,5.2,4.8);slope.rotation.x=Math.PI*.3;slope.material=crowdMat;slope.isPickable=false;
  const roof=MeshBuilder.CreateBox('stand roof',{width:len+2,height:.5,depth:9},scene);roof.parent=root;roof.position.set(0,13,9);roof.material=mat('#3a4466');
  const back=MeshBuilder.CreateBox('stand back',{width:len+2,height:13,depth:.6},scene);back.parent=root;back.position.set(0,6.5,11.5);back.material=mat('#252c47');
  stands.push({root,crowd:slope,base:slope.position.y});
 }
 stand(0,HALF_W+5,HALF_L*2+10,0);
 stand(HALF_L+6,0,HALF_W*2+6,Math.PI/2);stand(-HALF_L-6,0,HALF_W*2+6,-Math.PI/2);

 // 조명탑
 for(const sx of [-1,1])for(const sz of [-1,1]){
  const pole=MeshBuilder.CreateCylinder('light pole',{diameter:.6,height:26},scene);pole.position.set(sx*(HALF_L+10),13,sz*(HALF_W+10));pole.material=mat('#495057');
  const lamp=MeshBuilder.CreateBox('lamp',{width:5,height:3,depth:.6},scene);lamp.position.set(sx*(HALF_L+10),26,sz*(HALF_W+10));lamp.rotation.y=Math.atan2(sx,sz);lamp.material=mat('#fff9db',{glow:1.2});
 }

 // 골대와 그물
 const postMat=mat('#ffffff',{glow:.45,spec:.6});
 for(const sx of [-1,1]){
  const gx=sx*HALF_L;
  for(const pz of [-GOAL_W/2,GOAL_W/2]){const p=MeshBuilder.CreateCylinder('post',{diameter:.2,height:GOAL_H+.1,tessellation:12},scene);p.position.set(gx,GOAL_H/2,pz);p.material=postMat;}
  const bar=MeshBuilder.CreateCylinder('crossbar',{diameter:.2,height:GOAL_W+.2,tessellation:12},scene);bar.rotation.x=Math.PI/2;bar.position.set(gx,GOAL_H,0);bar.material=postMat;
  const back=gx+sx*GOAL_D,lines=[];
  for(let z=-GOAL_W/2;z<=GOAL_W/2+.01;z+=.4){lines.push([new Vector3(gx,GOAL_H,z),new Vector3(back,GOAL_H*.8,z),new Vector3(back,0,z)]);}
  for(let y=0;y<=GOAL_H+.01;y+=.4){const yb=Math.min(y,GOAL_H*.8);lines.push([new Vector3(back,yb,-GOAL_W/2),new Vector3(back,yb,GOAL_W/2)]);
   for(const sz of [-1,1])lines.push([new Vector3(gx,y,sz*GOAL_W/2),new Vector3(back,yb,sz*GOAL_W/2)]);}
  for(let t=0;t<=1.01;t+=.2){const x=gx+sx*GOAL_D*t,top=GOAL_H*(1-.2*t);lines.push([new Vector3(x,top,-GOAL_W/2),new Vector3(x,top,GOAL_W/2)]);for(const sz of [-1,1])lines.push([new Vector3(x,0,sz*GOAL_W/2),new Vector3(x,top,sz*GOAL_W/2)]);}
  const net=MeshBuilder.CreateLineSystem('net',{lines},scene);net.color=new Color3(.92,.95,1);net.alpha=.55;net.isPickable=false;
  const floor=MeshBuilder.CreateGround('goal floor',{width:GOAL_D,height:GOAL_W},scene);floor.position.set(gx+sx*GOAL_D/2,.01,0);floor.material=mat('#2f7d2c');
 }

 // 그림자 원판
 const shadowMat=texMat('blob shadow',128,128,(c,w,h)=>{const g=c.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);g.addColorStop(0,'rgba(0,0,0,.55)');g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(0,0,w,h);},{alpha:true});
 shadowMat.disableLighting=true;shadowMat.emissiveColor=new Color3(0,0,0);
 function blob(size){const m=MeshBuilder.CreateGround('shadow',{width:size,height:size},scene);m.material=shadowMat;m.position.y=.02;m.isPickable=false;return m;}

 // 선수
 function numberMat(num,color){return texMat(`number ${num} ${color}`,128,128,(c,w,h)=>{c.clearRect(0,0,w,h);c.fillStyle='#fff';c.strokeStyle='rgba(0,0,0,.35)';c.lineWidth=6;c.font='bold 92px Arial';c.textAlign='center';c.textBaseline='middle';c.strokeText(String(num),w/2,h/2+4);c.fillText(String(num),w/2,h/2+4);},{alpha:true,glow:.3});}
 function box(name,w,h,d,parent,material,x=0,y=0,z=0){const m=MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene);m.parent=parent;m.position.set(x,y,z);m.material=material;m.isPickable=false;return m;}
 function makePlayer(p){
  const kit=KITS[p.team],gk=p.role==='GK',shirt=mat(gk?kit.gk:kit.shirt),skin=mat(SKINS[(p.id*3+p.team)%SKINS.length]);
  const root=new TransformNode(`player ${p.id}`,scene);
  const body=new TransformNode('body',scene);body.parent=root;
  const hips=new TransformNode('hips',scene);hips.parent=body;hips.position.y=.86;
  const legs=[-1,1].map(side=>{const pivot=new TransformNode('leg',scene);pivot.parent=hips;pivot.position.z=side*.13;
   box('thigh',.19,.4,.2,pivot,skin,0,-.2,0);box('sock',.18,.36,.19,pivot,mat(gk?'#343a40':kit.socks),0,-.6,0);box('boot',.3,.12,.2,pivot,mat('#212529'),.05,-.8,0);return pivot;});
  box('shorts',.36,.26,.5,hips,mat(kit.shorts),0,.05,0);
  const torso=MeshBuilder.CreateCapsule('torso',{radius:.25,height:.72,tessellation:12},scene);torso.parent=hips;torso.position.y=.5;torso.scaling.set(.8,1,1.12);torso.material=shirt;
  const arms=[-1,1].map(side=>{const pivot=new TransformNode('arm',scene);pivot.parent=hips;pivot.position.set(0,.74,side*.35);
   box('sleeve',.16,.24,.16,pivot,shirt,0,-.1,0);box('forearm',.12,.34,.12,pivot,gk?mat('#f8f9fa'):skin,0,-.38,0);return pivot;});
  const head=MeshBuilder.CreateSphere('head',{diameter:.42,segments:10},scene);head.parent=hips;head.position.y=1.04;head.material=skin;
  const hair=MeshBuilder.CreateSphere('hair',{diameter:.45,segments:10,slice:.55},scene);hair.parent=head;hair.position.set(-.02,.02,0);hair.material=mat(HAIR[(p.id*7)%HAIR.length]);
  for(const side of [-1,1]){const eye=MeshBuilder.CreateSphere('eye',{diameter:.06,segments:4},scene);eye.parent=head;eye.position.set(.19,.03,side*.08);eye.material=mat('#111');}
  const num=MeshBuilder.CreatePlane('number',{size:.36},scene);num.parent=hips;num.position.set(-.21,.52,0);num.rotation.y=Math.PI/2;num.material=numberMat(p.num,gk?kit.gk:kit.shirt);
  const shadow=blob(1.3);
  return {root,body,hips,legs,arms,shadow};
 }

 const ring=MeshBuilder.CreateTorus('control ring',{diameter:1.35,thickness:.09,tessellation:36},scene);ring.material=mat('#ffe066',{glow:1});ring.isPickable=false;
 const arrow=MeshBuilder.CreateCylinder('control arrow',{diameterTop:.46,diameterBottom:0,height:.5,tessellation:3},scene);arrow.material=mat('#ffe066',{glow:1});arrow.isPickable=false;
 const targetRing=MeshBuilder.CreateTorus('pass ring',{diameter:1.2,thickness:.06,tessellation:30},scene);targetRing.material=mat('#74c0fc',{glow:1});targetRing.isPickable=false;
 const chargeBg=MeshBuilder.CreatePlane('charge bg',{width:1.9,height:.34},scene);chargeBg.material=mat('#1f2d4a',{glow:.6,alpha:.8});chargeBg.billboardMode=7;
 const chargeFill=MeshBuilder.CreatePlane('charge fill',{width:1.78,height:.22},scene);chargeFill.parent=chargeBg;chargeFill.position.z=-.01;
 const chargeMats=['#69db7c','#ffd43b','#ff6b6b'].map(c=>mat(c,{glow:1}));
 chargeFill.material=chargeMats[0];

 // 공
 const ballMat=texMat('ball',512,256,(c,w,h)=>{
  c.fillStyle='#fdfdfd';c.fillRect(0,0,w,h);c.fillStyle='#1b1b1b';
  const spots=[[.1,.5],[.3,.2],[.3,.8],[.5,.5],[.7,.2],[.7,.8],[.9,.5],[0,.1],[.5,.02],[1,.1],[0,.95],[.5,.98],[1,.95]];
  for(const [u,v] of spots){c.beginPath();for(let k=0;k<5;k++){const a=k/5*Math.PI*2-Math.PI/2;c.lineTo(u*w+Math.cos(a)*30,v*h+Math.sin(a)*28);}c.closePath();c.fill();}
  c.strokeStyle='#bbb';c.lineWidth=2;for(const [u,v] of spots){for(const [u2,v2] of spots){const d=Math.hypot(u-u2,(v-v2)*.5);if(d>.05&&d<.25){c.beginPath();c.moveTo(u*w,v*h);c.lineTo(u2*w,v2*h);c.stroke();}}}
 });
 ballMat.specularColor=new Color3(.4,.4,.4);
 const ball=MeshBuilder.CreateSphere('ball',{diameter:BALL_R*2,segments:16},scene);ball.material=ballMat;ball.rotationQuaternion=Quaternion.Identity();ball.isPickable=false;
 const ballShadow=blob(.9);

 // 꽃가루
 const confetti=[];
 for(let i=0;i<160;i++){const m=MeshBuilder.CreatePlane('confetti',{width:.22,height:.14},scene);m.material=mat(CONFETTI[i%CONFETTI.length],{glow:.7});m.material.backFaceCulling=false;m.isVisible=false;m.isPickable=false;confetti.push({m,vx:0,vy:0,vz:0,life:0,spin:Math.random()*8});}
 let confettiNext=0;
 function burst(x,y,z,n=90){for(let i=0;i<n;i++){const c=confetti[confettiNext++%confetti.length];const a=Math.random()*Math.PI*2,sp=3+Math.random()*7;Object.assign(c,{vx:Math.cos(a)*sp,vy:6+Math.random()*9,vz:Math.sin(a)*sp,life:2.5+Math.random()*1.5});c.m.position.set(x,y,z);c.m.isVisible=true;}}

 let meshes=null,cheer=0;
 const cam={zoom:1,x:0,z:0,goalX:0};
 function ensure(s){if(!meshes||meshes.length!==s.players.length){meshes?.forEach(m=>{m.root.dispose();m.shadow.dispose();});meshes=s.players.map(makePlayer);}}
 function camTarget(s){
  const b=s.ball,aspect=engine.getRenderWidth()/Math.max(1,engine.getRenderHeight());
  const lim=aspect<1?HALF_L-5:HALF_L-15;
  let tx=Math.max(-lim,Math.min(lim,b.x*.92)),tz=b.z*(aspect<1?.8:.5),zoom=cam.zoom;
  if(s.phase==='goal'&&s.lastGoal){const gx=(s.lastGoal.team?-1:1)*HALF_L;tx=gx*.82;tz=0;zoom*=.72;}
  return {tx,tz,zoom,aspect};
 }
 function place(t){
  // 가로 화면: 중계 카메라, 세로 화면: 공 위에서 내려다보는 카메라
  const portrait=t.aspect<1;
  camera.fovMode=portrait?Camera.FOVMODE_HORIZONTAL_FIXED:Camera.FOVMODE_VERTICAL_FIXED;camera.fov=portrait?.75:.7;
  const back=(portrait?9:33)*t.zoom,up=(portrait?25:24)*t.zoom,ahead=portrait?0:-3*t.zoom;
  camera.position.set(cam.x,up,cam.z-back);camera.setTarget(new Vector3(cam.x,0,cam.z+ahead));
 }
 function snapCamera(s){ensure(s);const t=camTarget(s);cam.x=t.tx;cam.z=t.tz;place(t);}

 function sync(s,dt,{human=null,charge=0}={}){
  ensure(s);
  const b=s.ball,t=s.clock;
  s.players.forEach((p,i)=>{
   const m=meshes[i],sp=Math.hypot(p.vx,p.vz),swing=Math.sin(p.run*2.3)*Math.min(1,sp/5)*.85;
   m.root.position.set(p.x,0,p.z);m.root.rotation.y=-p.face;
   m.legs[0].rotation.z=swing;m.legs[1].rotation.z=-swing;
   m.arms[0].rotation.z=-swing*.8;m.arms[1].rotation.z=swing*.8;m.arms[0].rotation.x=m.arms[1].rotation.x=0;
   let lean=-Math.min(.25,sp*.03),tilt=0,hop=0;
   if(p.lunge>0){lean=-.75;m.legs[0].rotation.z=1.1;m.legs[1].rotation.z=-.3;}
   if(p.stun>0){tilt=Math.sin(t*20)*.15;lean=.25;}
   if(p.dive>0){tilt=(Math.sign(p.vz)||1)*1.1*Math.cos(p.face);m.arms[0].rotation.x=2.6;m.arms[1].rotation.x=-2.6;}
   if(s.phase==='goal'&&s.lastGoal&&p.team===s.lastGoal.team){hop=Math.abs(Math.sin(t*7+i))*.45;m.arms[0].rotation.x=2.8;m.arms[1].rotation.x=-2.8;}
   if(s.phase==='end'&&s.score[p.team]>s.score[1-p.team]){hop=Math.abs(Math.sin(t*6+i))*.4;m.arms[0].rotation.x=2.8;m.arms[1].rotation.x=-2.8;}
   m.body.rotation.z=lean;m.body.rotation.x=tilt;m.body.position.y=hop+Math.abs(Math.sin(p.run*2.3))*Math.min(1,sp/6)*.06;
   m.shadow.position.set(p.x+.15,.02,p.z+.1);
  });
  ball.position.set(b.x,b.y,b.z);
  const bs=Math.hypot(b.vx,b.vz);
  if(bs>.05){const q=Quaternion.RotationAxis(new Vector3(b.vz/bs,0,-b.vx/bs),bs*dt/BALL_R);ball.rotationQuaternion=q.multiply(ball.rotationQuaternion);}
  const bh=Math.max(0,b.y-BALL_R);ballShadow.position.set(b.x+bh*.25,.025,b.z+bh*.15);ballShadow.scaling.setAll(Math.max(.45,1-bh*.12));
  // 조종 선수 표시
  const hp=human!=null?s.players[human]:null;
  ring.isVisible=arrow.isVisible=!!hp&&!s.over;
  if(hp){ring.position.set(hp.x,.05,hp.z);ring.scaling.setAll(1+Math.sin(t*6)*.06);arrow.position.set(hp.x,2.55+Math.sin(t*5)*.1,hp.z);arrow.rotation.y=t*2;}
  chargeBg.isVisible=chargeFill.isVisible=!!hp&&charge>0;
  if(hp&&charge>0){chargeBg.position.set(hp.x,3.1,hp.z);chargeFill.scaling.x=Math.max(.02,charge);chargeFill.position.x=-(1-charge)*.89;chargeFill.material=chargeMats[charge<.6?0:charge<.9?1:2];}
  const tp=s.passTarget!=null?s.players[s.passTarget]:null;
  targetRing.isVisible=!!tp&&tp.team===0;if(tp){targetRing.position.set(tp.x,.05,tp.z);}
  // 관중
  cheer=Math.max(0,cheer-dt);
  for(const [k,st] of stands.entries())st.crowd.position.y=st.base+(cheer>0?Math.abs(Math.sin(t*12+k))*.35:Math.sin(t*2+k)*.03);
  // 꽃가루
  for(const c of confetti){if(!c.m.isVisible)continue;c.life-=dt;if(c.life<=0){c.m.isVisible=false;continue;}
   c.vy-=9*dt;c.vx*=1-dt*.8;c.vz*=1-dt*.8;c.vy=Math.max(c.vy,-2.5);c.m.position.x+=c.vx*dt;c.m.position.y=Math.max(.05,c.m.position.y+c.vy*dt);c.m.position.z+=c.vz*dt;c.m.rotation.x+=c.spin*dt;c.m.rotation.y+=c.spin*.7*dt;}
  // 카메라
  const tg=camTarget(s),k=1-Math.exp(-dt*(s.phase==='goal'?2.5:4));cam.x+=(tg.tx-cam.x)*k;cam.z+=(tg.tz-cam.z)*k;
  const zk=1-Math.exp(-dt*2.5);cam.curZoom=(cam.curZoom??tg.zoom)+(tg.zoom-(cam.curZoom??tg.zoom))*zk;
  place({...tg,zoom:cam.curZoom});
  scene.render();
 }
 function celebrate(team){cheer=3.2;const gx=(team?-1:1)*HALF_L;burst(gx,GOAL_H+1,0,120);}
 function diagnostics(){return {ready:!!meshes,meshes:scene.meshes.length,activeMeshes:scene.getActiveMeshes().length,fps:Math.round(engine.getFps())};}
 addEventListener('resize',()=>engine.resize());
 return {engine,scene,cam,sync,snapCamera,burst,celebrate,diagnostics,teamOffset:TEAM_SIZE};
}
