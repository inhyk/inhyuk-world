import { Engine } from "@babylonjs/core/Engines/engine.js";
import { Scene } from "@babylonjs/core/scene.js";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera.js";
import { Vector3, Color3, Color4 } from "@babylonjs/core/Maths/math.js";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight.js";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight.js";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture.js";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode.js";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder.js";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder.js";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder.js";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder.js";
import { CreateTorus } from "@babylonjs/core/Meshes/Builders/torusBuilder.js";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder.js";
import { CreateLines } from "@babylonjs/core/Meshes/Builders/linesBuilder.js";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent.js";
import { WALLS, SITE } from "./core.mjs";

export function createWorld(canvas, touch) {
  const engine = new Engine(canvas, true, { stencil: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
  engine.setHardwareScalingLevel(Math.max(1, window.devicePixelRatio / (touch ? 1 : 1.5)));
  const scene = new Scene(engine);
  scene.clearColor = Color4.FromHexString("#c9e0e7ff");
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogColor = Color3.FromHexString("#c9dce0");
  scene.fogDensity = 0.009;
  scene.ambientColor = new Color3(0.18, 0.2, 0.24);
  const camera = new UniversalCamera("operator", new Vector3(23, 20, -28), scene);
  camera.inputs.clear();
  camera.minZ = 0.04;
  camera.maxZ = 220;
  camera.fov = 1.2;
  camera.setTarget(new Vector3(-1, 1, 5));
  const sky = new HemisphericLight("sky", new Vector3(0, 1, 0), scene);
  sky.intensity = 0.72;
  sky.groundColor = Color3.FromHexString("#718d98");
  const sun = new DirectionalLight("afternoon", new Vector3(-0.65, -1, 0.45), scene);
  sun.position = new Vector3(20, 35, -25);
  sun.intensity = 0.95;
  sun.diffuse = Color3.FromHexString("#fff0d9");
  sun.shadowMinZ = 1;
  sun.shadowMaxZ = 85;
  const shadow = new ShadowGenerator(touch ? 512 : 2048, sun);
  shadow.usePercentageCloserFiltering = true;
  shadow.bias = 0.003;
  shadow.normalBias = 0.09;
  shadow.filteringQuality = ShadowGenerator.QUALITY_LOW;
  shadow.setDarkness(0.28);
  const materials = {};
  function material(name, hex, emissive = 0) {
    const m = new StandardMaterial(name, scene);
    m.diffuseColor = Color3.FromHexString(hex);
    m.specularColor = new Color3(0.07, 0.07, 0.07);
    if (emissive) m.emissiveColor = m.diffuseColor.scale(emissive);
    materials[name] = m;
    return m;
  }
  const m = {
    ground: material("pale sandstone", "#b9b6a2"), ivory: material("warm plaster", "#dad6bc"),
    peach: material("coral stucco", "#c9957d"), sage: material("sage plaster", "#6e9a92"),
    roof: material("terracotta", "#986f62"), trim: material("cream trim", "#e7e1c8"),
    boundary: material("perimeter", "#a6b3a6"), dark: material("recesses", "#273e46"),
    crate: material("radionite steel", "#43736c"), edge: material("crate frames", "#263f43"),
    glow: material("radionite mint", "#80f6c4", 0.6), road: material("flagstones", "#959c91"),
    leaf: material("leaf", "#668e64"), leafLight: material("sunny leaf", "#91a977"),
    trunk: material("tree bark", "#766957"), red: material("defender signal", "#fc5262", 0.3),
    black: material("carbon fiber", "#14232e"), metal: material("gun metal", "#3a4d58"),
    lightMetal: material("milled metal", "#7b9398"), sleeve: material("operator sleeve", "#286575"),
    glove: material("tactical gloves", "#233d46"), gold: material("hazard marking", "#e3be7c", 0.1),
    robot: material("defender armor", "#465564"), visor: material("visor", "#ff5265", 1.1),
  };
  function finish(mesh, mat, parent, cast = true) {
    mesh.material = mat;
    mesh.receiveShadows = true;
    mesh.isPickable = false;
    if (parent) mesh.parent = parent;
    if (cast) shadow.addShadowCaster(mesh);
    return mesh;
  }
  function box(name, x, y, z, w, h, d, mat, parent, cast = true) {
    const mesh = CreateBox(name, { width: w, height: h, depth: d }, scene);
    mesh.position.set(x, y, z);
    return finish(mesh, mat, parent, cast);
  }
  function cylinder(name, x, y, z, height, diameter, mat, parent, tessellation = 12, top) {
    const mesh = CreateCylinder(name, { height, diameter, diameterTop: top ?? diameter, tessellation }, scene);
    mesh.position.set(x, y, z);
    return finish(mesh, mat, parent);
  }
  function sphere(name, x, y, z, size, mat, parent, segments = 5) {
    const mesh = CreateSphere(name, { diameter: size, segments }, scene);
    mesh.position.set(x, y, z);
    return finish(mesh, mat, parent);
  }
  function line(name, points, color) {
    const mesh = CreateLines(name, { points: points.map(p => new Vector3(...p)) }, scene);
    mesh.color = Color3.FromHexString(color);
    mesh.isPickable = false;
    return mesh;
  }
  function sign(text, x, y, z, width, height, color = "#d7e3cd", background = "#324e51", rotation = Math.PI) {
    const texture = new DynamicTexture(`sign ${text}`, { width: 1024, height: 512 }, scene, false);
    const ctx = texture.getContext();
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, 1024, 512);
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.font = "bold 210px Arial";
    ctx.fillText(text, 512, 300);
    ctx.globalAlpha = 0.45;
    ctx.fillRect(70, 375, 884, 4);
    ctx.font = "35px monospace";
    ctx.fillText("H A R B O R   / /   S E C T O R  0 1", 512, 444);
    texture.update();
    const mat = new StandardMaterial(`type ${text}`, scene);
    mat.diffuseTexture = texture;
    mat.specularColor = Color3.Black();
    const plane = CreatePlane(`sign ${text}`, { width, height }, scene);
    plane.position.set(x, y, z);
    plane.rotation.y = rotation;
    plane.material = mat;
    plane.isPickable = false;
    return plane;
  }

  const ground = CreateGround("harbor plaza", { width: 160, height: 160 }, scene);
  finish(ground, m.ground, null, false);
  const texture = new DynamicTexture("sandstone pattern", 1024, scene, false);
  const ctx = texture.getContext();
  ctx.fillStyle = "#b9b6a2";
  ctx.fillRect(0, 0, 1024, 1024);
  for (let row = 0; row < 16; row++) for (let col = 0; col < 8; col++) {
    ctx.fillStyle = `rgba(255,248,227,${((row * 17 + col * 13) % 9) / 70})`;
    ctx.fillRect(col * 128 + (row % 2) * 64, row * 64, 126, 62);
    ctx.strokeStyle = "#91998548";
    ctx.strokeRect(col * 128 + (row % 2) * 64, row * 64, 128, 64);
  }
  texture.update();
  texture.uScale = 16;
  texture.vScale = 16;
  m.ground.diffuseTexture = texture;
  box("central paved lane", 0, 0.012, -11, 12, 0.024, 23, m.road, null, false);
  for (let z = -21; z < 21; z += 2) {
    box("left drainage", -7.8, 0.025, z, 0.16, 0.03, 1.85, m.trim, null, false);
    box("right drainage", 8.3, 0.025, z, 0.16, 0.03, 1.85, m.trim, null, false);
  }
  for (let z = -19; z < -7; z += 2) box("road stripe", 0, 0.035, z, 0.1, 0.02, 0.8, m.trim, null, false);

  WALLS.forEach((w, index) => {
    box(`cover ${index}`, w.x, w.h / 2, w.z, w.w, w.h, w.d, m[w.style]);
    if (w.style === "crate") {
      for (const dx of [-1, 1]) for (const dz of [-1, 1]) {
        box("reinforced corner", w.x + dx * (w.w / 2 - 0.08), w.h / 2, w.z + dz * (w.d / 2 - 0.08), 0.16, w.h + 0.05, 0.16, m.edge);
      }
      box("crate top frame", w.x, w.h, w.z, w.w + 0.06, 0.12, w.d + 0.06, m.edge);
      box("crate bottom frame", w.x, 0.1, w.z, w.w + 0.06, 0.18, w.d + 0.06, m.edge);
      for (const dz of [-1, 1]) {
        box("luminous crate panel", w.x, w.h / 2, w.z + dz * (w.d / 2 + 0.005), w.w - 0.4, w.h - 0.5, 0.02, m.glow, null, false);
        for (const slope of [-1, 1]) {
          const brace = box("cross brace", w.x, w.h / 2, w.z + dz * (w.d / 2 + 0.04), 0.14, Math.hypot(w.w - 0.4, w.h - 0.5), 0.1, m.edge);
          brace.rotation.z = slope * Math.atan2(w.w - 0.4, w.h - 0.5);
        }
      }
      for (const dx of [-1, 1]) box("side energy stripe", w.x + dx * (w.w / 2 + 0.01), w.h / 2, w.z, 0.03, 0.15, w.d - 0.4, m.glow);
    } else if (w.style !== "boundary") {
      box("building cornice", w.x, w.h + 0.07, w.z, w.w + 0.4, 0.24, w.d + 0.4, m.trim);
      box("building plinth", w.x, 0.25, w.z, w.w + 0.13, 0.5, w.d + 0.13, m.boundary);
      if (w.h > 6) {
        box("rooftop parapet", w.x, w.h + 0.35, w.z + w.d / 2, w.w, 0.6, 0.22, m[w.style]);
        box("rooftop return", w.x - w.w / 2, w.h + 0.35, w.z, 0.22, 0.6, w.d, m[w.style]);
        for (let dx = -w.w / 2 + 1.2; dx < w.w / 2; dx += 2.1) {
          for (const dz of [-1, 1]) {
            box("window recess", w.x + dx, 4.8, w.z + dz * (w.d / 2 + 0.02), 0.94, 1.7, 0.07, m.dark, null, false);
            box("shutter", w.x + dx + 0.55, 4.8, w.z + dz * (w.d / 2 + 0.1), 0.25, 1.75, 0.09, m.sage);
            box("window sill", w.x + dx, 3.92, w.z + dz * (w.d / 2 + 0.12), 1.2, 0.13, 0.27, m.trim);
          }
        }
        const inward = w.x < 0 ? 1 : -1;
        for (let dz = -w.d / 2 + 1.5; dz < w.d / 2; dz += 3) {
          box("alley window", w.x + inward * (w.w / 2 + 0.015), 5.1, w.z + dz, 0.05, 1.8, 1.1, m.dark, null, false);
          box("alley sill", w.x + inward * (w.w / 2 + 0.15), 4.15, w.z + dz, 0.4, 0.15, 1.3, m.trim);
          const awning = box("sunshade", w.x + inward * (w.w / 2 + 0.5), 3.65, w.z + dz, 1.2, 0.12, 1.8, m.roof);
          awning.rotation.z = inward * 0.15;
        }
        cylinder("rooftop vent", w.x, w.h + 0.8, w.z, 1.5, 0.65, m.dark);
      }
    }
  });

  // Layered facades and a central gate frame the objective without blocking lanes.
  box("site gate left", -4.5, 3, 22.3, 3.8, 6, 0.8, m.peach);
  box("site gate right", 4.5, 3, 22.3, 3.8, 6, 0.8, m.peach);
  box("site gate lintel", 0, 6, 22.3, 12.8, 1.5, 1, m.peach);
  box("gate shadow", 0, 2.5, 22.95, 5.4, 5, 0.1, m.dark);
  for (let x = -2.4; x <= 2.4; x += 0.6) box("gate bars", x, 2.5, 22.65, 0.08, 5, 0.09, m.lightMetal);
  sign("HARBOR", 0, 6.25, 21.76, 7.3, 2.4, "#f1e3bc", "#976b5d", 0);
  sign("A", -5.7, 2.0, 0.48, 2.2, 1.9, "#e0e8ca", "#6a8c81", 0);
  sign("01", 12, 2, -17.52, 2.5, 1.8, "#487777", "#c9cbb3", 0);
  sign("港", -13, 2, -16.04, 2.5, 2, "#e9d7b8", "#ad7963", 0);
  const siteMat = material("site floor", "#6f928b");
  box("site platform", SITE.x, 0.025, SITE.z, 7, 0.04, 7, siteMat, null, false);
  for (const side of [-1, 1]) {
    box("site border", side * 3.5, 0.06, SITE.z, 0.07, 0.03, 7, m.glow, null, false);
    box("site border", 0, 0.06, SITE.z + side * 3.5, 7, 0.03, 0.07, m.glow, null, false);
  }
  const siteLetter = sign("A", 0, 0.065, SITE.z, 3, 3, "#c6d9c0", "#6f928b");
  siteLetter.rotation.set(Math.PI / 2, 0, 0);
  for (let x = -3; x <= 3; x += 0.6) {
    const stripe = box("hazard stripe", x, 0.06, 8.25, 0.25, 0.02, 0.5, m.gold, null, false);
    stripe.rotation.y = -0.45;
  }
  const marker = CreateTorus("site hologram", { diameter: 1.3, thickness: 0.027, tessellation: 40 }, scene);
  marker.position.set(0, 3.8, SITE.z);
  marker.rotation.x = Math.PI / 2;
  finish(marker, m.glow, null, false);
  const diamond = box("hologram diamond", 0, 3.8, SITE.z, 0.45, 0.45, 0.45, m.glow, null, false);
  diamond.rotation.z = Math.PI / 4;

  function tree(x, z, scale = 1) {
    cylinder("cypress trunk", x, 1.4 * scale, z, 2.8 * scale, 0.28 * scale, m.trunk);
    for (let i = 0; i < 3; i++) {
      cylinder("cypress canopy", x, (2.5 + i * 0.75) * scale, z, 2.8 * scale, (2 - i * 0.35) * scale, i % 2 ? m.leafLight : m.leaf, null, 7, 0.05);
    }
  }
  for (const [x, z, scale] of [[-18, 19, 1.3], [18, 19, 1.2], [-18, 0, 1], [18, -1, 1.3], [-17, -21, 0.8], [17, -21, 0.9]]) tree(x, z, scale);
  for (const [x, z] of [[-8.2, -3], [8.7, -4], [-9.5, 15], [9.4, 14]]) {
    cylinder("planter", x, 0.3, z, 0.6, 0.9, m.roof, null, 8);
    sphere("rosemary", x, 0.8, z, 1.05, m.leaf, null, 4);
  }
  for (let i = 0; i < 18; i++) {
    const x = -62 + i * 7, z = 40 + (i % 3) * 8;
    const h = 10 + (i * 7 % 11);
    box("distant town", x, h / 2 - 1, z, 6, h, 8, i % 2 ? m.ivory : m.peach, null, false);
    box("distant roof", x, h - 0.8, z, 6.4, 0.5, 8.4, m.roof, null, false);
  }
  for (let i = 0; i < 6; i++) {
    const mountain = cylinder("coastal mountains", -70 + i * 27, 3, 82 + i % 2 * 15, 38 + i % 3 * 12, 48, material(`mountain ${i}`, i % 2 ? "#a3b8b3" : "#8fa9a8"), null, 5, 0);
    mountain.rotation.y = i;
  }
  for (const z of [-2, 19]) {
    const points = [];
    for (let i = 0; i <= 20; i++) points.push([-14 + i * 1.4, 8 - Math.sin(i / 20 * Math.PI) * 1.7, z]);
    line("hanging wire", points, "#536565");
    for (let i = 0; i < 9; i++) {
      const flag = box("harbor pennant", -11 + i * 2.7, 7.7 - Math.sin((i + 1) / 11 * Math.PI) * 1.8, z, 0.45, 0.55, 0.015, i % 3 ? m.trim : m.peach, null, false);
      flag.rotation.z = 0.1;
    }
  }

  const gun = new TransformNode("first person weapon", scene);
  gun.parent = camera;
  gun.scaling.setAll(0.8);
  gun.setEnabled(false);
  const weaponRoot = new TransformNode("rifle", scene);
  weaponRoot.parent = gun;
  box("receiver", 0, 0, 0, 0.14, 0.16, 0.48, m.black, weaponRoot, false);
  box("upper receiver", 0, 0.075, 0.04, 0.125, 0.06, 0.52, m.metal, weaponRoot, false);
  box("rear stock", 0, -0.025, -0.35, 0.13, 0.18, 0.22, m.black, weaponRoot, false);
  box("foregrip", 0, 0, 0.36, 0.12, 0.14, 0.27, m.metal, weaponRoot, false);
  const barrel = cylinder("rifle barrel", 0, 0.025, 0.62, 0.3, 0.05, m.black, weaponRoot);
  barrel.rotation.x = Math.PI / 2;
  const suppressor = cylinder("muzzle brake", 0, 0.025, 0.8, 0.11, 0.074, m.lightMetal, weaponRoot);
  suppressor.rotation.x = Math.PI / 2;
  const mag = box("magazine", 0, -0.17, 0.08, 0.09, 0.28, 0.14, m.metal, weaponRoot, false);
  mag.rotation.x = -0.17;
  const grip = box("pistol grip", 0, -0.18, -0.15, 0.1, 0.21, 0.13, m.black, weaponRoot, false);
  grip.rotation.x = 0.3;
  for (let z = 0.24; z < 0.48; z += 0.055) box("handguard rib", 0, 0.067, z, 0.14, 0.025, 0.018, m.black, weaponRoot, false);
  for (const x of [-1, 1]) {
    box("energy inlay", x * 0.073, 0.016, 0.02, 0.009, 0.019, 0.36, m.glow, weaponRoot, false);
    box("receiver plate", x * 0.077, -0.025, -0.09, 0.008, 0.06, 0.13, m.lightMetal, weaponRoot, false);
  }
  box("rear sight", 0, 0.125, -0.12, 0.08, 0.055, 0.04, m.black, weaponRoot, false);
  box("front sight", 0, 0.13, 0.36, 0.025, 0.065, 0.035, m.black, weaponRoot, false);
  box("front sight bead", 0, 0.168, 0.36, 0.018, 0.01, 0.016, m.glow, weaponRoot, false);
  const hand = box("trigger hand", 0.02, -0.17, -0.16, 0.15, 0.16, 0.19, m.glove, gun, false);
  hand.rotation.x = 0.25;
  const arm = box("right sleeve", 0.035, -0.29, -0.4, 0.21, 0.23, 0.47, m.sleeve, gun, false);
  arm.rotation.x = -0.55;
  const otherArm = box("left sleeve", -0.23, -0.25, 0.16, 0.2, 0.2, 0.52, m.sleeve, gun, false);
  otherArm.rotation.y = -0.6;
  otherArm.rotation.x = -0.2;
  box("support hand", -0.06, -0.1, 0.34, 0.17, 0.14, 0.17, m.glove, gun, false);
  gun.getChildMeshes().forEach(mesh => { mesh.renderingGroupId = 2; mesh.receiveShadows = false; shadow.removeShadowCaster(mesh); });
  const muzzle = sphere("muzzle flash", 0, 0.03, 0.9, 0.16, material("flash", "#fff1b1", 1), gun, 3);
  muzzle.scaling.set(0.5, 0.5, 1.8);
  muzzle.renderingGroupId = 2;
  muzzle.setEnabled(false);
  shadow.removeShadowCaster(muzzle);

  const botMeshes = new Map();
  function createBot(bot) {
    const root = new TransformNode(`defender ${bot.id}`, scene);
    const torso = box("armored torso", 0, 1.13, 0, 0.55, 0.65, 0.32, m.robot, root);
    torso.rotation.x = -0.06;
    box("breastplate", 0, 1.25, 0.18, 0.47, 0.29, 0.12, m.black, root);
    box("signal core", 0, 1.25, 0.25, 0.13, 0.15, 0.018, m.visor, root, false);
    box("belt", 0, 0.81, 0, 0.5, 0.1, 0.35, m.black, root);
    const head = box("helmet", 0, 1.73, 0, 0.4, 0.41, 0.37, m.robot, root);
    box("red visor", 0, 1.77, 0.19, 0.37, 0.12, 0.04, m.visor, root, false);
    box("helmet crest", 0, 1.96, -0.03, 0.09, 0.06, 0.3, m.red, root);
    const limbs = [];
    for (const side of [-1, 1]) {
      const leg = box("leg armor", side * 0.17, 0.45, 0, 0.2, 0.7, 0.25, m.robot, root);
      limbs.push(leg);
      box("combat boot", side * 0.17, 0.1, 0.06, 0.24, 0.18, 0.36, m.black, root);
      const shoulder = box("shoulder", side * 0.37, 1.34, 0, 0.22, 0.25, 0.34, m.red, root);
      shoulder.rotation.z = -side * 0.14;
      const arm = box("armed forearm", side * 0.3, 1.1, 0.27, 0.17, 0.2, 0.53, m.robot, root);
      arm.rotation.x = -0.1;
    }
    box("defender rifle", 0.18, 1.2, 0.5, 0.12, 0.14, 0.7, m.black, root);
    box("enemy muzzle", 0.18, 1.21, 0.85, 0.055, 0.05, 0.1, m.red, root, false);
    const outline = CreateTorus("enemy identifier", { diameter: 0.25, thickness: 0.025, tessellation: 4 }, scene);
    outline.parent = root;
    outline.position.set(0, 2.25, 0);
    outline.rotation.x = Math.PI / 2;
    finish(outline, m.red, root, false);
    return { root, head, limbs, dead: false, deathTime: 0, lastX: bot.x, lastZ: bot.z };
  }
  const smokeMeshes = new Map();
  const smokeMat = material("opaque smoke", "#839ba7", 0.18);
  smokeMat.backFaceCulling = false;
  smokeMat.alpha = 0.93;
  smokeMat.disableLighting = true;
  smokeMat.emissiveColor = Color3.FromHexString("#8ca5b2");
  const plantedSpike = new TransformNode("planted spike", scene);
  cylinder("spike base", 0, 0.13, 0, 0.25, 0.5, m.black, plantedSpike, 6);
  cylinder("spike core", 0, 0.4, 0, 0.4, 0.23, m.glow, plantedSpike, 6);
  for (const angle of [0, Math.PI * 2 / 3, Math.PI * 4 / 3]) {
    const fin = box("spike fin", Math.sin(angle) * 0.18, 0.35, Math.cos(angle) * 0.18, 0.09, 0.6, 0.16, m.metal, plantedSpike);
    fin.rotation.y = angle;
  }
  plantedSpike.setEnabled(false);
  let effects = [], visualTime = 0, shotTimer = 0;

  function tracer(from, to, enemy = false) {
    const mesh = line("bullet tracer", [[from.x, from.y, from.z], [to.x, to.y, to.z]], enemy ? "#ffaf7e" : "#fff2bc");
    effects.push({ mesh, life: 0.065 });
    if (!enemy) {
      const spark = sphere("impact", to.x, to.y, to.z, 0.08, m.gold, null, 3);
      effects.push({ mesh: spark, life: 0.13 });
      shadow.removeShadowCaster(spark);
    }
  }
  function update(match, dt, aiming = false) {
    visualTime += dt;
    marker.rotation.z += dt * 0.45;
    diamond.rotation.y += dt * 0.6;
    diamond.position.y = 3.8 + Math.sin(visualTime * 1.8) * 0.12;
    effects.forEach(e => { e.life -= dt; if (e.life <= 0) e.mesh.dispose(); });
    effects = effects.filter(e => e.life > 0);
    if (!match) {
      camera.position.set(4 + Math.sin(visualTime * 0.06) * 1.5, 15.5, -23);
      camera.setTarget(new Vector3(-8, 0.5, 6));
      camera.fov = 1.05;
      gun.setEnabled(false);
      return;
    }
    const p = match.player;
    const bob = p.moving && !match.paused && match.phase === "active" ? Math.sin(match.time * 12) * 0.025 : 0;
    camera.position.set(p.x, 1.65 + p.y + bob, p.z);
    camera.rotation.set(p.pitch, p.yaw, 0);
    camera.fov += ((aiming ? 0.86 : 1.2) - camera.fov) * Math.min(1, dt * 13);
    gun.setEnabled(true);
    const reloadAmount = p.reload > 0 ? Math.sin((1 - p.reload / match.weapon.reload) * Math.PI) : 0;
    const kick = p.recoil * 0.045;
    gun.position.set(aiming ? 0.025 : 0.28, -0.28 - reloadAmount * 0.23 + bob * 0.5, 0.7 - kick);
    gun.rotation.set(-kick * 1.4 + reloadAmount * 0.4, -0.018, reloadAmount * -0.5);
    weaponRoot.scaling.z = p.slot === 2 ? 0.5 : match.primary === "phantom" ? 1.06 : 1;
    shotTimer = Math.max(0, shotTimer - dt);
    muzzle.setEnabled(shotTimer > 0 && !match.paused);
    muzzle.position.z = p.slot === 2 ? 0.47 : 0.9;
    for (const bot of match.bots) {
      if (!botMeshes.has(bot.id)) botMeshes.set(bot.id, createBot(bot));
      const mesh = botMeshes.get(bot.id);
      mesh.root.position.set(bot.x, 0, bot.z);
      if (bot.hp <= 0) {
        mesh.deathTime += dt;
        mesh.root.rotation.x = -Math.min(Math.PI / 2, mesh.deathTime * 5);
        mesh.root.position.y = -Math.min(0.5, mesh.deathTime * 0.5);
        if (mesh.deathTime > 1.5) mesh.root.setEnabled(false);
      } else {
        mesh.root.setEnabled(true);
        mesh.deathTime = 0;
        mesh.root.rotation.set(0, bot.yaw, 0);
        const moving = Math.hypot(bot.x - mesh.lastX, bot.z - mesh.lastZ) > 0.001;
        mesh.limbs.forEach((limb, i) => { limb.rotation.x = moving ? Math.sin(match.time * 9 + i * Math.PI) * 0.35 : 0; });
        mesh.lastX = bot.x;
        mesh.lastZ = bot.z;
      }
    }
    for (const [id, mesh] of botMeshes) if (!match.bots.some(b => b.id === id)) { mesh.root.dispose(); botMeshes.delete(id); }
    for (const smoke of match.smokes) {
      if (!smokeMeshes.has(smoke.id)) {
        const mesh = sphere("cloudburst", smoke.x, 1.3, smoke.z, smoke.radius * 2, smokeMat, null, 14);
        shadow.removeShadowCaster(mesh);
        mesh.receiveShadows = false;
        smokeMeshes.set(smoke.id, mesh);
      }
      const mesh = smokeMeshes.get(smoke.id);
      const scale = Math.min(1, (8 - smoke.life) * 4, smoke.life * 2);
      mesh.scaling.setAll(Math.max(0.01, scale));
      mesh.rotation.y += dt * 0.08;
    }
    for (const [id, mesh] of smokeMeshes) if (!match.smokes.some(s => s.id === id)) { mesh.dispose(); smokeMeshes.delete(id); }
    plantedSpike.setEnabled(!!match.spike);
    if (match.spike) {
      plantedSpike.position.set(match.spike.x, 0, match.spike.z);
      plantedSpike.rotation.y += dt * 0.2;
    }
  }
  function clearActors() {
    for (const mesh of botMeshes.values()) mesh.root.dispose();
    botMeshes.clear();
    for (const mesh of smokeMeshes.values()) mesh.dispose();
    smokeMeshes.clear();
    plantedSpike.setEnabled(false);
  }
  return { engine, scene, camera, update, clearActors, tracer, flash: () => { shotTimer = 0.055; }, render: () => scene.render() };
}
