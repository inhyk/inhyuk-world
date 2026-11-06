// 화면 그리기: 렌더러, 하늘, 빛, 그림자, 재질, 부품(블록) 만들기.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const touchDevice = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

export const SKIES = {
  hub: { top: '#3d8fff', horizon: '#cdeeff', bottom: '#9fd4ff', sun: [0.45, 0.7, 0.3], fog: '#cfeaff', near: 90, far: 420, hemiSky: '#cfe8ff', hemiGround: '#7da35a', sunColor: '#fff3df', sunI: 2.6, hemiI: 1.25, exposure: 1.0 },
  obby: { top: '#6c8dff', horizon: '#ffe0f2', bottom: '#ffd6ec', sun: [0.3, 0.75, -0.4], fog: '#f5dcff', near: 120, far: 520, hemiSky: '#f1e4ff', hemiGround: '#b59ad6', sunColor: '#fff2e4', sunI: 2.5, hemiI: 1.35, exposure: 1.0 },
  tycoon: { top: '#4f9bff', horizon: '#ffeccc', bottom: '#ffe1b0', sun: [-0.5, 0.62, 0.35], fog: '#ffe9cf', near: 100, far: 460, hemiSky: '#fff0d6', hemiGround: '#8ca35f', sunColor: '#ffe8c4', sunI: 2.7, hemiI: 1.15, exposure: 1.0 },
  survival: { top: '#2b1b5e', horizon: '#ff8f6b', bottom: '#5a1a2e', sun: [0.2, 0.32, -0.9], fog: '#7a3a5e', near: 70, far: 300, hemiSky: '#ffb4a0', hemiGround: '#5a2040', sunColor: '#ffc69a', sunI: 2.3, hemiI: 1.1, exposure: 1.05 },
};

export function createView(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, touchDevice ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1200);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  const hemi = new THREE.HemisphereLight('#cfe8ff', '#7da35a', 1.2);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff3df', 2.6);
  sun.castShadow = true;
  const sm = touchDevice ? 1024 : 2048;
  sun.shadow.mapSize.set(sm, sm);
  const S = 42;
  Object.assign(sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 1, far: 260 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);

  const sky = makeSky();
  scene.add(sky.mesh);
  const clouds = makeClouds();
  scene.add(clouds.group);
  scene.fog = new THREE.Fog('#cfeaff', 90, 420);

  let theme = SKIES.hub;
  const sunDir = new THREE.Vector3();
  function setSky(name) {
    theme = SKIES[name] ?? SKIES.hub;
    sky.set(theme);
    scene.fog.color.set(theme.fog); scene.fog.near = theme.near; scene.fog.far = theme.far;
    hemi.color.set(theme.hemiSky); hemi.groundColor.set(theme.hemiGround); hemi.intensity = theme.hemiI;
    sun.color.set(theme.sunColor); sun.intensity = theme.sunI;
    renderer.toneMappingExposure = theme.exposure;
    sunDir.set(...theme.sun).normalize();
    clouds.tint(name === 'survival' ? '#ffc2b0' : '#ffffff', name === 'survival' ? 0.7 : 1);
  }
  setSky('hub');

  // 그림자 카메라를 주인공 근처로 (텍셀 단위로 맞춰서 그림자가 떨리지 않게)
  const snap = (2 * S) / sm;
  function follow(x, y, z) {
    const cx = Math.round(x / snap) * snap, cz = Math.round(z / snap) * snap;
    sun.target.position.set(cx, y, cz);
    sun.position.set(cx + sunDir.x * 120, y + sunDir.y * 120, cz + sunDir.z * 120);
    sky.mesh.position.copy(camera.position);
  }

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < h ? 72 : 62;
    camera.updateProjectionMatrix();
  }
  resize();
  addEventListener('resize', resize);

  return {
    renderer, scene, camera, sun, hemi, setSky, follow, clouds,
    render: () => renderer.render(scene, camera),
    get sunDir() { return sunDir; },
  };
}

