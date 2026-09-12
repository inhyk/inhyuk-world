// Original code-drawn pixel scenery. Visual randomness never consumes the game RNG.
export const PALETTES = {
  ruins: { floor: '#30263f', seam: '#252034', wall: '#12101f', edge: '#655477', accent: '#b7a2cc', water: '#172747' },
  snowdin: { floor: '#bdcede', seam: '#aabed3', wall: '#101e32', edge: '#56748d', accent: '#e1eff6', water: '#193c56' },
  waterfall: { floor: '#192c45', seam: '#132138', wall: '#080f23', edge: '#355a79', accent: '#8be6ed', water: '#103148' },
  hotland: { floor: '#45312e', seam: '#302626', wall: '#18171e', edge: '#796050', accent: '#ffc479', water: '#ba422d' },
  castle: { floor: '#514b47', seam: '#3f3a3a', wall: '#191923', edge: '#887558', accent: '#efce86', water: '#1a2534' },
};
export const hash = (n, seed = 0) => { const v = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453; return v - Math.floor(v); };
const rect = (c, color, x, y, w, h) => { c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), w, h); };
function poly(c, color, points) { c.fillStyle = color; c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fill(); }
export function glow(c, x, y, radius, color, strength = .3) {
  c.save(); c.globalAlpha *= strength;
  const g = c.createRadialGradient(x, y, 0, x, y, radius); g.addColorStop(0, color); g.addColorStop(1, color + '00');
  c.fillStyle = g; c.fillRect(x - radius, y - radius, radius * 2, radius * 2); c.restore();
}
export function star(c, x, y, size = 4, color = '#ffe79c') {
  rect(c, color, x - 1, y - size, 2, size * 2); rect(c, color, x - size, y - 1, size * 2, 2);
  rect(c, '#fff7cd', x - 1, y - 1, 2, 2);
}
export function shadow(c, x, y, rx = 13, ry = 4) { c.fillStyle = '#00000040'; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); }
function flower(c, x, y, gold, t, seed) {
  const bend = Math.round(Math.sin(t * 1.3 + seed) * 1);
  rect(c, gold ? '#617046' : '#3e7a7a', x, y, 2, 5);
  rect(c, gold ? '#b8913e' : '#338fa5', x - 3 + bend, y - 3, 8, 3);
  rect(c, gold ? '#e4c46b' : '#83e3e9', x + bend, y - 6, 3, 8);
  rect(c, gold ? '#fff0a8' : '#d9ffef', x + bend, y - 2, 2, 2);
}
function pine(c, x, y, scale = 1) {
  c.save(); c.translate(x, y); c.scale(scale, scale); shadow(c, 0, 10, 17, 4);
  rect(c, '#4f4142', -3, -9, 6, 22);
  for (let i = 0; i < 3; i++) {
    const yy = -34 + i * 13, width = 13 + i * 5;
    poly(c, ['#254854', '#20424e', '#193a48'][i], [[0, yy - 17], [-width, yy + 13], [width, yy + 13]]);
    poly(c, '#a5c1d0', [[0, yy - 17], [-width + 4, yy + 5], [-3, yy + 2], [4, yy + 6], [width - 4, yy + 5]]);
    rect(c, '#dce9e9', -2, yy - 12, 4, 7);
  }
  c.restore();
}

