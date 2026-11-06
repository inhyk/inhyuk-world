// Dev-only model viewer (not part of the build): /viewer.html?mod=props/home&fn=buildHome&cam=6,4,8&target=0,1,0&hour=10
// Shows one builder's output under the game's lighting and post-processing. window.__ready = true once drawn.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Engine } from './engine.js';
import { Sky } from './sky.js';
import { mat } from './mat.js';
import { plane } from './geom.js';
import { texReady } from './tex.js';
import '@fontsource/jua';

const q = new URLSearchParams(location.search);
const num = (s, d) => (s ? s.split(',').map(Number) : d);
const engine = new Engine(document.getElementById('c'), { quality: q.get('quality') || 'high' });
const sky = new Sky(engine);
sky.setHour(Number(q.get('hour') ?? 10.5), true);
if (q.get('indoor') === '1') { sky.indoor = 1; sky.applyEnv(); }
const ground = q.get('ground') ?? 'grass';
if (ground !== 'none') {
  const g = new THREE.Mesh(plane(200, 200), mat(ground));
  g.receiveShadow = true;
  g.position.y = -0.002;
  engine.scene.add(g);
}
const info = document.getElementById('info');
const cam = num(q.get('cam'), [6, 4, 8]);
const target = num(q.get('target'), [0, 1, 0]);
engine.camera.position.set(...cam);
engine.camera.fov = Number(q.get('fov') ?? 55);
engine.camera.updateProjectionMatrix();
const controls = new OrbitControls(engine.camera, engine.canvas);
controls.target.set(...target);
controls.update();
sky.focus.set(...target);

async function main() {
  await document.fonts.load('40px Jua').catch(() => {});
  const t0 = performance.now();
  engine.renderer.info.autoReset = false;
  engine.onUpdate(() => engine.renderer.info.reset());
  const mod = await import(/* @vite-ignore */ `./${q.get('mod')}.js`);
  const args = q.get('args') ? JSON.parse(q.get('args')) : undefined;
  const out = await mod[q.get('fn')](args);
  const obj = out.isObject3D ? out : out.group;
  engine.scene.add(obj);
  await texReady(); // texture pixels come from workers
  if (q.get('debug') === '1' && out.colliders) {
    for (const c of out.colliders) {
      const b = new THREE.Box3(new THREE.Vector3(...c.min), new THREE.Vector3(...c.max));
      const h = new THREE.Box3Helper(b, 0xff3366);
      obj.add(h);
    }
    for (const it of out.interactables ?? []) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.08), new THREE.MeshBasicMaterial({ color: 0x33ff88 }));
      s.position.set(...it.pos);
      obj.add(s);
    }
  }
  let draws = 0;
  engine.onUpdate((dt, e) => { sky.update(dt, e); controls.update(); });
  engine.start();
  let frames = 0;
  engine.onUpdate(() => {
    frames++;
    draws = engine.renderer.info.render.calls;
    info.textContent = `${q.get('fn')}  build ${(t0 && (performance.now() - t0)).toFixed(0)}ms  draws ${draws}  tris ${engine.renderer.info.render.triangles}  ${engine.frameMs.toFixed(1)}ms`;
    if (frames === 6) { window.__engine = engine; window.__sky = sky; window.__ready = true; window.__stats = { draws, tris: engine.renderer.info.render.triangles }; }
  }, true);
}
main().catch((e) => { info.textContent = 'ERROR ' + e.message; console.error(e); window.__error = String(e.stack || e); window.__ready = true; });
