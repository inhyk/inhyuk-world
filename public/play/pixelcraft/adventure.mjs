import { absorbDamage } from './armor.mjs';
import { B, I, ITEMS, HOSTILE } from './data.mjs';
import { W, H, idx, moveBody, touching, computeLight, addItem, countItem, generateWorld } from './core.mjs';
import { SKINS, BOSS_HP, bossPhase, makeVillage, makeNether, makeEnd, portalFrame, findPortal, terrainSave, restoreTerrain } from './adventure-world.mjs';

export function newAdventure(G, opts = {}) {
  G.adventure = { seed: G.w.seed, dimension: 'overworld', coop: !!opts.coop, skin: Number(opts.skin) || 0, name: opts.playerName || '여행자',
    storySeen: false, bossDefeated: false, endingSeen: false, villagers: [], portals: [], worlds: {}, boss: null, achievements: [], trades: 0, visited: [] };
  G.player.skin = G.adventure.skin;
  G.companion = { ...G.player, armor: Array(4).fill(null), x: G.player.x + 1, inv: G.player.inv, spawn: { ...G.player.spawn }, skin: (G.adventure.skin + 1) % SKINS.length, attackT: 0 };
  for (const center of [Math.floor(W / 2) + 65, ...(opts.legacy ? [] : [Math.floor(W / 2) - 215]), W - 130]) G.adventure.villagers.push(...makeVillage(G.w, center));
  const x = Math.floor(W / 2) + 102;
  G.adventure.portals.push({ ...portalFrame(G.w, x, G.w.surface[x] - 1), kind: 'nether' });
  const ex = Math.floor(W / 2) + 145;
  G.adventure.portals.push({ ...portalFrame(G.w, ex, G.w.surface[ex] - 1), kind: 'end' });
  computeLight(G.w, 0, W - 1);
}
const WORLD_FIELDS = ['mobs', 'drops', 'arrows', 'tnts', 'falling', 'chests', 'furnaces', 'water', 'lava'];
function capture(G) {
  const d = { w: G.w, villagers: G.adventure.villagers, portals: G.adventure.portals, position: { x: G.player.x, y: G.player.y }, spawn: { ...G.player.spawn } };
  for (const k of WORLD_FIELDS) d[k] = G[k];
  return d;
}
export function packAdventure(G) {
  const a = G.adventure;
  if (!a) return null;
  const worlds = {};
  for (const [key, d] of Object.entries(a.worlds)) {
    worlds[key] = { terrain: terrainSave(d.w), position: d.position, spawn: d.spawn, villagers: d.villagers, portals: d.portals,
      mobs: d.mobs.filter(m => !m.dead), chests: [...d.chests], furnaces: [...d.furnaces] };
  }
  return { ...a, worlds, companion: G.companion ? { ...G.companion, inv: undefined } : null };
}
export function unpackAdventure(G, saved) {
  if (!saved) { newAdventure(G, { legacy: true }); G.adventure.storySeen = true; return; }
  G.adventure = { ...saved, worlds: {} };
  for (const [key, d] of Object.entries(saved.worlds ?? {})) {
    const w = key === 'nether' ? makeNether(saved.seed ?? G.w.seed) : key === 'end' ? makeEnd(saved.seed ?? G.w.seed) : generateWorld(saved.seed ?? G.w.seed);
    restoreTerrain(w, d.terrain);
    G.adventure.worlds[key] = { ...d, w, chests: new Map(d.chests), furnaces: new Map(d.furnaces), water: new Set(), lava: new Set(), drops: [], arrows: [], tnts: [], falling: [] };
  }
  G.companion = { ...G.player, armor: Array(4).fill(null), ...saved.companion, inv: G.player.inv, attackT: 0 };
  G.player.skin = saved.skin ?? 0;
}