export function drawTile(c, room, x, y, t, flags) {
  const p = PALETTES[room.area], tile = room.tiles[y][x], px = x * 32, py = y * 32, seed = x * 23 + y * 113;
  if (tile === '#') {
    rect(c, p.wall, px, py, 32, 32);
    if (room.area === 'ruins' || room.area === 'castle') {
      rect(c, '#ffffff06', px + (y % 2) * 15, py + 3, 1, 26);
      rect(c, '#00000035', px, py + 29, 32, 2);
      if (hash(seed) > .65) rect(c, '#ffffff04', px + 4, py + 5, 23, 2);
    } else if (hash(seed) > .5) {
      poly(c, room.area === 'waterfall' ? '#101d32' : '#ffffff05', [[px, py + 30], [px + 12, py + 6], [px + 28, py + 31]]);
    }
    const below = room.tiles[y + 1]?.[x], right = room.tiles[y]?.[x + 1], left = room.tiles[y]?.[x - 1];
    if (below && below !== '#') {
      rect(c, p.edge, px, py + 22, 32, 3); rect(c, '#00000055', px, py + 25, 32, 7);
      rect(c, '#00000030', px, py + 32, 32, 6);
      if (room.area === 'snowdin') { rect(c, '#dce9ef', px, py + 19, 32, 4); rect(c, '#9ebed2', px + 5, py + 23, 4, 7); }
      if (room.area === 'ruins' && hash(seed) > .35) {
        const length = 8 + Math.floor(hash(seed, 3) * 16);
        rect(c, '#3c5147', px + 5, py + 23, 2, length); rect(c, '#4b5b4c', px + 2, py + 28, 6, 3); rect(c, '#56664f', px + 5, py + length + 16, 5, 3);
      }
    }
    if (right && right !== '#') rect(c, p.edge, px + 29, py + 2, 3, 30);
    if (left && left !== '#') rect(c, '#00000055', px, py, 5, 32);
    return;
  }
  if (tile === '~') {
    rect(c, p.water, px, py, 32, 32);
    const lava = room.area === 'hotland';
    for (let i = 0; i < 3; i++) {
      const xx = (hash(seed, i) * 21 + Math.sin(t * .6 + y + i) * 4), yy = 5 + i * 10;
      rect(c, lava ? ['#dd6537', '#ef8d46', '#a5342c'][i] : ['#265a70', '#31677b', '#173d58'][i], px + xx, py + yy, 6 + Math.floor(hash(seed, i + 4) * 8), 1 + (i === 1));
    }
    if (room.tiles[y - 1]?.[x] !== '~') { rect(c, lava ? '#ffb460' : '#48899b', px, py, 32, 2); rect(c, '#00000020', px, py + 3, 32, 5); }
    return;
  }
  rect(c, p.floor, px, py, 32, 32);
  if (room.area === 'snowdin') {
    if (hash(seed) > .45) rect(c, '#d9e4ea', px + 5, py + 10, 15, 2);
    if (hash(seed, 3) > .7) rect(c, '#849eb644', px + 18, py + 23, 6, 2);
  } else {
    rect(c, p.seam, px, py + 31, 32, 1); rect(c, p.seam, px + (y % 2 ? 16 : 0), py, 1, 32);
    if (hash(seed) > .62) { rect(c, '#ffffff0a', px + 4, py + 3, 19, 1); rect(c, '#00000020', px + 12, py + 19, 5, 1); }
  }
  if (tile === ',') {
    if (room.area === 'ruins' || room.throne) {
      for (let i = 0; i < (room.throne ? 4 : 5); i++) {
        const xx = px + hash(seed, i + 7) * 27, yy = py + hash(seed, i + 20) * 26;
        if (room.throne) flower(c, xx, yy + 4, true, t, seed + i);
        else { rect(c, ['#865152', '#ae7958', '#65414b', '#ad865d', '#5b3b47'][i], xx, yy, 4 + i % 3, 3); rect(c, '#d19a6935', xx + 1, yy, 2, 1); }
      }
    } else if (room.area === 'waterfall') {
      for (let i = 0; i < 4; i++) { const xx = px + hash(seed, i) * 29, yy = py + hash(seed, i + 8) * 24; rect(c, '#316259', xx, yy, 1, 6); rect(c, '#497e6b', xx - 2, yy + 1, 2, 2); }
    } else if (room.area === 'hotland') { rect(c, '#bb774a22', px + 3, py + 29, 25, 1); rect(c, '#18191c66', px + 4, py + 6, 2, 2); }
  }
  if (tile === '=') {
    rect(c, '#644e48', px, py, 32, 32);
    for (let i = 0; i < 4; i++) { rect(c, i % 2 ? '#8a7160' : '#796051', px + 1, py + i * 8, 30, 6); rect(c, '#b29a78', px + 3, py + i * 8 + 1, 18, 1); rect(c, '#322e34', px + 4, py + i * 8 + 3, 2, 2); }
  } else if (tile === '^') {
    const down = flags[room.id + '_switch'];
    rect(c, '#1d2026', px + 2, py + 20, 28, 10);
    for (let i = 0; i < 3; i++) if (!down) {
      poly(c, '#b8c5ca', [[px + 3 + i * 10, py + 27], [px + 8 + i * 10, py + 5], [px + 13 + i * 10, py + 27]]);
      poly(c, '#677786', [[px + 8 + i * 10, py + 5], [px + 8 + i * 10, py + 27], [px + 13 + i * 10, py + 27]]);
    } else rect(c, '#56636c', px + 4 + i * 10, py + 22, 5, 2);
  } else if (tile === 'x') {
    const on = flags[room.id + '_switch'] || flags[room.id + '_door'];
    rect(c, '#1c1e29', px + 4, py + 9, 24, 19); rect(c, '#7a7f89', px + 5, py + 8, 22, 15);
    rect(c, on ? '#73b89d' : '#be9e68', px + 8, py + 11, 16, 8); rect(c, on ? '#bdeed3' : '#efd69c', px + 10, py + 11, 12, 2);
  } else if (tile === 'D') {
    const open = flags[room.id + '_door'];
    rect(c, '#0a0a14', px, py, 32, 32);
    if (!open) { rect(c, '#60506b', px + 2, py, 28, 32); rect(c, '#3b3149', px + 5, py + 3, 22, 26); rect(c, '#917b83', px + 6, py + 4, 1, 24); rect(c, '#cdb281', px + 24, py + 17, 3, 3); }
  } else if (tile === 'B') {
    const empty = room.box && flags[room.box.flag]; shadow(c, px + 16, py + 29, 15, 4);
    rect(c, '#392b2a', px + 3, py + 10, 26, 19); rect(c, '#96714e', px + 4, py + 8, 24, 16);
    rect(c, empty ? '#211d24' : '#be9464', px + 5, py + 9, 22, 6); rect(c, '#5a4035', px + 5, py + 17, 22, 2);
    rect(c, '#e2c079', px + 7, py + 8, 3, 16); rect(c, '#e2c079', px + 22, py + 8, 3, 16); rect(c, '#f6dd96', px + 14, py + 15, 4, 5);
  }
}

