// 16x16 픽셀 그림을 코드로 그린다. 그림 파일은 하나도 쓰지 않는다.
import { B, I, ITEMS } from './data.mjs';
import { makeRng } from './core.mjs';

const S = 16;
const canvas = () => {
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  return c;
};

function painter(seed) {
  const c = canvas();
  const g = c.getContext('2d');
  const r = makeRng(seed * 7919 + 13);
  const px = (x, y, color) => {
    if (x < 0 || y < 0 || x >= S || y >= S || !color) return;
    g.fillStyle = color;
    g.fillRect(x, y, 1, 1);
  };
  const pick = (pal) => pal[Math.floor(r() * pal.length)];
  const fill = (pal, x0 = 0, y0 = 0, x1 = S, y1 = S) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) px(x, y, pick(pal));
  };
  const rect = (x, y, w, h, color) => {
    g.fillStyle = color;
    g.fillRect(x, y, w, h);
  };
  // "...#ab" 같은 글자 그림. 글자마다 색을 정해 둔다
  const map = (rows, colors, ox = 0, oy = 0) => {
    rows.forEach((row, y) => [...row].forEach((ch, x) => px(ox + x, oy + y, colors[ch])));
  };
  const line = (x0, y0, x1, y1, color) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let k = 0; k <= n; k++) px(Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n), color);
  };
  return { c, g, r, px, pick, fill, rect, map, line };
}

// 그려진 픽셀 둘레에 어두운 테두리를 두른다 (아이템 아이콘용)
function outline(c, color = 'rgba(20,14,10,0.9)') {
  const g = c.getContext('2d');
  const d = g.getImageData(0, 0, S, S).data;
  const on = (x, y) => x >= 0 && y >= 0 && x < S && y < S && d[(y * S + x) * 4 + 3] > 40;
  g.fillStyle = color;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    if (on(x, y)) continue;
    if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) g.fillRect(x, y, 1, 1);
  }
}

const PAL = {
  dirt: ['#8a5f3c', '#7a5233', '#96694a', '#6b4429', '#82593a'],
  grass: ['#5fa83b', '#4f9530', '#6cb845', '#447f28', '#5a9e36'],
  stone: ['#7f7f80', '#757576', '#8a8a8b', '#6d6d6e', '#828283'],
  sand: ['#dcd2a0', '#d3c690', '#e4dab0', '#cbbd86', '#d8cd98'],
  snow: ['#f4f8fb', '#e8eef4', '#ffffff', '#dfe7ef'],
  plank: ['#b48c58', '#a8814f', '#bd975f', '#9f7746'],
  oakBark: ['#6a5034', '#5b4329', '#7a5d3b', '#4b3822'],
  birchBark: ['#e3e1d8', '#d6d3c8', '#ecebe4', '#c9c6ba'],
  spruceBark: ['#4a321c', '#3c2814', '#56391f', '#30200f'],
  oakLeaf: ['#3f8f2b', '#357d23', '#4d9f35', '#2d6b1b'],
  birchLeaf: ['#6ea03f', '#5f8f34', '#7fb04c', '#517c2b'],
  spruceLeaf: ['#2f5e38', '#264f2e', '#3a6d42', '#1e4226'],
  water: ['#2f63d8', '#3a6fe0', '#2857c8', '#3d76e8'],
  lava: ['#e8590c', '#f27a1a', '#ff9a2a', '#d4430a', '#ffbf3a'],
  obsidian: ['#1c1426', '#251a33', '#140e1c', '#2e2140'],
  bedrock: ['#3a3a3a', '#555555', '#222222', '#6a6a6a', '#2e2e2e'],
};

