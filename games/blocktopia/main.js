import { TOWERS, towerPlatforms, recordTowerLanding } from './towers.mjs';
import './style.css';
import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import '@babylonjs/core/Culling/ray';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import { SAVE_KEY, PALETTE, cleanSave, stepBody } from './core.mjs';
const $=s=>document.querySelector(s),canvas=$('#world');
let save;try{save=cleanSave(JSON.parse(localStorage.getItem(SAVE_KEY)||'{}'));}catch{save=cleanSave({});}
let canSave=true;function persist(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(save));}catch{if(canSave)toast('이 브라우저에서는 진행 상황을 저장할 수 없어요.');canSave=false;}}
let engine;try{engine=new Engine(canvas,true,{preserveDrawingBuffer:true,stencil:true});}catch{$('#start').textContent='3D를 켤 수 없어요. WebGL 지원 브라우저로 열어 주세요.';throw Error('WebGL unavailable');}
engine.setHardwareScalingLevel(1/Math.min(devicePixelRatio||1,1.5));
const scene=new Scene(engine);scene.clearColor=new Color4(.72,.86,.88,1);scene.fogMode=Scene.FOGMODE_LINEAR;scene.fogStart=65;scene.fogEnd=155;scene.fogColor=new Color3(.72,.86,.88);
const camera=new FreeCamera('camera',new Vector3(20,24,-35),scene);camera.inputs.clear();camera.minZ=.1;camera.maxZ=230;camera.fov=.85;
const hemi=new HemisphericLight('sky',new Vector3(0,1,0),scene);hemi.intensity=.6;hemi.groundColor=Color3.FromHexString('#a1a886');
const sun=new DirectionalLight('sun',new Vector3(-.6,-1,.45),scene);sun.position.set(30,55,-30);sun.intensity=.6;sun.diffuse=Color3.FromHexString('#fff2d9');sun.shadowMinZ=1;sun.shadowMaxZ=140;sun.shadowFrustumSize=110;
const shadows=new ShadowGenerator(innerWidth<700?1024:2048,sun);shadows.usePercentageCloserFiltering=true;shadows.bias=.001;shadows.normalBias=.04;shadows.setDarkness(.25);
const materials=new Map();function mat(c,glow=false){const key=c+glow;if(materials.has(key))return materials.get(key);const m=new StandardMaterial(key,scene);m.diffuseColor=Color3.FromHexString(c);m.specularColor=new Color3(.07,.07,.07);if(glow)m.emissiveColor=Color3.FromHexString(c).scale(.75);materials.set(key,m);return m;}
const solids=[],coins=[],npcs=[],clouds=[],sparkles=[],lamps=[];
function finish(m,x,y,z,c,parent,shadow=true){m.position.set(x,y,z);m.material=mat(c);if(parent)m.parent=parent;m.receiveShadows=true;if(shadow)shadows.addShadowCaster(m);return m;}
function box(n,x,y,z,w,h,d,c,parent,shadow=true){return finish(MeshBuilder.CreateBox(n,{width:w,height:h,depth:d},scene),x,y,z,c,parent,shadow);}
function cyl(n,x,y,z,r,h,c,parent,top=r){return finish(MeshBuilder.CreateCylinder(n,{diameterBottom:r*2,diameterTop:top*2,height:h,tessellation:32},scene),x,y,z,c,parent);}
function ball(n,x,y,z,r,c,parent){return finish(MeshBuilder.CreateSphere(n,{diameter:r,segments:8},scene),x,y,z,c,parent);}
function solid(x,z,w,d,top,bottom=-2){const b={x,z,w,d,top,bottom};solids.push(b);return b;}
function label(text,x,y,z,w=5,bg='#fff5d9',fg='#3c5d47',parent){const tex=new DynamicTexture(text,{width:512,height:128},scene,false);tex.drawText(text,null,83,'bold 49px sans-serif',fg,bg,true);const m=new StandardMaterial('sign',scene);m.diffuseTexture=tex;m.emissiveColor=new Color3(.22,.22,.22);m.specularColor=Color3.Black();m.backFaceCulling=false;const p=MeshBuilder.CreatePlane(text,{width:w,height:w/4},scene);p.position.set(x,y,z);p.material=m;if(parent)p.parent=parent;return p;}
function beam(n,a,b,width,color,parent){const mid=a.add(b).scale(.5),m=box(n,mid.x,mid.y,mid.z,width,Vector3.Distance(a,b),width,color,parent);m.rotation.z=-Math.atan2(b.x-a.x,b.y-a.y);return m;}
// Floating garden island, tiled promenade and an ocean full of little glints.
box('ocean',0,-4,0,380,.2,380,'#82bec4',null,false);
box('island sandstone',0,-1.8,0,86,3.4,78,'#d3bf97');box('island strata',0,-.65,0,86.3,.35,78.3,'#e1d0a4');box('grass',0,-.14,0,86.5,.5,78.5,'#a8c888');solid(0,0,86.5,78.5,.11);
box('avenue',0,.14,0,12,.1,76,'#e8ddc0',null,false);box('crosswalk plaza',0,.16,0,80,.1,12,'#e8ddc0',null,false);
for(let i=-18;i<=18;i++){box('paving seam',0,.219,i*2,11.7,.012,.035,'#d4c6ab',null,false);box('paving seam',i*2,.225,0,.035,.012,11.8,'#d4c6ab',null,false);}
for(const x of [-6.1,6.1])box('avenue curb',x,.22,0,.22,.22,76,'#f5ead0');for(const z of [-6.1,6.1])box('plaza curb',0,.23,z,80,.22,.22,'#f5ead0');
for(let i=0;i<45;i++){const x=Math.sin(i*12.7)*145,z=Math.cos(i*7.3)*140;if(Math.abs(x)<45&&Math.abs(z)<41)continue;const s=box('ocean shimmer',x,-3.84,z,1+i%4,.02,.13,'#b5dcda',null,false);sparkles.push(s);}
function tree(x,z,s=1,pink=false){const root=new TransformNode('tree',scene);root.position.set(x,0,z);root.scaling.setAll(s);cyl('trunk',0,1.25,0,.23,2.5,'#aa8660',root);for(const [dx,dy,dz,r] of [[0,3.2,0,2.5],[-.85,2.7,.1,1.8],[.8,2.9,.3,2],[-.2,3.8,0,1.8]])ball('leaf cluster',dx,dy,dz,r,pink?'#e5afa6':'#79a36c',root);solid(x,z,.6*s,.6*s,2.4*s);}
for(let i=0;i<13;i++){tree(-39+i*6.4,34,1+(i%3)*.16,i%4===0);if(i<10)tree(i%2?-37:37,-31+Math.floor(i/2)*12,1.1,i%3===0);}
function planter(x,z,w=3){box('planter',x,.35,z,w,.6,1.2,'#e7d5b5');box('soil',x,.67,z,w-.2,.08,1,'#92835d');for(let j=0;j<5;j++){ball('hedge',x-w/2+.35+j*(w-.7)/4,.9,z,.75,'#799b5a');for(let k=0;k<2;k++)ball('flowers',x-w/2+.35+j*(w-.7)/4,1.17,z+(k-.5)*.35,.23,j%2?'#f4d08b':'#e6a19b');}solid(x,z,w,1.2,.7);}
function bench(x,z,rot=0){const g=new TransformNode('bench',scene);g.position.set(x,0,z);g.rotation.y=rot;for(let i=0;i<3;i++)box('seat slat',0,.7,(i-1)*.22,2.7,.15,.18,'#b98d61',g);for(let i=0;i<2;i++)box('back slat',0,1.15+i*.23,.37,2.7,.17,.12,'#b98d61',g);for(const dx of [-1,1]){box('bench leg',dx,.35,0,.12,.7,.6,'#496454',g);box('back support',dx,1,.39,.1,1,.1,'#496454',g);}solid(x,z,rot?1:2.8,rot?2.8:1,1.4);}
function lamp(x,z){cyl('lamp base',x,.22,z,.34,.4,'#526d60');cyl('lamp pole',x,2.25,z,.085,4.4,'#526d60');box('lantern base',x,4.08,z,.54,.1,.54,'#506956');for(const dx of [-.25,.25])for(const dz of [-.25,.25])box('lantern frame',x+dx,4.45,z+dz,.045,.75,.045,'#506956');const glass=box('warm lantern',x,4.45,z,.44,.57,.44,'#fff0bb');glass.material=mat('#ffe1a0',true);lamps.push(glass);cyl('lantern roof',x,4.9,z,.43,.18,'#526d60',null,.1);}
for(const x of [-7.7,7.7])for(const z of [-28,-13,12,27]){lamp(x,z);if(z!==12)planter(x+(x<0?-2.6:2.6),z,3.4);}
bench(-8,0,Math.PI/2);bench(8,0,-Math.PI/2);bench(-3,9,Math.PI);bench(3,9,Math.PI);
// Fountain: stacked stone basins, rippling water, animated droplets.
cyl('fountain step',0,.25,1,3.4,.3,'#d8cdb2');cyl('fountain rim',0,.55,1,3,.5,'#f0e5c9');const water=cyl('fountain water',0,.83,1,2.74,.07,'#8fcdd1');cyl('pedestal',0,1.4,1,.58,1.4,'#e8dabc');cyl('upper bowl',0,2.04,1,1.45,.3,'#eee2c4',null,1.6);cyl('upper water',0,2.21,1,1.4,.025,'#92d1d3');cyl('spout',0,2.5,1,.2,.65,'#e8dabc');solid(0,1,5.9,5.9,.84);
const drops=[];for(let i=0;i<28;i++){const d=ball('water drop',0,0,0,.10,'#d9f6ed');d.material=mat('#c3eeec',true);drops.push(d);}
label('CENTRAL SQUARE',0,.26,-6.5,5,'#e8ddc0','#8d997a').rotation.x=Math.PI/2;
function shop(x,z,color,title,accent){const g=new TransformNode(title,scene);g.position.set(x,0,z);box('foundation',0,.3,0,10,.5,8,'#e1d2b0',g);box('shop walls',0,3.15,0,9.4,5.5,7.4,color,g);box('roof cornice',0,6.03,0,10,.35,8,'#fff1d5',g);box('roof',0,6.26,0,9.5,.18,7.5,accent,g);box('upper trim',0,5.35,-3.8,9.5,.22,.23,'#fff0d5',g);
 for(const dx of [-3,3]){box('window frame',dx,2.5,-3.77,2.2,2.8,.18,'#fff1d3',g);box('glass',dx,2.55,-3.89,1.85,2.4,.08,'#719ea2',g);box('window bar',dx,2.55,-3.95,.08,2.4,.06,'#e8e3c9',g);box('window glint',dx-.35,2.75,-3.96,.1,1.4,.015,'#b8d4c9',g).rotation.z=-.3;box('windowsill',dx,1.12,-3.97,2.45,.2,.45,'#fff1d3',g);}
 box('door frame',0,1.95,-3.8,1.85,3.3,.2,'#f7e8c6',g);box('door',0,1.9,-3.94,1.5,3.1,.1,accent,g);box('door glass',0,2.4,-4.01,1.1,1.55,.02,'#95b6b0',g);ball('brass handle',.47,1.45,-4.1,.13,'#e8c679',g);
 for(let i=0;i<10;i++){box('striped awning',-4.5+i,4.3,-4.65,1,.15,2,i%2?'#fff1d6':accent,g).rotation.x=-.12;box('scalloped awning',-4.5+i,4.13,-5.61,1,.32,.12,i%2?'#fff1d6':accent,g);}label(title,0,5.63,-3.94,6.8,'#fff0d3','#52664c',g);
 for(const dx of [-4.5,4.5])box('corner trim',dx,2.9,-3.75,.22,5,.2,'#f8e8c7',g);box('step',0,.28,-4.3,2.6,.3,1,'#f0e3c5',g);solid(x,z,9.6,7.6,6.4);planter(x-3,z-5.6,2.3);planter(x+3,z-5.6,2.3);
 return g;}
