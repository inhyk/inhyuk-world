import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Vector3, Matrix } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import '@babylonjs/core/Culling/ray';
import { ORES, oreAt, hardness, targets } from './core.mjs';

export function createWorld(canvas) {
  const engine = new Engine(canvas, true, {preserveDrawingBuffer:true, stencil:true});
  engine.setHardwareScalingLevel(1/Math.min(devicePixelRatio||1,1.5));
  const scene = new Scene(engine);
  scene.clearColor=Color4.FromHexString('#1d3028ff');
  scene.fogMode=Scene.FOGMODE_EXP2;scene.fogDensity=.023;scene.fogColor=Color3.FromHexString('#1d3028');
  const camera=new FreeCamera('first person camera',new Vector3(0,1.29,-3.02),scene);
  camera.inputs.clear();camera.minZ=.04;camera.maxZ=80;camera.fov=1.05;camera.rotation.x=.4;
  const hemi=new HemisphericLight('cave fill',new Vector3(0,1,0),scene);hemi.intensity=.85;hemi.groundColor=Color3.FromHexString('#726450');
  const sun=new DirectionalLight('shaft of sunlight',new Vector3(-.5,-1,.4),scene);sun.position.set(5,12,-8);sun.intensity=1.4;sun.diffuse=Color3.FromHexString('#fff0ce');
  const shadows=new ShadowGenerator(1024,sun);shadows.useBlurExponentialShadowMap=true;shadows.blurKernel=16;shadows.normalBias=.025;shadows.bias=.0005;shadows.setDarkness(.35);
  const mats=new Map();
  function mat(color,glow=false){const key=color+glow;if(mats.has(key))return mats.get(key);const m=new StandardMaterial(key,scene);m.diffuseColor=Color3.FromHexString(color);m.specularColor=Color3.FromHexString('#242922');if(glow)m.emissiveColor=m.diffuseColor.scale(.65);mats.set(key,m);return m;}
  function finish(m,x,y,z,color,parent,shadow=true){m.position.set(x,y,z);m.material=mat(color);m.isPickable=false;m.receiveShadows=true;if(parent)m.parent=parent;if(shadow)shadows.addShadowCaster(m);return m;}
  function box(name,x,y,z,w,h,d,color,parent,shadow=true){return finish(MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene),x,y,z,color,parent,shadow);}
  function cylinder(name,x,y,z,diameter,height,color,parent){return finish(MeshBuilder.CreateCylinder(name,{diameter,height,tessellation:12},scene),x,y,z,color,parent);}
  function crystal(name,x,y,z,size,color,parent){const m=finish(MeshBuilder.CreatePolyhedron(name,{type:1,size},scene),x,y,z,color,parent);m.rotation.set(.2,.4,.1);return m;}
  // A cutaway mine diorama: deep rock base, stratum bands and a timber scaffold.
  box('bedrock foundation',0,-2.35,0,7.5,2.3,6.7,'#4b4939');
  box('ochre stratum',0,-1.63,0,7.54,.16,6.74,'#967753');
  box('lower stratum',0,-2.8,0,7.54,.13,6.74,'#6d6146');
  box('ground',0,-3.56,0,200,.12,200,'#243b2c',null,false);
  for(let row=0;row<3;row++)for(let col=0;col<3;col++)box('lower stone', (col-1)*1.53,-1.1,(row-1)*1.53,1.46,.75,1.46,'#5a5745');
  box('explorer walkway',0,-.48,-3,7.4,.25,1.25,'#aa8960');
  for(let i=0;i<14;i++)box('walkway plank',-3.45+i*.53,-.325,-3,.49,.07,1.2,i%2?'#ad8b60':'#ba9b6f');
  box('left ledge',-3.1,-.38,.3,1,.35,5,'#797452');
  box('back ledge',0,-.38,3,7.3,.35,1,'#797452');
  for(const x of [-3.05,3.05]){
    box('timber post',x,1.52,2.85,.32,4.1,.32,'#9f8056');
    for(const y of [.2,2.9])box('iron collar',x,y,2.85,.35,.15,.35,'#4b5b50');
    const brace=box('diagonal brace',x-Math.sign(x)*.35,2.95,2.85,.19,1.15,.19,'#ba9965');brace.rotation.z=Math.sign(x)*-.7;
  }
  box('overhead timber',0,3.57,2.85,6.85,.36,.4,'#bd9a68');
  box('timber cap',0,3.79,2.85,7,.08,.49,'#d0b079');
  for(const x of [-2.7,2.7]){
    cylinder('lantern chain',x,2.94,2.85,.025,.8,'#34443a');
    const lamp=box('lantern glass',x,2.42,2.85,.28,.42,.28,'#ffe1a1');lamp.material=mat('#ffe1a1',true);
    for(const y of [2.16,2.68])box('lantern cap',x,y,2.85,.4,.08,.4,'#405447');
    for(const dx of [-.17,.17])for(const dz of [-.17,.17])box('lantern frame',x+dx,2.42,2.85+dz,.025,.48,.025,'#405447');
    const light=new PointLight('warm lantern light',new Vector3(x,2.4,2.55),scene);light.diffuse=Color3.FromHexString('#ffc977');light.intensity=.8;light.range=5;
  }
  // A small ore cart and stacked supplies on the edge of the shaft.
  for(const z of [2.65,3.15])box('cart rail',-.2,-.15,z,3.2,.07,.06,'#bbc4ad');
  const cart=new TransformNode('ore cart',scene);cart.position.set(.5,.13,2.9);
  box('cart base',0,.1,0,1.15,.16,.8,'#50635b',cart);
  for(const x of [-.57,.57])box('cart side',x,.4,0,.1,.65,.85,'#677d70',cart);
  for(const z of [-.4,.4])box('cart end',0,.4,z,1.14,.65,.1,'#819483',cart);
  for(const x of [-.4,.4])for(const z of [-.48,.48]){const wheel=cylinder('iron wheel',x,-.07,z,.3,.12,'#34453b',cart);wheel.rotation.x=Math.PI/2;}
  for(let i=0;i<5;i++)crystal('cart rubble',-.35+(i%3)*.31,.68,Math.floor(i/3)*.28-.14,.22,'#b4b49b',cart);
  for(let i=0;i<2;i++){const crate=box('supply crate',-3.15,.02+i*.6,1.1,.64,.59,.64,'#a48658');for(const y of [-.2,.2])box('crate band',0,y,0,.68,.07,.68,'#d2b57d',crate);}
  // Hands and shovel stay in the player's view; the head and body cannot obscure the camera.
  const arm=new TransformNode('first person hand',scene);arm.parent=camera;arm.position.set(.32,-.3,.62);arm.scaling.setAll(.75);
  box('jacket sleeve',.04,-.12,0,.19,.34,.22,'#93af86',arm,false);
  box('hand',0,.02,.04,.18,.17,.18,'#e6b886',arm,false);
  const tool=new TransformNode('shovel',scene);tool.parent=arm;tool.position.set(0,.06,.09);tool.rotation.x=.35;tool.scaling.setAll(.7);
  cylinder('shovel handle',0,.1,0,.065,1,'#b99761',tool);
  box('shovel blade',0,.65,0,.34,.36,.06,'#ccd7c0',tool,false);
  box('blade ridge',0,.65,-.04,.04,.31,.025,'#edf0d5',tool,false);
  for(const mesh of arm.getChildMeshes()){shadows.removeShadowCaster(mesh);mesh.renderingGroupId=2;mesh.receiveShadows=false;}

  const crackMats=[];
  // Increasingly branched fissures are transparent decals on the block's 3D faces.
  for(let stage=1;stage<=5;stage++){
    const tex=new DynamicTexture(`fracture ${stage}`,{width:256,height:256},scene,false);tex.hasAlpha=true;
    const c=tex.getContext();c.clearRect(0,0,256,256);c.lineCap='round';c.lineJoin='round';
    const branches=[[[127,120],[111,95],[132,67],[116,39],[130,0]],[[127,120],[158,137],[167,171],[199,180],[221,256]],[[127,120],[103,150],[65,147],[40,174],[0,163]],[[158,137],[179,107],[208,115],[256,84]],[[111,95],[74,83],[62,40],[27,16]],[[167,171],[133,193],[143,224],[120,256]],[[103,150],[91,184],[51,203],[46,256]],[[132,67],[169,53],[185,14],[212,0]]];
    for(let i=0;i<Math.min(8,stage+2);i++){
      const path=branches[i],end=Math.min(path.length,stage+1);
      for(const [color,lineWidth,offset] of [['#d7c49c',stage+2,1.5],['#24251f',stage+1,0]]){c.strokeStyle=color;c.lineWidth=lineWidth;c.beginPath();path.slice(0,end).forEach(([x,y],j)=>j?c.lineTo(x+offset,y+offset):c.moveTo(x+offset,y+offset));c.stroke();}
    }
    tex.update();const m=new StandardMaterial(`crack material ${stage}`,scene);m.diffuseTexture=tex;m.useAlphaFromDiffuseTexture=true;m.specularColor=Color3.Black();m.backFaceCulling=false;m.zOffset=-2;crackMats.push(m);
  }
  const blocks=[],outlines=[],debris=[];let depth=0,clock=0,swing=0,yaw=0,pitch=.4;
  function build(s){
    for(const b of blocks){shadows.removeShadowCaster(b.mesh,true);b.mesh.dispose();}blocks.length=0;
    for(const o of outlines)o.dispose();outlines.length=0;depth=s.depth;
    for(let col=0;col<9;col++){
      const x=(col%3-1)*1.53,z=(Math.floor(col/3)-1)*1.53,ore=oreAt(s.depth,col);
      const color=s.depth>=300?'#716478':s.depth>=150?'#77776c':s.depth>=75?'#947660':'#9c8c69';
      const mesh=box(`mineable block ${col}`,x,0,z,1.46,1.36,1.46,color);mesh.isPickable=true;mesh.metadata={col};
      for(let j=0;j<4;j++){
        const cx=-.42+(j%2)*.72,cz=-.4+Math.floor(j/2)*.69;
        const gem=crystal('embedded mineral',cx,.675,cz,.12+(j%2)*.055,ORES[ore].color,mesh);gem.scaling.y=.4;
        const side=crystal('exposed vein',cx,-.05+(j%2)*.38,-.732,.11,ORES[ore].color,mesh);side.scaling.z=.35;
      }
      const decals=[];
      for(const face of ['top','front','right','left','back']){
        const p=MeshBuilder.CreatePlane(`cracks ${col} ${face}`,{size:1.46},scene);p.parent=mesh;p.isPickable=false;
        if(face==='top'){p.position.y=.686;p.rotation.x=Math.PI/2;}else if(face==='front'){p.position.z=-.736;p.scaling.y=1.36/1.46;}else if(face==='back'){p.position.z=.736;p.rotation.y=Math.PI;p.scaling.y=1.36/1.46;}else {p.position.x=face==='right'?.736:-.736;p.rotation.y=face==='right'?-Math.PI/2:Math.PI/2;p.scaling.y=1.36/1.46;}
        p.setEnabled(false);decals.push(p);
      }
      blocks.push({mesh,decals,stage:0});
      const points=[[-.75,-.75],[.75,-.75],[.75,.75],[-.75,.75],[-.75,-.75]].map(([dx,dz])=>new Vector3(x+dx,.72,z+dz));
      const outline=MeshBuilder.CreateLines(`selection ${col}`,{points},scene);outline.color=Color3.FromHexString('#ffe8a4');outline.isPickable=false;outlines.push(outline);
    }
  }
  function sync(s,selected){
    if(depth!==s.depth)build(s);
    const chosen=targets(s,selected);
    blocks.forEach((b,col)=>{
      b.mesh.setEnabled(!s.dug.includes(col));outlines[col].setEnabled(chosen.includes(col));
      const stage=s.damage[col]?Math.min(5,Math.max(1,Math.ceil(s.damage[col]/hardness(s,col)*5))):0;
      if(stage!==b.stage){b.stage=stage;for(const d of b.decals){d.setEnabled(stage>0);if(stage)d.material=crackMats[stage-1];}}
    });
  }
  function impact(impacts){swing=1;for(const hit of impacts){const b=blocks[hit.col];for(let i=0;i<(hit.broken?12:3);i++){
    const size=hit.broken?.1+Math.random()*.1:.035+Math.random()*.04;
    const m=box('stone chip',b.mesh.position.x+(Math.random()-.5),.7,b.mesh.position.z+(Math.random()-.5),size,size,size,i%3? '#baa783':ORES[hit.ore].color,null,false);
    debris.push({m,v:new Vector3((Math.random()-.5)*3,1+Math.random()*2,(Math.random()-.5)*3),life:hit.broken?.9:.45});
  }}}
  function render(dt,held,phase,player){
    clock+=dt;swing=Math.max(0,swing-dt*6);camera.rotation.set(pitch,yaw,0);
    camera.position.set(player.x,player.y+1.55,player.z);
    const bob=player.moving?Math.sin(clock*12)*.015:0;
    arm.position.set(.32+bob,-.3+Math.abs(bob),.62);
    arm.rotation.x=held?Math.sin(phase*Math.PI)*-.75:arm.rotation.x*Math.max(0,1-dt*10);
    arm.rotation.z=held?Math.sin(phase*Math.PI)*-.15:0;
    for(let i=debris.length-1;i>=0;i--){const p=debris[i];p.life-=dt;if(p.life<=0){p.m.dispose();debris.splice(i,1);continue;}p.v.y-=7*dt;p.m.position.addInPlace(p.v.scale(dt));p.m.rotation.x+=dt*3;p.m.rotation.z+=dt*4;p.m.scaling.setAll(Math.min(1,p.life*4));}
    scene.render();
  }
  const observer=new ResizeObserver(()=>engine.resize());observer.observe(canvas);
  return {
    reset(s){
      for(const p of debris)p.m.dispose();debris.length=0;clock=0;swing=0;
      yaw=0;pitch=.4;camera.rotation.set(pitch,yaw,0);camera.position.set(0,1.29,-3.02);arm.rotation.set(0,0,0);
      build(s);
    },
    cameraAngle:()=>-Math.PI/2-yaw,
    look:(dx,dy)=>{yaw+=dx*.006;pitch=Math.max(-.7,Math.min(1.3,pitch+dy*.005));},
    sync,impact,render,loop:fn=>engine.runRenderLoop(fn),rotate:amount=>{yaw+=amount;},
    pick(clientX,clientY){const r=canvas.getBoundingClientRect();const p=scene.pick(clientX-r.left,clientY-r.top,m=>Number.isInteger(m.metadata?.col));return p?.hit?p.pickedMesh.metadata.col:null;},
    diagnostics(){return {renderer:'WebGL 3D',ready:scene.getFrameId()>2&&scene.getActiveMeshes().length>0,frames:scene.getFrameId(),view:'first-person',cameraPosition:{x:camera.position.x,y:camera.position.y,z:camera.position.z},cameraAngle:yaw,cameraPitch:pitch,crackStages:blocks.map(b=>b.stage),blocks:blocks.map((b,col)=>{const p=Vector3.Project(b.mesh.position.add(new Vector3(0,.7,0)),Matrix.Identity(),scene.getTransformMatrix(),camera.viewport.toGlobal(engine.getRenderWidth(),engine.getRenderHeight()));return {col,visible:b.mesh.isEnabled(),x:p.x/engine.getRenderWidth()*canvas.clientWidth,y:p.y/engine.getRenderHeight()*canvas.clientHeight};})};},
  };
}
