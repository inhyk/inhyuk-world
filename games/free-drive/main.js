import './style.css';
import {PLACES,schoolZoneAt,SCHOOL_LIMIT} from './places.mjs';
import {buildSchool} from './school.mjs';
import {setupOnline} from './online.mjs';
import {ferrariFactory} from './ferrari.js';
import {Engine} from '@babylonjs/core/Engines/engine';
import {Scene} from '@babylonjs/core/scene';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import {Color3,Color4} from '@babylonjs/core/Maths/math.color';
import {FreeCamera} from '@babylonjs/core/Cameras/freeCamera';
import {HemisphericLight} from '@babylonjs/core/Lights/hemisphericLight';
import {DirectionalLight} from '@babylonjs/core/Lights/directionalLight';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder';
import {TransformNode} from '@babylonjs/core/Meshes/transformNode';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import {DynamicTexture} from '@babylonjs/core/Materials/Textures/dynamicTexture';
import {ShadowGenerator} from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import {SAVE_KEY,CARS,cleanSave,buy,claimDaily,claimTime,nearestRoad,HIDDEN_TOTAL,discover} from './core.mjs';
import {Journey} from './journey.mjs';
import {signalPhase} from './law.mjs';
import {Enforcement} from './police.mjs';
const $=s=>document.querySelector(s);let save;try{save=cleanSave(JSON.parse(localStorage.getItem(SAVE_KEY)||'{}'));}catch{save=cleanSave();}
let storageOK=true;function persist(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(save));}catch{if(storageOK)toast('저장 공간을 사용할 수 없어요. 이번 플레이 동안만 유지됩니다.');storageOK=false;}}
let toastTimer;function toast(s){$('#toast').textContent=s;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3500);}
let engine;try{engine=new Engine($('#world'),true,{preserveDrawingBuffer:true,stencil:true});}catch{document.body.innerHTML='<p style="padding:40px">3D 화면을 켤 수 없어요. WebGL을 지원하는 브라우저에서 다시 열어 주세요. <a href="/" target="_top">돌아가기</a></p>';throw Error('WebGL unavailable');}
engine.setHardwareScalingLevel(1/Math.min(devicePixelRatio,1.5));const scene=new Scene(engine);scene.clearColor=new Color4(.66,.81,.79,1);scene.fogMode=Scene.FOGMODE_LINEAR;scene.fogStart=100;scene.fogEnd=220;scene.fogColor=new Color3(.66,.81,.79);
const camera=new FreeCamera('camera',new Vector3(12,8,-15),scene);camera.inputs.clear();camera.minZ=.1;camera.maxZ=270;camera.fov=.85;
const sky=new HemisphericLight('sky',new Vector3(0,1,0),scene);sky.intensity=.55;sky.groundColor=Color3.FromHexString('#718c7e');const sun=new DirectionalLight('sun',new Vector3(-.5,-1,.5),scene);sun.position.set(30,70,-40);sun.intensity=.65;sun.diffuse=Color3.FromHexString('#fff1cd');sun.shadowMinZ=1;sun.shadowMaxZ=220;sun.shadowFrustumSize=110;
const shadow=new ShadowGenerator(1024,sun);shadow.useBlurExponentialShadowMap=true;shadow.blurKernel=16;shadow.setDarkness(.2);const mats=new Map(),solids=[];
function mat(c){if(mats.has(c))return mats.get(c);const m=new StandardMaterial(c,scene);m.diffuseColor=Color3.FromHexString(c);m.specularColor=new Color3(.12,.14,.12);mats.set(c,m);return m;}
function finish(m,x,y,z,c,parent,cast=false){m.position.set(x,y,z);m.material=mat(c);if(parent)m.parent=parent;m.receiveShadows=true;if(cast)shadow.addShadowCaster(m);return m;}
function box(n,x,y,z,w,h,d,c,parent,cast=false){return finish(MeshBuilder.CreateBox(n,{width:w,height:h,depth:d},scene),x,y,z,c,parent,cast);}
function cyl(n,x,y,z,r,h,c,parent,top=r){return finish(MeshBuilder.CreateCylinder(n,{diameterBottom:r*2,diameterTop:top*2,height:h,tessellation:20},scene),x,y,z,c,parent,true);}
function sign(text,x,y,z,w=8){const tex=new DynamicTexture(text,{width:512,height:128},scene,false);tex.drawText(text,null,85,'bold 52px sans-serif','#f0f4de','#294f4d',true);const m=new StandardMaterial(text,scene);m.diffuseTexture=tex;m.emissiveColor=new Color3(.2,.2,.2);m.backFaceCulling=false;const p=MeshBuilder.CreatePlane(text,{width:w,height:w/4},scene);p.position.set(x,y,z);p.material=m;return p;}
function makeBlockJeep(c){
 const r=new TransformNode('red brick jeep',scene),wheels=[];
 const black='#1f292f',red=c.color;
 box('chassis',0,.5,0,2.25,.22,4.4,black,r,true);
 box('red lower body',0,.95,0,2.2,.65,4.25,red,r,true);
 box('studded hood',0,1.34,1.36,2.3,.22,1.5,red,r,true);
 box('rear deck',0,1.32,-1.72,2.27,.2,.8,red,r,true);
 // Individual pillars leave clear windows and blue seats visible inside.
 for(const x of [-1.02,1.02]){box('door',x,1.25,-.12,.17,.52,1.8,red,r,true);box('door handle',x*1.11,1.37,.08,.14,.1,.3,black,r);for(const z of [-1.4,.55])box('black roof pillar',x,1.91,z,.15,1.25,.15,black,r,true);}
 box('black brick roof',0,2.57,-.43,2.38,.23,2.27,black,r,true);
 for(const x of [-.79,0,.79])for(const z of [-1.18,-.45,.28])cyl('roof stud',x,2.76,z,.23,.17,black,r);
 for(const x of [-.75,0,.75])for(const z of [1,1.77])cyl('hood stud',x,1.54,z,.23,.17,red,r);
 let glass=mats.get('jeep-glass');if(!glass){glass=new StandardMaterial('jeep-glass',scene);glass.diffuseColor=Color3.FromHexString('#c5e7ef');glass.alpha=.27;glass.specularColor=new Color3(.5,.6,.6);glass.backFaceCulling=false;mats.set('jeep-glass',glass);}
 const windshield=box('clear windshield',0,1.98,.73,2.02,1.08,.05,'#c5e7ef',r);windshield.material=glass;windshield.rotation.x=-.18;
 const back=box('clear rear window',0,1.95,-1.43,1.9,1.05,.035,'#c5e7ef',r);back.material=glass;
 for(const x of [-1.03,1.03]){const pane=box('clear side window',x,2,-.44,.03,.85,1.75,'#c5e7ef',r);pane.material=glass;}
 for(const x of [-.53,.53]){box('blue seat back',x,1.72,-.67,.7,.85,.25,'#427ecb',r);box('blue seat cushion',x,1.33,-.37,.7,.17,.75,'#427ecb',r);}
 const steering=cyl('steering wheel',-.53,1.6,.32,.25,.07,black,r);steering.rotation.x=.6;
 for(const side of [-1,1])for(const z of [-1.38,1.37]){const wheel=cyl('knobby tire',side*1.13,.61,z,.58,.37,black,r);wheel.rotation.z=Math.PI/2;wheels.push(wheel);const hub=cyl('silver hub',side*1.33,.61,z,.32,.04,'#bbc4c1',r);hub.rotation.z=Math.PI/2;for(let i=0;i<10;i++){const a=i*Math.PI/5,tread=box('tire tread',side*1.13,.61+Math.cos(a)*.57,z+Math.sin(a)*.57,.41,.15,.2,black,r);tread.rotation.x=a;}}
 box('silver front grille',0,1.02,2.15,1.1,.48,.09,'#b6c2c1',r);for(const x of [-.36,-.12,.12,.36])box('grille slit',x,1.03,2.21,.06,.32,.025,black,r);
 for(const x of [-.85,.85]){const lamp=cyl('round yellow headlamp',x,1.05,2.23,.31,.16,'#ffe69a',r);lamp.rotation.x=Math.PI/2;box('rear red lamp',x,1.08,-2.16,.36,.25,.07,'#ffb16a',r);}
 for(const x of [-.92,-.46,0,.46,.92]){const bar=cyl('front bumper tube',x,.55,2.3,.12,.45,black,r);bar.rotation.x=Math.PI/2;}
 r.metadata={wheels};return r;
}
const makeFerrari=ferrariFactory(scene,shadow,()=>makeCar({name:'페라리 로딩 중',shape:'sport',color:'#30363c'}),toast);
function makeCar(c){if(c.shape==='ferrari')return makeFerrari();if(c.shape==='jeep')return makeBlockJeep(c);const r=new TransformNode(c.name,scene),wheels=[];const van=c.shape==='van',sport=c.shape==='sport';box('body',0,.78,0,2.25,.65,4.3,c.color,r,true);box('hood',0,1.14,1.23,2.12,.25,1.55,c.color,r,true);box('cabin',0,1.53,van?-.4:-.3,1.9,van?1.3:.85,van?2.6:2.1,c.color,r,true);box('front glass',0,1.58,van?.93:.78,1.67,van?.85:.58,.025,'#294a55',r);box('back glass',0,1.6,van?-1.72:-1.37,1.63,.51,.025,'#294a55',r);for(const side of [-1,1]){box('side glass',side*.96,1.62,-.29,.025,van?.8:.53,van?2.05:1.73,'#345c62',r);box('pillar',side*.98,1.63,-.28,.04,.65,.1,c.color,r);box('mirror',side*1.2,1.3,.65,.25,.2,.35,c.color,r);for(const z of [-1.35,1.35]){const wheel=cyl('tire',side*1.12,.55,z,.49,.28,'#243336',r);wheel.rotation.z=Math.PI/2;const hub=cyl('hub',side*1.285,.55,z,.25,.025,'#d5dfca',r);hub.rotation.z=Math.PI/2;wheels.push(wheel);}box('headlight',side*.74,.99,2.16,.5,.22,.035,'#fff4c1',r);box('taillight',side*.78,.95,-2.16,.42,.18,.035,'#e77963',r);}
box('front bumper',0,.59,2.17,1.97,.15,.14,'#dce5cf',r);box('grill',0,.85,2.18,.75,.19,.025,'#263f3e',r);box('back bumper',0,.6,-2.17,1.95,.15,.15,'#dce5cf',r);if(sport){box('spoiler',0,1.37,-1.9,2.37,.12,.4,c.color,r);for(const x of [-.75,.75])box('spoiler strut',x,1.2,-1.9,.09,.3,.08,'#273c3c',r);}if(c.kit==='police'){box('police roof bar',0,2.04,-.3,1.5,.12,.5,'#27384e',r);box('red emergency lamp',-.42,2.21,-.3,.6,.22,.4,'#fc6960',r);box('blue emergency lamp',.42,2.21,-.3,.6,.22,.4,'#75c9ff',r);for(const side of [-1,1]){box('police blue stripe',side*1.13,.87,0,.025,.25,3.8,'#3567b7',r);box('gold badge',side*1.15,1.03,-.2,.03,.34,.3,'#f6d67e',r);}}
if(c.kit==='stripe')for(const x of [-.35,.35])box('racing stripe',x,1.275,1.23,.2,.02,1.45,'#f7edbf',r);
if(c.kit==='roof')box('contrast roof',0,van?2.2:1.98,-.3,1.97,.12,van?2.65:2.15,'#fff2d6',r);
if(c.kit==='taxi'){box('taxi sign',0,2.1,-.3,.85,.27,.38,'#fff4bd',r);box('taxi stripe',0,.88,2.18,1.5,.1,.04,'#283c42',r);}
if(c.kit==='rack'){box('roof rack',0,2.27,-.4,1.7,.12,2.2,'#394f50',r);box('travel trunk',0,2.5,-.6,1.3,.42,1.15,'#ab865d',r);}
if(c.kit==='fins')for(const x of [-.75,.75]){const fin=box('dragon fin',x,2.2,-.8,.13,.65,.65,'#f4c866',r);fin.rotation.x=.4;}
r.metadata={wheels};return r;}
// Small, continuous island with connected boulevards and three distinct districts.
const world=new TransformNode('exploration',scene);
const central=new TransformNode('original town',scene);central.parent=world;
box('ocean',0,-.65,0,650,.3,650,'#79b9bc',central);box('island',0,-.28,0,242,.5,242,'#abc396',central);box('beach',88,.005,0,64,.04,240,'#e5d5a9',central);box('forest ground',-20,.015,81,190,.04,78,'#91b08a',central);box('city paving',-76,.025,-24,82,.04,174,'#bac4ac',central);
for(const x of [-70,0,70]){box('north road',x,.065,0,11,.07,240,'#526969',central);for(const dx of [-5.7,5.7])box('curb',x+dx,.12,0,.35,.18,240,'#dfe0bd',central);for(let z=-112;z<116;z+=8)box('lane',x,.109,z,.15,.013,3.7,'#eee5bd',central);}
for(const z of [-70,0,70]){box('east road',0,.08,z,240,.08,11,'#526969',central);for(const dz of [-5.7,5.7])box('curb',0,.13,z+dz,240,.18,.35,'#dfe0bd',central);for(let x=-112;x<116;x+=8)if(![-70,0,70].some(v=>Math.abs(x-v)<7))box('lane',x,.129,z,3.7,.013,.15,'#eee5bd',central);}
for(const x of [-70,0,70])for(const z of [-70,0,70]){box('crossing',x,.134,z,10.8,.012,10.8,'#526969',central);for(let j=-4;j<=4;j+=2){box('crosswalk',x+j,.145,z+7,1,.015,2,'#e6e3c6',central);}}
function tree(x,z,s=1){cyl('trunk',x,s,z,.3*s,2*s,'#8b8061',central);cyl('pine',x,3*s,z,2.3*s,4*s,'#507f69',central,0);cyl('pine tip',x,4.2*s,z,1.7*s,3.5*s,'#699b79',central,0);solids.push({x,z,w:1,d:1});}
for(let i=0;i<80;i++){const x=-110+(i*37.71%220),z=17+(i*17.43%98);if([-70,0,70].some(v=>Math.abs(x-v)<10||Math.abs(z-v)<10)||Math.hypot(x+35,z-98)<12)continue;tree(x,z,.7+i%4*.17);}
for(let i=0;i<20;i++){const x=-102+(i%4)*20,z=-99+Math.floor(i/4)*20;if(Math.abs(z+70)<12||Math.abs(x+70)<12)continue;const h=5+(i*7%12),c=['#e1c4a9','#b6ceba','#d6baab','#9fb9b4'][i%4];box('building',x,h/2,z,11,h,11,c,central,true);box('roof',x,h+.2,z,11.5,.4,11.5,'#f2e5c6',central,true);solids.push({x,z,w:11,d:11});for(let y=2;y<h;y+=3)for(const dx of [-3,0,3]){box('window',x+dx,y,z+5.52,1.5,1.4,.03,'#52757a',central);box('window trim',x+dx,y-.8,z+5.7,1.8,.13,.4,'#eee4c9',central);}}
for(let i=0;i<12;i++){const x=91+(i%2)*17,z=-96+i*17;const trunk=cyl('palm',x,2.8,z,.23,5.6,'#a89470',central);trunk.rotation.z=.1;for(let j=0;j<5;j++){const leaf=box('palm leaf',x,5.8,z,.85,.14,5.3,'#6a9977',central);leaf.rotation.y=j*Math.PI/5;leaf.rotation.z=.16;}solids.push({x,z,w:1,d:1});}
cyl('lighthouse',105,5,37,2.4,10,'#f3e4c4',central,1.8);cyl('red stripe',105,6,37,2.06,1.4,'#d68d71',central,1.98);cyl('lantern',105,10.5,37,2,1.6,'#e9c673',central);cyl('roof',105,11.7,37,2.5,1,'#486966',central,0);solids.push({x:105,z:37,w:5,d:5});
box('pier',102,.25,16,31,.4,8,'#c4ab7e',central);for(let x=88;x<118;x+=3)box('pier seam',x,.46,16,.04,.02,8,'#a18e69',central);
box('forest deck',-35,.18,98,15,.3,12,'#c6b48b',central);for(let x=-42;x<-27;x+=2)box('deck line',x,.34,98,.04,.02,12,'#a3906a',central);
for(const [text,x,z] of [['CENTRAL CITY',-56,-12],['PINE FOREST',12,78],['SUNSET BEACH',83,-12]]){const s=sign(text,x,4,z,10);s.parent=central;cyl('sign pole',x,1.8,z,.12,3.6,'#486763',central);}
const coins=[];for(let i=0;i<48;i++){const vertical=i<24,j=i%24,x=vertical?3:(j%8)*13-46,z=vertical?(j%8)*13-46:3;const lane=Math.floor(j/8);const px=x+(vertical?(lane-1)*70:0),pz=z+(vertical?0:(lane-1)*70);const mesh=cyl('coin',px,1.3,pz,.55,.14,'#f9d979',central);mesh.rotation.x=Math.PI/2;coins.push({x:px,z:pz,mesh,ready:0});}
const hidden=[{id:'forest',x:-35,z:98},{id:'ocean',x:104,z:16},{id:'gold',x:-92,z:-17}];for(const h of hidden){h.mesh=makeCar(CARS.find(c=>c.id===h.id));h.mesh.parent=central;h.mesh.position.set(h.x,.2,h.z);h.halo=cyl('discovery halo',h.x,.12,h.z,4,.07,'#e3d48a',central);const marker=sign('HIDDEN CAR',h.x,4.5,h.z,6);marker.parent=central;h.marker=marker;}
buildSchool({parent:central,box,cyl,sign,solids});
const showroom=new TransformNode('showroom',scene);box('studio floor',0,-.48,0,200,.7,200,'#23494a',showroom);cyl('podium',0,-.06,0,5.5,.2,'#51716a',showroom);cyl('podium inset',0,.05,0,5.05,.025,'#69877a',showroom);for(let i=0;i<16;i++){const a=i*Math.PI/8;const m=box('podium mark',Math.sin(a)*5.2,.06,Math.cos(a)*5.2,.07,.02,.25,'#c5d6aa',showroom);m.rotation.y=a;}
let car=makeCar(CARS.find(c=>c.id===save.selected));const p={x:3,z:-15,yaw:0,speed:0,gear:'D'};let playing=false,view=0,clock=0,elapsed=0,distance=save.distance,lastPersist=0,steerVisual=0,modalKind='',lastFocus=null;
function makeTreasure(h,parent){const mesh=makeCar(CARS.find(c=>c.id===h.id));mesh.parent=parent;mesh.position.set(h.x,.2,h.z);const halo=cyl('hidden car pedestal',h.x,.1,h.z,3.6,.12,'#e8d895',parent);const beacon=cyl('hidden beacon',h.x,4.1,h.z,.4,.7,CARS.find(c=>c.id===h.id).color,parent,0);return {mesh,halo,beacon};}
function makeCuffs(parent){const root=new TransformNode('vehicle handcuffs',scene);root.parent=parent;root.position.y=3;for(const x of [-.48,.48]){const ring=MeshBuilder.CreateTorus('silver handcuff',{diameter:.8,thickness:.12,tessellation:16},scene);ring.parent=root;ring.position.x=x;ring.rotation.x=Math.PI/2;ring.material=mat('#e2eff4');}box('cuff chain',0,0,0,.4,.12,.12,'#e2eff4',root);return root;}
const journey=new Journey({p,world,central,solids,makeCar,node:n=>new TransformNode(n,scene),box,cyl,camera,selected:save.selected,makeTreasure,makeCuffs,conditions:save.durability,onDamage:health=>{persist();toast(health===0?'내구도 0! 차가 고장 났어요. E로 내려 다른 차에 타세요.':`사고! 내구도 -10 · 남은 내구도 ${health}/100`);}});
car.parent=showroom;let travelClock=0;
const enforcement=new Enforcement({save,persist,toast,journey,world,node:n=>new TransformNode(n,scene),box,cyl,makeCar,material:mat});
const net=setupOnline({journey,world,node:n=>new TransformNode(n,scene),box,cyl,makeCar,makeTreasure,makeCuffs,camera,material:mat,toast,persist,law:enforcement,save:()=>save,clock(value){if(value!==undefined)travelClock=value;return travelClock;},wallClock:()=>clock,coins,treasures:allTreasures,clearInput,start,closeModal,syncCar,wallet:updateWallet,refreshModal(){if(modalKind)renderModal();},showPolice(cop,driving,seconds){enforcement.chasing=!!cop;if(cop)enforcement.cop={...cop};enforcement.car.setEnabled(!!cop&&driving);enforcement.officer.setEnabled(!!cop&&!driving);if(cop)for(const m of [enforcement.car,enforcement.officer]){m.position.set(cop.x,.13,cop.z);m.rotation.y=cop.yaw;}enforcement.red.setEnabled(Math.floor(seconds*6)%2===0);enforcement.blue.setEnabled(Math.floor(seconds*6)%2!==0);}});
const keys=new Set(),touch=new Set();function clearInput(){keys.clear();touch.clear();}function updateWallet(){$('#balance').textContent=save.coins.toLocaleString();}
function syncCar(){car.dispose();car=makeCar(CARS.find(c=>c.id===save.selected));car.parent=showroom;if(!net.guest)journey.select(save.selected);const c=CARS.find(c=>c.id===save.selected);$('#car-name').textContent=c.name;$('#car-tag').textContent=c.tag;updateWallet();}
function setGear(g){if(net.action('gear',g))return;if(enforcement.jailed||journey.walking)return;if(Math.abs(p.speed)>1){toast('차를 멈춘 뒤 기어를 바꿔 주세요.');return;}p.gear=g;document.querySelectorAll('[data-gear]').forEach(b=>b.classList.toggle('active',b.dataset.gear===g));}
function home(){playing=false;clearInput();save.distance=Math.floor(distance);persist();$('#hud').hidden=true;$('#home').hidden=false;$('#car-caption').hidden=false;world.setEnabled(false);showroom.setEnabled(true);scene.fogColor=new Color3(.14,.29,.29);scene.clearColor=new Color4(.14,.29,.29,1);p.speed=0;if(journey.occupied)journey.occupied.speed=0;$('#start').innerHTML='자유주행 시작 <span>↗</span>';}
function start(){if(enforcement.jailed)return;closeModal();playing=true;clearInput();$('#hud').hidden=false;$('#home').hidden=true;$('#car-caption').hidden=true;world.setEnabled(true);showroom.setEnabled(false);scene.fogColor=new Color3(.66,.81,.79);scene.clearColor=new Color4(.66,.81,.79,1);camera.position.set(p.x+10,8,p.z-13);journey.render(travelClock);toast('E로 내리고 다른 차에 타세요! 도로는 새로운 지역으로 계속 이어져요.');}
function icon(c){if(c.shape==='jeep')return `<svg viewBox="0 0 150 70" aria-hidden="true"><path d="M15 34h118v23H15z" fill="#e44338"/><path d="M39 17h59v22H39z" fill="#c5e7ef"/><path d="M33 12h70v8H33z" fill="#202c32"/><path d="M40 20v19m55-19v19" stroke="#202c32" stroke-width="5"/><g fill="#202c32"><rect x="37" y="8" width="12" height="5"/><rect x="61" y="8" width="12" height="5"/><rect x="85" y="8" width="12" height="5"/><circle cx="39" cy="56" r="12"/><circle cx="112" cy="56" r="12"/></g><g fill="#bac5c8"><circle cx="39" cy="56" r="6"/><circle cx="112" cy="56" r="6"/></g><circle cx="128" cy="41" r="5" fill="#ffe59a"/></svg>`;return `<svg viewBox="0 0 150 70" aria-hidden="true"><path d="M18 38h19l12-20h45l17 20h20v19H18z" fill="${c.color}"/><path d="m53 23-9 15h26V23zm23 0v15h26L91 23z" fill="#254a51"/><circle cx="43" cy="56" r="11" fill="#142c30"/><circle cx="110" cy="56" r="11" fill="#142c30"/><circle cx="43" cy="56" r="5" fill="#dce5c8"/><circle cx="110" cy="56" r="5" fill="#dce5c8"/></svg>`;}
function openModal(kind){if(enforcement.jailed)return;if(save.wanted&&['shop','places'].includes(kind)){toast('추격이 끝난 뒤에 자동차를 바꿀 수 있어요.');return;}lastFocus=document.activeElement;modalKind=kind;clearInput();$('#modal').hidden=false;renderModal();$('#close').focus();}
function closeModal(){$('#modal').hidden=true;modalKind='';lastFocus?.focus();}
function renderModal(){if(modalKind==='places'){
 $('#modal-title').textContent='어디에서 달릴까요?';$('#modal-body').innerHTML='<div class="places">'+PLACES.map(place=>`<button class="place-card" data-place="${place.id}"><span>${place.icon}</span><strong>${place.name}</strong><small>${place.description}</small><b>여기서 출발 →</b></button>`).join('')+'</div><p class="model-credit">선택한 내 차로 이동해요. 2인 플레이에서는 친구도 같은 장소를 골라 만날 수 있어요.</p>';
 document.querySelectorAll('[data-place]').forEach(button=>button.onclick=()=>{if(save.wanted||enforcement.jailed)return;if(!net.action('place',button.dataset.place)){enforcement.trail=[];enforcement.schoolSpeeding=0;journey.travel(button.dataset.place,save.selected);view=0;}closeModal();start();toast(`${PLACES.find(place=>place.id===button.dataset.place).name}에서 출발해요!`);});
 }else if(modalKind==='shop'){$('#modal-title').textContent='내 차를 고르는 시간';$('#modal-body').innerHTML='<div class="cars">'+CARS.map(c=>{const own=save.owned.includes(c.id);return `<article class="car-card ${save.selected===c.id?'selected':''}"><div class="car-icon">${icon(c)}</div><h3>${c.name}</h3><p>${c.tag}<br>최고속도 ${Math.round(c.speed*3.6)} km/h</p><button data-car="${c.id}" ${!own&&(c.hidden||save.coins<c.price)?'disabled':''}>${save.selected===c.id?'✓ 선택한 자동차':own?'이 차 선택하기':c.hidden?'탐험으로 발견':c.price===0?'무료로 받기':`${c.price} 코인 · 구매`}</button></article>`;}).join('')+'</div><p class="model-credit">Ferrari 458 Italia · <a href="https://sketchfab.com/models/57bf6cc56931426e87494f554df1dab6" target="_blank" rel="noopener noreferrer">vicent091036</a> / <a href="https://threejs.org/examples/#webgl_materials_envmaps_groundprojected" target="_blank" rel="noopener noreferrer">Three.js 예제</a></p>';document.querySelectorAll('[data-car]').forEach(b=>b.onclick=()=>{if(net.action('buy',b.dataset.car))return;if(buy(save,b.dataset.car)){syncCar();persist();renderModal();toast('자동차가 준비됐어요!');}});}else{$('#modal-title').textContent='작은 여행, 반가운 선물';const date=localDay();const ready=Math.floor(save.seconds/120)>save.claimed;$('#modal-body').innerHTML=`<div class="reward-card"><h3>☀ 오늘의 드라이브 선물</h3><p>하루 한 번, 차고에 들르면 100 코인.<br>자동차를 모으는 첫걸음이에요.</p><button id="daily" ${save.daily===date?'disabled':''}>${save.daily===date?'오늘 선물 받음':'100 코인 받기'}</button></div><div class="reward-card"><h3>◷ 함께 달린 시간</h3><p>자유주행 2분마다 60 코인을 받아요.<br>누적 ${Math.floor(save.seconds/60)}분 ${save.seconds%60}초 · ${ready?'선물이 기다리고 있어요!':`다음 선물까지 ${(save.claimed+1)*120-save.seconds}초`}</p><button id="time-reward" ${ready?'':'disabled'}>60 코인 받기</button></div><p style="font-size:12px;color:#bed0c4">발견한 자동차 ${save.owned.filter(id=>CARS.find(c=>c.id===id).hidden).length} / ${HIDDEN_TOTAL} · 달린 거리 ${(distance/1000).toFixed(2)} km</p>`;$('#daily').onclick=()=>{if(net.action('daily'))return;if(claimDaily(save,localDay())){persist();updateWallet();renderModal();toast('오늘의 선물 +100 코인');}};$('#time-reward').onclick=()=>{if(net.action('time'))return;if(claimTime(save)){persist();updateWallet();renderModal();toast('플레이 보상 +60 코인');}};}}