shop(-19,15,'#e4ad91','SUNBEAM CAFÉ','#b97558');shop(19,12,'#b9cabc','THE BLOCK SHOP','#6f9986');shop(-20,-6,'#d7c4db','STUDIO 01','#a18bac');
// Café terrace: cups, tables, seats, folded menu boards.
for(const x of [-25,-14]){cyl('café table',x,1,-.2+7,1.1,.13,'#f0dab2');cyl('table leg',x,.5,6.8,.1,1,'#6e7d62');for(const dz of [-1.6,1.6]){box('stool',x,.63,6.8+dz,.7,.15,.7,'#ad9271');box('stool leg',x,.3,6.8+dz,.16,.6,.16,'#677c64');}cyl('coffee cup',x,1.18,6.8,.15,.24,'#fff4d8');cyl('coffee',x,1.31,6.8,.12,.01,'#745640');}
// Ferris wheel with suspended cabins and structural spokes.
const wheelRoot=new TransformNode('ferris wheel',scene);wheelRoot.position.set(-29,9,25);const wheel=new TransformNode('rotating wheel',scene);wheel.parent=wheelRoot;
beam('left support',new Vector3(-4,-8,0),new Vector3(0,0,0),.45,'#f4e4c5',wheelRoot);beam('right support',new Vector3(4,-8,0),new Vector3(0,0,0),.45,'#f4e4c5',wheelRoot);
const ring=MeshBuilder.CreateTorus('wheel rim',{diameter:13,thickness:.25,tessellation:64},scene);ring.parent=wheel;ring.rotation.x=Math.PI/2;ring.material=mat('#f7e7c6');shadows.addShadowCaster(ring);const cabins=[];
for(let i=0;i<8;i++){const a=i*Math.PI/4,x=Math.cos(a)*6.5,y=Math.sin(a)*6.5;beam('spoke',Vector3.Zero(),new Vector3(x,y,0),.1,'#ecd6ab',wheel);const cabin=new TransformNode('cabin',scene);cabin.parent=wheel;cabin.position.set(x,y,-.25);box('gondola',0,-.65,0,1.4,.8,1.2,PALETTE[i%6],cabin);box('gondola roof',0,.45,0,1.65,.17,1.4,'#fff0d0',cabin);for(const dx of [-.6,.6])box('cabin suspension',dx,.03,0,.07,1,.9,'#eee4c7',cabin);cabins.push(cabin);}
label('SLOW DAYS PARK',-29,2,20,6);box('park path',-28,.18,20,15,.12,6,'#e0d6b7');
// Block garden with a clearly marked buildable plot.
box('garden border',-24,.18,-20,18,.3,16,'#e7d9b8');const plot=box('build plot',-24,.35,-20,17,.12,15,'#93b57a');plot.metadata={plot:true};
for(let x=-32;x<=-16;x++)box('garden grid',x,.418,-20,.022,.01,15,'#abc78d',null,false);for(let z=-27;z<=-13;z++)box('garden grid',-24,.419,z,17,.01,.022,'#abc78d',null,false);
label('YOUR LITTLE GARDEN',-24,2.4,-28.3,7);for(const x of [-28,-20])box('sign post',x,1.25,-28.2,.13,2.5,.13,'#ac9470');
// A continuous, reachable obby. Every third landing is a saved checkpoint.
const platforms=[];for(let i=0;i<12;i++){const x=13+i*2.15,z=23+Math.sin(i*.7)*3.3,top=.8+i*.75;platforms.push({x,z,top});box('floating island',x,top-.4,z,2.9,.8,2.9,i%3===2?'#e7c779':'#c2b2d4');box('platform top',x,top+.035,z,2.95,.07,2.95,i%3===2?'#f9e6a9':'#e7daf0');solid(x,z,2.95,2.95,top+.07,top-.8);if(i%3===2){cyl('checkpoint pad',x,top+.1,z,.65,.06,'#f5d370');label(String(i+1).padStart(2,'0'),x,top+.16,z,1.3,'#f9e6a9','#ac8840').rotation.x=Math.PI/2;}}
box('obby sign post',10,1.5,20,.18,3,.18,'#8a9c80');label('SKY HOP  →',10,3,19.8,5,'#f5e5ba');
const last=platforms.at(-1);const trophy=new TransformNode('golden trophy',scene);trophy.position.set(last.x,last.top+1.4,last.z);cyl('trophy base',0,-.3,0,.36,.2,'#ab8750',trophy);cyl('trophy stem',0,.02,0,.1,.6,'#e3b756',trophy);cyl('trophy cup',0,.48,0,.27,.5,'#f5ce72',trophy,.5);ball('trophy gem',0,1,0,.38,'#fff0b3',trophy);
label('THE SKY IS YOURS',last.x,last.top+3.5,last.z,5.5,'#fff0cd');
// Small block avatars with faces, hair, shoes and articulated limbs.
function avatar(name,color){const root=new TransformNode(name,scene);const hips=new TransformNode('hips',scene);hips.parent=root;const shirt=box('shirt',0,1.35,0,.92,.85,.51,color,hips);box('collar',0,1.79,-.015,.36,.09,.5,'#f6e7cd',hips);box('shirt patch',-.22,1.52,-.27,.17,.17,.025,'#f5dfa8',hips);
 const legs=[],arms=[];for(const s of [-1,1]){const leg=new TransformNode('leg',scene);leg.parent=hips;leg.position.set(s*.25,.95,0);box('trousers',0,-.38,0,.4,.74,.44,'#536a68',leg);box('sneaker',0,-.76,-.06,.44,.2,.61,'#fff0d8',leg);box('sole',0,-.86,-.06,.46,.06,.63,'#d2cbb5',leg);legs.push(leg);const arm=new TransformNode('arm',scene);arm.parent=hips;arm.position.set(s*.66,1.68,0);box('sleeve',0,-.2,0,.33,.43,.43,color,arm);box('hand',0,-.56,0,.32,.36,.38,'#f1cd99',arm);arms.push(arm);}
 box('head',0,2.13,0,.69,.65,.62,'#f1cd99',hips);box('hair',0,2.47,.035,.75,.16,.69,'#654d3e',hips);box('side hair',-.31,2.29,.07,.16,.34,.62,'#654d3e',hips);for(const s of [-1,1])box('eye',s*.15,2.14,-.318,.055,.077,.016,'#3c4841',hips);box('smile',0,1.99,-.32,.16,.035,.016,'#9a6651',hips);box('backpack',0,1.33,.37,.6,.7,.25,'#dfb970',hips);return{root,hips,shirt,legs,arms};}