function makeSky() {
  const uniforms = {
    top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, bottom: { value: new THREE.Color() },
    sunDir: { value: new THREE.Vector3(0.4, 0.7, 0.3).normalize() },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; uniform vec3 sunDir; varying vec3 vDir;
      void main(){ vec3 d = normalize(vDir); float h = d.y;
        vec3 col = mix(horizon, top, pow(clamp(h,0.0,1.0), 0.55));
        col = mix(col, bottom, smoothstep(0.0, -0.3, h));
        float s = max(dot(d, normalize(sunDir)), 0.0);
        col += vec3(1.0,0.92,0.75) * (pow(s, 900.0) * 6.0 + pow(s, 12.0) * 0.28);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return {
    mesh,
    set(t) {
      uniforms.top.value.set(t.top); uniforms.horizon.value.set(t.horizon); uniforms.bottom.value.set(t.bottom);
      uniforms.sunDir.value.set(...t.sun).normalize();
    },
  };
}

// 몽글몽글 구름: 공 여러 개를 InstancedMesh 하나로
function makeClouds() {
  const group = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(1, 2);
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, metalness: 0, emissive: '#ffffff', emissiveIntensity: 0.18, fog: true });
  const puffs = [];
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let c = 0; c < 26; c++) {
    const a = rnd() * Math.PI * 2, r = 140 + rnd() * 260;
    const cx = Math.cos(a) * r, cz = Math.sin(a) * r, cy = 45 + rnd() * 70;
    const n = 5 + Math.floor(rnd() * 5), s = 6 + rnd() * 7;
    for (let i = 0; i < n; i++) {
      puffs.push([cx + (i - n / 2) * s * 0.75 + rnd() * 3, cy + rnd() * s * 0.4, cz + (rnd() - 0.5) * s * 1.2, s * (0.7 + rnd() * 0.6)]);
    }
  }
  const mesh = new THREE.InstancedMesh(geo, mat, puffs.length);
  const m = new THREE.Matrix4();
  puffs.forEach(([x, y, z, s], i) => { m.makeScale(s, s * 0.72, s); m.setPosition(x, y, z); mesh.setMatrixAt(i, m); });
  mesh.frustumCulled = false;
  group.add(mesh);
  return {
    group,
    update(dt) { group.rotation.y += dt * 0.004; },
    tint(color, op) { mat.color.set(color); mat.emissive.set(color); mat.opacity = op; mat.transparent = op < 1; },
  };
}

// ───────────── 재질과 무늬 ─────────────

function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

function noise(g, w, h, base, spread, n = 2600, size = 3) {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) {
    const v = (Math.random() - 0.5) * spread;
    g.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`;
    g.fillRect(Math.random() * w, Math.random() * h, size * (0.5 + Math.random()), size * (0.5 + Math.random()));
  }
}

const texCache = new Map();
export function tex(name) {
  if (texCache.has(name)) return texCache.get(name);
  let t;
  if (name === 'grass') t = canvasTex(256, 256, (g, w, h) => {
    noise(g, w, h, '#ffffff', 0.16, 3000, 4);
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(40,90,20,${Math.random() * 0.12})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 7); }
  });
  else if (name === 'stone') t = canvasTex(256, 256, (g, w, h) => {
    noise(g, w, h, '#ffffff', 0.08, 1800, 3);
    g.strokeStyle = 'rgba(70,60,50,0.28)'; g.lineWidth = 4;
    for (let y = 0; y <= h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    for (let y = 0; y < h; y += 64) for (let x = (y / 64) % 2 ? 32 : 0; x <= w; x += 64) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 64); g.stroke(); }
  });
  else if (name === 'wood') t = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) { g.fillStyle = `rgba(90,50,20,${0.05 + Math.abs(Math.sin(y * 0.09)) * 0.1})`; g.fillRect(0, y, w, 2); }
    g.fillStyle = 'rgba(60,30,10,0.35)'; for (let y = 0; y < h; y += 64) g.fillRect(0, y, w, 3);
  });
  else if (name === 'sand') t = canvasTex(128, 128, (g, w, h) => noise(g, w, h, '#ffffff', 0.12, 1600, 2));
  else if (name === 'plastic') t = canvasTex(128, 128, (g, w, h) => noise(g, w, h, '#ffffff', 0.05, 700, 3));
  else if (name === 'arrow') t = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#3a3f4b'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2a2e38'; for (let x = 0; x < w; x += 16) g.fillRect(x, 0, 6, h);
    g.fillStyle = '#ffd23f';
    for (const y of [16, 80]) { g.beginPath(); g.moveTo(40, y + 36); g.lineTo(64, y); g.lineTo(88, y + 36); g.lineTo(74, y + 36); g.lineTo(64, y + 20); g.lineTo(54, y + 36); g.closePath(); g.fill(); }
  });
  else if (name === 'water') t = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#8080ff'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { g.strokeStyle = `rgba(${150 + Math.random() * 60},128,255,0.5)`; g.lineWidth = 2 + Math.random() * 3; g.beginPath(); const x = Math.random() * w, y = Math.random() * h; g.arc(x, y, 6 + Math.random() * 20, 0, Math.PI); g.stroke(); }
  });
  else if (name === 'lava') t = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#ff5a1f'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,${180 + Math.random() * 70},60,${0.3 + Math.random() * 0.5})`; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 4 + Math.random() * 16, 0, 7); g.fill(); }
    for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(160,30,0,0.45)'; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 3 + Math.random() * 9, 0, 7); g.fill(); }
  });
  else if (name === 'stripes') t = canvasTex(128, 128, (g, w, h) => {
    for (let x = 0; x < w; x += 32) { g.fillStyle = (x / 32) % 2 ? '#ffffff' : '#ff5e7e'; g.fillRect(x, 0, 32, h); }
  });
  else if (name === 'checker') t = canvasTex(128, 128, g => {
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#ffffff' : '#20232b'; g.fillRect(x * 16, y * 16, 16, 16); }
  });
  texCache.set(name, t);
  return t;
}

