// V3 adds release-controlled jumps and low ceilings.
export const RECORD_KEY = 'neon-dash-hell-v3-best';
export const LEVELS = [
  { name: 'FIRST LIGHT', label: '빛의 시련', difficulty: 'HELL', color: '#65ffcf', speed: 500, length: 21000 },
  { name: 'NEON RUSH', label: '네온 지옥', difficulty: 'ABYSS', color: '#b59aff', speed: 590, length: 29000 },
  { name: 'SOLAR FLARE', label: '극한의 태양', difficulty: 'NIGHTMARE', color: '#ffaf68', speed: 680, length: 38000 },
];
export const SIZE = 34, GRAVITY = 2100, JUMP = 740;
export function makeLevel(index) {
  const result = [], level = LEVELS[index];
  let x = 850, n = 0;
  const counts = [[4,5,3,5,4,5],[5,6,4,6,5,6],[6,7,5,7,6,7]][index];
  while (x < level.length - 800) {
    if (n % 3 === 1) {
      result.push({x: x - 85, w: 225 + index * 12, bottom: 130, h: 48, type: 'ceiling'});
      for(let j=0;j<2+Number(index===2);j++) result.push({x: x+j*34, w:34, h:38, type:'spike'});
    } else if (n % 9 === 8) {
      result.push({x, w: 135 + index * 25, h: 64 + index * 4, type: 'block'});
    } else {
      const count = counts[n % counts.length];
      for (let j = 0; j < count; j++) result.push({ x: x + j * 34, w: 34, h: 56 + index * 6, type: 'spike' });
    }
    // Changing the beat breaks hold-to-jump; every eighth group gives practice a safe checkpoint.
    x += n % 8 === 7 ? 880 : level.speed * [.82,.94,.77,.88,.79,.91][n % 6];
    n++;
  }
  return result.sort((a,b) => a.x-b.x);
}
export function createGame(level = 0, practice = false) {
  return { level, practice, mode: 'ready', x: 0, y: 0, vy: 0, rotation: 0, time: 0, attempts: 1, checkpoint: 0, obstacles: makeLevel(level), jumps: 0 };
}
export function jump(g) {
  const grounded = g.y <= 0.01 || (g.vy === 0 && g.obstacles.some(o => o.type === 'block' && Math.abs(g.y - o.h) < .01 && g.x + SIZE - 5 > o.x && g.x + 5 < o.x + o.w));
  if (g.mode === 'playing' && grounded) { g.vy = JUMP; g.jumps++; return true; }
  return false;
}
export function releaseJump(g) {
  if (g.mode === 'playing' && g.vy > 240) g.vy = 240;
}
export function collides(g, o) {
  const left = g.x + 5, right = g.x + SIZE - 5;
  if (right <= o.x || left >= o.x + o.w) return false;
  if (o.type === 'ceiling') return g.y + SIZE - 4 > o.bottom && g.y + 4 < o.bottom + o.h;
  if (o.type === 'block') return g.y + 4 < o.h;
  // Triangle height under the overlapping player interval, with forgiving corners.
  const center = o.x + o.w / 2;
  const nearest = Math.max(left, Math.min(right, center));
  const height = o.h * (1 - Math.abs(nearest - center) / (o.w / 2));
  return g.y + 6 < height;
}
export function tick(g, dt, held = false) {
  if (g.mode !== 'playing') return;
  if (held) jump(g);
  const previousBottom = g.y;
  g.time += dt;
  g.x += LEVELS[g.level].speed * dt;
  g.vy -= GRAVITY * dt;
  g.y = Math.max(0, g.y + g.vy * dt);
  if (g.y === 0) { g.vy = 0; g.rotation = Math.round(g.rotation / (Math.PI / 2)) * (Math.PI / 2); }
  else g.rotation += 8 * dt;
  for (const o of g.obstacles) {
    if (o.x > g.x + SIZE + 5) break;
    if (o.x + o.w < g.x) continue;
    if (o.type === 'block' && g.vy <= 0 && previousBottom >= o.h - 1 && g.y <= o.h && g.x + SIZE - 5 > o.x && g.x + 5 < o.x + o.w) {
      g.y = o.h; g.vy = held ? JUMP : 0;
    } else if (collides(g, o)) { g.mode = 'dead'; return; }
  }
  if (g.practice && g.y === 0 && g.x - g.checkpoint > 1800 && !g.obstacles.some(o => o.x > g.x - 100 && o.x < g.x + 450)) g.checkpoint = g.x;
  if (g.x >= LEVELS[g.level].length) g.mode = 'won';
}
export function retry(g) {
  Object.assign(g, { mode: 'playing', x: g.practice ? g.checkpoint : 0, y: 0, vy: 0, rotation: 0, time: 0, jumps: 0, attempts: g.attempts + 1 });
}
