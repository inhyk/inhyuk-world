import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Viewport } from '@babylonjs/core/Maths/math.viewport';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { ORES,radius,rankIndex,MAP_SIZE,clampMap } from './core.mjs';
import { PHASES } from './events.mjs';
// 안개 시야보다 넓게 깔아 두면 30,000m 계곡 어디를 걸어도 숲이 끊기지 않는다.
const SCENERY_RADIUS=620;
const SCENERY_KEEP=SCENERY_RADIUS+240;
const RAINBOW=['#ff85a7','#ffce65','#a4ffb7','#75d7ff','#ae9bff','#edb4ff'];
const DAY_LOOK={
 morning:{sky:'#d3e2d4',density:.0030,hemi:.62,ground:'#6f8266',sun:.58,sunColor:'#ffe6c0'},
 day:{sky:'#b5cec2',density:.0024,hemi:.78,ground:'#637655',sun:.78,sunColor:'#fff1cf'},
 night:{sky:'#141d33',density:.0042,hemi:.2,ground:'#121a2c',sun:.16,sunColor:'#8ea8ff'},
};
for(const look of Object.values(DAY_LOOK)){look.skyColor=Color3.FromHexString(look.sky);look.groundColor=Color3.FromHexString(look.ground);look.sunTint=Color3.FromHexString(look.sunColor);}
export function createWorld(canvas){
 const engine=new Engine(canvas,true,{preserveDrawingBuffer:true,stencil:true});engine.setHardwareScalingLevel(1/Math.min(devicePixelRatio,1.5));
 const scene=new Scene(engine);scene.clearColor=Color4.FromHexString('#b5cec2ff');scene.fogMode=Scene.FOGMODE_EXP2;scene.fogDensity=.0024;scene.fogColor=Color3.FromHexString('#b5cec2');
 const cameras=[0,1].map(i=>{const cam=new FreeCamera('camera'+i,new Vector3(0,30,-38),scene);cam.inputs.clear();cam.minZ=1;cam.maxZ=900;cam.fov=.86;return cam;});
 scene.activeCameras=[cameras[0]];
 const hemi=new HemisphericLight('sky',new Vector3(0,1,0),scene);hemi.intensity=.78;hemi.groundColor=Color3.FromHexString('#637655');
 const sun=new DirectionalLight('sun',new Vector3(-.5,-1,.5),scene);sun.intensity=.78;sun.diffuse=Color3.FromHexString('#fff1cf');
 const mats=new Map();function mat(color,glow=false){const key=color+glow;if(mats.has(key))return mats.get(key);const m=new StandardMaterial(key,scene);m.diffuseColor=Color3.FromHexString(color);m.specularColor=Color3.FromHexString('#142322');if(glow)m.emissiveColor=m.diffuseColor.scale(.55);mats.set(key,m);return m;}
 function finish(m,x,y,z,color,parent){m.position.set(x,y,z);m.material=mat(color);m.isPickable=false;if(parent)m.parent=parent;return m;}
 function box(n,x,y,z,w,h,d,c,p){return finish(MeshBuilder.CreateBox(n,{width:w,height:h,depth:d},scene),x,y,z,c,p);}
 function cylinder(n,x,y,z,diameter,height,c,p,top=diameter,tessellation=8){return finish(MeshBuilder.CreateCylinder(n,{diameterBottom:diameter,diameterTop:top,height,tessellation},scene),x,y,z,c,p);}
 function sphere(n,x,y,z,size,c,p,segments=8){return finish(MeshBuilder.CreateSphere(n,{diameter:size,segments},scene),x,y,z,c,p);}
 function label(text,x,y,z,w=15){const t=new DynamicTexture(text,{width:512,height:128},scene,false);t.hasAlpha=true;t.drawText(text,null,83,'bold 48px sans-serif','#fffae4','#234e3e',true);const m=new StandardMaterial(text,scene);m.diffuseTexture=t;m.emissiveColor=new Color3(.6,.6,.6);m.backFaceCulling=false;const mesh=MeshBuilder.CreatePlane(text,{width:w,height:w/4},scene);mesh.position.set(x,y,z);mesh.material=m;mesh.billboardMode=7;mesh.isPickable=false;return mesh;}
 // 30,000m 지면과 캠프 바닥이 같은 높이면 깊이 버퍼가 다퉈 화면이 반짝인다.
 // 바닥판은 두껍게 만들어 지면 아래로 묻고, 윗면 높이만 층마다 벌려 둔다. (지면 -0.03 → 광장 0.03 → 길 0.08)
 const ground=finish(MeshBuilder.CreateGround(`${MAP_SIZE} × ${MAP_SIZE} map`,{width:MAP_SIZE,height:MAP_SIZE,subdivisions:24},scene),0,-.03,0,'#8da978');ground.isPickable=false;
 box('camp clearing',0,-.47,0,54,1,30,'#c5bf9c');box('camp pathway',0,-.42,0,14,1,65,'#c9c2a0');
 for(let j=0;j<4;j++){const side=j<2?1:-1;box('map boundary',j%2?side*(MAP_SIZE/2):0,6,j%2?0:side*(MAP_SIZE/2),j%2?2:MAP_SIZE,12,j%2?MAP_SIZE:2,'#728675');}
 function stall(x,color,title){box('wood deck',x,.3,0,12,.6,8,'#876b4d');for(const dx of [-5.3,5.3])for(const dz of [-3,3])box('post',x+dx,3.3,dz,.45,6,.45,'#6b6246');box('counter',x,1.7,-2,10,2,2,'#ad8759');for(let j=0;j<6;j++){const roof=box('canvas awning',x-5+j*2,6.3,0,2, .35,9,j%2?'#f1e7bf':color);roof.rotation.x=-.07;}label(title,x,8,0,13);for(let i=0;i<3;i++)box('crate',x-3+i*3,1,-.5,2,1.7,2,'#bea06d');}
 stall(-19,'#dfb65f','판매소 · SELL');stall(19,'#518f7b','상점 · SHOP');
 for(let i=0;i<10;i++)cylinder('stepping stone',Math.sin(i)*.5,-.05,13+i*3.5,2.2,.5,'#d9cfac',null,2.2,7);
 let seed=6742;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 // 풍경은 템플릿 하나를 복제해 쓰고, 멀어지면 플레이어 주위로 옮겨 심는다.
 const treeTemplates=[0,1,2].map(v=>{
  const root=new TransformNode('pine template',scene);const h=9+v*4;
  cylinder('trunk',0,h*.2,0,1.1+v*.2,h*.4,'#726649',root);
  const cones=[];for(let k=0;k<3;k++)cones.push(cylinder('pine canopy',0,h*(.42+k*.2),0,h*(.7-k*.16),h*.55,'#5d8159',null,0,6));
  const canopy=Mesh.MergeMeshes(cones,true,true,undefined,false,false);canopy.material=mat(['#567b58','#68885b','#7b995f'][v]);canopy.isPickable=false;canopy.parent=root;
  root.setEnabled(false);return root;
 });
 const rockTemplate=(()=>{const root=new TransformNode('outcrop template',scene);const r=sphere('valley outcrop',0,2,0,16,'#8c987a',root);r.scaling.set(1,.38,.9);root.setEnabled(false);return root;})();
 const props=[];
 function placeProp(p,cx,cz){
  const a=rand()*6.283,d=95+Math.sqrt(rand())*SCENERY_RADIUS;
  let x=cx+Math.cos(a)*d,z=cz+Math.sin(a)*d;
  if(Math.hypot(x,z)<72){x+=(x<0?-1:1)*72;z+=(z<0?-1:1)*72;}
  p.node.position.set(clampMap(x),0,clampMap(z));p.node.scaling.setAll(p.scale);p.node.rotation.y=rand()*6.283;
 }
 for(let i=0;i<156;i++)props.push({node:treeTemplates[i%3].clone('pine '+i,null),scale:.7+rand()*.85,group:i%2});
 for(let i=0;i<46;i++)props.push({node:rockTemplate.clone('outcrop '+i,null),scale:.6+rand()*1.6,group:i%2});
 for(const p of props){p.node.setEnabled(true);placeProp(p,0,0);}
 function streamScenery(centers){for(const p of props){const c=centers[p.group%centers.length];if(Math.hypot(p.node.position.x-c.x,p.node.position.z-c.z)>SCENERY_KEEP)placeProp(p,c.x,c.z);}}
 const grass=[];for(let i=0;i<650;i++){const a=rand()*Math.PI*2,d=25+rand()*180,x=Math.sin(a)*d,z=Math.cos(a)*d;if(Math.abs(x)<8&&Math.abs(z)<38||Math.abs(x)<28&&Math.abs(z)<15)continue;for(let j=0;j<2;j++){const blade=box('meadow grass',x+j*.3,.32,z,.12,.6+rand()*.5,.09,'#789568');blade.rotation.z=(j?1:-1)*.3;grass.push(blade);}}Mesh.MergeMeshes(grass,true,true,undefined,false,true);
 // 캠프 앞 삼나무는 첫 탐험의 길잡이. 이동을 막지 않도록 길 바깥에만 둔다.
 for(const [x,z] of [[-36,22],[38,32],[-48,-24],[43,-31],[-60,65],[59,75]]){cylinder('cedar trunk',x,3,z,1.3,6,'#786c4d');for(let k=0;k<3;k++)cylinder('cedar crown',x,6+k*3,z,12-k*2,8,'#547f59',null,0,7);}
 function makeAvatar(skin){
  const root=new TransformNode('explorer',scene);
  cylinder('body',0,1.6,0,1.5,1.7,skin.coat,root);sphere('head',0,2.95,0,1.15,'#d8ab7d',root);
  cylinder('hat brim',0,3.4,0,1.9,.16,skin.hat,root);cylinder('hat',0,3.6,0,1.25,.4,skin.hat,root);
  box('backpack',0,1.9,-.8,1.2,1.35,.65,skin.pack,root);
  const legs=[-1,1].map(side=>box('boot',side*.4,.45,0,.6,.9,.75,'#3b5147',root));
  const arms=[-1,1].map(side=>box('arm',side*.94,1.75,0,.45,1.2,.5,'#d7a974',root));
  const shadow=cylinder('explorer shadow',0,.13,0,3,.02,'#708663',null,3,24);
  const ring=MeshBuilder.CreateTorus('selection',{diameter:4,thickness:.07,tessellation:40},scene);ring.material=mat(skin.ring,true);ring.setEnabled(false);ring.isPickable=false;
  const tag=label(skin.tag,0,5.4,0,8);tag.parent=root;tag.setEnabled(false);
  return {root,legs,arms,shadow,ring,tag};
 }
 const avatars=[makeAvatar({coat:'#eac36d',hat:'#e9cd86',pack:'#395d53',ring:'#f9efb5',tag:'1P'}),makeAvatar({coat:'#7fb7e6',hat:'#bfe0f7',pack:'#3d4a72',ring:'#bfe6ff',tag:'2P'})];
 avatars[1].root.setEnabled(false);avatars[1].shadow.setEnabled(false);
 const templates=ORES.map((o,id)=>{
  const root=new TransformNode('ore outcrop',scene);const rank=rankIndex(id);
  // 산맥처럼 삐죽삐죽 솟은 돌 봉우리. 등급이 높을수록 봉우리가 더 많이 솟는다.
  const rocks=[cylinder('rock skirt',0,.1,0,2.4,.2,'#79826f',null,1.7,7)];
  const peaks=11+rank*2;
  for(let j=0;j<peaks;j++){
   const a=j/peaks*6.283+rand()*.45,d=.2+rand()*.78,h=.6+rand()*1.7;
   const spire=cylinder('rock spire',Math.cos(a)*d,h*.45,Math.sin(a)*d,.26+rand()*.36,h,'#79826f',null,0,5);
   spire.rotation.x=(rand()-.5)*.55;spire.rotation.z=(rand()-.5)*.55;rocks.push(spire);
  }
  const mountain=Mesh.MergeMeshes(rocks,true,true,undefined,false,false);
  mountain.material=mat(rank<5?'#79826f':'#6b7a72');mountain.isPickable=false;mountain.convertToFlatShadedMesh();mountain.parent=root;
  // 봉우리 틈에서 솟아오른 광물 결정. 밤에도 스스로 빛난다.
  const shards=6+Math.round(rank*.9),groups=new Map();
  for(let j=0;j<shards;j++){
   const a=j/shards*6.283+.35,d=rand()*.55,h=1.1+rank*.075+rand()*1.1;
   const crystal=cylinder('ore crystal',Math.cos(a)*d,h*.45+.2,Math.sin(a)*d,.22+rank*.012,h,o.color,null,0,6);
   crystal.rotation.x=(rand()-.5)*.5;crystal.rotation.z=(rand()-.5)*.5;
   const color=id===13?RAINBOW[j%RAINBOW.length]:o.color;
   if(!groups.has(color))groups.set(color,[]);
   groups.get(color).push(crystal);
  }
  for(const [color,list] of groups){const merged=Mesh.MergeMeshes(list,true,true,undefined,false,false);merged.material=mat(color,true);merged.isPickable=false;merged.convertToFlatShadedMesh();merged.parent=root;}
  root.setEnabled(false);return root;
 });
 const oreScale=ore=>radius(ore)*.62;
 function addOre(ore){const root=templates[ore.id].clone('ore '+ore.uid,null);root.setEnabled(true);root.position.set(ore.x,0,ore.z);root.scaling.setAll(oreScale(ore));root.rotation.y=ore.turn;return root;}
 let zoom=53,split=false;const yaws=[0,0];
 function setSplit(on){
  split=on;
  cameras[0].viewport=new Viewport(0,0,on?.5:1,1);cameras[1].viewport=new Viewport(.5,0,.5,1);
  scene.activeCameras=on?cameras:[cameras[0]];
  avatars[1].root.setEnabled(on);avatars[1].shadow.setEnabled(on);
  for(const a of avatars)a.tag.setEnabled(on);
  if(!on)avatars[1].ring.setEnabled(false);
 }
 function setDay(phase){
  const cur=DAY_LOOK[phase.key],next=DAY_LOOK[PHASES[(phase.index+1)%PHASES.length].key];
  const t=Math.max(0,(phase.progress-.85)/.15);
  const sky=Color3.Lerp(cur.skyColor,next.skyColor,t);
  scene.clearColor=new Color4(sky.r,sky.g,sky.b,1);scene.fogColor=sky;
  scene.fogDensity=cur.density+(next.density-cur.density)*t;
  hemi.intensity=cur.hemi+(next.hemi-cur.hemi)*t;hemi.groundColor=Color3.Lerp(cur.groundColor,next.groundColor,t);
  sun.intensity=cur.sun+(next.sun-cur.sun)*t;sun.diffuse=Color3.Lerp(cur.sunTint,next.sunTint,t);
  const angle=(phase.index+phase.progress)/PHASES.length*Math.PI*2;
  sun.direction.set(Math.cos(angle)*.7,-.85,Math.sin(angle)*.7);
 }
 return {scene,engine,addOre,setSplit,setDay,streamScenery,
 setYaw:v=>yaws[0]+=v,setZoom:v=>zoom=Math.min(115,Math.max(22,zoom+v)),yaw:(i=0)=>yaws[i],
 update(actors,t){
  for(let i=0;i<avatars.length;i++){
   const a=avatars[i],act=actors[i];
   if(!act){a.ring.setEnabled(false);continue;}
   a.root.position.set(act.x,0,act.z);if(act.moving)a.root.rotation.y=act.facing;
   for(let k=0;k<2;k++){a.legs[k].rotation.x=act.moving?Math.sin(t*10+k*Math.PI)*.5:0;a.arms[k].rotation.x=act.carried.length?-1.3:act.moving?Math.sin(t*10+k*Math.PI)*.4:0;}
   a.shadow.position.set(act.x,.03,act.z);
   // 2P 카메라는 조작이 단순하도록 달리는 방향을 부드럽게 따라간다.
   if(i===1){const want=-act.facing,d=Math.atan2(Math.sin(want-yaws[1]),Math.cos(want-yaws[1]));yaws[1]+=d*.07;}
   const cam=cameras[i],y=yaws[i];
   cam.position.set(act.x+Math.sin(y)*zoom,zoom*.8,act.z-Math.cos(y)*zoom);cam.setTarget(new Vector3(act.x,1,act.z));
   for(let k=0;k<act.carried.length;k++){
    const ore=act.carried[k],size=Math.min(oreScale(ore),2.6),ang=act.facing+(k-(act.carried.length-1)/2)*1.05;
    ore.mesh.scaling.setAll(size);ore.mesh.position.set(act.x+Math.sin(ang)*(3.6+size*1.4),1.5,act.z+Math.cos(ang)*(3.6+size*1.4));ore.mesh.rotation.y+=.004;
   }
   a.ring.setEnabled(!!act.nearest);
   if(act.nearest){a.ring.position.set(act.nearest.x,.28,act.nearest.z);a.ring.scaling.setAll(radius(act.nearest)*.55+.5);}
  }
  scene.render();
 },
 resize:()=>{engine.resize();setSplit(split);}};
}