export function drawDecoration(c, room, px, py, t) {
  if (room.area === 'snowdin') pine(c, px + 16, py + 18);
  else if (room.area === 'waterfall') {
    glow(c, px + 16, py + 7, 32, '#41bad6', .22);
    for (let i = 0; i < 3; i++) flower(c, px + 9 + i * 7, py + 19 - (i % 2) * 8, false, t, px + i);
  } else if (room.area === 'castle') {
    shadow(c, px + 16, py + 29, 17, 5);
    rect(c, '#3c3737', px + 3, py + 23, 26, 8); rect(c, '#a8946d', px + 6, py - 35, 20, 59);
    rect(c, '#d5bf87', px + 8, py - 34, 3, 57); rect(c, '#76614d', px + 20, py - 34, 5, 57);
    rect(c, '#c1aa7a', px + 2, py - 39, 28, 7); rect(c, '#e8d29a', px + 2, py - 39, 28, 2); rect(c, '#b49d74', px + 3, py + 23, 26, 4);
  } else if (room.area === 'hotland') {
    rect(c, '#23232d', px + 6, py - 7, 20, 35); rect(c, '#65616a', px + 8, py - 8, 16, 5);
    rect(c, '#f6bd70', px + 10, py - 4, 12, 3); rect(c, '#393844', px + 9, py + 3, 3, 21);
  } else {
    rect(c, '#76647a', px + 6, py - 12, 20, 37); rect(c, '#a0919b', px + 7, py - 12, 3, 35);
    rect(c, '#4a3c57', px + 22, py - 12, 4, 37); rect(c, '#8c7b8d', px + 3, py + 22, 26, 7);
  }
}