function voronoi(p, pal, mortar, n, seedPts) {
  const pts = seedPts ?? Array.from({ length: n }, () => [p.r() * S, p.r() * S, p.pick(pal)]);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let d1 = 1e9, d2 = 1e9, col = pal[0];
    for (const [qx, qy, c] of pts) {
      for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
        const d = (x + 0.5 - qx - ox) ** 2 + (y + 0.5 - qy - oy) ** 2;
        if (d < d1) { d2 = d1; d1 = d; col = c; } else if (d < d2) d2 = d;
      }
    }
    const edge = Math.sqrt(d2) - Math.sqrt(d1) < 1.1;
    p.px(x, y, edge ? mortar : p.r() < 0.18 ? shade(col, -14) : col);
  }
}
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, v + amt)).toString(16).padStart(2, '0');
  return `#${c(n >> 16)}${c((n >> 8) & 255)}${c(n & 255)}`;
}
function ore(seed, colors) {
  const p = painter(seed);
  p.fill(PAL.stone);
  const spots = [[3, 3], [10, 2], [6, 8], [12, 9], [2, 12], [9, 13]];
  for (const [sx, sy] of spots) {
    if (p.r() < 0.15) continue;
    const blob = [[0, 0], [1, 0], [0, 1], [1, 1], [2, 1], [1, 2]];
    for (const [dx, dy] of blob) if (p.r() < 0.8) p.px(sx + dx, sy + dy, dy === 0 && dx < 2 ? colors[2] : p.pick(colors.slice(0, 2)));
    p.px(sx + 2, sy + 2, 'rgba(0,0,0,0.25)');
  }
  return p.c;
}
function log(seed, bark, top) {
  const p = painter(seed);
  for (let x = 0; x < S; x++) {
    const base = bark[x % bark.length];
    for (let y = 0; y < S; y++) p.px(x, y, p.r() < 0.35 ? p.pick(bark) : base);
  }
  for (let k = 0; k < 4; k++) {
    const x = Math.floor(p.r() * S), y = Math.floor(p.r() * 12);
    p.rect(x, y, 1, 3 + Math.floor(p.r() * 3), shade(bark[3], -10));
  }
  if (top) for (let k = 0; k < 7; k++) p.rect(Math.floor(p.r() * 14), Math.floor(p.r() * 15), 2 + Math.floor(p.r() * 2), 1, top);
  return p.c;
}
function leaves(seed, pal) {
  const p = painter(seed);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const v = p.r();
    if (v < 0.16) continue;
    p.px(x, y, v < 0.3 ? shade(pal[3], -12) : p.pick(pal));
  }
  return p.c;
}
function planks(seed) {
  const p = painter(seed);
  for (let b = 0; b < 4; b++) {
    const col = PAL.plank[b];
    for (let y = b * 4; y < b * 4 + 4; y++) for (let x = 0; x < S; x++) p.px(x, y, p.r() < 0.25 ? shade(col, -10) : col);
    p.rect(0, b * 4 + 3, S, 1, '#7a5a34');
    const seam = (b * 7 + 3) % 14 + 1;
    p.rect(seam, b * 4, 1, 3, '#86643a');
  }
  return p.c;
}
function metalBlock(seed, base, light, dark) {
  const p = painter(seed);
  p.fill([base, base, shade(base, -8)]);
  p.rect(0, 0, S, 1, light);
  p.rect(0, 0, 1, S, light);
  p.rect(0, S - 1, S, 1, dark);
  p.rect(S - 1, 0, 1, S, dark);
  p.rect(3, 3, 10, 1, light);
  p.rect(3, 12, 10, 1, dark);
  p.rect(2, 2, 2, 2, light);
  return p.c;
}