const matCache = new Map();
export const animated = { lava: [], conveyor: [], neon: [], water: [] };
// 재질 이름: 기본은 플라스틱. k(종류) 나 m(재질) 로 바꾼다.
export function material(color, m = 'plastic') {
  const key = `${m}|${color}`;
  if (matCache.has(key)) return matCache.get(key);
  let mat;
  const c = new THREE.Color(color);
  switch (m) {
    case 'lava': {
      const map = tex('lava').clone(); map.needsUpdate = true; map.repeat.set(0.25, 0.25);
      mat = new THREE.MeshStandardMaterial({ color: '#ffffff', map, emissive: '#ff4a10', emissiveMap: map, emissiveIntensity: 1.2, roughness: 0.6 });
      animated.lava.push(mat); break;
    }
    case 'neon': mat = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.1, roughness: 0.3 }); animated.neon.push(mat); break;
    case 'glass': mat = new THREE.MeshStandardMaterial({ color: c, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.32, depthWrite: false }); break;
    case 'ice': mat = new THREE.MeshStandardMaterial({ color: c, roughness: 0.04, metalness: 0.05, transparent: true, opacity: 0.85, envMapIntensity: 1.6 }); break;
    case 'metal': mat = new THREE.MeshStandardMaterial({ color: c, roughness: 0.28, metalness: 0.75 }); break;
    case 'gold': mat = new THREE.MeshStandardMaterial({ color: c, roughness: 0.25, metalness: 0.75, envMapIntensity: 1.6, emissive: '#8a5a00', emissiveIntensity: 0.35 }); break;
    case 'grass': { const map = tex('grass'); mat = new THREE.MeshStandardMaterial({ color: c, map, roughness: 0.92 }); break; }
    case 'stone': mat = new THREE.MeshStandardMaterial({ color: c, map: tex('stone'), roughness: 0.85 }); break;
    case 'wood': mat = new THREE.MeshStandardMaterial({ color: c, map: tex('wood'), roughness: 0.75 }); break;
    case 'sand': mat = new THREE.MeshStandardMaterial({ color: c, map: tex('sand'), roughness: 0.95 }); break;
    case 'water': {
      const map = tex('water').clone(); map.needsUpdate = true; map.repeat.set(30, 30);
      mat = new THREE.MeshStandardMaterial({ color: c, roughness: 0.08, metalness: 0.1, normalMap: map, normalScale: new THREE.Vector2(0.35, 0.35), transparent: true, opacity: 0.88, envMapIntensity: 1.3 });
      animated.water.push(mat); break;
    }
    case 'conveyor': mat = new THREE.MeshStandardMaterial({ color: '#ffffff', map: tex('arrow'), roughness: 0.6 }); animated.conveyor.push(mat); break;
    case 'stripes': mat = new THREE.MeshStandardMaterial({ color: c, map: tex('stripes'), roughness: 0.6 }); break;
    case 'checker': mat = new THREE.MeshStandardMaterial({ color: c, map: tex('checker'), roughness: 0.5 }); break;
    case 'cloud': mat = new THREE.MeshStandardMaterial({ color: c, roughness: 1, emissive: c, emissiveIntensity: 0.12 }); break;
    case 'matte': mat = new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }); break;
    default: mat = new THREE.MeshStandardMaterial({ color: c, map: tex('plastic'), roughness: 0.42, metalness: 0 });
  }
  matCache.set(key, mat);
  return mat;
}