export function createAdventureController(api) {
  const $ = (s) => document.getElementById(s);
  const get = api.get;
  let dialog = false;
  function close() {
    $('adventureDialog').hidden = true;
    dialog = false;
    const G = get();
    if (G) G.paused = false;
    api.keys.clear();
  }
  function show(title, paragraphs, actions = []) {
    const G = get();
    if (!G) return;
    api.closePanel();
    api.keys.clear();
    G.paused = true; dialog = true;
    $('adventureTitle').textContent = title;
    const body = $('adventureBody'); body.replaceChildren();
    for (const text of paragraphs) { const p = document.createElement('p'); p.textContent = text; body.append(p); }
    const buttons = $('adventureActions'); buttons.replaceChildren();
    for (const [label, act] of [...actions, ['계속 모험하기', close]]) {
      const b = document.createElement('button'); b.className = 'mc-btn'; b.textContent = label; b.onclick = act; buttons.append(b);
    }
    $('adventureDialog').hidden = false;
    buttons.querySelector('button')?.focus();
  }
  function story() {
    const G = get();
    show('깊은 숲에서 깨어나다', [
      `${G.adventure.name}, 학교에서 잠깐 잠들었을 뿐인데… 눈을 뜨니 깊은 숲, 네모난 세상이야.`,
      '마을 주민: “이곳은 소환사 좀비가 잠가 놓은 세계야. 나무를 캐고 집을 지어서 살아남아. 동쪽 마을에서는 물건을 바꿀 수 있어.”',
      '“50일째, 소환사 좀비가 나타날 거야. 세 번 바뀌는 공격을 이겨 내면 현실로 돌아가는 포탈을 열 수 있어!”',
      '나무 → 제작대 → 돌·철 도구 → 다이아몬드 장비. 네더 포탈 근처에서 R 또는 ‘대화·포탈’을 눌러 다른 차원도 탐험해 봐.',
    ]);
    G.adventure.storySeen = true;
  }
  const TRADES = [
    [B.OAK_LOG, 8, I.APPLE, 4], [B.COBBLE, 16, I.IRON_INGOT, 3], [I.COAL, 6, I.COOKED_PORK, 4],
    [I.GOLD_INGOT, 4, I.DIAMOND, 1], [I.DIAMOND, 3, I.DIAMOND_SWORD, 1], [I.IRON_INGOT, 4, I.FLINT_STEEL, 1],
  ];
  function trade(v) {
    const G = get();
    show(['숲 마을 농부', '돌 마을 대장장이', '여행 상인'][v.shop], ['필요한 물건을 골라 줘. 2인 플레이에서는 가방을 함께 써!', '50일째의 소환사 좀비는 2단계에 좀비 무리, 3단계에 스켈레톤까지 불러내. 황금 사과를 준비해.'],
      TRADES.slice(v.shop * 2, v.shop * 2 + 2).map(([from, amount, to, qty]) => [
        `${ITEMS[from].name} ${amount} → ${ITEMS[to].name} ${qty}`,
        () => {
          if (countItem(G.player.inv, [from]) < amount) return api.toast('재료가 부족해!');
          const copy = G.player.inv.map(s => s ? { ...s } : null);
          let left = amount;
          for (let k = 0; k < copy.length && left; k++) if (copy[k]?.id === from) { const n = Math.min(left, copy[k].count); left -= n; copy[k].count -= n; if (!copy[k].count) copy[k] = null; }
          if (addItem(copy, to, qty, ITEMS[to].tool?.dur) > 0) return api.toast('가방에 빈 칸이 필요해!');
          G.player.inv.splice(0, 36, ...copy); G.adventure.trades = (G.adventure.trades ?? 0) + 1; api.hudDirty(); api.toast('거래했어!'); api.save();
        },
      ]));
  }
  function switchDimension(kind = 'nether') {
    const G = get(), a = G.adventure;
    if (G.mobs.some(m => m.type === 'summoner' && !m.dead)) return api.toast('소환사 좀비와 싸우는 동안에는 포탈을 쓸 수 없어!');
    close();
    const destination = a.dimension === 'overworld' ? kind : 'overworld';
    a.worlds[a.dimension] = capture(G);
    let d = a.worlds[destination];
    if (!d) {
      const w = destination === 'end' ? makeEnd(a.seed) : makeNether(a.seed);
      const x = W / 2, floor = w.surface[x] - 1;
      const portal = { ...portalFrame(w, x, floor), kind: destination };
      // 포탈 양옆에 평평한 발판을 두어 용암으로 떨어지지 않는다.
      for (let dx = -5; dx <= 6; dx++) for (let dy = 0; dy < 5; dy++) {
        const i = idx(x + dx, floor + 1 + dy); w.tiles[i] = destination === 'end' ? B.END_STONE : B.NETHERRACK; w.meta[i] = 0;
      }
      d = { w, position: { x, y: floor - 1.85 }, spawn: { x, y: floor - 1.85 }, villagers: [], portals: [portal], mobs: [], drops: [], arrows: [], tnts: [], falling: [], chests: new Map(), furnaces: new Map(), water: new Set(), lava: new Set() };
    }
    delete a.worlds[destination];
    G.w = d.w;
    for (const k of WORLD_FIELDS) G[k] = d[k];
    a.dimension = destination; a.visited = [...new Set([...(a.visited ?? []), destination])]; a.villagers = d.villagers; a.portals = d.portals;
    Object.assign(G.player, d.position, { spawn: d.spawn, vx: 0, vy: 0, fire: 0, invT: 2, fallTop: d.position.y });
    G.companion && Object.assign(G.companion, d.position, { x: d.position.x + 0.7, vx: 0, vy: 0, fallTop: d.position.y });
    G.cam = { ...d.position }; G.mining = null; G.target = null; G.dirty = [0, W - 1];
    G.fade = 1; api.save(); api.toast(destination === 'nether' ? '네더에 도착했어. 붉은 땅과 용암을 조심해!' : destination === 'end' ? '엔드의 떠 있는 섬에 도착했어!' : '숲 세계로 돌아왔어!');
  }
  function interact() {
    const G = get();
    if (!G || G.dead || G.paused || api.UI.open) return;
    const a = G.adventure, p = G.player;
    const near = (e, r) => Math.hypot(e.x - p.x, e.y - p.y) < r;
    const v = a.villagers.find(v => near(v, 4));
    if (v) return trade(v);
    const portal = a.portals.find(e => near(e, 5));
    if (portal?.kind === 'ending') return ending();
    if (portal) return show(a.dimension !== 'overworld' ? '숲으로 돌아가는 포탈' : portal.kind === 'end' ? '엔드 포탈' : '네더 포탈', ['포탈을 지나면 함께 다른 차원으로 이동해. 지은 집과 가방은 보존돼.'], [['포탈로 들어가기', () => switchDimension(portal.kind)]]);
    const frame = findPortal(G.w, p.x, p.y);
    if (frame) {
      if (G.player.inv[G.player.sel]?.id !== I.FLINT_STEEL) return api.toast('부싯돌과 부시를 손에 들고 R을 눌러 포탈을 켜 줘!');
      a.portals.push({ ...frame, kind: 'nether' }); api.toast('네더 포탈이 켜졌어! 다시 R을 눌러 들어가 줘.'); return;
    }
    api.toast('주민이나 보랏빛 포탈 가까이에서 사용해 줘. 동쪽 마을은 처음 자리에서 약 65칸이야.');
  }
  function ending() {
    const G = get();
    show('현실로 돌아가는 길', ['소환사 좀비가 쓰러지자, 숲을 잠그던 어둠이 걷혔어.', '네가 만든 집, 함께 나눈 음식, 끝까지 싸운 용기. 그 기억을 안고 빛나는 포탈을 지나갔어.', '눈을 뜨니 다시 학교야. 책상 위에는 작은 다이아몬드 하나가 반짝이고 있었어.', '이야기 끝 · 네모난 세계는 언제든 다시 찾아갈 수 있어.'], [['엔딩을 보고 세계에 남기', () => { G.adventure.endingSeen = true; close(); api.save(); }]]);
  }
  function summonBoss() {
    const G = get(), a = G.adventure;
    const x = Math.max(8, Math.min(W - 10, Math.floor(G.player.x + 10)));
    const y = G.w.surface[x] - 2.6;
    const m = api.makeMob('summoner', x, y);
    m.summonT = 4; m.volleyT = 3; m.phase = 1;
    G.mobs.push(m); a.boss = { spawned: true };
    api.toast('50일째, 소환사 좀비 등장! 체력이 줄면 소환술이 강해져!');
    G.shake = 0.4; api.save();
  }
  function hurtCompanion(amount, cause) {
    const G = get(), p = G.companion;
    if (!p || p.spectator || p.invT > 0 || G.mode === 'creative') return;
    p.hp -= absorbDamage(p, amount, cause); p.invT = 0.8; p.hurtT = 0.4;
    if (p.hp <= 0) {
      Object.assign(p, { x: G.player.x, y: G.player.y, hp: 20, vx: 0, vy: 0, invT: 3, fire: 0 });
      api.toast('2P가 쓰러졌어. 동료 곁에서 다시 태어났어!');
    }
  }
  function tickCompanion(dt) {
    const G = get(), p = G.companion, keys = api.keys;
    if (!G.adventure.coop || !p || G.dead) return;
    p.inv = G.player.inv;
    if (p.spectator) { Object.assign(p, { x: G.player.x, y: G.player.y, vx: 0, vy: 0, invT: 2 }); return; }
    p.invT = Math.max(0, p.invT - dt); p.hurtT = Math.max(0, p.hurtT - dt); p.swing = Math.max(0, p.swing - dt * 3.5); p.attackT -= dt;
    const move = api.UI.open ? 0 : Number(keys.has('ArrowRight')) - Number(keys.has('ArrowLeft'));
    const fluid = touching(G.w, p, t => t === B.LAVA || t === B.WATER);
    p.vx += (move * (fluid ? 2.5 : 4.3) - p.vx) * Math.min(1, dt * 14);
    p.vy = Math.min(28, p.vy + (fluid ? 9 : 30) * dt);
    if (keys.has('ArrowUp') && !api.UI.open && (p.onGround || fluid)) p.vy = fluid ? -4 : -9.4;
    if (move) p.face = move;
    moveBody(G.w, p, dt); p.stepLift *= Math.exp(-dt * 18); p.walkT += dt * Math.abs(p.vx) * 0.3;
    if (p.onGround) { if (p.y - p.fallTop > 3.5) hurtCompanion(Math.floor(p.y - p.fallTop - 3), 'fall'); p.fallTop = p.y; }
    else p.fallTop = Math.min(p.fallTop, p.y);
    if (fluid === B.LAVA || p.y > H) hurtCompanion(4, p.y > H ? 'void' : 'lava');
    if (keys.has('Slash') && !api.UI.open && p.attackT <= 0) {
      p.attackT = 0.4; p.swing = 1;
      const m = G.mobs.find(m => !m.dead && HOSTILE.has(m.type) && Math.hypot(m.x - p.x, m.y - p.y) < 3.5);
      if (m) { api.hitMob(m, ITEMS[G.player.inv[G.player.sel]?.id]?.tool?.dmg ?? 1, p.x); api.wearTool(1); }
    }
    if (keys.has('Period') && !api.UI.open && p.attackT <= 0) {
      const x = Math.floor(p.x + (p.face > 0 ? 1.4 : -0.7)), y = Math.floor(p.y + 0.8), t = G.w.tiles[idx(x, y)];
      if (x > 0 && x < W - 1 && y > 0 && y < H - 1 && t !== B.AIR) {
        const info = api.breakInfo(t, G.player.inv[G.player.sel]?.id ?? 0);
        p.mineT = (p.mineX === x && p.mineY === y ? p.mineT : 0) + dt;
        p.mineX = x; p.mineY = y; p.swing = 1;
        if (p.mineT >= info.time) { api.breakBlock(x, y, { harvest: info.harvest }); api.wearTool(1); G.stats.mined++; p.mineT = 0; }
      }
    } else p.mineT = 0;
    // 2P가 획득한 재료도 공유 가방으로 들어간다.
    for (const d of G.drops) if (!d.remove && d.age > 0.5 && Math.hypot(d.x - p.x, d.y - p.y) < 1.4) { d.count = addItem(G.player.inv, d.id, d.count, d.dur); if (!d.count) d.remove = true; api.hudDirty(); }
  }
  function tick(dt) {
    const G = get(), a = G.adventure;
    if (!a) return;
    tickCompanion(dt);
    a.achievements ??= [];
    for (const [id, label, done] of achievementList(G)) if (done && !a.achievements.includes(id)) { a.achievements.push(id); api.toast(`도전과제 달성: ${label}`); }

    if (a.dimension === 'overworld' && G.day >= 50 && !a.bossDefeated && !a.boss?.spawned && !G.dead) summonBoss();
    const m = G.mobs.find(m => m.type === 'summoner');
    if (m && m.dead && !a.bossDefeated) {
      a.bossDefeated = true;
      const x = Math.max(3, Math.min(W - 4, Math.floor(m.x))), floor = G.w.surface[x] - 1;
      a.portals.push({ ...portalFrame(G.w, x, floor), kind: 'ending' });
      G.dirty = [x - 10, x + 10]; api.toast('소환사 좀비를 이겼어! 황금빛 포탈에서 R을 눌러 현실로 돌아가자.'); api.save();
    }
    if (!m || m.dead || G.dead) return;
    if (m.y > H - 5) { m.x = Math.max(2, Math.min(W - 3, G.player.x + 12)); m.y = G.w.surface[Math.floor(m.x)] - m.h; m.vx = 0; m.vy = 0; }
    const phase = bossPhase(m.hp);
    if (phase !== m.phase) { m.phase = phase; m.summonT = 1; G.shake = 0.35; api.toast(`${phase}페이즈! ${phase === 2 ? '좀비 무리가 몰려온다!' : '스켈레톤 소환과 마법 화살!'} `); }
    m.summonT -= dt; m.volleyT -= dt;
    if (m.summonT <= 0) {
      m.summonT = phase === 3 ? 7 : 10;
      const count = G.mobs.filter(e => e.summoned && !e.dead).length;
      for (let k = 0; k < Math.min(phase + 1, 10 - count); k++) {
        const x = Math.max(2, Math.min(W - 3, m.x + (k % 2 ? -1 : 1) * (3 + k)));
        const type = phase === 3 && k % 2 === 0 ? 'skeleton' : 'zombie';
        const s = api.makeMob(type, x, G.w.surface[Math.floor(x)] - 1.85);
        s.summoned = true; s.hp = phase === 1 ? 10 : 16; G.mobs.push(s);
      }
    }
    if (m.volleyT <= 0 && phase >= 2) {
      m.volleyT = phase === 3 ? 2.8 : 4;
      const p = a.coop && !G.companion.spectator && Math.abs(G.companion.x - m.x) < Math.abs(G.player.x - m.x) ? G.companion : G.player;
      api.shootArrow(m.x + 0.5, m.y + 0.6, p.x + 0.3, p.y + 0.6, 12 + phase, 'mob', phase);
    }
    if (Math.abs(m.x - G.player.x) > 55 && a.dimension === 'overworld') {
      m.x = Math.max(2, Math.min(W - 3, G.player.x + 16)); m.y = G.w.surface[Math.floor(m.x)] - m.h; m.vx = 0; m.vy = 0;
    }
  }
  function draw(g, G, sx, sy, T) {
    const a = G.adventure;
    if (!a) return;
    for (const p of a.portals) {
      const x = sx(p.x), y = sy(p.y), gold = p.kind === 'ending', end = p.kind === 'end';
      const gradient = g.createLinearGradient(x, y, x + T * 2, y + T * 4);
      gradient.addColorStop(0, gold ? '#f5d484' : end ? '#143e43' : '#361f6f'); gradient.addColorStop(0.5, gold ? '#fff8d8' : end ? '#68b8ab' : '#a266e0'); gradient.addColorStop(1, gold ? '#bc813d' : end ? '#1a535c' : '#421a75');
      g.fillStyle = gradient; g.fillRect(x, y, T * 2, T * 4);
      g.save(); g.beginPath(); g.rect(x, y, T * 2, T * 4); g.clip();
      for (let k = 0; k < 14; k++) { g.strokeStyle = gold ? '#fff4c3' : '#d0a8ff'; g.globalAlpha = 0.3; g.lineWidth = T * 0.04; g.beginPath(); g.ellipse(x + T * (1 + Math.sin(k + G.clock) * 0.3), y + T * 2, T * (0.2 + k / 12), T * (0.1 + ((k / 6 + G.clock * 0.3) % 2)), 0, 0, Math.PI * 2); g.stroke(); }
      g.restore();
    }
  }
  function hud() {
    const G = get(), a = G?.adventure;
    $('questHUD').hidden = !G;
    if (!a) return;
    const p = G.player;
    $('questLine').textContent = a.bossDefeated ? (a.endingSeen ? '이야기 완료 · 자유롭게 세계를 탐험해!' : '황금빛 포탈에서 현실로 돌아가자') : G.day < 50 ? `소환사 좀비까지 ${50 - G.day}일 · 집과 장비를 준비하자` : '소환사 좀비를 쓰러뜨려 포탈을 열자';
    $('worldLine').textContent = `${a.dimension === 'nether' ? '네더' : a.dimension === 'end' ? '엔드' : '숲 세계'} · ${G.day}일째 · ${W}칸${a.coop ? ` · 2P ${G.companion.spectator ? '관전 중' : `HP ${Math.ceil(G.companion.hp)}/20`}` : ''}`;
    const nearby = [...a.villagers, ...a.portals].some(e => Math.hypot(e.x - p.x, e.y - p.y) < 5);
    $('interactButton').classList.toggle('near', nearby);
    const m = G.mobs.find(m => m.type === 'summoner' && !m.dead);
    $('bossHUD').hidden = !m;
    if (m) { $('bossLabel').textContent = `소환사 좀비 · ${bossPhase(m.hp)}페이즈 · ${Math.ceil(m.hp)} / ${BOSS_HP}`; $('bossHealth').value = m.hp; }
  }
  function key(e) {
    const G = get();
    if (!G?.adventure) return false;
    if (dialog) { if (e.code === 'Escape') close(); return true; }
    if (G.paused || G.dead || api.UI.open) return false;
    if (e.code === 'KeyR') { interact(); return true; }
    if ((e.code === 'KeyL' || e.code === 'KeyB') && G.adventure.coop) {
      const p = G.companion, leader = G.player;
      if (e.code === 'KeyL') p.spectator = !p.spectator;
      Object.assign(p, { x: leader.x, y: leader.y, vx: 0, vy: 0, fallTop: leader.y, invT: 2 }); api.toast(p.spectator ? '2P 관전 모드: 동료의 모험을 지켜봐! L로 다시 참가해.' : '2P가 동료 곁에서 모험에 참가했어!'); return true;
    }
    return false;
  }
  function start() {
    close();
    const G = get();
    if (!G.adventure) newAdventure(G);
    G.drawAdventure = draw;
    if (!G.adventure.storySeen) story();
    hud();
  }
  function reset() { close(); $('questHUD').hidden = true; $('bossHUD').hidden = true; }
  function achievementList(G) {
    const a = G.adventure;
    return [
      ['mine', '첫 번째 채집', G.stats.mined > 0],
      ['craft', '나만의 작업실', G.placedTable || a.achievements?.includes('craft')],
      ['trade', '마을의 친구', a.trades > 0],
      ['iron', '철의 시대', countItem(G.player.inv, [I.IRON_INGOT, I.IRON_PICK, I.IRON_SWORD]) > 0],
      ['diamond', '반짝이는 발견', countItem(G.player.inv, [I.DIAMOND, I.DIAMOND_PICK, I.DIAMOND_SWORD]) > 0],
      ['nether', '붉은 차원', a.visited?.includes('nether')],
      ['end', '공허 위의 섬', a.visited?.includes('end')],
      ['days', '50일의 생존', G.day >= 50],
      ['boss', '소환술을 넘어', a.bossDefeated],
      ['ending', '학교로 돌아오다', a.endingSeen],
    ];
  }
  $('achievementButton').onclick = () => { const G = get(); if (G) show('도전과제', achievementList(G).map(([id, label, done]) => `${done || G.adventure.achievements?.includes(id) ? '◆ 달성' : '◇ 미달성'} · ${label}`)); };
  $('interactButton').onclick = interact;
  $('storyButton').onclick = story;
  return { start, reset, key, tick, draw, hud, interact, switchDimension, summonBoss, hurtCompanion };
}