const BLOCK_ART = {
  [B.END_STONE]: (p) => { p.fill(['#d7dba5','#c7ce94','#e4e4b3','#b3be83']); for(let k=0;k<12;k++) p.rect((k*7)%16,(k*11)%16,2,1,'#a1ac79'); },
  [B.PURPUR]: (p) => { p.fill(['#9e789c','#a682a3','#8b678b']); p.line(0,0,15,0,'#c39dbd');p.line(0,8,15,8,'#6f516e');p.line(7,0,7,7,'#6f516e');p.line(3,8,3,15,'#6f516e'); },
  [B.NETHERRACK]: (p) => { p.fill(['#743839', '#8e4746', '#633034', '#a14e46']); for(let k=0;k<8;k++) p.line(k*2, (k*7)%16, k*2+2, (k*7)%16+2, '#46252e'); },
  [B.SOUL_SAND]: (p) => { p.fill(['#625043','#726052','#564538']); for(let k=0;k<4;k++){ const x=2+(k%2)*8,y=2+Math.floor(k/2)*8; p.rect(x,y,2,2,'#312e2b');p.rect(x+3,y,2,2,'#312e2b');p.rect(x+1,y+4,3,1,'#312e2b');} },
  [B.GLOWSTONE]: (p) => { p.fill(['#e6aa51','#ffde83','#f3c664','#ba7834']); for(let k=0;k<12;k++) p.rect((k*7)%16,(k*11)%16,2,2,'#fff0b4'); },
  [B.GRASS]: (p) => {
    p.fill(PAL.dirt);
    for (let x = 0; x < S; x++) {
      const d = 3 + (p.r() < 0.5 ? 1 : 0) + (p.r() < 0.2 ? 1 : 0);
      for (let y = 0; y < d; y++) p.px(x, y, p.pick(PAL.grass));
    }
  },
  [B.SNOW_GRASS]: (p) => {
    p.fill(PAL.dirt);
    for (let x = 0; x < S; x++) {
      const d = 3 + (p.r() < 0.5 ? 1 : 0) + (p.r() < 0.2 ? 1 : 0);
      for (let y = 0; y < d; y++) p.px(x, y, p.pick(PAL.snow));
    }
  },
  [B.DIRT]: (p) => {
    p.fill(PAL.dirt);
    for (let k = 0; k < 6; k++) p.px(Math.floor(p.r() * S), Math.floor(p.r() * S), '#a97c56');
  },
  [B.STONE]: (p) => {
    p.fill(PAL.stone);
    for (let k = 0; k < 5; k++) p.rect(Math.floor(p.r() * 13), Math.floor(p.r() * S), 2 + Math.floor(p.r() * 3), 1, '#666667');
  },
  [B.COBBLE]: (p) => voronoi(p, ['#8c8c8c', '#7a7a7a', '#9a9a9a', '#6e6e6e', '#858585'], '#4d4d4d', 9),
  [B.MOSSY_COBBLE]: (p) => {
    voronoi(p, ['#8c8c8c', '#7a7a7a', '#9a9a9a', '#6e6e6e'], '#4d4d4d', 9);
    for (let k = 0; k < 40; k++) p.px(Math.floor(p.r() * S), Math.floor(p.r() * S), p.pick(['#4f7a33', '#5e8c3d', '#3e6428']));
  },
  [B.BEDROCK]: (p) => voronoi(p, PAL.bedrock, '#151515', 12),
  [B.SAND]: (p) => p.fill(PAL.sand),
  [B.GRAVEL]: (p) => voronoi(p, ['#8a817c', '#9b928d', '#77706b', '#a8a09a', '#6a6460'], '#57514d', 14),
  [B.SANDSTONE]: (p) => {
    p.fill(PAL.sand);
    p.rect(0, 0, S, 3, '#e6ddb5');
    p.rect(0, 3, S, 1, '#bba873');
    p.rect(0, 11, S, 1, '#bba873');
    p.rect(0, 13, S, 3, '#d2c48e');
  },
  [B.SNOW]: (p) => p.fill(PAL.snow),
  [B.ICE]: (p) => {
    p.fill(['rgba(150,190,240,0.82)', 'rgba(140,182,236,0.82)', 'rgba(165,200,245,0.82)']);
    p.line(2, 12, 7, 7, 'rgba(255,255,255,0.8)');
    p.line(9, 5, 12, 2, 'rgba(255,255,255,0.8)');
    p.line(8, 14, 13, 9, 'rgba(255,255,255,0.6)');
  },
  [B.OAK_LOG]: () => null,
  [B.PLANKS]: () => null,
  [B.GLASS]: (p) => {
    p.rect(0, 0, S, S, 'rgba(200,230,255,0.12)');
    p.rect(0, 0, S, 1, '#dbeefa'); p.rect(0, 15, S, 1, '#b8d4e6');
    p.rect(0, 0, 1, S, '#dbeefa'); p.rect(15, 0, 1, S, '#b8d4e6');
    p.line(3, 6, 6, 3, '#ffffff'); p.line(4, 8, 8, 4, 'rgba(255,255,255,0.7)');
    p.line(10, 13, 13, 10, 'rgba(255,255,255,0.7)');
  },
  [B.COAL_ORE]: null, [B.IRON_ORE]: null, [B.GOLD_ORE]: null, [B.DIAMOND_ORE]: null, [B.REDSTONE_ORE]: null,
  [B.CRAFTING]: (p) => {
    const top = planks(24).getContext('2d').getImageData(0, 0, S, S);
    p.g.putImageData(top, 0, 0);
    p.rect(0, 0, S, 4, '#8a6236');
    for (let x = 0; x < S; x += 4) p.rect(x, 0, 1, 4, '#6b4a26');
    p.rect(0, 4, S, 1, '#5c3f20');
    p.rect(0, 5, 1, 11, '#6b4a26'); p.rect(15, 5, 1, 11, '#6b4a26');
    // 톱과 망치 무늬
    p.rect(3, 7, 1, 6, '#5c3f20'); p.rect(2, 7, 3, 2, '#9a9a9a');
    p.line(9, 12, 13, 8, '#c0c0c0'); p.line(9, 13, 13, 9, '#8a8a8a'); p.rect(8, 12, 2, 2, '#5c3f20');
  },
  [B.FURNACE]: (p) => furnace(p, false),
  [B.FURNACE_LIT]: (p) => furnace(p, true),
  [B.CHEST]: (p) => {
    p.fill(['#a0702e', '#9a6a2a', '#a8763a']);
    p.rect(0, 0, S, 1, '#5a3a14'); p.rect(0, 15, S, 1, '#5a3a14');
    p.rect(0, 0, 1, S, '#5a3a14'); p.rect(15, 0, 1, S, '#5a3a14');
    p.rect(1, 6, 14, 1, '#5a3a14');
    p.rect(1, 1, 14, 1, '#c08a46');
    p.rect(7, 5, 2, 4, '#d9d9d9'); p.rect(7, 8, 2, 1, '#8a8a8a');
  },
  [B.TORCH]: (p) => {
    p.rect(7, 6, 2, 10, '#7a5a30');
    p.rect(8, 6, 1, 10, '#5a3f1c');
    p.rect(7, 4, 2, 2, '#ffd23a');
    p.rect(6, 5, 1, 1, '#ff9a1a'); p.rect(9, 5, 1, 1, '#ff9a1a');
    p.rect(7, 3, 2, 1, '#fff2a0');
    p.rect(7, 6, 2, 1, '#ff7a10');
  },
  [B.WATER]: (p) => p.fill(PAL.water),
  [B.LAVA]: (p) => p.fill(PAL.lava),
  [B.CACTUS]: (p) => {
    p.fill(['#3f8a2e', '#357a26', '#4a9a36'], 1, 0, 15, 16);
    for (let x = 3; x < 14; x += 4) p.rect(x, 0, 1, S, '#2a6a1e');
    for (let k = 0; k < 10; k++) p.px(1 + Math.floor(p.r() * 14), Math.floor(p.r() * S), '#e6e6b8');
    p.rect(1, 0, 1, S, '#2a5a1a'); p.rect(14, 0, 1, S, '#2a5a1a');
  },
  [B.STONE_BRICKS]: (p) => {
    p.fill(PAL.stone);
    p.rect(0, 7, S, 1, '#5a5a5b'); p.rect(0, 15, S, 1, '#5a5a5b');
    p.rect(7, 0, 1, 7, '#5a5a5b'); p.rect(3, 8, 1, 7, '#5a5a5b'); p.rect(11, 8, 1, 7, '#5a5a5b');
    p.rect(0, 0, S, 1, '#959596'); p.rect(0, 8, S, 1, '#959596');
  },
  [B.TNT]: (p) => {
    p.fill(['#d8321e', '#c42a18', '#e0442c']);
    for (let x = 1; x < S; x += 3) p.rect(x, 0, 1, S, '#a82010');
    p.rect(0, 5, S, 6, '#e8e4dc');
    p.map(['..###.#..#.###..', '...#..##.#..#...', '...#..#.##..#...', '...#..#..#..#...'], { '#': '#222222' }, 0, 6);
  },
  [B.WOOL]: (p) => {
    p.fill(['#eeeeee', '#e4e4e4', '#f6f6f6', '#dcdcdc']);
    for (let k = 0; k < 8; k++) p.line(Math.floor(p.r() * 14), Math.floor(p.r() * 15), Math.floor(p.r() * 16), Math.floor(p.r() * 16), '#d0d0d0');
  },
  [B.TALL_GRASS]: (p) => {
    for (let k = 0; k < 7; k++) {
      const x = 2 + Math.floor(p.r() * 12), h = 5 + Math.floor(p.r() * 8), lean = p.r() < 0.5 ? -1 : 1;
      p.line(x, 15, x + lean * Math.floor(h / 4), 15 - h, p.pick(PAL.grass));
    }
  },
  [B.POPPY]: (p) => {
    p.line(8, 15, 8, 8, '#3f8a2e');
    p.rect(6, 11, 2, 1, '#4f9a36');
    p.map(['.rr.', 'rRRr', 'rRyr', '.rr.'], { r: '#c8201c', R: '#e83a2a', y: '#2a1a10' }, 6, 4);
  },
  [B.DANDELION]: (p) => {
    p.line(8, 15, 8, 9, '#3f8a2e');
    p.rect(9, 12, 2, 1, '#4f9a36');
    p.map(['.yy.', 'yYYy', 'yYYy', '.yy.'], { y: '#e8c21c', Y: '#fbe24a' }, 6, 5);
  },
  [B.OBSIDIAN]: (p) => {
    p.fill(PAL.obsidian);
    for (let k = 0; k < 6; k++) p.px(Math.floor(p.r() * S), Math.floor(p.r() * S), '#4a3466');
  },
  [B.IRON_BLOCK]: () => metalBlock(43, '#d8d8d8', '#ffffff', '#a8a8a8'),
  [B.GOLD_BLOCK]: () => metalBlock(44, '#f2cc32', '#fff27a', '#c89a14'),
  [B.DIAMOND_BLOCK]: () => metalBlock(45, '#5fe0d8', '#c4fff8', '#2aa8a0'),
  [B.COAL_BLOCK]: () => metalBlock(57, '#1e1e1e', '#3a3a3a', '#0e0e0e'),
  [B.LADDER]: (p) => {
    p.rect(2, 0, 2, S, '#8a6236'); p.rect(12, 0, 2, S, '#8a6236');
    p.rect(3, 0, 1, S, '#6b4a26'); p.rect(13, 0, 1, S, '#6b4a26');
    for (let y = 1; y < S; y += 4) { p.rect(2, y, 12, 2, '#a07440'); p.rect(2, y + 1, 12, 1, '#7a5530'); }
  },
  [B.DOOR_B]: (p) => door(p, false),
  [B.DOOR_T]: (p) => door(p, true),
  [B.BED_FOOT]: (p) => {
    p.rect(0, 7, S, 4, '#c82828'); p.rect(0, 7, S, 1, '#e04848');
    p.rect(0, 11, S, 2, '#a07440');
    p.rect(0, 13, 2, 3, '#7a5530');
  },
  [B.BED_HEAD]: (p) => {
    p.rect(0, 7, S, 4, '#c82828'); p.rect(0, 7, S, 1, '#e04848');
    p.rect(9, 5, 6, 3, '#f0f0f0'); p.rect(9, 7, 6, 1, '#cfcfcf');
    p.rect(0, 11, S, 2, '#a07440');
    p.rect(14, 13, 2, 3, '#7a5530');
  },
  [B.SAPLING_OAK]: (p) => sapling(p, PAL.oakLeaf, '#6a5034'),
  [B.SAPLING_BIRCH]: (p) => sapling(p, PAL.birchLeaf, '#d6d3c8'),
  [B.SAPLING_SPRUCE]: (p) => sapling(p, PAL.spruceLeaf, '#4a321c'),
  [B.PUMPKIN]: (p) => pumpkin(p, false),
  [B.JACK]: (p) => pumpkin(p, true),
  [B.DEAD_BUSH]: (p) => {
    const c = '#8a6a3a';
    p.line(8, 15, 8, 9, c); p.line(8, 11, 4, 6, c); p.line(8, 10, 12, 5, c);
    p.line(5, 7, 3, 7, c); p.line(11, 6, 13, 7, c); p.line(8, 9, 9, 4, c);
  },
};
function furnace(p, lit) {
  voronoi(p, ['#8c8c8c', '#7a7a7a', '#858585'], '#5a5a5a', 8);
  p.rect(0, 0, S, 2, '#a0a0a0');
  p.rect(4, 8, 8, 6, '#1e1e1e');
  p.rect(4, 8, 8, 1, '#4a4a4a');
  if (lit) {
    p.rect(5, 11, 6, 3, '#ff7a10'); p.rect(6, 10, 4, 2, '#ffbf3a'); p.rect(7, 9, 2, 1, '#fff2a0');
  }
  p.rect(3, 4, 10, 2, '#5a5a5a');
}
function door(p, top) {
  p.fill(['#a8784a', '#9c6e42', '#b08050'], 2, 0, 14, 16);
  p.rect(2, 0, 1, S, '#6b4a26'); p.rect(13, 0, 1, S, '#6b4a26');
  if (top) {
    p.rect(2, 0, 12, 1, '#6b4a26');
    p.rect(4, 3, 3, 4, '#9fd0ef'); p.rect(9, 3, 3, 4, '#9fd0ef');
    p.rect(4, 3, 3, 1, '#d8f0ff'); p.rect(9, 3, 3, 1, '#d8f0ff');
  } else {
    p.rect(2, 15, 12, 1, '#6b4a26');
    p.rect(4, 3, 8, 1, '#7a5530'); p.rect(4, 9, 8, 1, '#7a5530');
    p.rect(10, 1, 2, 2, '#d0d0d0');
  }
}
function sapling(p, pal, stem) {
  p.line(8, 15, 8, 7, stem);
  for (const [x, y] of [[6, 5], [7, 4], [8, 3], [9, 4], [10, 5], [6, 8], [10, 7], [5, 7], [11, 6], [7, 6], [9, 6], [8, 5]]) p.px(x, y, p.pick(pal));
}
function pumpkin(p, lit) {
  p.fill(['#e08a1c', '#d47c14', '#ea9628'], 0, 2, 16, 16);
  for (let x = 2; x < S; x += 4) p.rect(x, 2, 1, 14, '#b8640e');
  p.rect(0, 2, S, 1, '#f0a440');
  p.rect(7, 0, 2, 3, '#4a7a2a');
  if (lit) {
    const g = '#ffe066';
    p.rect(3, 6, 3, 2, g); p.rect(10, 6, 3, 2, g);
    p.rect(4, 11, 8, 2, g); p.rect(5, 13, 2, 1, g); p.rect(9, 13, 2, 1, g);
  } else {
    p.rect(3, 6, 2, 2, '#9a5410'); p.rect(11, 6, 2, 2, '#9a5410');
  }
}

