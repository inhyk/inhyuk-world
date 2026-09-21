import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { ORES,radius,rankIndex } from './core.mjs';
export function createWorld(canvas){
 const engine=new Engine(canvas,true,{preserveDrawingBuffer:true,stencil:true});engine.setHardwareScalingLevel(1/Math.min(devicePixelRatio,1.5));
 const scene=new Scene(engine);scene.clearColor=Color4.FromHexString('#b5cec2ff');scene.fogMode=Scene.FOGMODE_EXP2;scene.fogDensity=.0037;scene.fogColor=Color3.FromHexString('#b5cec2');
 const camera=new FreeCamera('camera',new Vector3(0,30,-38),scene);camera.inputs.clear();camera.minZ=.3;camera.maxZ=800;camera.fov=.86;
 const hemi=new HemisphericLight('sky',new Vector3(0,1,0),scene);hemi.intensity=.65;hemi.groundColor=Color3.FromHexString('#637655');
 const sun=new DirectionalLight('sun',new Vector3(-.5,-1,.5),scene);sun.intensity=.65;sun.diffuse=Color3.FromHexString('#fff1cf');
 const mats=new Map();function mat(color,glow=false){const key=color+glow;if(mats.has(key))return mats.get(key);const m=new StandardMaterial(key,scene);m.diffuseColor=Color3.FromHexString(color);m.specularColor=Color3.FromHexString('#142322');if(glow)m.emissiveColor=m.diffuseColor.scale(.55);mats.set(key,m);return m;}
 function finish(m,x,y,z,color,parent){m.position.set(x,y,z);m.material=mat(color);m.isPickable=false;if(parent)m.parent=parent;return m;}
 function box(n,x,y,z,w,h,d,c,p){return finish(MeshBuilder.CreateBox(n,{width:w,height:h,depth:d},scene),x,y,z,c,p);}
 function cylinder(n,x,y,z,diameter,height,c,p,top=diameter,tessellation=8){return finish(MeshBuilder.CreateCylinder(n,{diameterBottom:diameter,diameterTop:top,height,tessellation},scene),x,y,z,c,p);}
 function sphere(n,x,y,z,size,c,p,segments=8){return finish(MeshBuilder.CreateSphere(n,{diameter:size,segments},scene),x,y,z,c,p);}
 function label(text,x,y,z,w=15){const t=new DynamicTexture(text,{width:512,height:128},scene,false);t.hasAlpha=true;t.drawText(text,null,83,'bold 48px sans-serif','#fffae4','#234e3e',true);const m=new StandardMaterial(text,scene);m.diffuseTexture=t;m.emissiveColor=new Color3(.6,.6,.6);m.backFaceCulling=false;const mesh=MeshBuilder.CreatePlane(text,{width:w,height:w/4},scene);mesh.position.set(x,y,z);mesh.material=m;mesh.billboardMode=7;return mesh;}
 const ground=finish(MeshBuilder.CreateGround('1000 × 1000 map',{width:1000,height:1000},scene),0,-.03,0,'#8da978');ground.isPickable=false;
 box('camp pathway',0,.01,0,14,.06,65,'#c9c2a0');box('camp clearing',0,0,0,54,.06,30,'#c5bf9c');
 for(let j=0;j<4;j++){const side=j<2?1:-1;box('map boundary',j%2?side*500:0,1,j%2?0:side*500,j%2?1:1000,2,j%2?1000:1,'#728675');}
 function stall(x,color,title){box('wood deck',x,.3,0,12,.6,8,'#876b4d');for(const dx of [-5.3,5.3])for(const dz of [-3,3])box('post',x+dx,3.3,dz,.45,6,.45,'#6b6246');box('counter',x,1.7,-2,10,2,2,'#ad8759');for(let j=0;j<6;j++){const roof=box('canvas awning',x-5+j*2,6.3,0,2, .35,9,j%2?'#f1e7bf':color);roof.rotation.x=-.07;}label(title,x,8,0,13);for(let i=0;i<3;i++)box('crate',x-3+i*3,1,-.5,2,1.7,2,'#bea06d');}
 stall(-19,'#dfb65f','판매소 · SELL');stall(19,'#518f7b','상점 · SHOP');
 for(let i=0;i<10;i++)cylinder('stepping stone',Math.sin(i)*.5,.07,13+i*3.5,2.2,.12,'#d9cfac',null,2.2,7);
 let seed=6742;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<230;i++){const x=(rand()-.5)*990,z=(rand()-.5)*990;if(Math.hypot(x,z)<55)continue;const h=7+rand()*13;const tree=new TransformNode('pine',scene);tree.position.set(x,0,z);cylinder('trunk',0,h*.2,0,1.1,h*.4,'#726649',tree);for(let k=0;k<3;k++)cylinder('pine canopy',0,h*(.42+k*.2),0,h*(.7-k*.16),h*.55,['#567b58','#68885b','#7b995f'][k],tree,0,6);}
 for(let i=0;i<55;i++){const a=rand()*Math.PI*2,d=65+rand()*420,x=Math.cos(a)*d,z=Math.sin(a)*d;const r=8+rand()*25;const rock=sphere('valley outcrop',x,r*.13,z,r,'#8c987a');rock.scaling.set(1,.38,.9);}
 const grass=[];for(let i=0;i<650;i++){const a=rand()*Math.PI*2,d=25+rand()*180,x=Math.sin(a)*d,z=Math.cos(a)*d;if(Math.abs(x)<8&&Math.abs(z)<38||Math.abs(x)<28&&Math.abs(z)<15)continue;for(let j=0;j<2;j++){const blade=box('meadow grass',x+j*.3,.32,z,.12,.6+rand()*.5,.09,'#789568');blade.rotation.z=(j?1:-1)*.3;grass.push(blade);}}Mesh.MergeMeshes(grass,true,true,undefined,false,true);
 // Near-camp foliage frames the first expedition without blocking movement.
 for(const [x,z] of [[-36,22],[38,32],[-48,-24],[43,-31],[-60,65],[59,75]]){cylinder('cedar trunk',x,3,z,1.3,6,'#786c4d');for(let k=0;k<3;k++)cylinder('cedar crown',x,6+k*3,z,12-k*2,8,'#547f59',null,0,7);}
 const avatar=new TransformNode('explorer',scene);cylinder('body',0,1.6,0,1.5,1.7,'#eac36d',avatar);sphere('head',0,2.95,0,1.15,'#d8ab7d',avatar);cylinder('hat brim',0,3.4,0,1.9,.16,'#f5df9c',avatar);cylinder('hat',0,3.6,0,1.25,.4,'#e9cd86',avatar);box('backpack',0,1.9,-.8,1.2,1.35,.65,'#395d53',avatar);const legs=[-1,1].map(side=>box('boot',side*.4,.45,0,.6,.9,.75,'#3b5147',avatar));const arms=[-1,1].map(side=>box('arm',side*.94,1.75,0,.45,1.2,.5,'#d7a974',avatar));
 const shadow=cylinder('explorer shadow',0,.03,0,3,.02,'#708663',null,3,24);
 const ring=MeshBuilder.CreateTorus('selection',{diameter:4,thickness:.07,tessellation:40},scene);ring.material=mat('#f9efb5',true);ring.setEnabled(false);
 const templates=ORES.map((o,id)=>{const root=new TransformNode('ore template',scene);const rank=rankIndex(id),segments=rank<3?2+rank*2:8+rank*2;for(const side of [-1,1]){const stone=finish(MeshBuilder.CreateSphere('stone shell',{diameter:2,segments,arc:.475},scene),side*.035,0,0,rank<3?'#7f8273':'#777f75',root);stone.rotation.y=side===1?0:Math.PI;if(rank<4)stone.convertToFlatShadedMesh();}
 // A narrow recessed seam: stone stays outside, small crystals gather inside.
 cylinder('ore contact shadow',0,-.74,0,1.9,.012,'#7c9667',root,1.9,16);
 const seam=sphere('dark cleft',0,0,0,1.85,'#394942',root,6);seam.scaling.z=.2;
 for(let j=0;j<6;j++){const crystal=cylinder('exposed crystal',(j%2?1:-1)*.065,-.49+j*.19,-.85-Math.sin(j)*.045,.28,.5,o.color,root,0,5);crystal.rotation.x=-.7;crystal.rotation.z=(j%2?1:-1)*.38;crystal.material=mat(id===13?['#ff85a7','#ffce65','#a4ffb7','#75d7ff','#ae9bff','#edb4ff'][j]:o.color,true);const back=crystal.clone('rear seam crystal',root);back.position.z=-crystal.position.z;back.rotation.x=-crystal.rotation.x;}
 root.setEnabled(false);return root;});
 function addOre(ore){const root=templates[ore.id].clone('ore '+ore.uid);root.setEnabled(true);root.position.set(ore.x,radius(ore)*.77,ore.z);root.scaling.setAll(radius(ore));root.rotation.y=ore.turn;return root;}
 let yaw=0,zoom=53;return {scene,engine,addOre,setYaw:v=>yaw+=v,setZoom:v=>zoom=Math.min(70,Math.max(22,zoom+v)),yaw:()=>yaw,
 update(player,nearest,carried,t,moving){avatar.position.set(player.x,0,player.z);if(moving)avatar.rotation.y=player.facing;for(let i=0;i<2;i++){legs[i].rotation.x=moving?Math.sin(t*10+i*Math.PI)*.5:0;arms[i].rotation.x=carried.length?-1.3:moving?Math.sin(t*10+i*Math.PI)*.4:0;}shadow.position.set(player.x,.03,player.z);const target=new Vector3(player.x,1,player.z);camera.position.set(player.x+Math.sin(yaw)*zoom,zoom*.8,player.z-Math.cos(yaw)*zoom);camera.setTarget(target);for(let i=0;i<carried.length;i++){const ore=carried[i],r=radius(ore);const a=player.facing+(i-(carried.length-1)/2)*1.05;const displaySize=r;ore.mesh.scaling.setAll(displaySize);ore.mesh.position.set(player.x+Math.sin(a)*(3.4+displaySize),2+displaySize,player.z+Math.cos(a)*(3.4+displaySize));ore.mesh.rotation.y+=.004;}ring.setEnabled(!!nearest);if(nearest){ring.position.set(nearest.x,.15,nearest.z);ring.scaling.setAll(radius(nearest)*.65+.4);}scene.render();},resize:()=>engine.resize()};
}
