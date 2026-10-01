import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
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
import { TIERS, MODELS, padFor } from './core.mjs';

export function createWorld(canvas) {
  const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
  engine.setHardwareScalingLevel(1 / Math.min(devicePixelRatio || 1, 1.5));
  const scene = new Scene(engine);
  scene.clearColor = Color4.FromHexString('#b4bfa4ff');
  scene.ambientColor = Color3.FromHexString('#8f9b7e');
  const camera = new FreeCamera('artisan view', new Vector3(0, 6.8, -10), scene);
  camera.inputs.clear(); camera.minZ = .1; camera.maxZ = 60; camera.fov = .68;
  const target = new Vector3(0, 1.3, 1.1);
  camera.setTarget(target);
  const fill = new HemisphericLight('soft skylight', new Vector3(-.4, 1, -.4), scene);
  fill.intensity = .85; fill.diffuse = Color3.FromHexString('#fff5dc'); fill.groundColor = Color3.FromHexString('#8c957d');
  const sunlight = new DirectionalLight('afternoon sunlight', new Vector3(-.7, -1.5, -.6), scene);
  sunlight.position.set(7, 12, 4); sunlight.intensity = 1.5; sunlight.diffuse = Color3.FromHexString('#fff0ce');
  const shadow = new ShadowGenerator(1024, sunlight);
  shadow.useBlurExponentialShadowMap = true; shadow.blurKernel = 24; shadow.normalBias = .03; shadow.bias = .0005; shadow.setDarkness(.2);
  const materials = new Map();
  function material(color, glow = 0) {
    const key = `${color}:${glow}`;
    if (materials.has(key)) return materials.get(key);
    const m = new StandardMaterial(key, scene);
    m.diffuseColor = Color3.FromHexString(color); m.specularColor = new Color3(.1, .1, .08);
    m.emissiveColor = m.diffuseColor.scale(glow); materials.set(key, m); return m;
  }
  function finish(mesh, x, y, z, color, parent, casts = true) {
    mesh.position.set(x, y, z); mesh.material = material(color); mesh.isPickable = false; mesh.receiveShadows = true;
    if (parent) mesh.parent = parent;
    if (casts) shadow.addShadowCaster(mesh);
    return mesh;
  }
  const box = (name, x, y, z, w, h, d, color, parent, casts) => finish(MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene), x, y, z, color, parent, casts);
  const cylinder = (name, x, y, z, d, h, color, parent, top) => finish(MeshBuilder.CreateCylinder(name, { diameter: d, diameterTop: top ?? d, height: h, tessellation: 32 }, scene), x, y, z, color, parent);
  const sphere = (name, x, y, z, sx, sy, sz, color, parent) => {
    const m = finish(MeshBuilder.CreateSphere(name, { diameter: 1, segments: 16 }, scene), x, y, z, color, parent);
    m.scaling.set(sx, sy, sz); return m;
  };
  function rounded(name, w, h, d, radius, color, parent) {
    const node = new TransformNode(name, scene); if (parent) node.parent = parent;
    box(name, 0, 0, 0, w - radius * 2, h, d, color, node);
    box(name, 0, 0, 0, w, h, d - radius * 2, color, node);
    for (const x of [-1, 1]) for (const z of [-1, 1]) cylinder(name, x * (w / 2 - radius), 0, z * (d / 2 - radius), radius * 2, h, color, node);
    return node;
  }
  function plaque(name, text, x, y, z, w, h, bg, ink, size = 75) {
    const t = new DynamicTexture(name, { width: 1024, height: 256 }, scene, false);
    const ctx = t.getContext(); ctx.fillStyle = bg; ctx.fillRect(0, 0, 1024, 256);
    ctx.font = `500 ${size}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = ink; ctx.fillText(text, 512, 128); t.update();
    const m = new StandardMaterial(name, scene); m.diffuseTexture = t; m.specularColor = Color3.Black(); m.emissiveColor = new Color3(.12, .12, .12);
    const plane = MeshBuilder.CreatePlane(name, { width: w, height: h }, scene); plane.position.set(x, y, z); plane.material = m;
    return plane;
  }
  // A real 3D shop: warm timber, sage plaster, shelves, afternoon window light.
  box('floor', 0, -.75, 0, 26, .16, 24, '#c9bea3');
  box('sage back wall', 0, 2.6, 6, 23, 7, .25, '#b1bea1');
  box('lower wall panel', 0, .65, 5.83, 22, 2.1, .13, '#93a28a');
  box('wall trim', 0, 1.72, 5.69, 22, .1, .1, '#d7dac1');
  for (let i = -10; i <= 10; i++) box('wall panel seam', i * .75, .65, 5.74, .018, 2, .04, '#84967d', null, false);
  box('worktop shadow', -.2, .35, .25, 15, .68, 7.3, '#ad9066');
  box('birch worktop', -.2, .74, .25, 15.2, .19, 7.45, '#d8bc8b');
  box('worktop front edge', -.2, .65, -3.5, 15.2, .14, .08, '#c1a074');
  for (let i = 0; i < 24; i++) box('subtle wood grain', -7.3 + i * .62, .84, .25, .012, .003, 7.35, '#cbae7d', null, false);
  for (let i = 0; i < 7; i++) {
    const grain = box('wood detail', -6 + i * 1.8, .842, (i % 3) * 1.4 - 1.5, .007, .004, 1.2 + (i % 2), '#bfa176', null, false); grain.rotation.y = .03;
  }
  const mat = rounded('cutting mat', 4.55, .028, 3.25, .15, '#567e6c'); mat.position.set(-.55, .86, -.9);
  for (let i = -8; i <= 8; i++) box('mat grid vertical', -.55 + i * .25, .877, -.9, .008, .002, 2.94, '#6e8f77', null, false);
  for (let i = -5; i <= 5; i++) box('mat grid horizontal', -.55, .878, -.9 + i * .25, 4.24, .002, .008, '#6e8f77', null, false);
  box('mat edge', -.55, .88, .58, 4.25, .003, .017, '#a3b39a', null, false);
  // Display shelves and colorful boxed pads.
  for (const y of [2.3, 3.75]) {
    box('floating oak shelf', -4.9, y, 5.27, 4.2, .16, 1.05, '#b89b70');
    for (let i = 0; i < 4; i++) {
      const color = ['#d8bd8b', '#c8cfb0', '#e3d8bd', '#a2b7a2'][i];
      const pack = box('pad packaging', -6.3 + i * .89, y + .43, 5.25, .67, .7, .44, color); pack.rotation.z = (i - 1) * .025;
      box('package paper band', -6.3 + i * .89, y + .43, 5.012, .18, .7, .02, '#eae3ce');
      box('package label', -6.3 + i * .89, y + .49, 4.992, .29, .17, .015, '#72836a');
    }
  }
  plaque('atelier sign', 'PAD ATELIER', -.6, 3.95, 5.77, 4.8, 1.05, '#b1bea1', '#53664f', 94);
  plaque('atelier subtitle', 'H A N D C R A F T E D   W I T H   C A R E', -.6, 3.3, 5.75, 4, .45, '#b1bea1', '#718569', 40);
  // A large mullioned window with a stylized leafy garden outside.
  box('window surround', 4.8, 3.05, 5.7, 4.4, 3.6, .16, '#ece2c9');
  box('window sky', 4.8, 3.05, 5.58, 4.12, 3.33, .04, '#dbe4c9');
  for (let i = 0; i < 8; i++) sphere('garden treetop', 3 + i * .49, 2.1 + Math.sin(i) * .4, 5.48, 1.15, 1.3, .05, i % 2 ? '#afc79b' : '#c2d4a9');
  box('window vertical divider', 4.8, 3.05, 5.36, .09, 3.5, .11, '#e9dfc3');
  box('window horizontal divider', 4.8, 3.1, 5.35, 4.3, .09, .11, '#e9dfc3');
  box('window sill', 4.8, 1.25, 5.27, 4.7, .16, .65, '#d4c49e');
  // Sun patches on the desk, notebook, pencil pot, mug, and a little succulent.
  const patch = box('sunlight on table', 4.6, .845, .9, 3.4, .002, 3.4, '#e2c998', null, false); patch.rotation.y = -.3;
  for (const x of [-1, 1]) { const beam = box('window shadow stripe', 4.6 + x * .77, .85, .9, .035, .003, 3.5, '#c6b181', null, false); beam.rotation.y = -.3; }
  const notebook = rounded('notebook', 1.5, .13, 1.07, .08, '#e9dfc1'); notebook.position.set(-3.6, .93, -1.1); notebook.rotation.y = -.22;
  for (let i = 0; i < 4; i++) box('notebook writing', -.22, .069, -.33 + i * .18, .72 - i * .09, .003, .014, '#a9ac8e', notebook, false);
  box('notebook binding', -.64, .077, 0, .055, .015, .95, '#a3aa8a', notebook);
  const pencil = cylinder('pencil', -3.44, 1.04, -1.19, .055, 1.23, '#d2a45b'); pencil.rotation.z = Math.PI / 2; pencil.rotation.y = .38;
  cylinder('pencil cup', -3.95, 1.15, 1.07, .51, .6, '#c6d0ad');
  for (let i = 0; i < 5; i++) { const p = cylinder('tool in cup', -4.1 + i * .074, 1.5, 1.07 + Math.sin(i) * .09, .045, .75, ['#947c59', '#d1aa6c', '#677d68'][i % 3]); p.rotation.z = (i - 2) * .09; }
  cylinder('cup saucer', 2.55, .88, -.78, .77, .03, '#ece1c5');
  cylinder('tea mug', 2.55, 1.08, -.78, .49, .38, '#e8d6af');
  cylinder('tea', 2.55, 1.274, -.78, .4, .003, '#7c7150');
  const handle = finish(MeshBuilder.CreateTorus('mug handle', { diameter: .32, thickness: .075, tessellation: 24 }, scene), 2.83, 1.09, -.78, '#e8d6af'); handle.rotation.z = Math.PI / 2;
  cylinder('plant pot', 3.15, 1.13, 1.35, .75, .6, '#bb8260', null, .92);
  cylinder('pot soil', 3.15, 1.44, 1.35, .8, .03, '#79664d');
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; const leaf = sphere('succulent leaf', 3.15 + Math.cos(a) * .24, 1.6, 1.35 + Math.sin(a) * .24, .23, .72, .28, i % 2 ? '#789b73' : '#97b088'); leaf.rotation.set(Math.sin(a) * .8, 0, -Math.cos(a) * .8); }
  sphere('succulent center', 3.15, 1.8, 1.35, .32, .56, .32, '#b0c79b');
  // Small brass task lamp.
  cylinder('lamp base', -2.75, .93, 2, .8, .13, '#657566');
  const stem = cylinder('lamp arm', -2.75, 1.65, 2, .065, 1.45, '#a79d70'); stem.rotation.z = -.15;
  const neck = cylinder('lamp top arm', -2.43, 2.28, 1.82, .065, .7, '#a79d70'); neck.rotation.z = -1;
  cylinder('lamp shade', -2.14, 2.22, 1.8, .65, .3, '#71866d', null, .25);
  const bulb = cylinder('warm bulb', -2.14, 2.06, 1.8, .53, .025, '#ffefb6'); bulb.material = material('#ffefb6', .5);
  const deskLight = new PointLight('desk lamp glow', new Vector3(-2.14, 1.94, 1.8), scene); deskLight.diffuse = Color3.FromHexString('#ffe5a0'); deskLight.intensity = .15; deskLight.range = 3;
  // The customer waits on the other side of the counter.
  const customer = new TransformNode('customer', scene); customer.position.set(.35, 0, 3.8);
  const shirt = cylinder('customer sweater', 0, 1.63, 0, 1.15, 1.1, '#c59972', customer, .76);
  cylinder('neck', 0, 2.25, 0, .25, .3, '#edc99f', customer);
  sphere('face', 0, 2.76, -.04, .85, 1, .79, '#edc99f', customer);
  sphere('hair cap', 0, 3.09, .025, .9, .49, .83, '#5d5143', customer);
  sphere('fringe', -.25, 3.03, -.3, .42, .3, .28, '#5d5143', customer);
  for (const side of [-1, 1]) {
    sphere('ear', side * .44, 2.77, -.01, .13, .23, .18, '#edc99f', customer);
    sphere('eye', side * .16, 2.79, -.413, .065, .08, .03, '#443e32', customer);
    sphere('cheek', side * .26, 2.64, -.387, .115, .055, .025, '#daaa8a', customer);
    const arm = cylinder('sleeve', side * .54, 1.75, -.22, .3, .72, '#c59972', customer); arm.rotation.x = .4; arm.rotation.z = side * .26;
    sphere('customer hand', side * .57, 1.4, -.4, .27, .28, .3, '#edc99f', customer);
  }
  box('smile', 0, 2.56, -.391, .13, .026, .021, '#ac795c', customer);
  box('apron', 0, 1.6, -.53, .65, .82, .06, '#dbd7b5', customer);
  // Work-in-progress tablet: a rounded metal body, inset glass, camera and buttons.
  const tablet = new TransformNode('crafted pad', scene); tablet.position.set(-.55, .96, -.88); tablet.rotation.y = -.13;
  const body = rounded('pad metal shell', 3.15, .115, 2.04, .15, '#9aaea4', tablet);
  const bezel = rounded('dark bezel', 3.02, .035, 1.91, .12, '#334940', tablet); bezel.position.y = .065;
  const screenTexture = new DynamicTexture('pad display', { width: 1024, height: 640 }, scene, false);
  const screenMat = new StandardMaterial('lit display glass', scene); screenMat.diffuseTexture = screenTexture; screenMat.emissiveTexture = screenTexture; screenMat.emissiveColor = new Color3(.32, .32, .32); screenMat.specularColor = new Color3(.2, .2, .2);
  const screen = MeshBuilder.CreateGround('pad screen', { width: 2.74, height: 1.72 }, scene); screen.parent = tablet; screen.position.set(-.03, .089, 0); screen.material = screenMat;
  cylinder('front camera', 1.433, .09, 0, .055, .005, '#111f1a', tablet);
  box('volume button', -.8, .01, 1.027, .37, .05, .02, '#cad5c9', tablet);
  const proDetails = new TransformNode('pro stereo speakers', scene); proDetails.parent = tablet;
  for (const side of [-1, 1]) for (let i = 0; i < 6; i++) box('speaker grille', side * .83 + i * .045, .086, -.915, .016, .005, .035, '#bccbbd', proDetails, false);
  const stylus = cylinder('pro drawing stylus', 1.79, .065, 0, .058, 1.8, '#e0dcca', proDetails); stylus.rotation.x = Math.PI / 2;
  const components = new TransformNode('unfinished circuits', scene); components.parent = tablet;
  for (let i = 0; i < 5; i++) { box('gold circuit trace', -.92 + i * .42, .1, 0, .018, .014, 1.22, '#c5b477', components); box('chip', -.85 + i * .38, .11, i % 2 ? .32 : -.24, .24, .03, .3, '#8aaf96', components); }
  const finishShine = box('glass reflection', .72, .094, 0, .23, .002, 1.68, '#b7cfad', tablet, false); finishShine.rotation.y = .25; finishShine.visibility = .08;
  // Both hands are visible, like the original drawing. The right hand holds a pickaxe.
  const leftHand = new TransformNode('left hand', scene); leftHand.position.set(-1.98, 1.08, -2.32); leftHand.rotation.y = -.25;
  const rightHand = new TransformNode('right hand and pickaxe', scene); rightHand.position.set(1.35, 1.23, -2.2); rightHand.rotation.y = .2;
  for (const [hand, side] of [[leftHand, -1], [rightHand, 1]]) {
    const sleeve = box('artisan rolled sleeve', 0, -.02, -.45, .5, .38, .88, '#dfd9bc', hand); sleeve.rotation.x = -.15;
    box('linen cuff', 0, .035, -.045, .52, .38, .18, '#ede5cb', hand);
    sphere('palm', 0, .05, .18, .43, .26, .51, '#e5b78e', hand);
    for (let i = 0; i < 4; i++) sphere('fingers', -.145 + i * .098, .06, .44 + Math.sin(i / 3 * Math.PI) * .055, .102, .18, .3, '#edc69c', hand);
    const thumb = sphere('thumb', side * -.23, .1, .21, .16, .19, .31, '#edc69c', hand); thumb.rotation.y = side * -.4;
  }
  const pick = new TransformNode('pickaxe', scene); pick.parent = rightHand; pick.position.set(0, .25, .28); pick.rotation.set(-.28, 0, -.3);
  cylinder('wooden pick handle', 0, .43, 0, .095, 1.18, '#93754f', pick);
  for (let i = 0; i < 4; i++) cylinder('handle grip', 0, .05 + i * .08, 0, .113, .035, '#c5b484', pick);
  const pickHead = box('pickaxe head', 0, 1, 0, .64, .15, .2, '#a4b2a4', pick); pickHead.rotation.z = -.15;
  const tip = cylinder('pickaxe point', -.47, .91, 0, .16, .47, '#a4b2a4', pick, 0); tip.rotation.z = -1.15;
  const heel = cylinder('pickaxe heel', .38, .96, 0, .16, .32, '#a4b2a4', pick, .06); heel.rotation.z = 1.8;
  const gems = new TransformNode('crystal pickaxe crown', scene); gems.parent = pick;
  const gemMeshes = [];
  for (let i = -1; i <= 1; i++) {
    const gem = finish(MeshBuilder.CreatePolyhedron('cut gemstone', { type: 1, size: .19 }, scene), i * .25, 1.17 + (i === 0 ? .1 : 0), 0, '#b0e9e6', gems);
    gem.scaling.set(.7, i === 0 ? 1.5 : 1, .8); gem.rotation.z = -i * .3; gemMeshes.push(gem);
  }
  const spikes = new TransformNode('elemental pickaxe spikes', scene); spikes.parent = pick;
  const spikeMeshes = [];
  for (let i = 0; i < 5; i++) {
    const spike = finish(MeshBuilder.CreateCylinder('elemental spike', { diameterTop: 0, diameterBottom: .18, height: .35, tessellation: 3 }, scene), (i - 2) * .15, 1.19 + Math.sin(i / 4 * Math.PI) * .1, .015, '#b0def4', spikes);
    spike.rotation.z = (2 - i) * .25; spikeMeshes.push(spike);
  }
  const wings = new TransformNode('dragon pickaxe wings', scene); wings.parent = pick;
  for (const side of [-1, 1]) {
    const wing = finish(MeshBuilder.CreateCylinder('dragon wing blade', { diameterTop: 0, diameterBottom: .48, height: .67, tessellation: 3 }, scene), side * .38, 1.2, .01, '#f1ba74', wings);
    wing.scaling.z = .28; wing.rotation.z = side * -.8;
  }
  const rings = new TransformNode('cosmic pickaxe orbits', scene); rings.parent = pick; rings.position.y = 1.04;
  const ringMeshes = [];
  for (let i = 0; i < 2; i++) {
    const ring = finish(MeshBuilder.CreateTorus('orbital ring', { diameter: .75 + i * .22, thickness: .035, tessellation: 40 }, scene), 0, 0, 0, '#e3d397', rings);
    ring.rotation.set(Math.PI / 2, i * .8, i * .5); ringMeshes.push(ring);
  }
  let time = 0, swing = 0, celebrate = 0, lastTier = -1, lastModel = -1, lastStage = -1, lastCustomer = -1, lastEquipped = -1;
  const particles = [];
  const palettes = [
    ['#c7d6b5','#97b394','#416d5b'], ['#cae6b3','#83bd8c','#326447'], ['#b9ddf3','#80b5d0','#405f8e'],
    ['#f8e5a3','#d8b268','#87622d'], ['#e6cff1','#ba90d0','#6d4c92'], ['#b5eee0','#6ac8c2','#316b85'], ['#f3ccb5','#d88c85','#8d4b61'],
    ['#cceff4','#86cadd','#4e799f'], ['#f2bac9','#ce668b','#742c60'], ['#d7f4ff','#9dd5eb','#4778ac'],
    ['#ffd291','#e78453','#823855'], ['#424e92','#9380c3','#24294e'], ['#f4eac1','#d7b873','#8b789d'],
    ['#453679','#b170c0','#212957'], ['#233f4b','#55b7a7','#151f39'],
    ['#1d2455','#7d8fe8','#0d1233'], ['#fbe3ef','#f2a1c3','#8e5bb8'], ['#16121f','#6d5aa5','#07060c'],
    ['#f6e7b9','#d9b25a','#5b4520'], ['#0b1a2e','#5fc6e6','#f1d7ff'],
  ];
  function paintScreen(tier, model, completed, progress) {
    const c = screenTexture.getContext();
    const colors = palettes[tier];
    const gradient = c.createLinearGradient(0, 0, 1024, 640); gradient.addColorStop(0, colors[0]); gradient.addColorStop(1, colors[2]);
    c.fillStyle = gradient; c.fillRect(0, 0, 1024, 640);
    c.fillStyle = '#f3e8bc'; c.beginPath(); c.arc(780, 182, 82, 0, Math.PI * 2); c.fill();
    for (const [height, color] of [[320, colors[1]], [430, TIERS[tier].color], [530, colors[2]]]) { c.fillStyle = color; c.beginPath(); c.moveTo(0, 640); c.lineTo(0, height); c.bezierCurveTo(260, height - 210, 460, height + 190, 1024, height - 80); c.lineTo(1024, 640); c.fill(); }
    if (tier === 7 || tier === 8 || tier === 9) {
      for (let i = 0; i < 5; i++) { const x = 380 + i * 115, y = 260 + Math.sin(i * 2) * 55; c.fillStyle = i % 2 ? colors[0] : colors[1]; c.beginPath(); c.moveTo(x, y - 100); c.lineTo(x + 60, y); c.lineTo(x, y + 160); c.lineTo(x - 45, y); c.closePath(); c.fill(); c.strokeStyle = '#ffffff70'; c.lineWidth = 3; c.stroke(); }
    } else if (tier === 10) {
      for (let i = 0; i < 5; i++) { const x = 430 + i * 100; c.fillStyle = i % 2 ? '#f8c772' : '#f3a45e'; c.beginPath(); c.moveTo(x - 70, 570); c.bezierCurveTo(x + 60, 440, x - 65, 420, x + 25, 210 + i * 20); c.bezierCurveTo(x + 115, 420, x + 130, 480, x + 70, 570); c.fill(); }
    } else if (tier >= 15) {
      for (let i = 0; i < 80; i++) { c.fillStyle = i % 3 ? '#f2eacd' : '#bdefff'; c.beginPath(); c.arc((i * 193 + 47) % 1024, (i * 137 + 21) % 640, i % 4 === 0 ? 3 : 1.5, 0, Math.PI * 2); c.fill(); }
      if (tier === 15) {
        for (let i = 0; i < 140; i++) { const a = i * .23, r = 12 + i * 1.5; c.fillStyle = i % 2 ? '#c9d2ff' : '#f7e3ff'; c.beginPath(); c.arc(706 + Math.cos(a) * r, 342 + Math.sin(a) * r * .55, 4, 0, Math.PI * 2); c.fill(); }
      } else if (tier === 16) {
        ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#9775fa'].forEach((color, i) => { c.strokeStyle = color; c.lineWidth = 20; c.beginPath(); c.arc(706, 470, 250 - i * 20, Math.PI, 0); c.stroke(); });
      } else if (tier === 17) {
        c.strokeStyle = '#f0a868'; c.lineWidth = 16; c.beginPath(); c.ellipse(706, 342, 230, 70, -.2, 0, Math.PI * 2); c.stroke();
        c.fillStyle = '#000'; c.beginPath(); c.arc(706, 342, 105, 0, Math.PI * 2); c.fill();
      } else if (tier === 18) {
        c.fillStyle = '#fff6d8'; c.beginPath(); c.arc(706, 330, 170, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#8c6a24'; c.lineWidth = 10; c.stroke();
        c.fillStyle = '#8c6a24'; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; c.beginPath(); c.arc(706 + Math.cos(a) * 140, 330 + Math.sin(a) * 140, 8, 0, Math.PI * 2); c.fill(); }
        c.lineWidth = 12; c.beginPath(); c.moveTo(706, 330); c.lineTo(706, 220); c.moveTo(706, 330); c.lineTo(790, 360); c.stroke();
      } else {
        c.lineWidth = 6; ['#f1d7ff', '#5fc6e6', '#ffe6a2'].forEach((color, i) => { c.strokeStyle = color; for (let j = 0; j < 2; j++) { c.beginPath(); c.ellipse(706, 342, 170 + i * 30, 60 + j * 40, i * 1.05 + j * .4, 0, Math.PI * 2); c.stroke(); } });
        c.fillStyle = '#ffffff'; c.font = '140px serif'; c.textAlign = 'center'; c.fillText('∞', 706, 390);
      }
    } else if (tier >= 11) {
      for (let i = 0; i < 60; i++) { c.fillStyle = i % 3 ? '#f2eacd' : '#bdc5fc'; c.beginPath(); c.arc((i * 193 + 47) % 1024, (i * 137 + 21) % 640, i % 4 === 0 ? 3 : 1.5, 0, Math.PI * 2); c.fill(); }
      c.strokeStyle = tier === 12 ? '#ffe6a2' : '#cfbaee'; c.lineWidth = 7;
      for (let i = 0; i < (tier === 14 ? 4 : 2); i++) { c.beginPath(); c.ellipse(706, 342, 190 + i * 26, 80 + i * 9, -.4 + i * .5, 0, Math.PI * 2); c.stroke(); }
      if (tier === 14) { c.fillStyle = '#c7fff0'; c.font = '130px serif'; c.textAlign = 'center'; c.fillText('Ω', 706, 381); }
    }
    c.textAlign = 'left'; c.fillStyle = '#f7f5e1'; c.font = '500 94px sans-serif'; c.fillText(completed ? 'hello.' : `${progress}%`, 67, 158);
    c.font = '500 22px sans-serif'; c.fillText(completed ? 'MADE WITH CARE' : 'A LITTLE WORK IN PROGRESS', 72, 211);
    c.textAlign = 'right'; c.font = '18px sans-serif'; c.fillText(`${TIERS[tier].english} ${['', 'MINI', 'PRO'][model]}`, 962, 589);
    if (model === 2) {
      c.fillStyle = '#ffffff45'; c.fillRect(67, 522, 259, 58);
      for (let i = 0; i < 4; i++) { c.fillStyle = ['#f9e5b6', '#a3d7cf', '#d2b8e7', '#c6d6ec'][i]; c.fillRect(84 + i * 60, 534, 34, 34); }
    }
    screenTexture.update();
  }
  function sync(state) {
    const pad = padFor(state.order), tier = pad.tier, model = pad.model, progress = state.order.progress / pad.work;
    const stage = Math.floor(progress * 10);
    if (tier !== lastTier) { for (const mesh of body.getChildMeshes()) mesh.material = material(TIERS[tier].color); lastTier = tier; lastStage = -1; }
    if (model !== lastModel) { tablet.scaling.set(MODELS[model].width, 1, MODELS[model].depth); proDetails.setEnabled(model === 2); lastModel = model; lastStage = -1; }
    if (stage !== lastStage) { paintScreen(tier, model, progress >= 1, Math.round(progress * 100)); lastStage = stage; }
    screen.setEnabled(progress >= .4); finishShine.setEnabled(progress >= .8); components.setEnabled(progress < .4);
    if (state.equipped !== lastEquipped) {
      const equipped = state.equipped, color = TIERS[equipped].color;
      for (const m of [pickHead, tip, heel, ...gemMeshes, ...spikeMeshes]) m.material = material(color, equipped >= 7 ? .12 : 0);
      for (const m of wings.getChildMeshes()) m.material = material(equipped === 12 ? '#e5d292' : '#f3a16c', .12);
      for (const m of ringMeshes) m.material = material(equipped >= 15 ? color : equipped === 14 ? '#b6f1d8' : '#d8c4f1', .3);
      gems.setEnabled(equipped >= 7); spikes.setEnabled([9, 10, 14, 17, 19].includes(equipped)); wings.setEnabled([10, 12, 16, 19].includes(equipped)); rings.setEnabled(equipped >= 11);
      pickHead.scaling.x = equipped >= 7 ? 1.2 : 1;
      lastEquipped = equipped;
    }
    if (state.order.customer !== lastCustomer) { shirt.material = material(['#c59972', '#8a9e7b', '#8399ab', '#c3aa7b', '#a88b9c', '#9aab91', '#c2927e', '#9fa7c1'][state.order.customer]); lastCustomer = state.order.customer; celebrate = .8; }
  }
  function burst(color, amount) {
    for (let i = 0; i < amount; i++) {
      const mesh = box('craft sparkle', -.55 + (Math.random() - .5) * 1.8, 1.1, -.88 + (Math.random() - .5), .045, .045, .045, color, null, false);
      particles.push({ mesh, life: .5 + Math.random() * .5, vx: (Math.random() - .5) * 2.3, vy: 1.4 + Math.random() * 1.4, vz: (Math.random() - .5) * 1.8 });
    }
  }
  function resize() {
    engine.resize();
    const mobile = canvas.clientWidth < 700;
    camera.position.set(mobile ? -.4 : 0, mobile ? 7.7 : 6.8, mobile ? -12 : -10);
    target.set(mobile ? -.4 : 0, mobile ? 1.2 : 1.3, mobile ? .8 : 1.1); camera.fov = mobile ? .67 : .68; camera.setTarget(target);
    customer.position.x = mobile ? -1 : .35;
  }
  const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
  return {
    sync, loop: fn => engine.runRenderLoop(fn),
    impact(completed) { swing = 1; if (completed) { celebrate = 1.4; burst('#efe2a4', 30); } else burst(TIERS[lastTier].color, 7); },
    sale() { celebrate = 1.5; burst('#e6ba62', 36); },
    render(dt) {
      time += dt; swing = Math.max(0, swing - dt * 4.5); celebrate = Math.max(0, celebrate - dt);
      const stroke = Math.sin(swing * Math.PI);
      rightHand.rotation.x = -.2 - stroke * .65; rightHand.position.y = 1.23 + stroke * .28;
      rightHand.position.z = -2.2 + stroke * .48;
      leftHand.position.y = 1.08 + Math.sin(time * 1.7) * .012;
      tablet.position.y = .96 + stroke * .007;
      if (lastEquipped >= 11) { rings.rotation.y = time * .35; rings.rotation.z = Math.sin(time * .6) * .2; }
      customer.rotation.y = Math.sin(time * .7) * .035;
      customer.position.y = celebrate > 0 ? Math.abs(Math.sin(celebrate * 5)) * .055 : Math.sin(time * 1.5) * .012;
      for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.life -= dt; if (p.life <= 0) { p.mesh.dispose(); particles.splice(i, 1); continue; } p.vy -= 5 * dt; p.mesh.position.addInPlace(new Vector3(p.vx * dt, p.vy * dt, p.vz * dt)); p.mesh.rotation.x += dt * 4; p.mesh.rotation.z += dt * 3; p.mesh.scaling.setAll(Math.min(1, p.life * 3)); }
      scene.render();
    },
    diagnostics: () => ({ renderer: 'WebGL 3D', ready: scene.getFrameId() > 2 && scene.isReady() && scene.getActiveMeshes().length > 0, frames: scene.getFrameId(), meshes: scene.meshes.length, particles: particles.length, hands: 2, toolStyle: TIERS[lastEquipped]?.english, padModel: MODELS[lastModel]?.name, padScale: tablet.scaling.x }),
  };
}