// ---- 아이템 그림 ----
const MAT_COL = {
  wood: ['#a07440', '#c49558'],
  stone: ['#7d7d7d', '#a5a5a5'],
  iron: ['#cfcfcf', '#ffffff'],
  gold: ['#e8c030', '#fff27a'],
  diamond: ['#33d1c4', '#b2fff6'],
};
const STICK = ['#8a6236', '#5c3f20'];
function stick(p, x0, y0, x1, y1) {
  p.line(x0, y0, x1, y1, STICK[0]);
  p.line(x0 + 1, y0, x1 + 1, y1, STICK[1]);
}
function toolArt(p, type, mat) {
  const [mid, light] = MAT_COL[mat];
  const dark = shade(mid, -50);
  if (type === 'sword') {
    stick(p, 2, 13, 4, 11);
    for (let k = 0; k < 9; k++) {
      p.px(5 + k, 10 - k, light);
      p.px(6 + k, 10 - k, mid);
      p.px(5 + k, 9 - k, k > 0 ? mid : light);
    }
    p.px(14, 1, light);
    p.line(3, 9, 7, 13, dark);
    p.line(4, 9, 7, 12, shade(dark, 20));
    p.px(1, 14, dark);
  } else if (type === 'pick') {
    stick(p, 2, 13, 10, 5);
    for (let a = -1.75; a <= 0.15; a += 0.04) {
      for (const rr of [8.5, 9.5]) {
        const x = Math.round(5.5 + Math.cos(a) * rr), y = Math.round(10.5 + Math.sin(a) * rr);
        p.px(x, y, rr > 9 ? light : mid);
      }
    }
  } else if (type === 'axe') {
    stick(p, 2, 13, 11, 4);
    p.map(['..LLL..', '.LMMMM.', 'LMMMMd.', 'LMMMd..', '.MMd...', '..d....'], { L: light, M: mid, d: dark }, 5, 1);
  } else if (type === 'shovel') {
    stick(p, 2, 13, 8, 7);
    p.map(['..LL.', '.LMMd', 'LMMMd', 'LMMd.', '.dd..'], { L: light, M: mid, d: dark }, 9, 2);
  }
}
const ITEM_ART = {
  [I.STICK]: (p) => stick(p, 3, 12, 11, 4),
  [I.COAL]: (p) => lump(p, ['#2a2a2a', '#3c3c3c', '#1a1a1a', '#505050']),
  [I.REDSTONE]: (p) => {
    for (let k = 0; k < 26; k++) p.px(4 + Math.floor(p.r() * 8), 6 + Math.floor(p.r() * 7), p.pick(['#ff2a1a', '#c81008', '#ff6a50']));
  },
  [I.FLINT]: (p) => p.map(['....dd..', '...dMMd.', '..dMLMd.', '.dMMMMd.', '.dMMMd..', '..ddd...'], { d: '#1e1e22', M: '#4a4a52', L: '#7a7a84' }, 4, 5),
  [I.GUNPOWDER]: (p) => {
    for (let k = 0; k < 30; k++) p.px(3 + Math.floor(p.r() * 10), 7 + Math.floor(p.r() * 6), p.pick(['#5a5a5a', '#7a7a7a', '#3a3a3a', '#9a9a9a']));
  },
  [I.IRON_INGOT]: (p) => ingot(p, '#d8d8d8', '#ffffff', '#9a9a9a'),
  [I.GOLD_INGOT]: (p) => ingot(p, '#f0c430', '#fff27a', '#b88a10'),
  [I.DIAMOND]: (p) => p.map(['...LLLL...', '..LMMMML..', '.LMMLMMMd.', 'dMMMMMMMMd', '.dMMMMMMd.', '..dMMMMd..', '...dMMd...', '....dd....'], { L: '#c4fff8', M: '#3fd8cc', d: '#1a8a82' }, 3, 4),
  [I.FLINT_STEEL]: (p) => {
    p.map(['.ddd..', 'd...d.', 'd...d.', '.d.d..', '..d...'], { d: '#a8a8a8' }, 2, 2);
    p.map(['..dd.', '.dMMd', 'dMLMd', '.dMd.', '..d..'], { d: '#1e1e22', M: '#4a4a52', L: '#7a7a84' }, 9, 9);
  },
  [I.BUCKET]: (p) => bucket(p, null),
  [I.WATER_BUCKET]: (p) => bucket(p, '#3a6fe0'),
  [I.LAVA_BUCKET]: (p) => bucket(p, '#f27a1a'),
  [I.BOW]: (p) => {
    for (let a = -1.25; a <= 1.25; a += 0.05) p.px(Math.round(4 + Math.cos(a) * 9), Math.round(8 + Math.sin(a) * 6.5), '#8a6236');
    p.line(5, 2, 5, 14, '#e8e8e8');
  },
  [I.ARROW]: (p) => {
    p.line(3, 12, 12, 3, '#8a6236');
    p.map(['.LL', 'LMd', 'Ld.'], { L: '#d8d8d8', M: '#9a9a9a', d: '#5a5a5a' }, 11, 1);
    p.map(['w..', 'ww.', '.w.'], { w: '#f2f2f2' }, 1, 11);
  },
  [I.COMPASS]: (p) => {
    p.map(['..dddd..', '.dLLLLd.', 'dLLrLLLd', 'dLLrLLLd', 'dLLLwLLd', 'dLLLwLLd', '.dLLLLd.', '..dddd..'], { d: '#6a6a6a', L: '#c8c8c8', r: '#e02020', w: '#3a3a3a' }, 4, 4);
  },
  [I.CLOCK]: (p) => {
    p.map(['..dddd..', '.dyyyyd.', 'dybbbbyd', 'dbbybbbd', 'dggggggd', 'dyggggyd', '.dyyyyd.', '..dddd..'], { d: '#9a7a10', y: '#f0c430', b: '#3a7ae0', g: '#2a6a2a' }, 4, 4);
  },
  [I.RAW_PORK]: (p) => meat(p, '#f08a8a', '#d86a6a', '#ffd0d0'),
  [I.COOKED_PORK]: (p) => meat(p, '#b8743a', '#8a5226', '#e0b070'),
  [I.RAW_BEEF]: (p) => meat(p, '#d83a3a', '#a82222', '#f0a0a0'),
  [I.STEAK]: (p) => meat(p, '#8a4a22', '#5a2e12', '#c88a50'),
  [I.RAW_CHICKEN]: (p) => drumstick(p, '#f4c8b0', '#d8a088'),
  [I.COOKED_CHICKEN]: (p) => drumstick(p, '#c88440', '#9a5e26'),
  [I.ROTTEN_FLESH]: (p) => meat(p, '#8a7a3a', '#5a6a2a', '#a8a050'),
  [I.APPLE]: (p) => apple(p, '#e02828', '#a01414', '#ff8a8a'),
  [I.GOLDEN_APPLE]: (p) => apple(p, '#f0c430', '#b88a10', '#fff6a0'),
  [I.BONE]: (p) => {
    p.line(4, 11, 11, 4, '#f0ece0');
    p.line(5, 11, 12, 4, '#d8d2c0');
    for (const [x, y] of [[3, 11], [4, 12], [3, 12], [12, 3], [11, 3], [12, 4]]) p.px(x, y, '#f8f6ee');
  },
  [I.LEATHER]: (p) => p.map(['.dddddd.', 'dMMMMMMd', 'dMLMMMMd', '.dMMMMMd', '.dMMMMd.', 'dMMMMMMd', 'dMMMMMMd', '.dd..dd.'], { d: '#5a3216', M: '#a0602a', L: '#c48040' }, 4, 4),
  [I.FEATHER]: (p) => {
    p.line(3, 13, 12, 3, '#c8c8c8');
    for (let k = 0; k < 8; k++) { p.px(4 + k, 10 - k, '#ffffff'); p.px(5 + k, 11 - k, '#e8e8e8'); }
  },
  [I.STRING]: (p) => {
    let x = 3, y = 12;
    for (let k = 0; k < 14; k++) { p.px(x, y, '#f0f0f0'); x += k % 2 ? 1 : 0; y -= k % 3 === 0 ? 1 : 0; }
    p.line(4, 4, 10, 10, '#d8d8d8');
  },
  [I.DOOR]: (p) => {
    p.fill(['#a8784a', '#9c6e42'], 4, 1, 12, 15);
    p.rect(5, 3, 2, 3, '#9fd0ef'); p.rect(9, 3, 2, 3, '#9fd0ef');
    p.rect(10, 9, 1, 1, '#d0d0d0');
  },
  [I.BED]: (p) => {
    p.rect(1, 7, 14, 4, '#c82828'); p.rect(1, 7, 14, 1, '#e04848');
    p.rect(10, 5, 5, 3, '#f0f0f0');
    p.rect(1, 11, 14, 2, '#a07440'); p.rect(1, 13, 2, 2, '#7a5530'); p.rect(13, 13, 2, 2, '#7a5530');
  },
};
function lump(p, pal) {
  ['..xxxx..', '.xxxxxx.', 'xxxxxxxx', 'xxxxxxxx', 'xxxxxxx.', '.xxxxx..'].forEach((row, y) => {
    [...row].forEach((ch, x) => { if (ch === 'x') p.px(4 + x, 5 + y, p.pick(pal)); });
  });
}
function ingot(p, mid, light, dark) {
  p.map(['....LLLLLL', '...LMMMMMLd', '..LMMMMMMLd', '.LLLLLLLLdd', '.MMMMMMMMd.', '.ddddddddd.'], { L: light, M: mid, d: dark }, 2, 5);
}
function bucket(p, fill) {
  p.map(['.d........d.', 'dLLLLLLLLLLd', 'dMffffffffMd', '.dMMMMMMMMd.', '.dMMMMMMMMd.', '..dMMMMMMd..', '..dMMMMMMd..', '...dddddd...'], { d: '#4a4a4a', L: '#e0e0e0', M: '#a8a8a8', f: fill ?? '#3a3a3a' }, 2, 4);
}
function meat(p, mid, dark, light) {
  p.map(['...dddd...', '..dMMMMd..', '.dMLLMMMd.', 'dMLMMMMMMd', 'dMMMMMwMMd', '.dMMMMwwd.', '..dMMMMd..', '...dddd...'], { d: dark, M: mid, L: light, w: '#f4f0e8' }, 3, 4);
}
function drumstick(p, mid, dark) {
  p.map(['..dddd...', '.dMMMMd..', 'dMMMMMMd.', 'dMMMMMMd.', '.dMMMMd..', '..ddMMw..', '.....ww..', '......ww.', '.....w..w'], { d: dark, M: mid, w: '#f4f0e8' }, 3, 3);
}
function apple(p, mid, dark, light) {
  p.map(['....s...', '...sl...', '.dMMdMd.', 'dMLMMMMd', 'dLMMMMMd', 'dMMMMMMd', '.dMMMMd.', '..d..d..'], { s: '#5a3a1a', l: '#4a9a36', d: dark, M: mid, L: light }, 4, 3);
}