export function drawRoomFloor(c, w, t) {
  const room = w.room;
  if (room.id === 'snow_town') {
    // The shop occupies the existing solid tiles, keeping its doorway readable.
    rect(c, '#594e51', 129, 31, 284, 63);
    for (let i = 0; i < 8; i++) rect(c, '#382f3e', 133, 37 + i * 7, 276, 1);
    poly(c, '#344555', [[112, 35], [143, 6], [395, 6], [430, 35]]);
    poly(c, '#d8e5e9', [[112, 30], [143, 2], [395, 2], [430, 30], [375, 28], [339, 31], [268, 28], [189, 32]]);
    rect(c, '#93aab8', 112, 31, 318, 4);
    for (const x of [161, 343]) {
      rect(c, '#352e37', x - 3, 48, 41, 32); rect(c, '#d2ad75', x, 50, 35, 27);
      rect(c, '#f1d79a', x + 3, 52, 28, 21); rect(c, '#776355', x + 15, 50, 4, 27); rect(c, '#776355', x, 61, 35, 3);
      rect(c, '#e5eef0', x - 4, 80, 43, 3); glow(c, x + 17, 68, 58, '#f6d79a', .15);
    }
    rect(c, '#2d2934', 232, 48, 74, 25); rect(c, '#b99b6b', 233, 49, 72, 1);
    c.font = '11px Galmuri11'; c.textAlign = 'center'; c.textBaseline = 'top'; c.fillStyle = '#e2c898'; c.fillText('SNOW INN', 269, 55);
    for (let i = 0; i < 5; i++) { const x = 150 + i * 57; rect(c, '#a6c8d9', x, 34, 2, 5 + i % 3 * 3); }
  }
  if (room.area === 'waterfall') {
    for (const tx of [2, 17]) {
      let row = 1;
      while (room.tiles[row]?.[tx] === '~') row++;
      if (row <= 1) continue;
      const x = tx * 32 + 3, end = row * 32;
      rect(c, '#3a647477', x, 30, 22, end - 30);
      rect(c, '#99d7d144', x + 2, 30, 3, end - 30); rect(c, '#a3e5df33', x + 15, 30, 4, end - 30);
      for (let i = 0; i < 9; i++) { const y = 32 + ((i * 21 + t * 34) % Math.max(1, end - 37)); rect(c, '#a6e0d85a', x + i % 3 * 7, y, 2, 7); }
      glow(c, x + 11, end - 2, 29, '#8ad4cf', .12);
      rect(c, '#a9dbd47d', x - 4, end - 3, 30, 2);
    }
  }
  if (room.id === 'ruins_home' || room.id === 'castle_home') {
    const warm = room.id === 'ruins_home';
    rect(c, warm ? '#6a4e59' : '#62605b', 33, 30, 574, 13); rect(c, warm ? '#b28c75' : '#8d8774', 33, 40, 574, 2);
    for (const x of [265, 392]) {
      rect(c, '#392c42', x, 48, 38, 46); rect(c, '#99827b', x - 3, 47, 44, 3);
      rect(c, warm ? '#52516b' : '#a79778', x + 4, 53, 30, 34);
      rect(c, warm ? '#918897' : '#d2c19a', x + 17, 51, 3, 38); rect(c, '#8b7573', x + 3, 69, 32, 3);
      rect(c, warm ? '#855366' : '#72716e', x - 3, 50, 9, 38); rect(c, warm ? '#72465f' : '#646560', x + 32, 50, 9, 38);
      rect(c, '#b69e85', x - 4, 90, 46, 4);
      poly(c, '#d5c39409', [[x + 6, 91], [x + 32, 91], [x + 69, 187], [x + 11, 187]]);
    }
  }
  if (room.hall) {
    for (let i = 0; i < 6; i++) {
      const x = 62 + i * 96;
      poly(c, '#957853', [[x, 4], [x + 12, -4], [x + 24, 4], [x + 24, 50], [x, 50]]);
      rect(c, '#c6a15f', x + 3, 8, 18, 39); rect(c, '#e2c98a', x + 11, 1, 2, 48); rect(c, '#eddb9e', x + 2, 21, 20, 2);
      rect(c, '#715640', x - 2, 49, 28, 4);
    }
    for (let i = 0; i < 20; i++) rect(c, '#c0a16d2b', i * 32 + 5, 251, 23, 1);
  }
  if (room.id === 'hot_lab') {
    rect(c, '#2e303b', 138, 26, 355, 49); rect(c, '#55515a', 138, 27, 355, 4);
    for (let i = 0; i < 9; i++) { const x = 152 + i * 38; rect(c, '#131c29', x, 41, 23, 23); rect(c, i % 3 ? '#648c87' : '#b3916d', x + 3, 44, 17, 12); rect(c, '#87b6a9', x + 5, 46, 9, 1); }
    rect(c, '#958772', 138, 73, 355, 3);
    for (const x of [136, 492]) { rect(c, '#55515c', x, 9, 7, 62); rect(c, '#86808a', x, 10, 2, 60); }
  }
  if (room.deco === 'flowers') {
    glow(c, 320, 258, 180, '#dcb665', .15);
    for (let i = 0; i < 115; i++) {
      const a = hash(i, 2) * Math.PI * 2, r = Math.sqrt(hash(i, 5));
      flower(c, 320 + Math.cos(a) * r * 72, 272 + Math.sin(a) * r * 47, true, t, i);
    }
  }
  if (room.id === 'ruins_home') {
    rect(c, '#523542', 252, 210, 140, 88); rect(c, '#ae806440', 257, 215, 130, 78);
    rect(c, '#563441', 260, 218, 124, 72);
    for (let i = 0; i < 8; i++) { rect(c, '#b48b693f', 266 + i * 16, 222, 6, 2); rect(c, '#b48b693f', 266 + i * 16, 284, 6, 2); }
  }
  if (room.hall) for (let i = 0; i < 6; i++) {
    const x = 52 + i * 100;
    rect(c, '#b0965720', x, 66, 28, 280);
    poly(c, '#f8d37c12', [[x, 63], [x + 28, 63], [x + 108, 355], [x + 15, 355]]);
    rect(c, '#d8b75e30', x + 25, 284, 48, 3);
  }
  for (const f of w.footprints) {
    const alpha = Math.max(0, 1 - f.age / 7) * (room.area === 'snowdin' ? .32 : .14);
    c.save(); c.globalAlpha = alpha; c.translate(Math.round(f.x), Math.round(f.y));
    c.rotate({ up: 0, down: Math.PI, left: -Math.PI / 2, right: Math.PI / 2 }[f.dir]);
    rect(c, room.area === 'snowdin' ? '#365378' : '#d7c7ae', f.side * 5 - 2, -3, 4, 5); c.restore();
    if (room.area === 'ruins' && room.tiles[Math.floor(f.y / 32)]?.[Math.floor(f.x / 32)] === ',' && f.age < .5) {
      c.save(); c.globalAlpha = 1 - f.age * 2;
      for (let i = 0; i < 3; i++) rect(c, '#b48060', f.x + Math.sin(i * 2 + f.side) * f.age * 32, f.y - Math.sin(f.age * Math.PI * 2) * 7 + Math.cos(i * 2) * f.age * 24, 3, 2);
      c.restore();
    }
  }
}