// 부품 종류 → 기본 재질
const KIND_MAT = { kill: 'lava', ice: 'ice', conveyor: 'conveyor', glass: 'glass', check: 'plastic', bounce: 'neon' };

const geoCache = new Map();
function partGeometry(p) {
  const shape = p.shape ?? 'box';
  const conv = p.k === 'conveyor' || p.m === 'conveyor';
  const key = `${shape}|${p.w}|${p.h}|${p.d}|${p.w2 ?? ''}|${p.round ?? ''}|${p.m ?? ''}|${conv ? Math.sign(p.cv?.[0] ?? 0) + ',' + Math.sign(p.cv?.[1] ?? 0) : ''}`;
  if (geoCache.has(key)) return geoCache.get(key);
  let g;
  if (shape === 'cyl') g = new THREE.CylinderGeometry(p.w / 2, (p.w2 ?? p.w) / 2, p.h, 20);
  else if (shape === 'cone') g = new THREE.ConeGeometry(p.w / 2, p.h, 20);
  else if (shape === 'sphere') { g = new THREE.SphereGeometry(0.5, 20, 14); g.scale(p.w, p.h, p.d); }
  else {
    const min = Math.min(p.w, p.h, p.d);
    const r = p.round ?? Math.min(0.14, min * 0.22);
    g = r > 0.005 ? new RoundedBoxGeometry(p.w, p.h, p.d, 2, r) : new THREE.BoxGeometry(p.w, p.h, p.d);
    if (conv) {
      // 벨트 무늬가 움직이는 쪽으로 반복되게 윗면 UV 를 늘린다 (화살표가 미는 쪽을 가리킨다)
      const uv = g.attributes.uv, n = g.attributes.normal, pos = g.attributes.position;
      const cx = p.cv?.[0] ?? 0, cz = p.cv?.[1] ?? 0;
      const along = Math.abs(cx) > Math.abs(cz) ? 'x' : 'z';
      const sign = Math.sign(along === 'x' ? cx : cz) || 1;
      for (let i = 0; i < uv.count; i++) {
        if (n.getY(i) > 0.5) {
          const u = along === 'x' ? (pos.getZ(i) / p.d + 0.5) : (pos.getX(i) / p.w + 0.5);
          const v = (along === 'x' ? pos.getX(i) : pos.getZ(i)) * sign / 2;
          uv.setXY(i, u, v);
        }
      }
    } else if (p.m === 'grass' || p.m === 'stone' || p.m === 'sand' || p.m === 'wood') {
      // 큰 바닥은 무늬를 4칸마다 한 번 반복
      const uv = g.attributes.uv, pos = g.attributes.position, n = g.attributes.normal;
      const s = p.m === 'wood' ? 3 : 6;
      for (let i = 0; i < uv.count; i++) {
        const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
        if (ay > 0.5) uv.setXY(i, pos.getX(i) / s, pos.getZ(i) / s);
        else if (ax > 0.5) uv.setXY(i, pos.getZ(i) / s, pos.getY(i) / s);
        else uv.setXY(i, pos.getX(i) / s, pos.getY(i) / s);
      }
    }
  }
  geoCache.set(key, g);
  return g;
}

export function partMaterial(p) {
  return material(p.c ?? '#cccccc', p.m ?? KIND_MAT[p.k] ?? 'plastic');
}

// 부품 하나 → Mesh
export function partMesh(p) {
  const mesh = new THREE.Mesh(partGeometry(p), partMaterial(p));
  mesh.position.set(p.x, p.y, p.z);
  mesh.rotation.order = 'YXZ';
  mesh.rotation.set(p.rx ?? 0, p.ry ?? 0, p.rz ?? 0);
  const glassy = p.k === 'glass' || p.m === 'glass';
  mesh.castShadow = p.shadow !== false && !glassy && p.k !== 'kill';
  mesh.receiveShadow = true;
  return mesh;
}

