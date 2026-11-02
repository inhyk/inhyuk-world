// Viewer smoke test: a few materials on rounded boxes and spheres.
import * as THREE from 'three';
import { mat, paint } from './mat.js';
import { rbox, sphere, put, bake } from './geom.js';
export function swatches() {
  const g = new THREE.Group();
  const names = ['oakFloor', 'bathTile', 'marble', 'carpet', 'fabricBlue', 'brick', 'sidingWhite', 'roof', 'asphalt', 'pavers', 'stone', 'steel', 'leather', 'bark', 'walnut', 'ceramic'];
  names.forEach((n, i) => {
    const x = (i % 4) * 1.4 - 2.1, z = Math.floor(i / 4) * 1.4 - 2.1;
    put(g, rbox(1, 1, 1, 0.08), mat(n), x, 0.5, z);
  });
  put(g, sphere(0.4), paint(0xd23c3c, 0.3, 0, { clearcoat: 1 }), 3.4, 0.4, 0);
  return bake(g);
}