export function drawProp(c, item, t, discovered = false) {
  const x = item.x * 32 + 16, y = item.y * 32 + 24;
  c.save(); c.translate(x, y); if (item.solid) shadow(c, 0, 4, 17, 4);
  switch (item.kind) {
    case 'flowers': for (let i = 0; i < 5; i++) flower(c, -10 + i * 5, -i % 3 * 3, !item.room.startsWith('water'), t, i); break;
    case 'plaque': rect(c, '#231e2b', -12, -17, 25, 21); rect(c, '#7d717a', -13, -20, 26, 20); rect(c, '#b8a39a', -10, -17, 20, 1); for (let i = 0; i < 3; i++) rect(c, '#3e3548', -8, -13 + i * 4, 16 - i * 3, 1); break;
    case 'basket': rect(c, '#9a7652', -13, -12, 26, 16); for (let i = 0; i < 6; i++) rect(c, '#c19763', -11 + i * 4, -11, 2, 14); rect(c, '#9a789e', -7, -16, 9, 10); rect(c, '#e6cfa4', 2, -14, 8, 6); rect(c, '#d4d2ce', 3, -21, 1, 15); break;
    case 'bench': rect(c, '#56444a', -14, -2, 4, 10); rect(c, '#56444a', 10, -2, 4, 10); rect(c, '#9e7767', -20, -6, 40, 7); rect(c, '#9e7767', -19, -22, 38, 6); rect(c, '#5e4750', -16, -20, 3, 15); rect(c, '#5e4750', 13, -20, 3, 15); rect(c, '#c39c7e', -18, -22, 36, 1); break;
    case 'bookshelf': rect(c, '#392d35', -17, -48, 34, 53); rect(c, '#936e56', -19, -49, 38, 5); for (let row = 0; row < 2; row++) { for (let i = 0; i < 6; i++) { rect(c, ['#897b91', '#9d665d', '#828968', '#b99568', '#5b7b88', '#ad8a7c'][i], -13 + i * 5, -38 + row * 23 - i % 3 * 2, 4, 15 + i % 3 * 2); rect(c, '#dbbe9255', -13 + i * 5, -33 + row * 23, 4, 1); } rect(c, '#966e52', -17, -22 + row * 23, 34, 3); } break;
    case 'table': {
      rect(c, '#563c36', -15, -2, 4, 12); rect(c, '#563c36', 11, -2, 4, 12); rect(c, '#a5805d', -21, -9, 42, 12); rect(c, '#cda87b', -21, -9, 42, 2);
      if (item.id === 'king-tea') { for (const xx of [-10, 6]) { rect(c, '#ddd4b9', xx, -17, 7, 8); rect(c, '#c5996b', xx + 2, -16, 3, 2); rect(c, '#ddd4b9', xx + 7, -15, 2, 4); } }
      else { rect(c, '#ded5c0', -10, -13, 20, 5); rect(c, item.id === 'home-pie' ? '#c78346' : '#d5bd76', -7, -18, 14, 7); rect(c, '#e8b266', -7, -19, 14, 2); rect(c, '#d7c8b4', 14, -18, 1, 12); }
      if (!item.room.startsWith('snow')) for (let i = 0; i < 2; i++) { c.globalAlpha = .3; rect(c, '#efe0c8', -4 + i * 9 + Math.sin(t * 1.7 + i) * 2, -25 - (t * 6 + i * 5) % 13, 1, 5); c.globalAlpha = 1; }
      break;
    }
    case 'fireplace':
      rect(c, '#68565a', -21, -42, 42, 46); rect(c, '#c09b80', -24, -45, 48, 6); rect(c, '#211923', -14, -29, 28, 30);
      for (let i = 0; i < 5; i++) { const h = 10 + Math.sin(t * 6 + i * 2) * 6; rect(c, '#c86c3e', -12 + i * 5, -h, 5, h); rect(c, '#ffd78b', -10 + i * 5, -h + 5, 2, h - 5); }
      rect(c, '#4a3230', -12, -1, 24, 4); glow(c, 0, -8, 65, '#ffb864', .24); break;
    case 'bed': rect(c, '#644c48', -17, -44, 34, 49); rect(c, '#c6b3a0', -14, -38, 28, 17); rect(c, '#e4d7bf', -11, -37, 22, 10); rect(c, '#826487', -14, -23, 28, 27); rect(c, '#c4a0ae', -14, -23, 28, 4); rect(c, '#654d73', 10, -19, 4, 23); break;
    case 'snowman':
      rect(c, '#d6e5e8', -13, -12, 26, 17); rect(c, '#eff6ef', -10, -15, 20, 18); rect(c, '#d6e5e8', -10, -34, 20, 19); rect(c, '#eff6ef', -7, -36, 14, 20);
      rect(c, '#334958', -5, -29, 2, 2); rect(c, '#334958', 4, -29, 2, 2); rect(c, '#c38c55', 0, -25, 6, 3); rect(c, '#bd7476', -10, -17, 20, 4); rect(c, '#bd7476', 6, -14, 4, 11); rect(c, '#516175', 0, -8, 2, 2); rect(c, '#516175', 0, -2, 2, 2); rect(c, '#7e6f65', -22, -11, 10, 2); rect(c, '#7e6f65', 12, -15, 10, 2); break;
    case 'sign': rect(c, '#5d5550', -2, -15, 4, 22); rect(c, '#785d4f', -20, -38, 40, 28); rect(c, '#c3b99b', -15, -32, 14, 17); rect(c, '#dbd5b5', 2, -30, 13, 13); for (let i = 0; i < 3; i++) rect(c, '#8f8674', -12, -28 + i * 4, 8, 1); rect(c, '#dce8eb', -21, -40, 42, 3); break;
    case 'lamp': rect(c, '#344454', -2, -50, 4, 56); rect(c, '#1e3043', -7, 2, 14, 4); rect(c, '#405360', -9, -62, 18, 16); rect(c, '#ffe5a5', -6, -59, 12, 11); rect(c, '#51616b', -11, -64, 22, 3); rect(c, '#cedee4', -10, -66, 20, 2); glow(c, 0, -54, 52, '#f9d38f', .28); break;
    case 'telescope': rect(c, '#708c9d', -1, -18, 3, 24); poly(c, '#567383', [[0, -6], [-13, 6], [-9, 6], [0, 1], [9, 6], [13, 6]]); poly(c, '#82b9c5', [[-16, -27], [-10, -34], [15, -21], [11, -13]]); rect(c, '#b4dfdd', -17, -30, 4, 7); rect(c, '#3a566e', 12, -20, 6, 4); break;
    case 'musicbox': rect(c, '#725d78', -13, -17, 26, 21); rect(c, '#b9a2a1', -14, -19, 28, 4); rect(c, '#ddc99a', -8, -13, 16, 2); rect(c, '#bea78a', 13, -9, 6, 2); rect(c, '#bea78a', 17, -8, 2, 5); star(c, 0, -5, 3); break;
    case 'monitor': rect(c, '#252630', -20, -37, 40, 31); rect(c, '#2e5b57', -16, -33, 32, 22); for (let i = 0; i < 4; i++) rect(c, '#8fc9a1', -12, -29 + i * 4, 10 + i * 4, 1); if (Math.floor(t * 2) % 2) rect(c, '#d4e0a5', 12, -17, 2, 4); rect(c, '#5c5556', -3, -7, 6, 8); rect(c, '#767071', -12, 1, 24, 3); glow(c, 0, -22, 40, '#9ee4b5', .12); break;
    case 'cooler': rect(c, '#738698', -9, -36, 18, 21); rect(c, '#a6d4da', -6, -33, 12, 15); rect(c, '#cecbc1', -12, -15, 24, 21); rect(c, '#47738c', -6, -10, 4, 4); rect(c, '#a36760', 4, -10, 4, 4); rect(c, '#555e6a', -8, -3, 16, 6); break;
    case 'mirror': rect(c, '#b58e58', -15, -46, 30, 50); rect(c, '#77959e', -11, -42, 22, 41); poly(c, '#b3c6c0', [[-10, -41], [-2, -41], [10, -19], [10, -8]]); for (const yy of [-41, -25, -9]) { rect(c, '#fff0af', -16, yy, 3, 3); rect(c, '#fff0af', 13, yy, 3, 3); } break;
    case 'frame': rect(c, '#a28764', -15, -28, 30, 30); rect(c, '#353644', -11, -24, 22, 22); rect(c, '#a0a5a0', -6, -17, 5, 6); rect(c, '#7e6990', -7, -11, 7, 7); rect(c, '#c5b892', 3, -17, 5, 6); rect(c, '#829d82', 2, -11, 7, 7); rect(c, '#dfc891', -13, -27, 26, 1); break;
    case 'clock': rect(c, '#69564a', -12, -47, 24, 52); rect(c, '#bcae8b', -9, -43, 18, 18); rect(c, '#4d4651', -1, -40, 2, 8); rect(c, '#4d4651', -1, -34, 6, 2); rect(c, '#3d3335', -8, -22, 16, 25); rect(c, '#ad9466', -1, -20, 2, 17); rect(c, '#ceb981', -5, -7, 10, 6); break;
  }
  if (!discovered && item.kind !== 'lamp' && item.kind !== 'fireplace') {
    const phase = (t + hash(item.x * 17 + item.y) * 5) % 5;
    if (phase < 1.4) { c.globalAlpha = Math.sin(phase / 1.4 * Math.PI) * .7; star(c, 12, -24, 3, '#f1d8a1'); }
  }
  c.restore();
}

