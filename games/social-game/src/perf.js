// Speed-ups that need the whole world loaded (인혁 계획: "게임을 최적화 해줘"). Called once by main.js
// after the town, Japan and the people are made.
//  - ground, roads and trees never move: their matrices are worked out once (places.freeze)
//  - the fog hides the far island anyway, so it is not drawn from the town (and the other way round)
//  - the AO pass (indoors only) skips the ground, the trees and far buildings
//  - see-through glass is drawn in one pass
import * as THREE from 'three';
import { freeze, singlePassGlass } from './places.js';

export function prepareStatic({ engine, places, world }) {
  const scene = engine.scene;
  const box = new THREE.Box3(), sphere = new THREE.Sphere();
  const noFog = (o) => { let f = false; o.traverse((m) => { if (m.material && (Array.isArray(m.material) ? m.material : [m.material]).some((x) => x.fog === false)) f = true; }); return f; };
  const cullByBounds = (o) => {
    if (noFog(o)) return; // backdrops (Mt Fuji) are meant to show through the fog
    box.setFromObject(o);
    if (box.isEmpty()) return;
    box.getBoundingSphere(sphere);
    places.cullable(o, sphere.center.x, sphere.center.z, sphere.radius);
  };
  // terrain, sea and roads: each big mesh is culled by its own bounds (the foam moves every frame)
  if (world?.root) {
    freeze(world.root, new Set([world.foam].filter(Boolean)));
    for (const o of world.root.children) cullByBounds(o);
    places.aoSkip.push(world.root);
  }
  // trees, bushes, lamps, parked planes: the scattered trees cull themselves by chunks (scatter.js),
  // the groups (street furniture, planes) by their bounds
  for (const name of ['deco', 'japan-deco']) {
    const root = scene.getObjectByName(name);
    if (!root) continue;
    freeze(root);
    for (const o of root.children) if (!o.isInstancedMesh) cullByBounds(o);
    places.aoSkip.push(root);
  }
  engine.aoHide = (cam) => places.aoHide(cam);
  singlePassGlass(scene);
  places.cullFar(engine.camera.position, scene.fog?.density ?? 0.0017);
}