const player=avatar('player','#86ad72');let body={x:0,y:.23,z:-17,vy:0,grounded:true};player.root.position.set(body.x,body.y,body.z);player.root.rotation.y=Math.PI;
const npcInfo=[[-9,11,'MILO','#d49a74'],[12,5,'LUNA','#b39ec5'],[-11,-11,'OLIVE','#8cb6aa'],[2,20,'FINN','#dfb969'],[25,-7,'BEAN','#ce9b9b']];
for(const [x,z,name,color] of npcInfo){const n=avatar(name,color);n.origin={x,z};n.name=name;n.phase=npcs.length*1.4;npcs.push(n);}
// Collectible coins lead through the whole island and onto the jump course.
const coinPositions=[[-3,-13],[3,-9],[-10,-2],[-14,5],[-24,8],[-31,15],[-24,23],[-9,22],[0,29],[8,17],[18,5],[27,0],[29,-13],[17,-22],[5,-29],[-8,-24],[-14,-17],[-33,-9],[-1,12],[10,-5],...platforms.map(p=>[p.x,p.z,p.top])];
coinPositions.forEach(([x,z,y=.2],id)=>{const c=cyl('coin',x,y+1.2,z,.28,.1,'#edc05b');c.rotation.x=Math.PI/2;c.material=mat('#ecc66b',true);c.metadata={coin:id};coins.push({mesh:c,id,y:y+1.2});if(save.collected.includes(id))c.setEnabled(false);});
// Clouds, distant islands, wildflowers, flags and decorative paving studs.
for(let i=0;i<12;i++){const g=new TransformNode('cloud',scene);g.position.set(-100+i*19,26+(i%3)*7,45+(i%4)*9);for(let k=0;k<3;k++)box('cloud puff',k*3,Math.sin(k)*1.3,0,5.5,2.4,3.2,'#f5f0dc',g,false);clouds.push(g);}
for(let i=0;i<8;i++){const x=Math.cos(i*.9)*85,z=Math.sin(i*.9)*85;box('distant island',x,-1,z,10+(i%3)*5,5,12,'#b3bd9b',null,false);box('island grass',x,1.6,z,10+(i%3)*5,.25,12,'#a7c294',null,false);}
for(let i=0;i<100;i++){const x=Math.sin(i*83.4)*40,z=Math.cos(i*14.7)*35;if(Math.abs(x)<8||Math.abs(z)<8||(x< -13&&z< -11)||(x>9&&z>18))continue;box('grass blade',x,.34,z,.075,.4,.07,'#80a368',null,false);if(i%3===0){ball('wildflower',x,.57,z,.19,i%2?'#f4db9c':'#eac4ac');}}
for(const x of [-4.8,4.8]){cyl('gate post',x,3,-31,.12,6,'#789272');box('flag',x+.6,5.4,-31,1.1,.9,.06,'#e5b772');}label('MAKE A LITTLE WONDER',0,.24,-28,7.7,'#e8ddc0','#8d997a').rotation.x=Math.PI/2;
// A brick-built explorer monument: studs, crown and a tiny duck pond.
const monument=new TransformNode('explorer monument',scene);monument.position.set(25,0,-22);
cyl('monument plinth',0,.35,0,3.5,.6,'#e7d8b7',monument);box('monument base',0,.88,0,3.7,.5,3,'#baa5c6',monument);
for(const dx of [-.63,.63])box('statue leg',dx,1.6,0,1,1.05,1.2,'#73958e',monument);
box('statue body',0,2.85,0,2.6,1.6,1.35,'#e8b966',monument);box('statue head',0,4.34,0,1.85,1.4,1.5,'#f1d39b',monument);
for(const dx of [-.4,.4])box('statue eye',dx,4.4,-.76,.13,.19,.03,'#59694f',monument);box('statue smile',0,4.03,-.76,.45,.09,.03,'#a0784d',monument);
for(const dx of [-1.68,1.68]){box('statue sleeve',dx,2.95,0,.6,1.1,1,'#e8b966',monument);box('statue hand',dx,2.22,0,.6,.5,1,'#f1d39b',monument);}
box('crown band',0,5.13,0,2,.24,1.65,'#e8bf5d',monument);for(const dx of [-.85,0,.85])box('crown point',dx,5.43,-.68,.23,.42,.23,'#e8bf5d',monument);label('DREAM BIG',0,.9,-1.53,3,'#fff0cf','#7f8059',monument);solid(25,-22,4.4,3.8,5.7);
for(let i=0;i<3;i++){const x=18+i*2,z=-27+i%2*2;box('giant toy brick',x,.65,z,1.7,1.1,1.7,PALETTE[i+2]);for(const dx of [-.45,.45])for(const dz of [-.45,.45])cyl('brick stud',x+dx,1.27,z+dz,.22,.16,PALETTE[i+2]);solid(x,z,1.7,1.7,1.35);}
const pond=cyl('duck pond',29,.24,-12,3,.13,'#90bdba');pond.scaling.z=.65;
for(let i=0;i<12;i++){const a=i*Math.PI/6;ball('pond stone',29+Math.cos(a)*3,.3,-12+Math.sin(a)*1.95,.55,'#d3ccb0');}
for(let i=0;i<3;i++){const x=28+i*.8,z=-12+Math.sin(i)*.6;ball('duck body',x,.47,z,.52,'#f7df97');ball('duck head',x-.22,.7,z,.29,'#f7df97');box('duck bill',x-.4,.68,z,.2,.08,.16,'#d5a269');}
tree(32,-25,1.2,true);bench(33,-16,Math.PI/2);
// Five separate spiral towers with landing pads, checkpoint flags and summit crowns.
const towerWorlds=TOWERS.map(t=>{
  const steps=towerPlatforms(t),height=steps.at(-1).top;
  box('tower island',t.x,-.8,t.z,18,1.7,18,t.color);box('tower lawn',t.x,.1,t.z,18,.14,18,t.trim);solid(t.x,t.z,18,18,.17,-1.7);
  cyl('tower pillar',t.x,height/2,t.z,.85,height,t.color);solid(t.x,t.z,1.7,1.7,height);
  for(let y=2;y<height;y+=3){cyl('pillar ring',t.x,y,t.z,1.2,.18,t.trim);}
  steps.forEach((p,i)=>{
    const checkpoint=(i+1)%4===0;
    box('tower platform',p.x,p.top-.25,p.z,p.w,.5,p.d,t.color);box('tower landing',p.x,p.top+.015,p.z,p.w,.03,p.d,checkpoint?'#f5d681':t.trim);solid(p.x,p.z,p.w,p.d,p.top,p.bottom);
    label(String(i+1).padStart(2,'0'),p.x,p.top+.04,p.z,1.2,checkpoint?'#f5d681':t.trim,'#4b6058').rotation.x=Math.PI/2;
    if(checkpoint){const flag=box('checkpoint flag',p.x+p.w/2-.15,p.top+1.25,p.z+.45,.08,2.5,.08,'#f5e8bc');box('checkpoint pennant',flag.position.x+.32,p.top+2.2,p.z+.45,.65,.45,.05,t.color);}
  });
  const summit=steps.at(-1);cyl('summit pedestal',t.x,height+.5,t.z,1.6,.5,t.trim);label(t.sign,t.x,3,t.z-8,7,t.trim);
  for(const dx of [-1,0,1])box('summit crown',t.x+dx,height+1.7+(dx===0?.4:0),t.z,.5,1.3,.5,'#efd37f');box('crown band',t.x,height+1.2,t.z,3,.3,1,'#efd37f');
  label('FINISH',summit.x,summit.top+3,summit.z,3.5,t.trim);
  return {...t,steps};
});
box('tower portal base',0,.35,21,4,.4,3,'#bca3d4');for(const x of [-1.6,1.6])box('tower portal post',x,2,21,.3,3.5,.3,'#a593c3');box('tower portal lintel',0,3.8,21,3.6,.35,.4,'#e1d6ed');label('TOWER TRAVEL',0,4.6,21,5,'#f5e5ba');
// Merge static scenery by material; animated and editable objects stay separate.
const dynamicRoots=[player.root,...npcs.map(n=>n.root),wheelRoot,trophy,...clouds];
const dynamicMeshes=new Set([water,plot,...drops,...sparkles,...coins.map(c=>c.mesh),...lamps]);
const groups=new Map();
for(const m of [...scene.meshes]){if(dynamicMeshes.has(m)||dynamicRoots.some(root=>m.isDescendantOf(root)))continue;const group=groups.get(m.material)||[];group.push(m);groups.set(m.material,group);}
for(const group of groups.values()){if(group.length<2)continue;for(const m of group){m.computeWorldMatrix(true);shadows.removeShadowCaster(m);}const merged=Mesh.MergeMeshes(group,true,true,undefined,false,false);if(merged){merged.receiveShadows=true;merged.isPickable=false;merged.freezeWorldMatrix();shadows.addShadowCaster(merged);}}
let yaw=Math.PI,pitch=.43,distance=23,started=false,paused=true,night=false,buildMode=false,selectedColor=0,elapsed=0,toastTime=0,audio=null,sound=false,action=null,jumpQueued=false;
let activeTower=null;
const keys=new Set(),built=[];let lastCheckpoint=save.checkpoint;
function toast(t){$('#toast').textContent=t;$('#toast').classList.add('show');toastTime=3.5;}
function beep(freq=600){if(!sound)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.setValueAtTime(freq,audio.currentTime);o.frequency.exponentialRampToValueAtTime(freq*1.4,audio.currentTime+.12);g.gain.setValueAtTime(.045,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.22);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+.24);}catch{/* Audio is optional. */}}
function updateHUD(){$('#coins').textContent=save.coins;const tasks=[['◆','광장의 반짝임 모으기',Math.min(save.collected.length,12),12,'코인'],['☁','여섯 타워 정복하기',Number(save.won)+Object.values(save.towers).filter(p=>p.completed).length,6,'타워'],['▦','나만의 정원 만들기',Math.min(save.blocks.length,5),5,'블록']];$('#quest-list').innerHTML=tasks.map(([icon,name,n,max,unit])=>`<div class="task ${n>=max?'done':''}"><i>${n>=max?'✓':icon}</i><div><b>${name}</b><small>${n} / ${max} ${unit}</small><progress value="${n}" max="${max}"></progress></div></div>`).join('');const level=1+tasks.filter(t=>t[2]>=t[3]).length;$('#rank').textContent=['','새내기 여행자','호기심 탐험가','블록 아티스트','블록토피아 마스터'][level];$('#player-sub').textContent=`LV. ${level} · ${save.won?'하늘을 정복한 탐험가':'나만의 세상을 만드는 중'}`;$('#block-count').textContent=`${save.blocks.length} / 100 블록`;}
function equip(){const c=PALETTE[save.outfit];player.shirt.material=mat(c);for(const arm of player.arms)arm.getChildMeshes()[0].material=mat(c);$('.avatar-icon').style.background=c;}
function addBlock(b,write=false){const m=box('garden block',b.x,.92+b.y,b.z,.98,1,.98,PALETTE[b.color]);m.metadata={block:true};const col=solid(b.x,b.z,1,1,1.42+b.y,.42+b.y);built.push({mesh:m,col,data:b});if(write){save.blocks.push(b);persist();updateHUD();beep(380);}}
for(const b of save.blocks)addBlock(b);equip();updateHUD();
function removeBlock(index){if(index<0)return;const entry=built[index];if(built.some(b=>b.data.x===entry.data.x&&b.data.z===entry.data.z&&b.data.y>entry.data.y)){toast('위에 있는 블록부터 지워 주세요.');return;}entry.mesh.dispose();solids.splice(solids.indexOf(entry.col),1);built.splice(index,1);save.blocks.splice(index,1);persist();updateHUD();}
function respawn(home=false){if(home)activeTower=null;if(activeTower&&!home){const t=towerWorlds.find(t=>t.id===activeTower),p=t.steps[Math.max(0,save.towers[t.id].checkpoint-1)];body={x:p.x,y:p.top+.1,z:p.z,vy:0,grounded:false};return;}const p=!home&&lastCheckpoint?platforms[lastCheckpoint-1]:null;body={x:p?p.x:0,y:p?p.top+.2:.3,z:p?p.z:-17,vy:0,grounded:false};if(home){yaw=Math.PI;pitch=.43;}beep(250);}
function closeModal(){paused=false;$('#modal').hidden=true;keys.clear();jumpQueued=false;canvas.focus();}
function openModal(html){paused=true;keys.clear();$('#modal').hidden=false;$('#modal').innerHTML=`<section class="welcome">${html}<button class="primary" id="close-modal">모험 계속하기 →</button></section>`;$('#close-modal').onclick=closeModal;}
function towerMenu(){
  openModal('<div class="eyebrow">CHOOSE YOUR NEXT SUMMIT</div><h2>어떤 타워에 도전할까요?</h2><p>기존 스카이 점프맵 + 새로운 타워 5개!<br>네 발판마다 저장 · 정상 보상은 타워마다 한 번</p><div class="tower-list">'+towerWorlds.map(t=>{const p=save.towers[t.id];return `<button data-tower="${t.id}" style="--tower-color:${t.color}"><span class="tower-swatch">♜</span><span><b>${t.name}</b><small>${t.levels}층 · ◆ ${t.reward} · ${p.completed?'정복 완료 ✓':p.checkpoint+'층 저장'}</small></span><strong>${p.checkpoint?'이어서':'도전'} →</strong></button>`;}).join('')+'</div>');
  document.querySelectorAll('[data-tower]').forEach(button=>button.onclick=()=>enterTower(button.dataset.tower));
}
function enterTower(id){
  if(buildMode)toggleBuild();activeTower=id;const t=towerWorlds.find(t=>t.id===id),index=Math.max(0,save.towers[id].checkpoint-1),p=t.steps[index],next=t.steps[Math.min(index+1,t.steps.length-1)];
  body={x:p.x,y:p.top+.1,z:p.z,vy:0,grounded:false};yaw=Math.atan2(p.x-next.x,p.z-next.z);pitch=.5;distance=16;closeModal();updateHUD();toast(t.name+' · 노란 발판에서 저장돼요!');
}
function updateTowerPlay(){
  if(!activeTower)return;const t=towerWorlds.find(t=>t.id===activeTower),progress=save.towers[t.id];
  for(let i=0;i<t.steps.length;i++){const p=t.steps[i];if(body.grounded&&Math.abs(body.x-p.x)<p.w/2+.25&&Math.abs(body.z-p.z)<p.d/2+.25&&Math.abs(body.y-p.top)<.05){const previous=progress.checkpoint,won=recordTowerLanding(save,t,i);if(progress.checkpoint!==previous||won){persist();updateHUD();beep(700);toast(t.name+' · '+progress.checkpoint+'층 저장!');}if(won)openModal('<div class="eyebrow">TOWER COMPLETE</div><div class="welcome-logo">🏆</div><h2>'+t.name+' 정복!</h2><p>'+t.levels+'층 정상에 도착했어요!<br>보상으로 <b>◆ '+t.reward+' 코인</b>을 받았어요.<br>타워 버튼에서 다음 모험을 골라 보세요.</p>');}}
  if(body.y<.3){respawn();toast('저장한 타워 발판에서 다시 도전해요!');}
}
function wardrobe(){openModal('<div class="eyebrow">A LITTLE MORE YOU</div><h2>오늘은 어떤 색으로?</h2><p>첫 옷은 무료, 새로운 색은 5 코인.<br>구입한 옷은 언제든 다시 입을 수 있어요.</p><div class="outfits">'+PALETTE.map((c,i)=>`<button data-outfit="${i}" class="${save.outfit===i?'selected':''}"><i style="background:${c}"></i>${['올리브','선샤인','피치','오션','라벤더','크림'][i]}<br><small>${save.owned.includes(i)?'보유 중':'◆ 5'}</small></button>`).join('')+'</div>');document.querySelectorAll('[data-outfit]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.outfit);if(!save.owned.includes(i)){if(save.coins<5){toast('코인 5개가 필요해요. 광장을 탐험해 보세요!');return;}save.coins-=5;save.owned.push(i);}save.outfit=i;equip();persist();updateHUD();wardrobe();beep();});}
function help(){openModal('<div class="eyebrow">TAKE YOUR TIME</div><h2>잠깐 쉬어 가요</h2><div class="help">WASD / 방향키 · 이동<br>Space · 점프 / Shift · 달리기<br>화면 드래그 · 시점 / 휠 · 확대<br>E · 주민 대화 / 상점 / 점프맵 입장<br>2 · 건축 모드 / 3 · 옷 갈아입기<br>4 · 낮과 밤 / 5 · 타워 고르기<br>R · 광장으로 돌아가기<br>Esc · 일시정지 / 모험 계속하기<br><br>노란 발판은 체크포인트예요.<br>떨어져도 마지막 체크포인트에서 다시 시작해요.<br>코인, 의상, 건축물과 기록은 자동 저장돼요.</div><button id="reset-progress" class="reset-button">↺ 처음부터 다시 시작</button>');$('#reset-progress').onclick=confirmReset;}
function confirmReset(){
  openModal('<div class="eyebrow">A FRESH START</div><h2 id="reset-title">처음부터 다시 시작할까요?</h2><p id="reset-description">모은 코인, 구입한 의상, 정원의 블록,<br>점프맵 체크포인트와 완료 기록이 모두 지워져요.<br><b>한번 지운 기록은 되돌릴 수 없어요.</b></p><p id="reset-error" role="alert" hidden></p><button id="confirm-reset" class="reset-button">모두 지우고 새로 시작</button>');
  const dialog=$('#modal .welcome');dialog.setAttribute('role','alertdialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-labelledby','reset-title');dialog.setAttribute('aria-describedby','reset-description');
  $('#close-modal').textContent='취소 · 모험 계속하기';$('#close-modal').focus();
  $('#confirm-reset').onclick=()=>{
    try{localStorage.setItem(SAVE_KEY,JSON.stringify(cleanSave({})));}
    catch{$('#reset-error').hidden=false;$('#reset-error').textContent='저장 기록을 지우지 못했어요. 브라우저의 저장 공간 설정을 확인하고 다시 시도해 주세요.';return;}
    $('#confirm-reset').disabled=true;window.location.reload();
  };
}
function toggleBuild(){activeTower=null;buildMode=!buildMode;$('#build-bar').hidden=!buildMode;document.querySelector('[data-action="build"]').classList.toggle('active',buildMode);document.querySelector('[data-action="explore"]').classList.toggle('active',!buildMode);if(buildMode){body={x:-24,y:.5,z:-29,vy:0,grounded:false};yaw=Math.PI;pitch=.85;distance=20;toast('초록 격자를 눌러 블록을 쌓아 보세요!');}else{pitch=.43;distance=23;}}
function toggleDay(){night=!night;document.body.classList.toggle('night',night);sun.intensity=night?.15:.6;hemi.intensity=night?.5:.6;scene.clearColor=night?new Color4(.13,.21,.30,1):new Color4(.72,.86,.88,1);scene.fogColor=new Color3(scene.clearColor.r,scene.clearColor.g,scene.clearColor.b);$('#day-label').textContent=night?'☾ 밤':'☀ 낮';document.querySelector('[data-action="day"] span').textContent=night?'☾':'☀';toast(night?'별빛이 내려앉은 블록토피아':'햇살 가득한 새로운 하루');}
const actions={towers:towerMenu,explore:()=>{if(buildMode)toggleBuild();},build:toggleBuild,wardrobe,day:toggleDay,home:()=>{if(buildMode)toggleBuild();respawn(true);toast('센트럴 광장으로 돌아왔어요.');}};
document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{if(!paused)actions[b.dataset.action]();});$('#settings').onclick=()=>{if(started){if(paused)closeModal();else help();}};$('#sound').onclick=()=>{sound=!sound;$('#sound').textContent=sound?'♫':'♪';$('#sound').setAttribute('aria-label',sound?'소리 끄기':'소리 켜기');beep();toast(sound?'효과음을 켰어요':'효과음을 껐어요');};
$('#build-colors').innerHTML=PALETTE.map((c,i)=>`<button aria-label="블록 색상 ${i+1}" data-color="${i}" class="${i===0?'selected':''}" style="background:${c}"></button>`).join('');document.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>{selectedColor=Number(b.dataset.color);document.querySelectorAll('[data-color]').forEach(x=>x.classList.toggle('selected',x===b));});$('#undo').onclick=()=>removeBlock(built.length-1);
function interact(){if(!paused&&action)action.run();}$('#interact').onclick=interact;
window.addEventListener('keydown',e=>{if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();if(e.code==='Escape'&&started){if(paused)closeModal();else help();return;}if(paused)return;keys.add(e.code);if(e.repeat)return;if(e.code==='Space')jumpQueued=true;const shortcuts={Digit1:'explore',Digit2:'build',Digit3:'wardrobe',Digit4:'day',Digit5:'towers',KeyR:'home'};if(shortcuts[e.code])actions[shortcuts[e.code]]();if(e.code==='KeyE')interact();});window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();if(started&&!paused)help();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&started&&!paused)help();});
document.querySelectorAll('[data-key]').forEach(b=>{b.onpointerdown=e=>{e.preventDefault();if(paused)return;b.setPointerCapture(e.pointerId);keys.add(b.dataset.key);if(b.dataset.key==='Space')jumpQueued=true;};for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>keys.delete(b.dataset.key));});
let drag=null;
canvas.addEventListener('pointerdown',e=>{if(paused)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,time:performance.now(),button:e.button};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;yaw-=(e.clientX-drag.x)*.005;pitch=Math.max(.17,Math.min(1.2,pitch+(e.clientY-drag.y)*.004));drag.x=e.clientX;drag.y=e.clientY;});
canvas.addEventListener('pointerup',e=>{if(!drag)return;const d=drag;drag=null;if(buildMode&&Math.hypot(e.clientX-d.startX,e.clientY-d.startY)<9){const rect=canvas.getBoundingClientRect();const pick=scene.pick(e.clientX-rect.left,e.clientY-rect.top,m=>m.metadata?.plot||m.metadata?.block);if(!pick?.hit)return;if(d.button===2||performance.now()-d.time>550){removeBlock(built.findIndex(b=>b.mesh===pick.pickedMesh));return;}if(save.blocks.length>=100){toast('정원에는 최대 100개까지 놓을 수 있어요.');return;}const pos=pick.pickedPoint,x=Math.round(pos.x),z=Math.round(pos.z);if(x< -32||x> -16||z< -27||z> -13)return;const stack=built.filter(b=>b.data.x===x&&b.data.z===z);const y=stack.length?Math.max(...stack.map(b=>b.data.y))+1:0;if(y>=8){toast('최대 8층까지 쌓을 수 있어요.');return;}if(Math.abs(body.x-x)<.9&&Math.abs(body.z-z)<.9){toast('조금 옆으로 이동한 다음 놓아 주세요.');return;}addBlock({x,z,y,color:selectedColor},true);}});
for(const event of ['pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>{drag=null;});canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('wheel',e=>{e.preventDefault();distance=Math.max(6,Math.min(28,distance+e.deltaY*.012));},{passive:false});
function animateAvatar(a,t,moving){a.legs.forEach((leg,i)=>leg.rotation.x=moving?Math.sin(t*10+i*Math.PI)*.6:0);a.arms.forEach((arm,i)=>arm.rotation.x=moving?-Math.sin(t*10+i*Math.PI)*.5:Math.sin(t*2)*.04);a.hips.position.y=moving?Math.abs(Math.sin(t*10))*.05:Math.sin(t*2)*.018;}
function findAction(){action=null;for(const n of npcs)if(Math.hypot(body.x-n.root.position.x,body.z-n.root.position.z)<3.5){action={text:`E · ${n.name}와 이야기하기`,run:()=>{beep(480);toast({MILO:'MILO: 카페에 온 걸 환영해! 광장 곳곳에 코인이 숨어 있어.',LUNA:'LUNA: 나만의 색을 찾고 싶어? 상점 앞에서 E를 눌러 봐.',OLIVE:'OLIVE: 2번을 누르면 네 정원으로 갈 수 있어. 다섯 블록부터 시작해 봐!',FINN:'FINN: 점프맵의 노란 발판은 저장 지점이야. 정상에 트로피가 있어!',BEAN:'BEAN: 밤에 분수를 구경해 봐. 4번으로 밤을 만들 수 있어!'}[n.name]);}};break;}
if(!activeTower&&Math.hypot(body.x,body.z-21)<4)action={text:'E · 새로운 타워 5개 둘러보기',run:towerMenu};if(Math.hypot(body.x-19,body.z-7)<4)action={text:'E · 블록 상점 — 옷 갈아입기',run:wardrobe};if(Math.hypot(body.x-10,body.z-20)<4)action={text:'E · 스카이 점프맵 도전',run:()=>{if(buildMode)toggleBuild();const p=platforms[lastCheckpoint?lastCheckpoint-1:0];body={x:p.x,y:p.top+.2,z:p.z,vy:0,grounded:false};yaw=-Math.PI/2;toast('앞으로 점프! 노란 발판에서 진행 상황이 저장돼요.');}};$('#interact').hidden=!action||buildMode;$('#interact').textContent=action?.text||'';}
const mini=$('#minimap').getContext('2d');function drawMap(){if(activeTower){const t=towerWorlds.find(t=>t.id===activeTower),p=save.towers[t.id];mini.clearRect(0,0,180,150);mini.fillStyle='#e6e9da';mini.fillRect(4,4,172,140);for(const step of t.steps){mini.fillStyle=t.color;mini.fillRect(90+(step.x-t.x)*10-5,75-(step.z-t.z)*10-5,10,10);}mini.fillStyle='#2e5540';mini.beginPath();mini.arc(90+(body.x-t.x)*10,75-(body.z-t.z)*10,4,0,7);mini.fill();$('#zone').textContent=t.name+' · '+p.checkpoint+'/'+t.levels;return;}const x=v=>90+v*1.9,z=v=>75-v*1.7;mini.clearRect(0,0,180,150);mini.fillStyle=night?'#789b91':'#c8dbc0';mini.beginPath();mini.roundRect(7,8,166,134,13);mini.fill();mini.fillStyle='#f2e7c9';mini.fillRect(79,12,22,127);mini.fillRect(10,65,160,20);mini.fillStyle='#c69987';mini.fillRect(x(-24),z(19),19,14);mini.fillStyle='#a5bdb0';mini.fillRect(x(14),z(16),19,14);mini.fillStyle='#b3a2c2';mini.fillRect(x(-25),z(-2),19,14);mini.fillStyle='#89aca4';mini.beginPath();mini.arc(x(0),z(1),6,0,Math.PI*2);mini.fill();mini.strokeStyle='#afc097';mini.strokeRect(x(-32),z(-13),31,24);mini.fillStyle='#c2abd2';for(const p of platforms)mini.fillRect(x(p.x)-2,z(p.z)-2,4,4);mini.strokeStyle='#9bb290';mini.beginPath();mini.arc(x(-29),z(25),10,0,Math.PI*2);mini.stroke();for(const c of coins)if(c.mesh.isEnabled()){mini.fillStyle='#d5af58';mini.beginPath();mini.arc(x(c.mesh.position.x),z(c.mesh.position.z),1.7,0,7);mini.fill();}mini.save();mini.translate(x(body.x),z(body.z));mini.rotate(-player.root.rotation.y);mini.fillStyle='#355c48';mini.strokeStyle='#fff9df';mini.lineWidth=2;mini.beginPath();mini.moveTo(0,-6);mini.lineTo(-4,5);mini.lineTo(0,3);mini.lineTo(4,5);mini.closePath();mini.fill();mini.stroke();mini.restore();$('#zone').textContent=buildMode?'나만의 블록 정원':body.y>2&&body.x>10?'스카이 점프맵':body.z>18&&body.x< -15?'슬로우 데이즈 파크':'센트럴 광장';}
let frame=0;engine.runRenderLoop(()=>{const dt=Math.min(engine.getDeltaTime()/1000,.04);if(!paused){elapsed+=dt;const forward=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0),right=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0),length=Math.hypot(forward,right)||1,speed=keys.has('ShiftLeft')||keys.has('ShiftRight')?10:6;const dx=(-Math.sin(yaw)*forward-Math.cos(yaw)*right)/length*speed*dt,dz=(-Math.cos(yaw)*forward+Math.sin(yaw)*right)/length*speed*dt;const jump=jumpQueued;jumpQueued=false;stepBody(body,dx,dz,dt,solids,jump);if(jump&&body.vy>0)beep(220);
if(body.y< -8){respawn();toast('괜찮아요! 마지막 체크포인트에서 다시 도전해요.');}player.root.position.set(body.x,body.y,body.z);if(dx||dz){const target=Math.atan2(-dx,-dz);player.root.rotation.y+=Math.atan2(Math.sin(target-player.root.rotation.y),Math.cos(target-player.root.rotation.y))*Math.min(1,dt*14);}animateAvatar(player,elapsed,!!(dx||dz));
for(const c of coins){if(!c.mesh.isEnabled())continue;c.mesh.rotation.z+=dt*1.6;c.mesh.position.y=c.y+Math.sin(elapsed*2+c.id)*.14;if(Math.hypot(body.x-c.mesh.position.x,body.z-c.mesh.position.z)<.85&&Math.abs(body.y+1.2-c.mesh.position.y)<1.4){save.collected.push(c.id);save.coins++;c.mesh.setEnabled(false);persist();updateHUD();beep(800);if(save.collected.length===12)toast('광장의 반짝임 완료! 탐험가 등급이 올랐어요.');}}
updateTowerPlay();for(let i=0;!activeTower&&i<platforms.length;i++){const p=platforms[i];if(body.grounded&&Math.abs(body.x-p.x)<1.7&&Math.abs(body.z-p.z)<1.7&&Math.abs(body.y-p.top)<.2){if((i+1)%3===0&&i+1>save.checkpoint){save.checkpoint=i+1;lastCheckpoint=i+1;persist();updateHUD();toast(`체크포인트 ${i+1} / 12 저장!`);beep(680);}if(i===11&&!save.won){save.won=true;save.coins+=25;persist();updateHUD();openModal('<div class="eyebrow">SKY HOP · COMPLETE</div><div class="welcome-logo">🏆</div><h1>하늘까지 닿았어!</h1><p>12개의 발판을 넘어 스카이 점프맵을 정복했어요.<br>축하 선물 <b>◆ 25 코인</b>을 받았어요.</p>');}}}
if(!activeTower&&body.x>9&&body.z>16&&body.y<.4&&lastCheckpoint&&body.x>12){respawn();toast('저장한 발판에서 이어서 도전해요.');}if(frame%8===0)findAction();}
const visualTime=elapsed+(started?0:performance.now()/1000);wheel.rotation.z=visualTime*.12;cabins.forEach(c=>c.rotation.z=-wheel.rotation.z);drops.forEach((d,i)=>{const t=(visualTime*.65+i/28)%1,a=i*2.4;d.position.set(Math.cos(a)*t*1.7,2.75+Math.sin(t*Math.PI)*1.7-t*1.75,1+Math.sin(a)*t*1.7);});water.scaling.x=water.scaling.z=1+Math.sin(visualTime*2)*.008;
for(const n of npcs){const a=visualTime*.17+n.phase;n.root.position.set(n.origin.x+Math.sin(a)*2,.22,n.origin.z+Math.cos(a)*2);n.root.rotation.y=Math.atan2(-Math.cos(a),Math.sin(a));animateAvatar(n,visualTime+n.phase,true);}clouds.forEach((c,i)=>{c.position.x+=paused?0:dt*.25;if(c.position.x>125)c.position.x=-125;c.position.y=28+i%3*5+Math.sin(visualTime*.1+i)*.3;});trophy.rotation.y=visualTime*.6;
const target=new Vector3(body.x,body.y+2.8,body.z),desired=target.add(new Vector3(Math.sin(yaw)*Math.cos(pitch)*distance,Math.sin(pitch)*distance,Math.cos(yaw)*Math.cos(pitch)*distance));camera.position=Vector3.Lerp(camera.position,desired,started?1-Math.exp(-dt*9):.018);camera.setTarget(target);if(frame++%6===0)drawMap();if(toastTime>0){toastTime-=dt;if(toastTime<=0)$('#toast').classList.remove('show');}scene.render();});
window.addEventListener('resize',()=>engine.resize());
scene.executeWhenReady(()=>{$('#start').disabled=false;$('#start').textContent='나의 모험 시작하기 →';});$('#start').onclick=()=>{started=true;closeModal();toast(matchMedia('(pointer:coarse)').matches?'화면 아래 방향키로 걸어 보세요. 점프 버튼도 눌러 봐요!':'블록토피아에 온 걸 환영해요! WASD로 걸어 보세요.');};
// Read-only state lets browser checks inspect the real game without exposing cheat controls.
window.blocktopia={getState:()=>({position:{...body},coins:save.coins,collected:save.collected.length,checkpoint:save.checkpoint,won:save.won,blocks:save.blocks.length,outfit:save.outfit,paused,buildMode,night,activeTower,towers:structuredClone(save.towers),meshes:scene.meshes.length})};