export function drawAtmosphere(c, w, t, reduced = false) {
  const room = w.room, area = room.area;
  if (room.deco === 'flowers') {
    poly(c, '#f8e1a50a', [[292, 0], [340, 0], [424, 335], [215, 335]]);
    poly(c, '#f8e1a508', [[304, 0], [328, 0], [370, 335], [274, 335]]);
    glow(c, 319, 255, 160, '#e2c47a', .07);
  }
  if (room.id === 'ruins_home') glow(c, 500, 132, 230, '#edb97b', .1);
  if (room.hall) glow(c, 320, 80, 340, '#e8c97a', .14);
  if (room.lava) glow(c, 320, 338, 310, '#fa743f', .13);
  if (area === 'waterfall') {
    for (let i = 0; i < 26; i++) {
      const x = Math.floor(hash(i, 8) * 640), y = Math.floor(hash(i, 3) * 380);
      if (room.tiles[Math.floor(y / 32)]?.[Math.floor(x / 32)] === '#') {
        c.save(); c.globalAlpha = .25 + (reduced ? .3 : (1 + Math.sin(t + i * 1.7)) * .3); star(c, x, y, i % 3 === 0 ? 3 : 1, '#78c9d9'); c.restore();
      }
    }
  }
  const count = reduced ? 12 : area === 'snowdin' ? 65 : 30;
  c.save();
  for (let i = 0; i < count; i++) {
    const seed = hash(i, 6), speed = 7 + seed * (area === 'snowdin' ? 20 : 10);
    const time = reduced ? 10 : t;
    const x = (hash(i, 2) * 680 + Math.sin(time * .22 + i) * 12 + time * (area === 'snowdin' ? 4 : 1)) % 680 - 20;
    const y = ((hash(i, 4) * 500 + time * speed * (area === 'hotland' ? -1 : 1)) % 500 + 500) % 500 - 10;
    c.globalAlpha = .15 + seed * (area === 'snowdin' ? .55 : .35);
    const color = area === 'snowdin' ? '#e7f5ff' : area === 'waterfall' ? '#79dee6' : area === 'hotland' ? '#ffc07b' : '#e6c898';
    rect(c, color, x, y, seed > .8 ? 2 : 1, area === 'hotland' ? 3 : seed > .8 ? 2 : 1);
  }
  c.restore();
  if (room.fog || area === 'waterfall') {
    c.save(); c.globalAlpha = room.fog ? .15 : .035;
    for (let i = 0; i < 3; i++) { const g = c.createLinearGradient(0, 260 + i * 30, 0, 350 + i * 30); g.addColorStop(0, '#b9d4e100'); g.addColorStop(.5, '#b9d4e1'); g.addColorStop(1, '#b9d4e100'); c.fillStyle = g; c.fillRect(0, 260 + i * 30, 640, 90); }
    c.restore();
  }
  const v = c.createRadialGradient(320, 230, 155, 320, 240, 395); v.addColorStop(0, '#04051000'); v.addColorStop(1, '#040510aa'); c.fillStyle = v; c.fillRect(0, 0, 640, 480);
}