function localDay(){const d=new Date();return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;}
$('#places').onclick=()=>openModal('places');$('#start').onclick=start;$('#garage').onclick=home;$('#shop').onclick=()=>openModal('shop');$('#rewards').onclick=()=>openModal('rewards');$('#close').onclick=closeModal;$('#camera').onclick=()=>view=(view+1)%3;$('#reset').onclick=()=>{if(net.action('reset'))return;if(enforcement.jailed||save.wanted){toast('경찰 추격 또는 수감 중에는 복귀할 수 없어요.');return;}enforcement.trail=[];journey.reset(save.selected);view=0;setGear('D');toast('센트럴 시티 출발 지점으로 돌아왔어요.');};document.querySelectorAll('[data-gear]').forEach(b=>b.onclick=()=>setGear(b.dataset.gear));
function interact(){if(net.action('interact'))return;if(!playing||modalKind||enforcement.jailed)return;clearInput();toast(journey.interact());view=0;if(!journey.walking)setGear('D');}
$('#interact').onclick=interact;
function handcuff(){if(net.action('cuff'))return;if(!playing||modalKind||enforcement.jailed)return;toast(journey.handcuff());}
$('#handcuff').onclick=handcuff;
$('#repair').onclick=()=>{if(net.action('repair'))return;if(!playing||modalKind||enforcement.jailed)return;toast(journey.repair(save));persist();updateWallet();updateHud();};
for(const b of document.querySelectorAll('[data-key]')){b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);touch.add(b.dataset.key);});for(const ev of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,()=>touch.delete(b.dataset.key));}
let jailCode='';
function enterReleaseCode(code){if(net.action('unlock',code))return false;if(!enforcement.unlock(code))return false;jailCode='';$('#jail-code').value='';$('#jail').hidden=true;clearInput();$('#jail-code').blur();return true;}
$('#jail-code').addEventListener('input',()=>{const field=$('#jail-code');field.value=field.value.replace(/[^0-9]/g,'').slice(0,5);jailCode=field.value;enterReleaseCode(jailCode);});
$('#jail-code-form').addEventListener('submit',e=>{e.preventDefault();if(!enterReleaseCode($('#jail-code').value))toast('출소 코드를 다시 확인해 주세요.');});
addEventListener('keydown',e=>{if(net.blocked){if(e.code==='Escape')$('#room-panel').hidden=true;return;}if(enforcement.jailed){if(e.target!==$('#jail-code')&&!e.repeat){if(/^[0-9]$/.test(e.key)){e.preventDefault();jailCode=(jailCode+e.key).slice(-5);$('#jail-code').value=jailCode;enterReleaseCode(jailCode);}else if(e.key==='Backspace'){e.preventDefault();jailCode=jailCode.slice(0,-1);$('#jail-code').value=jailCode;}else if(e.key.length===1){jailCode='';$('#jail-code').value='';}}if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Escape'].includes(e.code))e.preventDefault();return;}if(e.code==='Tab'&&modalKind){const focusable=[...$('#modal').querySelectorAll('button:not(:disabled)')];const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}return;}if(e.code==='Escape'){if(modalKind)closeModal();else if(playing)home();return;}if(!playing||modalKind||enforcement.jailed)return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();keys.add(e.code);if(!e.repeat){if(e.code==='KeyH'){e.preventDefault();handcuff();return;}if(e.code==='KeyE'){interact();return;}if(e.code==='KeyC')view=(view+1)%3;const n=['Digit1','Digit2','Digit3','Digit4'].indexOf(e.code);if(n>=0)setGear(['D','N','P','R'][n]);}});addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>{clearInput();if(playing)home();});document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();if(playing)home();}});addEventListener('pagehide',persist);addEventListener('resize',()=>engine.resize());
function allTreasures(){return [...(journey.centralVisible?hidden.map(h=>({...h,x:h.x+central.position.x,z:h.z+central.position.z})):[]),...journey.stream.treasures];}
const map=$('#map').getContext('2d');
function drawMap(){
 map.fillStyle='#91ac8a';map.fillRect(0,0,180,180);const scale=.65;
 map.strokeStyle='#426563';map.lineWidth=6;
 const roads=new Set();for(let q=-160;q<=160;q+=20){roads.add(nearestRoad(p.x+q));}
 for(const x of roads){const px=90+(x-p.x)*scale;map.beginPath();map.moveTo(px,0);map.lineTo(px,180);map.stroke();}
 roads.clear();for(let q=-160;q<=160;q+=20)roads.add(nearestRoad(p.z+q));
 for(const z of roads){const py=90-(z-p.z)*scale;map.beginPath();map.moveTo(0,py);map.lineTo(180,py);map.stroke();}
 for(const h of allTreasures())if(!save.owned.includes(h.id)){map.fillStyle='#ffec96';map.font='bold 13px Arial';map.fillText('?',86+(h.x-p.x)*scale,95-(h.z-p.z)*scale);}
 if(net.other?.p){map.fillStyle='#86d5ff';map.beginPath();map.arc(90+(net.other.p.x-p.x)*scale,90-(net.other.p.z-p.z)*scale,5,0,Math.PI*2);map.fill();}
 for(const v of journey.vehicles){if(v===journey.occupied)continue;map.fillStyle=v.auto?'#d1eff3':'#ffd484';map.fillRect(87+(v.x-p.x)*scale,87-(v.z-p.z)*scale,5,5);}
 map.save();map.translate(90,90);map.rotate(p.yaw);map.fillStyle='#fffde1';map.beginPath();map.moveTo(0,-7);map.lineTo(5,5);map.lineTo(-5,5);map.closePath();map.fill();map.restore();
}
function updateHud(){
 const axis=Math.abs(Math.cos(p.yaw))>.7?'z':'x',phase=signalPhase(travelClock,axis);
 $('#law-status').textContent=save.wanted?'🚨 경찰 추격 중 · 잡히면 60초 수감':`${{red:'🔴 빨간불 · 정지선 앞에서 멈추세요',yellow:'🟡 노란불 · 정지 준비',green:'🟢 초록불 · 지나가도 돼요'}[phase]}`;
 const school=schoolZoneAt(p,journey.stream.origin);if(school&&!save.wanted)$('#law-status').textContent=journey.walking?'🏫 어린이 보호구역 · 횡단보도로 건너요':Math.abs(p.speed)>SCHOOL_LIMIT?'⚠ 어린이 보호구역 · 30 km/h 이하로 줄이세요!':'🏫 어린이 보호구역 · 제한속도 30 km/h';
 $('#law-status').classList.toggle('wanted',save.wanted);
 const walking=journey.walking,near=journey.near;const cuffTarget=journey.cuffTarget;$('#handcuff').hidden=journey.occupied?.model!=='police';$('#handcuff').disabled=!cuffTarget;$('#handcuff').textContent=cuffTarget?`H · ${CARS.find(c=>c.id===cuffTarget.model).name} ${cuffTarget.cuffed?'수갑 해제':'수갑 채우기'}`:'H · 앞쪽 차량에 수갑';$('#hud').classList.toggle('walking',walking);
 $('#interact').textContent=walking?(near?`E · ${CARS.find(c=>c.id===near.model).name} 타기`:'E · 가까운 차 타기'):'E · 차에서 내리기';
 $('#interact').disabled=walking&&!near;
 $('#repair').disabled=walking||journey.occupied.durability>=100;
 const condition=(journey.occupied||near)?.durability;
 $('#durability').textContent=condition===undefined?'차에 타면 표시돼요':`${condition} / 100${condition===0?' · 고장':''}`;
 $('#condition-fill').style.width=`${condition??0}%`;$('#condition-fill').style.background=condition>30?'#dafa9c':'#f78975';
 $('#condition').classList.toggle('broken',condition===0);
 $('#speed').textContent=Math.round(Math.abs(p.speed)*3.6);$('#speed-unit').textContent=walking?'걷는 중':'KM/H';
 document.querySelectorAll('[data-gear]').forEach(b=>{b.disabled=walking;b.classList.toggle('active',!walking&&b.dataset.gear===p.gear);});
 $('[data-key="gas"]').textContent=walking?'앞으로':'가속';$('[data-key="brake"]').textContent=walking?'뒤로':'제동';
 const r=journey.region;$('#district').textContent=r.central?(p.x+Number(journey.stream.origin.x)*240>55?'선셋 비치':p.z+Number(journey.stream.origin.z)*240>50?'파인 포레스트':'센트럴 시티'):`${r.name} · ${r.x}, ${r.z}`;
 if(school)$('#district').textContent='어린이 보호구역';
 $('#mission').textContent=walking?'가까이 가면 차가 멈춰요 · E로 탑승':`${CARS.find(c=>c.id===journey.occupied.model).name} · ${(distance/1000).toFixed(2)} km의 여행`;
 $('#keyboard-help').textContent=walking?'WASD / 방향키 걷기 · E 가까운 차 타기 · Esc 차고':'W 가속 · S 제동 · A/D 핸들 · E 내리기 · 1–4 기어 · C 시점';
 if(journey.occupied?.model==='police'){$('#keyboard-help').textContent+=' · H 수갑 채우기 / 해제';$('#mission').textContent='경찰 순찰 중 · 다른 경찰에게 잡히지 않아요';}
 $('#wheel').style.transform=`rotate(${steerVisual*70}deg)`;
}
syncCar();home();engine.runRenderLoop(()=>{
 const dt=Math.min(engine.getDeltaTime()/1000,.05);clock+=dt;
 const remaining=net.guest?net.jail:enforcement.tick();$('#jail').hidden=remaining===0;$('#jail-count').textContent=String(remaining);if(remaining)clearInput();else{jailCode='';$('#jail-code').value='';}
 const input={gas:keys.has('KeyW')||keys.has('ArrowUp')||touch.has('gas'),brake:keys.has('KeyS')||keys.has('ArrowDown')||keys.has('Space')||touch.has('brake'),steer:Number(keys.has('KeyD')||keys.has('ArrowRight')||touch.has('right'))-Number(keys.has('KeyA')||keys.has('ArrowLeft')||touch.has('left'))};
 if(playing){
  if(!modalKind&&!remaining&&!net.blocked&&!net.waitingGuest){
   travelClock+=dt;
   const before={x:p.x,z:p.z},driving=!journey.walking,origin={...journey.stream.origin};
   distance+=journey.update(dt,input,travelClock);
   const shiftX=Number(journey.stream.origin.x-origin.x)*240,shiftZ=Number(journey.stream.origin.z-origin.z)*240;
   if(shiftX||shiftZ){enforcement.shift(shiftX,shiftZ);net.shift(shiftX,shiftZ);before.x-=shiftX;before.z-=shiftZ;}
   enforcement.step(dt,travelClock,before,driving);steerVisual+=(input.steer-steerVisual)*Math.min(1,dt*8);
   elapsed+=dt;if(elapsed>=1){const n=Math.floor(elapsed);save.seconds+=n;elapsed-=n;if(save.seconds%120===0)toast('2분 플레이 선물 도착! 차고의 보상에서 받아요.');}
   if(journey.centralVisible){
    for(const c of coins){if(clock>=c.ready&&Math.hypot(c.x+central.position.x-p.x,c.z+central.position.z-p.z)<2){save.coins+=5;c.ready=clock+45;c.mesh.setEnabled(false);updateWallet();toast('+5 코인');}if(clock>=c.ready)c.mesh.setEnabled(true);}
    
   }
   for(const h of allTreasures())if(Math.hypot(h.x-p.x,h.z-p.z)<5&&discover(save,h.id)){persist();toast(`히든 차 발견! ${CARS.find(c=>c.id===h.id).name} · 차고에 추가됐어요`);}
   if(clock-lastPersist>5){save.distance=Math.floor(distance);persist();lastPersist=clock;}
  }
  if(net.active&&!net.waitingGuest&&(modalKind||remaining||net.blocked))travelClock+=dt;
  net.update(dt,input,!modalKind&&!remaining&&!net.blocked);
  enforcement.lights(travelClock);
  const walking=journey.walking,dir=new Vector3(Math.sin(p.yaw),0,Math.cos(p.yaw)),target=new Vector3(p.x,1.2,p.z);
  const desired=walking?target.add(new Vector3(0,6,-9)):view===2?new Vector3(p.x,32,p.z-18):view===1?new Vector3(p.x,2.5,p.z).add(dir.scale(.6)):target.subtract(dir.scale(10)).add(new Vector3(0,5.5,0));
  camera.position=Vector3.Lerp(camera.position,desired,Math.min(1,dt*6));camera.setTarget(walking?target:view===1?target.add(dir.scale(18)).add(new Vector3(0,1,0)):target.add(dir.scale(2)));
  if(journey.occupied)journey.occupied.mesh.setEnabled(view!==1);updateHud();drawMap();sun.position.set(p.x+30,70,p.z-40);
 }else{
  if(net.active&&!net.waitingGuest)travelClock+=dt;
  net.update(dt,input,false);
  car.setEnabled(true);car.position.set(0,.12,0);car.rotation.y=clock*.14+.5;const narrow=innerWidth<760;camera.position.set(11,7.5,-13);camera.setTarget(narrow?new Vector3(0,4.6,0):new Vector3(-5,1,0));sun.position.set(30,70,-40);
 }
 for(const c of coins){c.mesh.rotation.y=clock*1.5;c.mesh.position.y=1.35+Math.sin(clock*2+c.x)*.15;}
 for(const h of allTreasures()){const show=!save.owned.includes(h.id);h.mesh.setEnabled(show);h.halo.setEnabled(show);h.marker?.setEnabled(show);h.beacon?.setEnabled(show);h.mesh.rotation.y=clock*.35;}
 scene.render();
});
window.freeDrive={getState:()=>({playing,schoolZone:schoolZoneAt(p,journey.stream.origin),multiplayer:net.state(),position:{...p},coins:save.coins,selected:save.selected,owned:[...save.owned],seconds:save.seconds,distance,view,modal:modalKind,hiddenTotal:HIDDEN_TOTAL,treasures:allTreasures().map(({id,x,z})=>({id,x,z})),signalTime:travelClock,modelStatus:car.metadata.modelStatus||'ready',drivingModelStatus:journey.occupied?.mesh.metadata?.modelStatus||'ready',...journey.state(),...enforcement.state()})};
// Test-only hooks are excluded from the site build; ordinary play never exposes movement setters.
if(import.meta.env.DEV&&new URLSearchParams(location.search).has('test'))window.freeDrive.test={setSignalTime(t){travelClock=t;},place(x,z){Object.assign(p,{x,z,speed:0});if(journey.occupied)Object.assign(journey.occupied,{x,z,speed:0});journey.refresh();},advance(dt=1/60){journey.update(dt,{gas:false,brake:false,steer:0},travelClock+=dt);}};