// 안 움직이는 부품은 재질별로 합쳐 그리기 횟수를 줄인다.
export function buildStatic(parts) {
  const groups = new Map();
  const tmp = new THREE.Object3D();
  tmp.rotation.order = 'YXZ';
  for (const p of parts) {
    if (p.hidden) continue;
    const mat = partMaterial(p);
    const geo = partGeometry(p).clone();
    tmp.position.set(p.x, p.y, p.z);
    tmp.rotation.set(p.rx ?? 0, p.ry ?? 0, p.rz ?? 0);
    tmp.updateMatrix();
    geo.applyMatrix4(tmp.matrix);
    for (const name of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(name)) geo.deleteAttribute(name);
    if (!geo.index) geo.setIndex([...Array(geo.attributes.position.count).keys()]);
    const shadow = p.shadow !== false && p.k !== 'kill' && p.k !== 'glass' && p.m !== 'glass';
    const key = `${mat.uuid}|${shadow}`;
    if (!groups.has(key)) groups.set(key, { mat, shadow, geos: [] });
    groups.get(key).geos.push(geo);
  }
  const group = new THREE.Group();
  for (const { mat, shadow, geos } of groups.values()) {
    const merged = mergeGeometries(geos, false);
    geos.forEach(g => g.dispose());
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = shadow; mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

export function disposeGroup(group) {
  group.traverse(o => {
    if (o.isMesh && o.geometry && !o.userData.sharedGeo) {
      let shared = false;
      for (const g of geoCache.values()) if (g === o.geometry) { shared = true; break; }
      if (!shared) o.geometry.dispose();
    }
    if (o.material?.userData?.own) { o.material.map?.dispose(); o.material.dispose(); }
    if (o.isSprite && o.material) { o.material.map?.dispose(); o.material.dispose(); }
  });
}

// 글자 표지판 (캔버스 → 평면)
export function signMesh(lines, { w = 6, h = 2.2, bg = '#ffffff', fg = '#22252e', accent = null, font = 'Jua', sizes = [] } = {}) {
  const scale = 128;
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale); c.height = Math.round(h * scale);
  const g = c.getContext('2d');
  const r = 0.28 * scale;
  g.fillStyle = bg;
  g.beginPath(); g.roundRect(0, 0, c.width, c.height, r); g.fill();
  if (accent) { g.fillStyle = accent; g.beginPath(); g.roundRect(0, 0, c.width, c.height * 0.12, [r, r, 0, 0]); g.fill(); }
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  const n = lines.length;
  lines.forEach((line, i) => {
    const rowH = (c.height * (accent ? 0.88 : 1)) / n;
    const size = sizes[i] ?? Math.min(rowH * (i === 0 ? 0.66 : 0.52), (i === 0 ? 0.7 : 0.42) * scale);
    g.font = `${size}px ${font}, "Apple SD Gothic Neo", sans-serif`;
    const y = c.height * ((i + 0.5) / n) + (accent ? c.height * 0.05 : 0);
    g.fillText(line, c.width / 2, y, c.width * 0.92);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const mat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.25 });
  mat.userData.own = true;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.userData.disposeMap = t;
  return mesh;
}

export { THREE };

// 늘 카메라를 보는 글자 (값이 바뀌면 set 으로 다시 그린다)
export function textSprite(text, { bg = 'rgba(20,22,30,0.78)', fg = '#ffffff', size = 46, scale = 0.011, sub = '', subColor = '#ffe066' } = {}) {
  const c = document.createElement('canvas');
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.center.set(0.5, 0);
  sprite.userData.set = (txt, s2 = sub, colors = {}) => {
    const g = c.getContext('2d');
    const font = `${size}px Jua, "Apple SD Gothic Neo", sans-serif`;
    const subFont = `${Math.round(size * 0.78)}px Jua, "Apple SD Gothic Neo", sans-serif`;
    g.font = font;
    let w = g.measureText(txt).width;
    if (s2) { g.font = subFont; w = Math.max(w, g.measureText(s2).width); }
    const pad = size * 0.45;
    const nw = Math.ceil(w + pad * 2), nh = Math.ceil(size * (s2 ? 2.2 : 1.35) + pad * 0.4);
    if ((nw !== c.width || nh !== c.height) && t.version > 0) t.dispose(); // 크기가 바뀌면 GPU 쪽 그림을 새로 만든다
    c.width = nw; c.height = nh;
    g.fillStyle = colors.bg ?? bg;
    g.beginPath(); g.roundRect(0, 0, c.width, c.height, size * 0.45); g.fill();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = font; g.fillStyle = colors.fg ?? fg;
    g.fillText(txt, c.width / 2, s2 ? c.height * 0.33 : c.height / 2 + 2);
    if (s2) { g.font = subFont; g.fillStyle = colors.sub ?? subColor; g.fillText(s2, c.width / 2, c.height * 0.72); }
    t.needsUpdate = true;
    sprite.scale.set(c.width * scale, c.height * scale, 1);
  };
  sprite.userData.set(text, sub);
  sprite.userData.disposeMap = t;
  return sprite;
}
