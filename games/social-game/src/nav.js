// Car navigation (인혁: "차에서 내비게이션이 되게 해줘", drawn as a box "300m 후 ↱").
// Shortest path on the road graph from the car to the quest target, then the next turn.
import { NAV } from './world.js';

function project(px, pz) {
  let best = null;
  NAV.edges.forEach(([a, b], i) => {
    const [ax, az] = NAV.nodes[a], [bx, bz] = NAV.nodes[b];
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L2));
    const x = ax + dx * t, z = az + dz * t, d = Math.hypot(px - x, pz - z);
    if (!best || d < best.d) best = { i, t, x, z, d };
  });
  return best;
}

/** Path of points [[x,z], ...] from (fx,fz) to (tx,tz) along the roads. */
export function roadPath(fx, fz, tx, tz) {
  const P = project(fx, fz), T = project(tx, tz);
  if (P.i === T.i) return [[P.x, P.z], [T.x, T.z]];
  const pts = NAV.nodes.map((n) => n.slice());
  const S = pts.length, E = S + 1;
  pts.push([P.x, P.z], [T.x, T.z]);
  const adj = pts.map(() => []);
  const link = (a, b) => { const d = Math.hypot(pts[a][0] - pts[b][0], pts[a][1] - pts[b][1]); adj[a].push([b, d]); adj[b].push([a, d]); };
  NAV.edges.forEach(([a, b], i) => {
    const on = [];
    if (i === P.i) on.push([P.t, S]);
    if (i === T.i) on.push([T.t, E]);
    if (!on.length) { link(a, b); return; }
    on.sort((p, q) => p[0] - q[0]);
    let prev = a;
    for (const [, n] of on) { link(prev, n); prev = n; }
    link(prev, b);
  });
  const dist = pts.map(() => Infinity), from = pts.map(() => -1), done = pts.map(() => false);
  dist[S] = 0;
  for (;;) {
    let u = -1;
    for (let k = 0; k < pts.length; k++) if (!done[k] && dist[k] < Infinity && (u < 0 || dist[k] < dist[u])) u = k;
    if (u < 0 || u === E) break;
    done[u] = true;
    for (const [v, d] of adj[u]) if (dist[u] + d < dist[v]) { dist[v] = dist[u] + d; from[v] = u; }
  }
  const path = [];
  for (let k = E; k >= 0; k = from[k]) { path.unshift(pts[k]); if (k === S) break; }
  return path;
}

/** Next instruction for a car at (x,z) heading (fx,fz) towards the target. */
export function guide(x, z, fx, fz, tx, tz) {
  const path = roadPath(x, z, tx, tz);
  if (path.length < 2) return null;
  const seg = (a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; return [dx / l, dz / l, l]; };
  const offRoad = Math.hypot(tx - path.at(-1)[0], tz - path.at(-1)[1]);
  let along = Math.hypot(path[0][0] - x, path[0][1] - z);
  const [d0x, d0z] = seg(path[0], path[1]);
  if (d0x * fx + d0z * fz < -0.4 && along + seg(path[0], path[1])[2] > 25) return { kind: 'uturn', dist: 0 };
  for (let i = 1; i < path.length - 1; i++) {
    const [ax, az, la] = seg(path[i - 1], path[i]);
    const [bx, bz] = seg(path[i], path[i + 1]);
    along += la;
    const cross = ax * bz - az * bx, dot = ax * bx + az * bz;
    if (dot < 0.85) return { kind: cross > 0 ? 'right' : 'left', dist: along - la + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]) };
  }
  along += seg(path.at(-2), path.at(-1))[2];
  return { kind: 'arrive', dist: along + offRoad * 0.5 };
}

export function guideText(g) {
  if (!g) return null;
  const m = g.dist < 100 ? Math.max(10, Math.round(g.dist / 10) * 10) : Math.round(g.dist / 50) * 50;
  if (g.kind === 'uturn') return { arrow: '⤺', head: '유턴', sub: '반대 방향이에요' };
  if (g.kind === 'arrive') return g.dist < 25 ? { arrow: '🏁', head: '도착', sub: '목적지 근처예요' } : { arrow: '↑', head: `${m}m`, sub: '앞으로 쭉 가면 도착' };
  return { arrow: g.kind === 'right' ? '↱' : '↰', head: `${m}m 후`, sub: g.kind === 'right' ? '우회전' : '좌회전' };
}
