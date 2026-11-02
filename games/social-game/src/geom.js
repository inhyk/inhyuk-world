// Geometry helpers. Every helper returns geometry with metric UVs (box projection, 1 uv = 1 m),
// position+normal+uv attributes, non-indexed, so bake() can merge anything that shares a material.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

/** Re-project UVs from object-space position by dominant normal axis (metres). */
export function metricUV(geo, scale = 1) {
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = x; v = z; }
    else if (ax >= az) { u = z; v = y; }
    else { u = x; v = y; }
    uv[i * 2] = u * scale; uv[i * 2 + 1] = v * scale;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

function norm(geo, uvScale = 1, keepUV = false) {
  let g = geo.index ? geo.toNonIndexed() : geo;
  if (!g.attributes.normal) g.computeVertexNormals();
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
  if (!keepUV || !g.attributes.uv) metricUV(g, uvScale);
  return g;
}

/** Plain box centred on origin. */
export const box = (w, h, d) => norm(new THREE.BoxGeometry(w, h, d));
/** Rounded box (bevel radius r) centred on origin. Prefer this over box for anything you touch. */
export const rbox = (w, h, d, r = 0.02, seg = 3) => norm(new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4)));
/** Cylinder along Y centred on origin. */
export const cyl = (rTop, rBot, h, seg = 24, open = false) => norm(new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, open));
export const sphere = (r, ws = 24, hs = 16) => norm(new THREE.SphereGeometry(r, ws, hs));
export const capsule = (r, len, cs = 6, rs = 16) => norm(new THREE.CapsuleGeometry(r, len, cs, rs));
export const torus = (r, tube, rs = 12, ts = 32, arc = Math.PI * 2) => norm(new THREE.TorusGeometry(r, tube, rs, ts, arc));
/** Lathe around Y from [[r, y], ...] points. */
export const lathe = (pts, seg = 32) => norm(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg));
/** Extrude a 2D shape (THREE.Shape, x/y) along +Z by depth, with optional bevel. */
export const extrude = (shape, depth, bevel = 0) => norm(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 16 }));
/** Tube along a curve (THREE.Curve). */
export const tube = (curve, r, seg = 32, rs = 10) => norm(new THREE.TubeGeometry(curve, seg, r, rs, false));
/** Flat plane facing +Y (floor), w along X, d along Z. */
export const plane = (w, d) => norm(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2));
/** Plane facing +Z (wall decal/screen) with its own 0..1 UVs kept (for canvas textures). */
export const quad = (w, h) => norm(new THREE.PlaneGeometry(w, h), 1, true);
/** Wrap any geometry you made yourself so it can be merged. keepUV keeps its own UVs. */
export const prep = (geo, keepUV = false) => norm(geo, 1, keepUV);

/**
 * mesh(geo, material, x, y, z, rx, ry, rz) → Mesh with shadows on. Add to a parent yourself or use
 * put(parent, ...) which does both.
 */
export function mesh(geo, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
export function put(parent, geo, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = mesh(geo, material, x, y, z, rx, ry, rz);
  parent.add(m);
  return m;
}

/** group(parent, x, y, z, ry) → new child Group (for pivots like doors and wheels). */
export function group(parent, x = 0, y = 0, z = 0, ry = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = ry;
  if (parent) parent.add(g);
  return g;
}

/**
 * Merge every static mesh under root into one mesh per material (huge draw-call saving). Objects
 * with userData.dynamic = true (and their children) are left alone. Meshes with castShadow false
 * are merged separately. Returns root.
 */
export function bake(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  const victims = [];
  const visit = (o) => {
    if (o !== root && o.userData.dynamic) return;
    if (o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh && !Array.isArray(o.material)) {
      const key = o.material.uuid + (o.castShadow ? 's' : 'n') + (o.geometry.attributes.color ? 'c' : '');
      if (!buckets.has(key)) buckets.set(key, { material: o.material, cast: o.castShadow, geos: [] });
      const g = o.geometry.clone();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      if (g.index) { const n = g.toNonIndexed(); g.dispose(); buckets.get(key).geos.push(n); }
      else buckets.get(key).geos.push(g);
      victims.push(o);
    }
    for (const c of o.children) visit(c);
  };
  visit(root);
  for (const v of victims) v.removeFromParent();
  for (const { material, cast, geos } of buckets.values()) {
    const attrs = ['position', 'normal', 'uv'];
    if (geos.some((g) => g.attributes.color)) attrs.push('color');
    for (const g of geos) {
      for (const k of Object.keys(g.attributes)) if (!attrs.includes(k)) g.deleteAttribute(k);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (attrs.includes('color') && !g.attributes.color) {
        const c = new Float32Array(g.attributes.position.count * 3).fill(1);
        g.setAttribute('color', new THREE.BufferAttribute(c, 3));
      }
    }
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!merged) continue;
    merged.computeBoundingSphere();
    const m = new THREE.Mesh(merged, material);
    m.castShadow = cast;
    m.receiveShadow = true;
    m.userData.baked = true;
    root.add(m);
  }
  return root;
}

/** Axis-aligned box collider in the local space of `root` around `obj` (or explicit numbers). */
export function aabb(minX, minY, minZ, maxX, maxY, maxZ) {
  return { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] };
}
export function aabbOf(obj, root) {
  root.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(obj);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  b.applyMatrix4(inv);
  return { min: b.min.toArray(), max: b.max.toArray() };
}

/**
 * Organic shapes: displace(new THREE.IcosahedronGeometry(1, 4), (x,y,z) => offset) pushes each
 * vertex along its smooth normal by the returned metres, keeps smooth shading, returns merge-ready
 * geometry. Pass a raw three.js geometry (not one from this file).
 */
export function displace(geo, fn) {
  let g = geo.clone();
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  g = mergeVertices(g, 1e-4);
  g.computeVertexNormals();
  const p = g.attributes.position, n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const d = fn(p.getX(i), p.getY(i), p.getZ(i));
    p.setXYZ(i, p.getX(i) + n.getX(i) * d, p.getY(i) + n.getY(i) * d, p.getZ(i) + n.getZ(i) * d);
  }
  g.computeVertexNormals();
  return norm(g);
}