// ---- 공개 함수 ----
export const tex = [];      // 블록 ID → 16x16 캔버스
export const darkTex = [];  // 뒷벽(배경)용 어두운 그림
export const icons = [];    // 아이템 ID → 16x16 캔버스
export const iconUrl = [];  // 아이템 ID → data URL (가방 화면)
export const avgColor = []; // 블록 ID → 부서질 때 조각 색
export const crack = [];    // 금 가는 10단계
export const fluidFrames = { [B.WATER]: [], [B.LAVA]: [] };

export function buildTextures() {
  for (let id = 0; id < 64; id++) {
    let c = null;
    if (id === B.OAK_LOG || id === B.OAK_TRUNK) c = log(id, PAL.oakBark);
    else if (id === B.BIRCH_LOG || id === B.BIRCH_TRUNK) c = log(id, PAL.birchBark, '#2a2a2a');
    else if (id === B.SPRUCE_LOG || id === B.SPRUCE_TRUNK) c = log(id, PAL.spruceBark);
    else if (id === B.OAK_LEAVES) c = leaves(id, PAL.oakLeaf);
    else if (id === B.BIRCH_LEAVES) c = leaves(id, PAL.birchLeaf);
    else if (id === B.SPRUCE_LEAVES) c = leaves(id, PAL.spruceLeaf);
    else if (id === B.PLANKS) c = planks(id);
    else if (id === B.COAL_ORE) c = ore(id, ['#2a2a2a', '#1a1a1a', '#4a4a4a']);
    else if (id === B.IRON_ORE) c = ore(id, ['#d8a888', '#c08a68', '#f0c8a8']);
    else if (id === B.GOLD_ORE) c = ore(id, ['#f0c830', '#d8a818', '#fff27a']);
    else if (id === B.DIAMOND_ORE) c = ore(id, ['#40dcd8', '#22b0aa', '#b8fffa']);
    else if (id === B.REDSTONE_ORE) c = ore(id, ['#e01a10', '#a00a04', '#ff6a50']);
    else if (BLOCK_ART[id]) {
      const p = painter(id);
      const out = BLOCK_ART[id](p);
      c = out instanceof HTMLCanvasElement ? out : p.c;
    }
    if (!c) continue;
    tex[id] = c;
    const d = canvas();
    const g = d.getContext('2d');
    g.drawImage(c, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(8,6,14,0.58)';
    g.fillRect(0, 0, S, S);
    darkTex[id] = d;
    avgColor[id] = average(c);
  }
  // 물과 용암은 출렁이게 몇 장 더
  for (const id of [B.WATER, B.LAVA]) {
    for (let f = 0; f < 4; f++) {
      const p = painter(id * 10 + f);
      const pal = id === B.WATER ? PAL.water : PAL.lava;
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const wave = Math.sin((x + f * 4) * 0.8 + y * 0.6) + Math.sin((y - f * 4) * 0.5 + x * 0.3);
        p.px(x, y, pal[Math.max(0, Math.min(pal.length - 1, Math.floor((wave + 2) / 4 * pal.length)))]);
      }
      fluidFrames[id].push(p.c);
    }
  }
  for (let k = 0; k < 10; k++) {
    const p = painter(900);
    const n = 3 + k * 4;
    for (let j = 0; j < n; j++) {
      const sx = 8 + Math.round((p.r() - 0.5) * (2 + k)), sy = 8 + Math.round((p.r() - 0.5) * (2 + k));
      p.line(8, 8, sx + Math.round((p.r() - 0.5) * 10), sy + Math.round((p.r() - 0.5) * 10), 'rgba(0,0,0,0.6)');
    }
    crack.push(p.c);
  }
  for (const it of ITEMS) {
    if (!it) continue;
    let c = null;
    if (it.armor) {
      const p = painter(it.id);
      const shapes = [
        ['..MMMMMM..', '.MLLLLLLM.', '.MM....MM.', '.MM....MM.', '.MM....MM.'],
        ['MM....MM', 'MLM..MLM', 'MLMMMMMM', '.MLLLLM.', '.MMMMMM.', '.MMMMMM.'],
        ['MMMMMMMM', 'MLLLLLLM', 'MMM..MMM', 'MLM..MLM', 'MMM..MMM', 'MMM..MMM'],
        ['MMM..MMM', 'MLM..MLM', 'MLM..MLM', 'MMMM.MMMM', 'MMMM.MMMM'],
      ];
      p.map(shapes[it.armor.slot], { M: it.armor.color, L: '#f2fff4' }, 3, 4);
      c = p.c; outline(c);
    } else if (it.tool) {
      const p = painter(it.id);
      toolArt(p, it.tool.type, it.tool.mat);
      c = p.c;
      outline(c);
    } else if (ITEM_ART[it.id]) {
      const p = painter(it.id);
      ITEM_ART[it.id](p);
      c = p.c;
      outline(c);
    } else if (tex[it.id]) c = blockIcon(it.id);
    if (!c) continue;
    icons[it.id] = c;
    iconUrl[it.id] = c.toDataURL();
  }
}
// 블록 아이콘은 살짝 입체감을 준다
function blockIcon(id) {
  const c = canvas();
  const g = c.getContext('2d');
  g.drawImage(tex[id], 0, 0);
  const flat = [B.TORCH, B.TALL_GRASS, B.POPPY, B.DANDELION, B.SAPLING_OAK, B.SAPLING_BIRCH, B.SAPLING_SPRUCE, B.DEAD_BUSH, B.LADDER, B.GLASS];
  if (!flat.includes(id)) {
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fillRect(0, 0, S, 2);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(0, S - 2, S, 2);
  }
  return c;
}
function average(c) {
  const d = c.getContext('2d').getImageData(0, 0, S, S).data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let k = 0; k < d.length; k += 4) {
    if (d[k + 3] < 100) continue;
    r += d[k]; g += d[k + 1]; b += d[k + 2]; n++;
  }
  if (!n) return '#888';
  return `rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})`;
}
