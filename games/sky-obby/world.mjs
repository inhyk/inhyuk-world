import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import '@babylonjs/core/Rendering/edgesRenderer';
import { LEVEL, CHECKPOINTS, GOAL, THEMES, boxAt, vanishPhase, spinnerAngle, groundBelow, zRange } from './core.mjs';

const PALETTE=['#ff6b6b','#ffa94d','#ffd43b','#69db7c','#4dabf7','#9775fa','#f783ac','#38d9a9','#ffc078'];

export function createWorld(canvas){
 const engine=new Engine(canvas,true,{preserveDrawingBuffer:true,stencil:true});
 engine.setHardwareScalingLevel(1/Math.min(devicePixelRatio||1,1.5));
 const scene=new Scene(engine);
 scene.clearColor=Color4.FromHexString('#8fd3ffff');
 scene.fogMode=Scene.FOGMODE_LINEAR;scene.fogStart=70;scene.fogEnd=190;scene.fogColor=Color3.FromHexString('#b5e3ff');
 const camera=new FreeCamera('follow camera',new Vector3(0,5,-10),scene);
 camera.inputs.clear();camera.minZ=.1;camera.maxZ=400;camera.fov=.95;
 const hemi=new HemisphericLight('sky',new Vector3(0,1,0),scene);hemi.intensity=.8;hemi.groundColor=Color3.FromHexString('#7ea6c9');
 const sun=new DirectionalLight('sun',new Vector3(-.4,-1,.35),scene);sun.intensity=.75;sun.diffuse=Color3.FromHexString('#fff4dc');

 const mats=new Map();
 function mat(color,{glow=0,alpha=1}={}){
  const key=`${color}/${glow}/${alpha}`;if(mats.has(key))return mats.get(key);
  const m=new StandardMaterial(key,scene);m.diffuseColor=Color3.FromHexString(color);m.specularColor=new Color3(.12,.12,.12);
  if(glow)m.emissiveColor=m.diffuseColor.scale(glow);if(alpha<1)m.alpha=alpha;mats.set(key,m);return m;
 }
 function outline(mesh,color='#20304a'){mesh.enableEdgesRendering(.95);mesh.edgesWidth=3.2;mesh.edgesColor=Color4.FromHexString(color+'aa');}
 function box(name,o,material){const m=MeshBuilder.CreateBox(name,{width:o.w,height:o.h,depth:o.d},scene);m.position.set(o.x,o.y,o.z);m.material=material;m.isPickable=false;return m;}
 const labelMats=new Map();
 function label(text,{w=4,h=1,bg='#ffffffee',fg='#1f2d4a',size=110}={}){
  const key=`${text}/${w}/${h}/${bg}/${fg}`;
  if(!labelMats.has(key)){
  const tex=new DynamicTexture(`label ${text}`,{width:Math.round(160*w/h),height:160},scene,true);
  const W=tex.getSize().width,H=tex.getSize().height,ctx=tex.getContext();
  ctx.fillStyle=bg;ctx.beginPath();ctx.roundRect(4,4,W-8,H-8,H*.3);ctx.fill();
  ctx.fillStyle=fg;let px=size*H/160;do{ctx.font=`bold ${px}px Arial, "Apple SD Gothic Neo", sans-serif`;px-=6;}while(ctx.measureText(text).width>W*.86&&px>20);ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,W/2,H/2+H*.04);tex.update();tex.hasAlpha=true;
  const m=new StandardMaterial(`label mat ${text}`,scene);m.diffuseTexture=tex;m.emissiveColor=new Color3(1,1,1);m.disableLighting=true;m.useAlphaFromDiffuseTexture=true;m.backFaceCulling=false;
  labelMats.set(key,m);}
  const plane=MeshBuilder.CreatePlane(`label ${text}`,{width:w,height:h},scene);plane.material=labelMats.get(key);plane.billboardMode=7;plane.isPickable=false;return plane;
 }

 // 코스. 오브젝트마다 만든 메시를 묶어 두고 플레이어 근처 구간만 켜서 그린다.
 const dynamic=[],flags=[],groups=[];let lavaMat,trophy;
 function collect(build){const m0=scene.meshes.length,t0=scene.transformNodes.length;build();return [...scene.meshes.slice(m0),...scene.transformNodes.slice(t0)].filter(n=>!n.parent);}
 function track(o,build,lazy){const [a,b]=zRange(o);groups.push({a,b,on:true,nodes:lazy?[]:collect(build),lazy:lazy?build:null});}
 const iceMat=mat('#a5e3ff',{glow:.3});iceMat.specularColor=new Color3(.9,.95,1);iceMat.specularPower=48;
 for(const o of LEVEL)track(o,()=>build(o));
 function build(o){
  const color=PALETTE[o.stage%PALETTE.length];
  if(o.type==='block'){outline(box(o.id,o,mat(color)));}
  else if(o.type==='pillar'){const m=box(o.id,o,mat('#dfe7f2'));outline(m,'#7d8aa3');const star=MeshBuilder.CreatePolyhedron('star',{type:1,size:.9},scene);star.position.set(o.x,o.y+o.h/2+1.3,o.z);star.material=mat('#ffe066',{glow:.8});dynamic.push({type:'spin',mesh:star});}
  else if(o.type==='lava'){lavaMat??=mat('#d9480f',{glow:.6});box(o.id,o,lavaMat);}
  else if(o.type==='mover'){const m=box(o.id,o,mat('#ffcc33',{glow:.15}));outline(m,'#8a5a00');const arrow=MeshBuilder.CreateBox('stripe',{width:o.axis==='x'?o.w*.8:.25,height:.04,depth:o.axis==='x'?.25:o.d*.8},scene);arrow.parent=m;arrow.position.y=o.h/2+.02;arrow.material=mat('#ff8c00',{glow:.5});dynamic.push({type:'mover',o,mesh:m});}
  else if(o.type==='ice'){const m=box(o.id,o,iceMat);outline(m,'#4c8fb3');for(let k=0;k<3;k++){const c=MeshBuilder.CreateBox('ice shine',{width:.08,height:.02,depth:Math.min(o.d,o.w)*.5},scene);c.parent=m;c.rotation.y=.7;c.position.set((k-1)*o.w*.28,o.h/2+.01,(k-1)*o.d*.22);c.material=mat('#ffffff',{glow:1});}}
  else if(o.type==='conveyor'){
   const m=box(o.id,o,mat('#495057'));outline(m,'#1f2429');const along=o.dir[0]?'x':'z',len=along==='x'?o.w:o.d,cross=along==='x'?o.d:o.w;
   const stripes=[];for(let k=0;k<Math.floor(len/1.2);k++){const st=MeshBuilder.CreateBox('belt stripe',{width:along==='x'?.25:cross*.9,height:.03,depth:along==='x'?cross*.9:.25},scene);st.parent=m;st.position.y=o.h/2+.02;st.material=mat('#ffd43b',{glow:.5});stripes.push(st);}
   dynamic.push({type:'belt',o,mesh:m,stripes,along,len,sign:o.dir[0]||o.dir[1]});
  }
  else if(o.type==='vanish'){const m=box(o.id,o,mat('#66e0ff',{glow:.25,alpha:.85}));outline(m,'#0b7285');dynamic.push({type:'vanish',o,mesh:m});}
  else if(o.type==='pad'){outline(box(o.id,o,mat('#40c057')));const top=MeshBuilder.CreateCylinder('pad top',{diameter:o.w*.8,height:.12,tessellation:28},scene);top.position.set(o.x,o.y+o.h/2+.06,o.z);top.material=mat('#b2f2bb',{glow:.9});dynamic.push({type:'pulse',mesh:top});
   const up=label('▲ 점프대',{w:2.6,h:.8,bg:'#2b8a3ecc',fg:'#fff',size:92});up.position.set(o.x,o.y+2.4,o.z);}
  else if(o.type==='checkpoint'){
   const m=box(o.id,o,mat(o.cp===0?'#f1f3f5':'#e9ecef'));outline(m,'#868e96');
   const stripe=MeshBuilder.CreateBox('cp stripe',{width:o.w,height:.06,depth:.6},scene);stripe.position.set(o.x,o.y+o.h/2+.03,o.z-o.d/2+.3);stripe.material=mat(color,{glow:.3});
   if(o.cp>0){
    const pole=MeshBuilder.CreateCylinder('pole',{diameter:.12,height:3.2},scene);pole.position.set(o.x+o.w/2-.6,o.y+o.h/2+1.6,o.z);pole.material=mat('#dee2e6');
    const flag=MeshBuilder.CreateBox('flag',{width:1.1,height:.7,depth:.06},scene);flag.position.set(o.x+o.w/2-1.2,o.y+o.h/2+2.8,o.z);flags.push({cp:o.cp,mesh:flag});
    // 스테이지 표지판 글자 텍스처는 가까이 왔을 때 처음 만든다.
    track(o,()=>{const sign=label(`STAGE ${o.cp+1}`,{w:2.8,h:.8,size:96});sign.position.set(o.x-o.w/2+1.2,o.y+o.h/2+3,o.z+o.d/2-.6);},true);
   } else {const sign=label('인혁이의 하늘 점프맵',{w:6,h:1.1,size:110});sign.position.set(-4.2,3.6,3.5);}
  }
  else if(o.type==='spinner'){
   const hub=MeshBuilder.CreateCylinder('hub',{diameter:.6,height:1.1},scene);hub.position.set(o.x,o.top+.55,o.z);hub.material=mat('#495057');
   const bar=MeshBuilder.CreateBox('bar',{width:o.len,height:.4,depth:.4},scene);bar.material=mat('#fa5252',{glow:.35});outline(bar,'#7a0b0b');
   const node=new TransformNode('spinner',scene);node.position.set(o.x,o.top+.5,o.z);bar.parent=node;dynamic.push({type:'spinner',o,mesh:node});
  }
  else if(o.type==='goal'){
   outline(box(o.id,o,mat('#ffd43b',{glow:.2})),'#8f6b00');
   trophy=new TransformNode('trophy',scene);trophy.position.set(o.x,o.y+o.h/2,o.z);const gold=mat('#fcc419',{glow:.45});
   const base=MeshBuilder.CreateBox('base',{width:1.2,height:.4,depth:1.2},scene);base.position.y=.2;
   const stem=MeshBuilder.CreateCylinder('stem',{diameter:.3,height:.9},scene);stem.position.y=.85;
   const cup=MeshBuilder.CreateCylinder('cup',{diameterTop:1.5,diameterBottom:.5,height:1.2,tessellation:24},scene);cup.position.y=1.9;
   const h1=MeshBuilder.CreateTorus('handle',{diameter:.8,thickness:.14},scene);h1.rotation.x=Math.PI/2;h1.position.set(.78,2,0);
   const h2=h1.clone('handle2');h2.position.x=-.78;
   for(const p of [base,stem,cup,h1,h2]){p.parent=trophy;p.material=gold;}
   const sign=label('🏆 GOAL',{w:3,h:.9,bg:'#fff3bfee',fg:'#8f5a00',size:100});sign.position.set(o.x,o.y+o.h/2+4.2,o.z);
  }
 }
 // 구름: 플레이어 주변에 두고, 뒤로 지나간 구름은 앞쪽으로 옮긴다.
 let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
 const cloudMat=mat('#ffffff',{glow:.55,alpha:.92}),clouds=[];
 function cloudSpot(g,z,y){let x;do x=(rnd()-.5)*120;while(Math.abs(x)<12);g.position.set(x,y-14+rnd()*50,z);}
 for(let i=0;i<60;i++){
  const g=new TransformNode('cloud',scene);cloudSpot(g,rnd()*260-60,0);clouds.push(g);
  for(let k=0;k<4;k++){const s=MeshBuilder.CreateSphere('puff',{diameter:3+rnd()*4,segments:8},scene);s.parent=g;s.position.set(k*2.2-3,rnd()*1.2,rnd()*1.5);s.scaling.y=.6;s.material=cloudMat;s.isPickable=false;}
 }
 const sunDisc=MeshBuilder.CreateDisc('sun disc',{radius:14,tessellation:40},scene);sunDisc.position.set(-90,110,300);sunDisc.material=mat('#fff3a8',{glow:1});sunDisc.billboardMode=7;sunDisc.applyFog=false;

 // 캐릭터
 const player=new TransformNode('player',scene);
 const skin=mat('#ffd8b1'),hoodie=mat('#4263eb'),pants=mat('#343a40'),hair=mat('#5c3d2e'),black=mat('#111111');
 const part=(name,w,h,d,m,parent,x,y,z)=>{const b=MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene);b.material=m;b.parent=parent;b.position.set(x,y,z);b.isPickable=false;return b;};
 const pivot=(x,y)=>{const n=new TransformNode('pivot',scene);n.parent=player;n.position.set(x,y,0);return n;};
 const legL=pivot(-.19,.8),legR=pivot(.19,.8),armL=pivot(-.5,1.35),armR=pivot(.5,1.35);
 part('leg',.34,.8,.36,pants,legL,0,-.4,0);part('leg',.34,.8,.36,pants,legR,0,-.4,0);
 part('torso',.78,.62,.44,hoodie,player,0,1.1,0);
 part('arm',.24,.6,.28,hoodie,armL,0,-.25,0);part('arm',.24,.6,.28,hoodie,armR,0,-.25,0);
 part('hand',.22,.14,.24,skin,armL,0,-.6,0);part('hand',.22,.14,.24,skin,armR,0,-.6,0);
 const head=part('head',.56,.5,.52,skin,player,0,1.66,0);
 part('hair',.6,.16,.56,hair,head,0,.24,-.01);part('hair back',.6,.3,.12,hair,head,0,.1,-.24);
 part('eye',.08,.1,.02,black,head,-.12,.03,.265);part('eye',.08,.1,.02,black,head,.12,.03,.265);
 part('smile',.2,.04,.02,black,head,0,-.12,.265);
 const shadow=MeshBuilder.CreateDisc('blob shadow',{radius:.5,tessellation:24},scene);shadow.rotation.x=Math.PI/2;
 const shadowMat=new StandardMaterial('shadow',scene);shadowMat.diffuseColor=new Color3(0,0,0);shadowMat.alpha=.35;shadowMat.disableLighting=true;shadow.material=shadowMat;

 // 체크포인트/클리어 폭죽
 const confetti=[];const confettiColors=PALETTE.map(c=>mat(c,{glow:.6}));
 function burst(x,y,z,count=40){
  for(let i=0;i<count;i++){const m=MeshBuilder.CreateBox('confetti',{width:.18,height:.18,depth:.04},scene);m.material=confettiColors[i%confettiColors.length];m.position.set(x,y,z);
   confetti.push({mesh:m,vx:(Math.random()-.5)*8,vy:5+Math.random()*7,vz:(Math.random()-.5)*8,life:1.8+Math.random()});}
 }

 const cam={yaw:0,pitch:.38,dist:9,tx:0,ty:1.4,tz:0};let lastWin=null;const skyTarget=new Color3(),fogTarget=new Color3();let walk=0,ready=false,clock=0;
 scene.executeWhenReady(()=>{ready=true;});
 const reached=mat('#40c057',{glow:.3}),unreached=mat('#adb5bd');
 function sync(s,dt){
  clock+=dt;
  // 가까운 구간만 켜기 (5m 움직일 때마다 갱신)
  const win=Math.round(s.z/5);
  if(win!==lastWin){lastWin=win;for(const g of groups){const on=g.b>s.z-60&&g.a<s.z+190;if(on===g.on)continue;
   if(on&&g.lazy){g.nodes=collect(g.lazy);g.lazy=null;}g.on=on;for(const n of g.nodes)n.setEnabled(on);}}
  for(const c of clouds){if(c.position.z<s.z-70)cloudSpot(c,c.position.z+260,s.y);else if(c.position.z>s.z+200)cloudSpot(c,c.position.z-260,s.y);}
  sunDisc.position.set(s.x-90,s.y+110,s.z+300);
  // 10스테이지마다 하늘 색이 바뀐다.
  const th=THEMES[Math.min(THEMES.length-1,Math.floor(s.checkpoint/10))],k=Math.min(1,dt*1.5);
  skyTarget.copyFrom(Color3.FromHexString(th.sky));fogTarget.copyFrom(Color3.FromHexString(th.fog));
  const cc=scene.clearColor;cc.r+=(skyTarget.r-cc.r)*k;cc.g+=(skyTarget.g-cc.g)*k;cc.b+=(skyTarget.b-cc.b)*k;
  const fc=scene.fogColor;fc.r+=(fogTarget.r-fc.r)*k;fc.g+=(fogTarget.g-fc.g)*k;fc.b+=(fogTarget.b-fc.b)*k;
  for(const d of dynamic){
   if(!d.mesh.isEnabled())continue;
   if(d.type==='mover'){const b=boxAt(d.o,s.clock);d.mesh.position.set(b.x,b.y,b.z);}
   else if(d.type==='vanish'){const p=vanishPhase(s,d.o.id);d.mesh.isVisible=p!=='gone';d.mesh.visibility=p==='warning'?(Math.sin(clock*40)>0?.35:.9):1;}
   else if(d.type==='spinner')d.mesh.rotation.y=-spinnerAngle(d.o,s.clock);
   else if(d.type==='spin')d.mesh.rotation.y+=dt*1.5;
   else if(d.type==='belt')d.stripes.forEach((st,k)=>{const p=((k*1.2+s.clock*d.o.push*d.sign)%d.len+d.len)%d.len-d.len/2;st.position[d.along]=p;});
   else if(d.type==='pulse')d.mesh.scaling.y=1+Math.sin(clock*6)*.5;
  }
  if(lavaMat)lavaMat.emissiveColor=Color3.FromHexString('#e8420f').scale(.5+Math.sin(clock*3)*.15);
  for(const f of flags){if(!f.mesh.isEnabled())continue;f.mesh.material=f.cp<=s.checkpoint?reached:unreached;f.mesh.rotation.y=Math.sin(clock*3+f.cp)*.15;}
  if(trophy)trophy.rotation.y+=dt*1.2;
  // 캐릭터
  player.position.set(s.x,s.y,s.z);
  let turn=s.facing-player.rotation.y;turn=Math.atan2(Math.sin(turn),Math.cos(turn));player.rotation.y+=turn*Math.min(1,dt*14);
  const speed=Math.hypot(s.vx,s.vz);
  if(s.grounded){walk+=dt*speed*1.6;const sw=Math.sin(walk)*Math.min(1,speed/5)*.8;legL.rotation.x=sw;legR.rotation.x=-sw;armL.rotation.x=-sw;armR.rotation.x=sw;armL.rotation.z=armR.rotation.z=0;}
  else{legL.rotation.x=-.5;legR.rotation.x=.4;armL.rotation.x=armR.rotation.x=-2.6;armL.rotation.z=-.2;armR.rotation.z=.2;}
  const g=groundBelow(s);shadow.isVisible=g!=null;if(g!=null){shadow.position.set(s.x,g+.02,s.z);const k=Math.max(.35,1-(s.y-g)/8);shadow.scaling.set(k,k,k);}
  // 카메라
  const f=Math.min(1,dt*8);cam.tx+=(s.x-cam.tx)*f;cam.ty+=(s.y+1.4-cam.ty)*Math.min(1,dt*5);cam.tz+=(s.z-cam.tz)*f;
  const cp=Math.cos(cam.pitch);
  camera.position.set(cam.tx-Math.sin(cam.yaw)*cp*cam.dist,cam.ty+Math.sin(cam.pitch)*cam.dist,cam.tz-Math.cos(cam.yaw)*cp*cam.dist);
  camera.setTarget(new Vector3(cam.tx,cam.ty,cam.tz));
  for(let i=confetti.length-1;i>=0;i--){const c=confetti[i];c.vy-=14*dt;c.mesh.position.x+=c.vx*dt;c.mesh.position.y+=c.vy*dt;c.mesh.position.z+=c.vz*dt;c.mesh.rotation.x+=dt*8;c.mesh.rotation.y+=dt*6;c.life-=dt;if(c.life<=0){c.mesh.dispose();confetti.splice(i,1);}}
  scene.render();
 }
 function snapCamera(s){cam.tx=s.x;cam.ty=s.y+1.4;cam.tz=s.z;cam.yaw=0;player.rotation.y=s.facing;}
 const fit=()=>{engine.resize();const portrait=innerHeight>innerWidth;camera.fovMode=portrait?FreeCamera.FOVMODE_HORIZONTAL_FIXED:FreeCamera.FOVMODE_VERTICAL_FIXED;camera.fov=portrait?1.25:.95;};
 addEventListener('resize',fit);fit();
 return {engine,cam,sync,snapCamera,burst,
  diagnostics:()=>({ready,renderer:'WebGL 3D',meshes:scene.meshes.length,activeMeshes:scene.getActiveMeshes().length,enabledGroups:groups.filter(g=>g.on).length,groups:groups.length,camera:{yaw:cam.yaw,pitch:cam.pitch,dist:cam.dist}})};
}
export {CHECKPOINTS,GOAL};
