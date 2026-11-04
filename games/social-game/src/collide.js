// Box colliders in world space with a spatial hash, plus the player's cylinder-vs-box mover.
export class Colliders {
  constructor(cell = 8) {
    this.cell = cell;
    this.map = new Map();
    this.all = new Set();
  }
  key(i, j) { return i * 73856093 ^ j * 19349663; }
  add(box) {
    // box: {min:[x,y,z], max:[x,y,z], tag?}
    const c = this.cell;
    box._cells = [];
    for (let i = Math.floor(box.min[0] / c); i <= Math.floor(box.max[0] / c); i++) {
      for (let j = Math.floor(box.min[2] / c); j <= Math.floor(box.max[2] / c); j++) {
        const k = this.key(i, j);
        if (!this.map.has(k)) this.map.set(k, []);
        this.map.get(k).push(box);
        box._cells.push(k);
      }
    }
    this.all.add(box);
    return box;
  }
  remove(box) {
    if (!box._cells) return;
    for (const k of box._cells) {
      const arr = this.map.get(k);
      const i = arr ? arr.indexOf(box) : -1;
      if (i >= 0) arr.splice(i, 1);
    }
    box._cells = null;
    this.all.delete(box);
  }
  /** Boxes overlapping the XZ rectangle. */
  query(minX, minZ, maxX, maxZ, out = []) {
    out.length = 0;
    const c = this.cell, seen = new Set();
    for (let i = Math.floor(minX / c); i <= Math.floor(maxX / c); i++) {
      for (let j = Math.floor(minZ / c); j <= Math.floor(maxZ / c); j++) {
        const arr = this.map.get(this.key(i, j));
        if (!arr) continue;
        for (const b of arr) {
          if (seen.has(b) || b.disabled) continue;
          seen.add(b);
          if (b.max[0] > minX && b.min[0] < maxX && b.max[2] > minZ && b.min[2] < maxZ) out.push(b);
        }
      }
    }
    return out;
  }
  /** Ray (origin o, unit dir d, max length) against boxes; returns nearest distance or Infinity. */
  ray(o, d, maxLen, ignoreTag) {
    let best = Infinity;
    const steps = Math.ceil(maxLen / this.cell) + 1;
    const ex = o[0] + d[0] * maxLen, ez = o[2] + d[2] * maxLen;
    const list = this.query(Math.min(o[0], ex) - 0.1, Math.min(o[2], ez) - 0.1, Math.max(o[0], ex) + 0.1, Math.max(o[2], ez) + 0.1);
    void steps;
    for (const b of list) {
      if (ignoreTag && b.tag === ignoreTag) continue;
      let t0 = 0, t1 = maxLen, ok = true;
      for (let a = 0; a < 3 && ok; a++) {
        if (Math.abs(d[a]) < 1e-9) { if (o[a] < b.min[a] || o[a] > b.max[a]) ok = false; continue; }
        let ta = (b.min[a] - o[a]) / d[a], tb = (b.max[a] - o[a]) / d[a];
        if (ta > tb) [ta, tb] = [tb, ta];
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
        if (t0 > t1) ok = false;
      }
      if (ok && t0 < best) best = t0;
    }
    return best;
  }
}

/**
 * Move a vertical cylinder (feet position p = {x,y,z}, radius r, height h) by (dx, dy, dz) against the
 * boxes and a ground height function. Steps up ledges <= step. Returns {onGround, hitX, hitZ, ceiling}.
 */
export function moveBody(col, p, r, h, dx, dy, dz, groundAt, step = 0.42) {
  const res = { onGround: false, hitX: false, hitZ: false, ceiling: false };
  const tmp = [];
  // boxes the body is already inside (e.g. a car that parked on top of it) never trap it: they are ignored
  const stuckIn = new Set();
  for (const b of col.query(p.x - r, p.z - r, p.x + r, p.z + r, tmp)) if (b.max[1] > p.y + 0.05 && b.min[1] < p.y + h - 0.05) stuckIn.add(b);
  const overl = (x, y, z) => {
    const list = col.query(x - r, z - r, x + r, z + r, tmp);
    for (const b of list) if (!stuckIn.has(b) && b.max[1] > y + 0.001 && b.min[1] < y + h) return b;
    return null;
  };
  // horizontal, axis by axis, with step-up
  const tryAxis = (ax, d) => {
    if (d === 0) return;
    const nx = ax === 0 ? p.x + d : p.x, nz = ax === 2 ? p.z + d : p.z;
    let b = overl(nx, p.y, nz);
    if (!b) { p.x = nx; p.z = nz; return; }
    // step up onto it?
    let top = b.max[1];
    if (top - p.y <= step) {
      // the tallest box we would stand on in this step
      const list = col.query(nx - r, nz - r, nx + r, nz + r, tmp);
      for (const o of list) if (o.max[1] > p.y && o.max[1] - p.y <= step && o.min[1] < p.y + h) top = Math.max(top, o.max[1]);
      if (!overl(nx, top + 0.001, nz)) { p.x = nx; p.z = nz; p.y = top + 0.001; return; }
    }
    if (ax === 0) res.hitX = true; else res.hitZ = true;
  };
  // substeps to avoid tunnelling
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / (r * 0.8)));
  for (let i = 0; i < n; i++) { tryAxis(0, dx / n); tryAxis(2, dz / n); }
  // vertical
  const g = groundAt(p.x, p.z);
  let ny = p.y + dy;
  if (dy <= 0) {
    // highest support below
    let support = g;
    const list = col.query(p.x - r, p.z - r, p.x + r, p.z + r, tmp);
    for (const b of list) if (b.max[1] <= p.y + 0.05 && b.max[1] > support) support = b.max[1];
    if (ny <= support) { ny = support; res.onGround = true; }
  } else {
    const list = col.query(p.x - r, p.z - r, p.x + r, p.z + r, tmp);
    for (const b of list) {
      if (b.min[1] >= p.y + h - 0.01 && b.min[1] < ny + h) { ny = b.min[1] - h; res.ceiling = true; }
    }
  }
  p.y = ny;
  return res;
}

/** Is a body of radius r and height h free of boxes at feet position (x, y, z)? */
export function bodyFree(col, x, y, z, r = 0.3, h = 1.75) {
  for (const b of col.query(x - r, z - r, x + r, z + r)) if (b.max[1] > y + 0.05 && b.min[1] < y + h) return false;
  return true;
}
