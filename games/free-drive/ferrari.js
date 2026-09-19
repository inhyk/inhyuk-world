import {LoadAssetContainerAsync} from '@babylonjs/core/Loading/sceneLoader';
import {TransformNode} from '@babylonjs/core/Meshes/transformNode';
import {DracoDecoder} from '@babylonjs/core/Meshes/Compression/dracoDecoder';
import {Color3} from '@babylonjs/core/Maths/math.color';
import '@babylonjs/loaders/glTF';

// Serve the model and decoder locally; no third-party runtime requests.
const url=file=>new URL(`models/${file}`,document.baseURI).href;
DracoDecoder.DefaultConfiguration={wasmUrl:url('draco/draco_wasm_wrapper_gltf.js'),wasmBinaryUrl:url('draco/draco_decoder_gltf.wasm'),fallbackUrl:url('draco/draco_decoder_gltf.js'),numWorkers:1};

export function ferrariFactory(scene,shadow,placeholder,notify){
 let pending;
 function load(){
  if(!pending)pending=LoadAssetContainerAsync(url('ferrari.glb'),scene).then(container=>{
   for(const mesh of container.meshes){
    const m=mesh.material;if(!m)continue;
    if(mesh.name==='body'){m.albedoColor=Color3.FromHexString('#30363c');m.metallic=.35;m.roughness=.24;if(m.clearCoat){m.clearCoat.isEnabled=true;m.clearCoat.intensity=1;}}
    if(mesh.name==='glass'){m.albedoColor=Color3.FromHexString('#9eafb5');m.alpha=.38;m.metallic=.1;m.roughness=.12;}
   }
   return container;
  }).catch(error=>{pending=null;throw error;});
  return pending;
 }
 return ()=>{
  const root=new TransformNode('Ferrari 458 Italia',scene);
  root.metadata={wheels:[],modelStatus:'loading'};
  const preview=placeholder();preview.parent=root;
  load().then(container=>{
   if(root.isDisposed())return;
   const instance=container.instantiateModelsToScene(name=>name,false,{doNotInstantiate:true});
   const model=new TransformNode('Ferrari normalized',scene);model.parent=root;
   for(const node of instance.rootNodes)node.parent=model;
   // Measure the unplaced source, not this moving/rotating instance.
   const bounds=container.rootNodes[0].getHierarchyBoundingVectors(true);
   const length=bounds.max.z-bounds.min.z,scale=4.3/length;
   model.scaling.setAll(scale);
   model.rotation.y=Math.PI;
   model.position.set((bounds.min.x+bounds.max.x)*scale/2,-bounds.min.y*scale+.08,(bounds.min.z+bounds.max.z)*scale/2);
   // This asset faces -Z after glTF conversion; driving uses +Z.
   for(const mesh of model.getChildMeshes()){mesh.receiveShadows=true;shadow.addShadowCaster(mesh);}
   preview.dispose();root.metadata.modelStatus='ready';
  }).catch(()=>{if(root.isDisposed())return;root.metadata.modelStatus='error';notify('페라리 모델을 불러오지 못했어요. 상점에서 다시 선택해 주세요.');});
  return root;
 };
}