export function drawTitleScene(c, t) {
  rect(c, '#0a0b15', 0, 0, 640, 480);
  glow(c, 320, 80, 290, '#7c697f', .16);
  // A deep, ruined entrance frames the menu and the little human below it.
  for (let i = 0; i < 3; i++) {
    const inset = i * 36, color = ['#181726', '#24202f', '#38303c'][i];
    rect(c, color, 40 + inset, 55 + i * 21, 22, 345 - i * 10);
    rect(c, color, 578 - inset, 55 + i * 21, 22, 345 - i * 10);
    rect(c, color, 40 + inset, 54 + i * 21, 560 - inset * 2, 9);
    rect(c, '#b29a6822', 40 + inset, 54 + i * 21, 560 - inset * 2, 1);
    for (let j = 0; j < 7; j++) { rect(c, '#090b1644', 40 + inset, 94 + j * 44, 22, 2); rect(c, '#090b1644', 578 - inset, 94 + j * 44, 22, 2); }
  }
  poly(c, '#e1c78508', [[286, 0], [352, 0], [459, 423], [178, 423]]);
  rect(c, '#1c1924', 0, 412, 640, 68);
  for (let i = 0; i < 80; i++) flower(c, hash(i, 2) * 640, 415 + hash(i, 3) * 62, true, t, i);
  for (let i = 0; i < 35; i++) { c.save(); c.globalAlpha = .2 + hash(i) * .45; rect(c, '#ddc79c', (hash(i, 1) * 640 + Math.sin(t * .3 + i) * 7), (hash(i, 5) * 420 + t * 5) % 420, 1, i % 4 === 0 ? 2 : 1); c.restore(); }
  glow(c, 320, 405, 170, '#d4b268', .11);
  const gradient = c.createLinearGradient(0, 70, 0, 402); gradient.addColorStop(0, '#08081100'); gradient.addColorStop(.4, '#080811aa'); gradient.addColorStop(1, '#08081100'); c.fillStyle = gradient; c.fillRect(171, 65, 298, 337);
}
