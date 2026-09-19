import {CHUNK_SIZE,chunkAt,chunkInfo,treasureForChunk} from './core.mjs';

// Coordinates for region addresses are BigInts; rendered positions stay near zero.
// At most nine chunks exist. Disposing a chunk preserves shared material caches.
export class WorldStream {
 constructor({node,box,cyl,parent,makeTreasure}){this.draw={node,box,cyl,parent,makeTreasure};this.chunks=new Map();this.origin={x:0n,z:0n};this.center='';}
 update(x,z){this.updateMany([{x,z}]);}
 updateMany(points){const centers=points.map(p=>({cx:chunkAt(p.x),cz:chunkAt(p.z)}));const center=centers.map(({cx,cz})=>`${this.origin.x+BigInt(cx)},${this.origin.z+BigInt(cz)}`).join(';');if(center===this.center)return;this.center=center;const wanted=new Set();for(const {cx,cz} of centers)for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
 const gx=this.origin.x+BigInt(cx+dx),gz=this.origin.z+BigInt(cz+dz),key=`${gx},${gz}`;if(gx===0n&&gz===0n)continue;wanted.add(key);if(!this.chunks.has(key))this.chunks.set(key,this.build(gx,gz));
 }for(const [key,chunk] of this.chunks)if(!wanted.has(key)){chunk.root.dispose();this.chunks.delete(key);}}

 shift(dx,dz){this.origin.x+=BigInt(dx/CHUNK_SIZE);this.origin.z+=BigInt(dz/CHUNK_SIZE);for(const c of this.chunks.values()){c.root.position.x-=dx;c.root.position.z-=dz;}this.center='';}
 get treasures(){return [...this.chunks.values()].filter(c=>c.treasure).map(c=>({...c.treasure,x:c.treasure.x+c.root.position.x,z:c.treasure.z+c.root.position.z}));}
 get solids(){return [...this.chunks.values()].flatMap(c=>c.solids.map(b=>({...b,x:b.x+c.root.position.x,z:b.z+c.root.position.z})));}
 region(x,z){const gx=this.origin.x+BigInt(chunkAt(x)),gz=this.origin.z+BigInt(chunkAt(z));return {...chunkInfo(gx,gz),x:gx.toString(),z:gz.toString(),central:gx===0n&&gz===0n};}
 build(gx,gz){const {node,box,cyl,parent}=this.draw,root=node(`region ${gx},${gz}`);root.parent=parent;root.position.set(Number(gx-this.origin.x)*CHUNK_SIZE,0,Number(gz-this.origin.z)*CHUNK_SIZE);const info=chunkInfo(gx,gz),solids=[],treasure=treasureForChunk(gx,gz);let rng=info.seed||7919;const random=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;};
 box('terrain',0,-.22,0,240,.4,240,['#abc396','#91b08a','#e3d1a4','#b8c4b0'][info.biome],root);
 for(const v of [-70,0,70]){box('road north',v,.055,0,11,.09,240,'#526969',root);box('road east',0,.065,v,240,.09,11,'#526969',root);for(const d of [-5.7,5.7]){box('edge north',v+d,.105,0,.2,.08,240,'#e4dfbc',root);box('edge east',0,.105,v+d,240,.08,.2,'#e4dfbc',root);}for(let q=-112;q<120;q+=16){box('dash north',v,.12,q,.16,.015,4,'#e9dfb1',root);box('dash east',q,.125,v,4,.015,.16,'#e9dfb1',root);}}
 for(let i=0;i<18;i++){const x=-105+random()*210,z=-105+random()*210;if([-70,0,70].some(v=>Math.abs(x-v)<14||Math.abs(z-v)<14)||Math.hypot(x-12,z-28)<18)continue;
 if(info.biome===3||info.biome===0&&i%3===0){const h=4+random()*15,w=7+random()*5;box('town house',x,h/2,z,w,h,9,['#e1c4a9','#b6ceba','#d6baab'][i%3],root);box('roof',x,h+.15,z,w+.5,.3,9.5,'#f2e5c6',root);for(let y=2;y<h;y+=3){box('glass south',x,y,z-4.51,w*.75,1.2,.035,'#547b80',root);box('glass north',x,y,z+4.51,w*.75,1.2,.035,'#547b80',root);}solids.push({x,z,w,d:9});
 }else if(info.biome===2){cyl('palm trunk',x,2.5,z,.2,5,'#a8926b',root);for(let j=0;j<3;j++){const leaf=box('palm frond',x,5,z,.8,.15,5,'#6f9a76',root);leaf.rotation.y=j*Math.PI/3;}solids.push({x,z,w:1,d:1});
 }else{cyl('tree trunk',x,1,z,.23,2,'#8b8061',root);cyl('pine',x,3,z,2,4.8,i%2?'#699b79':'#507f69',root,0);solids.push({x,z,w:1,d:1});}}
 // Pools stay inside blocks, so the connected road network never ends in water.
 if(info.biome===2){box('lagoon sand',35,.025,35,44,.03,43,'#ede0bb',root);box('lagoon',35,.05,35,35,.03,32,'#7cb9bb',root);solids.push({x:35,z:35,w:35,d:32});}
 if(this.draw.makeTreasure)Object.assign(treasure,this.draw.makeTreasure(treasure,root));
 return {root,solids,info,treasure};
 }
}
