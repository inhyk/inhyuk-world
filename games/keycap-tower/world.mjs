import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { TrailMesh } from '@babylonjs/core/Meshes/trailMesh';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import '@babylonjs/core/Meshes/instancedMesh';
import { WORLDS, TRAILS, SKINS, LOBBY_R, PILLAR_R, R, getWorld, boxAt, vanishPhase, spinnerAngle, pathPoint, buttonReady, ownsTread, levelOf, fmt } from './core.mjs';

const FONT='"Arial Rounded MT Bold", Arial, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
const CONFETTI=['#ff6b6b','#ffa94d','#ffd43b','#69db7c','#4dabf7','#9775fa','#f783ac'];

export function createWorld(canvas){
 const engine=new Engine(canvas,true,{preserveDrawingBuffer:true,stencil:true});
 engine.setHardwareScalingLevel(1/Math.min(devicePixelRatio||1,1.5));
 const scene=new Scene(engine);
 scene.fogMode=Scene.FOGMODE_LINEAR;scene.fogStart=90;scene.fogEnd=300;
 const camera=new FreeCamera('follow camera',new Vector3(0,5,-10),scene);
 camera.inputs.clear();camera.minZ=.1;camera.maxZ=700;camera.fov=.95;
 const hemi=new HemisphericLight('sky',new Vector3(0,1,0),scene);
 const sun=new DirectionalLight('sun',new Vector3(-.4,-1,.35),scene);sun.intensity=.7;sun.diffuse=Color3.FromHexString('#fff4dc');

 const mats=new Map();
 function mat(color,{glow=0,alpha=1}={}){
  const key=`${color}/${glow}/${alpha}`;if(mats.has(key))return mats.get(key);
  const m=new StandardMaterial(key,scene);m.diffuseColor=Color3.FromHexString(color);m.specularColor=new Color3(.14,.14,.14);
  if(glow)m.emissiveColor=m.diffuseColor.scale(glow);if(alpha<1)m.alpha=alpha;mats.set(key,m);return m;
 }
 const labelMats=new Map();
 function labelMat(text,{w=4,h=1,bg='#ffffffee',fg='#1f2d4a',size=110}={}){
  const key=`${text}/${w}/${h}/${bg}/${fg}`;
  if(!labelMats.has(key)){
   const tex=new DynamicTexture(`label ${text}`,{width:Math.round(160*w/h),height:160},scene,true);
   const W=tex.getSize().width,H=tex.getSize().height,ctx=tex.getContext();
   if(bg){ctx.fillStyle=bg;ctx.beginPath();ctx.roundRect(4,4,W-8,H-8,H*.3);ctx.fill();}
   ctx.fillStyle=fg;let px=size*H/160;do{ctx.font=`bold ${px}px ${FONT}`;px-=6;}while(ctx.measureText(text).width>W*.86&&px>20);ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,W/2,H/2+H*.04);tex.update();tex.hasAlpha=true;
   const m=new StandardMaterial(`label mat ${text}`,scene);m.diffuseTexture=tex;m.emissiveColor=new Color3(1,1,1);m.disableLighting=true;m.useAlphaFromDiffuseTexture=true;m.backFaceCulling=false;
   labelMats.set(key,m);
  }
  return labelMats.get(key);
 }
 // 항상 카메라를 보는 표지판
 function sign(text,o={}){const p=MeshBuilder.CreatePlane(`sign ${text}`,{width:o.w??4,height:o.h??1},scene);p.material=labelMat(text,o);p.billboardMode=7;p.isPickable=false;p.parent=root;return p;}
 // 키캡: 위가 살짝 좁은 네모 뿔대. 색마다 하나만 만들고 나머지는 인스턴스로 그린다.
 const caps=new Map(),tops=new Map();
 function cap(color,opt){
  const key=`${color}/${opt?.alpha??1}/${theme.dark}`;
  if(!caps.has(key)){const m=MeshBuilder.CreateCylinder(`cap ${key}`,{tessellation:4,diameterBottom:Math.SQRT2,diameterTop:Math.SQRT2*.82,height:1},scene);m.rotation.y=Math.PI/4;m.bakeCurrentTransformIntoVertices();m.convertToFlatShadedMesh();m.material=mat(color,{glow:theme.dark?.3:.06,...opt});m.isVisible=false;m.isPickable=false;caps.set(key,m);}
  return caps.get(key).createInstance('keycap');
 }
 function capTop(text,fg){
  const key=`${text}/${fg}`;
  if(!tops.has(key)){const wide=text.length>1,m=MeshBuilder.CreatePlane(`top ${key}`,{size:1},scene);m.material=labelMat(text,{w:wide?2.4:1,h:1,bg:'',fg,size:wide?92:128});m.isVisible=false;m.isPickable=false;tops.set(key,m);}
  return tops.get(key).createInstance('keycap label');
 }
 const yawOf=o=>Math.atan2(o.tx,o.tz);
 const bright=hex=>{const c=Color3.FromHexString(hex);return c.r*.3+c.g*.59+c.b*.11>.6;};

 let root=null,W=null,theme=null,keyed=new Map(),movers=[],blinks=[],spinners=[],walls=[],buttons=[],treads=[],floaters=[],chaser=null,belt=0;
 const yellow=()=>mat('#ffd43b',{glow:.55}),gray=()=>mat('#868e96',{glow:.1});
 function keycap(o,color,fg,opt){
  const body=cap(color,opt);body.parent=root;body.scaling.set(o.w,o.h,o.d);body.rotation.y=yawOf(o);body.position.set(o.x,o.top-o.h/2,o.z);
  const wide=o.label.length>1,size=Math.min(o.w,o.d)*.62,face=capTop(o.label,fg);face.parent=root;face.rotation.x=Math.PI/2;face.rotation.y=yawOf(o);face.scaling.set(wide?size*1.5:size,wide?size*.62:size,1);face.position.set(o.x,o.top+.02,o.z);
  const k={o,body,face,press:0};keyed.set(o.id,k);return k;
 }
 function load(w){
  if(root)root.dispose();
  keyed=new Map();movers=[];blinks=[];spinners=[];walls=[];buttons=[];treads=[];floaters=[];
  W=getWorld(w);theme=W.def.theme;root=new TransformNode(`world ${w}`,scene);
  scene.clearColor=Color4.FromHexString(theme.sky+'ff');scene.fogColor=Color3.FromHexString(theme.fog);
  hemi.intensity=theme.dark?.9:.62;sun.intensity=theme.dark?.6:.5;hemi.groundColor=Color3.FromHexString(theme.dark?'#3a3560':'#c99a8a');
  const soft=theme.dark?'#ffffff':'#4a2c1a';
  for(const o of W.objects){
   if(o.type==='key'){const c=theme.keys[(o.stage+Math.round(o.s))%theme.keys.length];keycap(o,c,bright(c)?'#2b2140':'#ffffff');}
   else if(o.type==='mover')movers.push(keycap(o,theme.accent,'#3d2b00'));
   else if(o.type==='blink')blinks.push(keycap(o,'#66e0ff','#0b4f5c',{alpha:.82}));
   else if(o.type==='del')keycap(o,'#fa5252','#ffffff');
   else if(o.type==='gold')keycap(o,'#ffd43b','#7a4d00');
   else if(o.type==='safe'){
    const b=MeshBuilder.CreateBox(o.id,{width:o.w,height:o.h,depth:o.d},scene);b.parent=root;b.position.set(o.x,o.top-o.h/2,o.z);b.rotation.y=yawOf(o);b.material=mat(theme.safe,{glow:theme.dark?.25:.04});b.isPickable=false;
    const btn=MeshBuilder.CreateCylinder('win button',{diameter:3.4,height:.5,tessellation:28},scene);btn.parent=root;btn.position.set(o.button.x,o.top+.25,o.button.z);btn.material=yellow();btn.isPickable=false;
    const tag=sign(`+${fmt(W.def.wins[o.stage])} 🏆`,{w:3.4,h:.9,bg:'#fff3bfee',fg:'#8f5a00',size:100});tag.position.set(o.button.x,o.top+3.1,o.button.z);
    buttons.push({k:o.stage,btn,tag});
    const last=o.stage===W.stages.length-1,next=W.stages[o.stage+1],e=pathPoint(o.s+5.2,-5.6);
    const board=sign(last?`👑 ${W.def.name} 정상!`:`STAGE ${o.stage+2} · ${next.name}`,{w:5.6,h:.9,size:92});board.position.set(e.x,o.top+3.4,e.z);
   }
   else if(o.type==='wall'){
    const b=MeshBuilder.CreateBox(o.id,{width:o.w,height:o.h,depth:o.d},scene);b.parent=root;b.position.set(o.x,o.top-o.h/2,o.z);b.rotation.y=yawOf(o);b.material=mat('#ff3b5c',{glow:.6,alpha:.42});b.isPickable=false;
    const tag=sign(`🔒 레벨 ${fmt(o.req)} 필요`,{w:5,h:1.1,bg:'#c92a2aee',fg:'#ffffff',size:100});tag.position.set(o.x,o.top-o.h/2+.6,o.z);
    walls.push({req:o.req,nodes:[b,tag]});
   }
   else if(o.type==='spinner'){
    const hub=MeshBuilder.CreateCylinder('hub',{diameter:.7,height:1.1},scene);hub.parent=root;hub.position.set(o.x,o.top+.55,o.z);hub.material=mat('#495057');
    const node=new TransformNode('spinner',scene);node.parent=root;node.position.set(o.x,o.top+.5,o.z);
    const bar=MeshBuilder.CreateBox('bar',{width:o.len,height:.42,depth:.42},scene);bar.parent=node;bar.material=mat('#fa5252',{glow:.5});bar.isPickable=false;
    spinners.push({o,node});
   }
   else if(o.type==='tread'){
    const tr=W.def.treads[o.index],yaw=yawOf(o),node=new TransformNode('treadmill',scene);node.parent=root;node.position.set(o.x,0,o.z);node.rotation.y=yaw;
    const part=(name,w,h,d,m,x,y,z)=>{const b=MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene);b.parent=node;b.position.set(x,y,z);b.material=m;b.isPickable=false;return b;};
    const color=['#8d5a3b','#fcc419','#66d9e8'][o.index];
    part('deck',o.w,o.h,o.d,mat('#343a40'),0,o.h/2,0);
    const stripes=[];for(let i=0;i<6;i++)stripes.push(part('belt stripe',o.w*.82,.04,.3,mat(color,{glow:.7}),0,o.h+.02,0));
    part('rail',.3,1.5,.3,mat(color,{glow:.35}),-o.w/2+.15,1.1,o.d/2-.4);part('rail',.3,1.5,.3,mat(color,{glow:.35}),o.w/2-.15,1.1,o.d/2-.4);part('console',o.w,.5,.4,mat(color,{glow:.5}),0,1.9,o.d/2-.4);
    const open=sign(`${tr.name} ×${fmt(tr.mult)}`,{w:6,h:.9,size:92});open.position.set(o.x,4.2,o.z);
    const locked=sign(`🔒 ${fmt(tr.cost)} 🏆`,{w:3.6,h:.8,bg:'#343a40ee',fg:'#ffd43b',size:96});locked.position.set(o.x,3.2,o.z);
    treads.push({o,stripes,locked});
   }
  }
  // 로비 바닥과 가운데 키보드 기둥
  const floor=MeshBuilder.CreateCylinder('lobby',{diameter:LOBBY_R*2,height:1.2,tessellation:64},scene);floor.parent=root;floor.position.y=-.6;floor.material=mat(theme.floor,{glow:theme.dark?.18:.02});floor.isPickable=false;
  const ring=MeshBuilder.CreateTorus('lobby edge',{diameter:LOBBY_R*2,thickness:.9,tessellation:64},scene);ring.parent=root;ring.material=mat(theme.accent,{glow:.6});
  const H=W.top+26,pillar=MeshBuilder.CreateCylinder('pillar',{diameter:PILLAR_R*2,height:H,tessellation:40},scene);pillar.parent=root;pillar.position.y=H/2-1;pillar.isPickable=false;
  const tex=new DynamicTexture('pillar keys',256,scene,true),ctx=tex.getContext();ctx.fillStyle=theme.pillar;ctx.fillRect(0,0,256,256);
  for(let r=0;r<4;r++)for(let c=0;c<4;c++){ctx.fillStyle=theme.keys[(r*3+c)%theme.keys.length];ctx.globalAlpha=.85;ctx.beginPath();ctx.roundRect(c*64+7,r*64+7,50,50,10);ctx.fill();ctx.globalAlpha=.25;ctx.fillStyle='#ffffff';ctx.beginPath();ctx.roundRect(c*64+13,r*64+11,38,34,8);ctx.fill();}
  ctx.globalAlpha=1;tex.update();tex.uScale=10;tex.vScale=H/9;
  const pm=new StandardMaterial('pillar',scene);pm.diffuseTexture=tex;pm.emissiveTexture=tex;pm.emissiveColor=new Color3(.45,.45,.45);pm.specularColor=new Color3(0,0,0);pillar.material=pm;
  const crown=sign(`${W.def.emoji} ${w+1}월드 · ${W.def.name}`,{w:16,h:2.6,bg:theme.dark?'#000000aa':'#ffffffdd',fg:soft,size:100});crown.position.set(R+6,9,-8);
  // 로비 시설
  const zoneLook={item:['🛒 아이템 상점','#63e6be'],stat:['📊 스탯 상점','#4dabf7'],world:['🌍 월드 포탈','#b197fc'],rebirth:['🔁 환생의 제단','#ff8787']};
  for(const z of W.zones){
   const [text,color]=zoneLook[z.id],pad=MeshBuilder.CreateCylinder(`zone ${z.id}`,{diameter:z.r*2,height:.16,tessellation:36},scene);pad.parent=root;pad.position.set(z.x,.08,z.z);pad.material=mat(color,{glow:.7});
   const arch=MeshBuilder.CreateTorus('arch',{diameter:5.4,thickness:.45,tessellation:36},scene);arch.parent=root;arch.rotation.x=Math.PI/2;arch.rotation.y=yawOf(z)+Math.PI/2;arch.position.set(z.x+z.ox*2.6,2.7,z.z+z.oz*2.6);arch.material=mat(color,{glow:.8});
   const tag=sign(text,{w:5,h:1,size:96});tag.position.set(z.x,5.9,z.z);
  }
  const start=pathPoint(1,0),arrow=sign('⬆ 타워 입구 · 키캡을 밟아 올라가요',{w:8.6,h:1,bg:'#ffd43bee',fg:'#5c3b00',size:88});arrow.position.set(start.x-start.tx*3,4.4,start.z-start.tz*3);
  // 하늘에 떠다니는 큰 키캡
  let seed=11+w;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
  for(let i=0;i<46;i++){const c=cap(theme.keys[i%theme.keys.length]);c.parent=root;const a=rnd()*6.283,r=80+rnd()*110,sc=3+rnd()*7;c.position.set(Math.cos(a)*r,-20+rnd()*(H+30),Math.sin(a)*r);c.scaling.set(sc,sc,sc);c.rotation.set(rnd()*6,rnd()*6,rnd()*6);floaters.push({mesh:c,spin:.1+rnd()*.3,y:c.position.y,ph:rnd()*6});}
  if(theme.dark){const star=MeshBuilder.CreateSphere('star',{diameter:1,segments:4},scene);star.material=mat('#ffffff',{glow:1});star.isVisible=false;star.applyFog=false;star.parent=root;
   for(let i=0;i<160;i++){const st=star.createInstance('star');st.parent=root;const a=rnd()*6.283,r=200+rnd()*120,sc=.6+rnd()*1.6;st.position.set(Math.cos(a)*r,-60+rnd()*(H+160),Math.sin(a)*r);st.scaling.set(sc,sc,sc);}}
  // 쫓아오는 ESC 괴물
  chaser=new TransformNode('chaser',scene);chaser.parent=root;
  const body=MeshBuilder.CreateCylinder('esc',{tessellation:4,diameterBottom:4.6,diameterTop:3.7,height:3},scene);body.rotation.y=Math.PI/4;body.parent=chaser;body.position.y=1.9;body.material=mat('#e03131',{glow:.6});
  for(const x of [-.7,.7]){const eye=MeshBuilder.CreateSphere('eye',{diameter:.8,segments:8},scene);eye.parent=chaser;eye.position.set(x,2.4,1.5);eye.material=mat('#ffffff',{glow:1});const pupil=MeshBuilder.CreateSphere('pupil',{diameter:.36,segments:6},scene);pupil.parent=chaser;pupil.position.set(x,2.36,1.86);pupil.material=mat('#111111');}
  const esc=MeshBuilder.CreatePlane('esc label',{width:2.4,height:1},scene);esc.material=labelMat('ESC',{w:2.4,h:1,bg:'',fg:'#ffffff',size:120});esc.parent=chaser;esc.rotation.x=Math.PI/2;esc.position.y=3.42;
  chaser.setEnabled(false);
 }

 // 캐릭터
 const player=new TransformNode('player',scene);
 // 스킨을 갈아입으면 이 네 가지 색이 바뀐다.
 const own=name=>{const m=new StandardMaterial(`skin ${name}`,scene);m.specularColor=new Color3(.12,.12,.12);return m;};
 const skin=own('skin'),hoodie=own('hoodie'),pants=own('pants'),hair=own('hair'),black=mat('#111111');
 let skinIndex=-1;
 function setSkin(i){if(i===skinIndex)return;skinIndex=i;const k=SKINS[i]??SKINS[0];skin.diffuseColor=Color3.FromHexString(k.skin);hoodie.diffuseColor=Color3.FromHexString(k.hoodie);pants.diffuseColor=Color3.FromHexString(k.pants);hair.diffuseColor=Color3.FromHexString(k.hair);}
 setSkin(0);
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
 const trailNode=new TransformNode('trail anchor',scene);trailNode.parent=player;trailNode.position.y=.9;
 let trail=null,trailIndex=-2;
 function setTrail(i){
  if(i===trailIndex)return;trailIndex=i;trail?.dispose();trail=null;
  if(i>=0){trail=new TrailMesh('trail',trailNode,scene,.7,50,true);trail.material=mat(TRAILS[i].color,{glow:1,alpha:.75});trail.isPickable=false;}
 }

 const confetti=[];const confettiColors=CONFETTI.map(c=>mat(c,{glow:.6}));
 function burst(x,y,z,count=40){
  for(let i=0;i<count;i++){const m=MeshBuilder.CreateBox('confetti',{width:.18,height:.18,depth:.04},scene);m.material=confettiColors[i%confettiColors.length];m.position.set(x,y,z);
   confetti.push({mesh:m,vx:(Math.random()-.5)*8,vy:5+Math.random()*7,vz:(Math.random()-.5)*8,life:1.8+Math.random()});}
 }

 const cam={yaw:0,pitch:.38,dist:10,tx:0,ty:1.4,tz:0};let walk=0,ready=false,clock=0,loaded=-1;
 scene.executeWhenReady(()=>{ready=true;});
 function sync(s,dt,view={}){
  if(s.world!==loaded){load(s.world);loaded=s.world;trailIndex=-2;}
  clock+=dt;setTrail(s.trail);setSkin(s.skin);
  const level=levelOf(s.speed);
  for(const k of keyed.values()){
   const b=boxAt(k.o,s.clock),want=s.grounded&&s.groundId===k.o.id?.2:0;k.press+=(want-k.press)*Math.min(1,dt*18);
   k.body.position.set(b.x,b.top-k.o.h/2-k.press,b.z);k.face.position.set(b.x,b.top+.02-k.press,b.z);
  }
  for(const k of blinks){const p=vanishPhase(s,k.o.id),on=p==='solid'||(p==='warning'&&Math.sin(clock*40)>0);k.body.isVisible=on;k.face.isVisible=on;}
  for(const sp of spinners)sp.node.rotation.y=-spinnerAngle(sp.o,s.clock);
  for(const wl of walls){const on=level<wl.req;for(const n of wl.nodes)n.setEnabled(on);}
  for(const b of buttons){const on=buttonReady(s,s.world,b.k);b.btn.material=on?yellow():gray();b.btn.scaling.y=on?1+Math.sin(clock*5)*.12:.5;b.tag.setEnabled(on);}
  if(view.onTread!=null)belt+=dt*6;
  for(const t of treads){t.locked.setEnabled(!ownsTread(s,s.world,t.o.index));const run=view.onTread===t.o.index?belt:0;t.stripes.forEach((st,i)=>{st.position.z=t.o.d/2-((i*t.o.d/6+run)%t.o.d+t.o.d)%t.o.d;});}
  for(const f of floaters){f.mesh.rotation.y+=dt*f.spin;f.mesh.position.y=f.y+Math.sin(clock*.5+f.ph)*2;}
  chaser.setEnabled(!!s.chaser);
  if(s.chaser){const p=pathPoint(s.chaser.pos);chaser.position.set(p.x,p.y+Math.abs(Math.sin(clock*7))*.8,p.z);chaser.rotation.y=Math.atan2(p.tx,p.tz);}
  // 캐릭터
  player.position.set(s.x,s.y,s.z);
  let turn=s.facing-player.rotation.y;turn=Math.atan2(Math.sin(turn),Math.cos(turn));player.rotation.y+=turn*Math.min(1,dt*14);
  const speed=view.onTread!=null?Math.max(9,Math.hypot(s.vx,s.vz)):Math.hypot(s.vx,s.vz);
  if(s.grounded){walk+=dt*speed*1.6;const sw=Math.sin(walk)*Math.min(1,speed/5)*.8;legL.rotation.x=sw;legR.rotation.x=-sw;armL.rotation.x=-sw;armR.rotation.x=sw;armL.rotation.z=armR.rotation.z=0;}
  else{legL.rotation.x=-.5;legR.rotation.x=.4;armL.rotation.x=armR.rotation.x=-2.6;armL.rotation.z=-.2;armR.rotation.z=.2;}
  shadow.isVisible=s.grounded;if(s.grounded)shadow.position.set(s.x,s.y+.03,s.z);
  // 카메라
  const f=Math.min(1,dt*8);cam.tx+=(s.x-cam.tx)*f;cam.ty+=(s.y+1.4-cam.ty)*Math.min(1,dt*5);cam.tz+=(s.z-cam.tz)*f;
  const cp=Math.cos(cam.pitch);
  camera.position.set(cam.tx-Math.sin(cam.yaw)*cp*cam.dist,cam.ty+Math.sin(cam.pitch)*cam.dist,cam.tz-Math.cos(cam.yaw)*cp*cam.dist);
  camera.setTarget(new Vector3(cam.tx,cam.ty,cam.tz));
  for(let i=confetti.length-1;i>=0;i--){const c=confetti[i];c.vy-=14*dt;c.mesh.position.x+=c.vx*dt;c.mesh.position.y+=c.vy*dt;c.mesh.position.z+=c.vz*dt;c.mesh.rotation.x+=dt*8;c.mesh.rotation.y+=dt*6;c.life-=dt;if(c.life<=0){c.mesh.dispose();confetti.splice(i,1);}}
  scene.render();
 }
 function snapCamera(s){cam.tx=s.x;cam.ty=s.y+1.4;cam.tz=s.z;cam.yaw=s.facing;player.rotation.y=s.facing;if(trail){trailIndex=-2;}}
 const fit=()=>{engine.resize();const portrait=innerHeight>innerWidth;camera.fovMode=portrait?FreeCamera.FOVMODE_HORIZONTAL_FIXED:FreeCamera.FOVMODE_VERTICAL_FIXED;camera.fov=portrait?1.25:.95;};
 addEventListener('resize',fit);fit();
 return {engine,cam,sync,snapCamera,burst,
  diagnostics:()=>({ready,renderer:'WebGL 3D',world:loaded,worldName:WORLDS[Math.max(0,loaded)].name,meshes:scene.meshes.length,activeMeshes:scene.getActiveMeshes().length,camera:{yaw:cam.yaw,pitch:cam.pitch,dist:cam.dist}})};
}
