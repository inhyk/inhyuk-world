import { BLUEPRINTS,guideProgress,guidePreview,tickBuildGuide,drawBuildGuide } from './build-guide.mjs';
import { tickSkeletonBoss,isBoss,skeletonPhase,SKELETON_BOSS_HP } from './skeleton-boss.mjs';
import { BOOK_IDS,bookForDimension,bookPages,updateJournal } from './journal.mjs';
import { makeMoon, makeSchool, landingPad, drawRocket, addEndIslands, upgradeWaters } from './expedition-world.mjs';
import { makeJumpWorld, tickJumpWorld, drawJumpWorld, resetJumper, newJumpState, JUMP_LAST, checkpointNumber, jumpGrip, themeAt } from './jump-world.mjs';
import { absorbDamage } from './armor.mjs';
import { B, I, ITEMS, HOSTILE } from './data.mjs';
import { W, H, idx, moveBody, touching, computeLight, addItem, countItem, generateWorld } from './core.mjs';
import { SKINS, BOSS_HP, bossPhase, makeVillage, makeNether, addNetherFortress, makeEnd, portalFrame, findPortal, insidePortal, portalIntact, openPortalSides, openEndScenery, terrainSave, restoreTerrain } from './adventure-world.mjs';

export function newAdventure(G, opts = {}) {
  G.adventure = { seed: G.w.seed, dimension: 'overworld', coop: !!opts.coop, skin: Number(opts.skin) || 0, name: opts.playerName || '여행자',
    bedsVersion: 1, fortressVersion: 1, endVersion: 2, watersVersion: 1, storySeen: false, bossDefeated: false, endingSeen: false, villagers: [], portals: [], worlds: {}, boss: null, achievements: [], trades: 0, visited: [] };
  G.player.skin = G.adventure.skin;
  G.companion = { ...G.player, armor: Array(4).fill(null), x: G.player.x + 1, inv: G.player.inv, spawn: { ...G.player.spawn }, skin: (G.adventure.skin + 1) % SKINS.length, attackT: 0 };
  if (G.jump||G.builder) return;
  for (const center of [Math.floor(W / 2) + 65, ...(opts.legacy ? [] : [Math.floor(W / 2) - 215]), W - 130]) G.adventure.villagers.push(...makeVillage(G.w, center));
  const x = Math.floor(W / 2) + 102;
  G.adventure.portals.push({ ...portalFrame(G.w, x, G.w.surface[x] - 1), kind: 'nether' });
  const ex = Math.floor(W / 2) + 145;
  G.adventure.portals.push({ ...portalFrame(G.w, ex, G.w.surface[ex] - 1, 'end'), kind: 'end' });
  computeLight(G.w, 0, W - 1);
}
const WORLD_FIELDS = ['mobs', 'drops', 'arrows', 'tnts', 'falling', 'chests', 'furnaces', 'water', 'lava', 'fireballs'];
function capture(G) {
  const d = { w: G.w, villagers: G.adventure.villagers, portals: G.adventure.portals, position: { x: G.player.x, y: G.player.y }, spawn: { ...G.player.spawn } };
  for (const k of WORLD_FIELDS) d[k] = G[k] ?? [];
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
    const w = key === 'nether' ? makeNether(saved.seed ?? G.w.seed) : key === 'end' ? makeEnd(saved.seed ?? G.w.seed) : key === 'moon' ? makeMoon(saved.seed ?? G.w.seed) : key === 'school' ? makeSchool(saved.seed ?? G.w.seed) : generateWorld(saved.seed ?? G.w.seed);
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
    api.keys.clear(); $('game').focus({ preventScroll: true });
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
    buttons.querySelector('button')?.focus({preventScroll:true});
    $('adventureDialog').querySelector('.story-dialog').scrollTop=0;
  }
  function story() {
    const G = get();
    if(G.builder){G.adventure.storySeen=true;return buildPlan();}
    if (G.jump) {
      G.adventure.storySeen = true;
      return show('극한 점프맵에 온 걸 환영해!', ['A·D 또는 방향키로 걷고 스페이스로 점프! 휴대폰에서는 화면 아래 이동·점프 버튼을 눌러 줘.', '61개 발판! 대부분 단 한 칸이고, 사이가 2~4칸 벌어져 있어. Shift를 누르고 달리다가 발판 끝에서 점프해! 2P는 오른쪽 Shift, 휴대폰은 ‘달리기’를 함께 눌러 줘.', '숲 → 얼음 절벽 → 화산 → 별빛섬! 얼음은 미끄럽고, 초록 화살표 발판은 자동으로 높이 튀어 올라. 금 간 붉은 발판은 밟고 0.38초 뒤 무너져! 멈추지 말고 다음 발판으로 뛰어. 2.5초 뒤 다시 생겨. 체크포인트는 15발판마다 있어. 블록 캐기·놓기·날기는 잠겨 있어.']);
    }
    show('깊은 숲에서 깨어나다', [
      `${G.adventure.name}, 학교에서 잠깐 잠들었을 뿐인데… 눈을 뜨니 깊은 숲, 네모난 세상이야.`,
      '마을 주민: “이곳은 소환사 좀비가 잠가 놓은 세계야. 나무를 캐고 집을 지어서 살아남아. 동쪽 마을에서는 물건을 바꿀 수 있어.”',
      '“50일째, 소환사 좀비가 나타날 거야. 세 번 바뀌는 공격을 이겨 내면 현실로 돌아가는 포탈을 열 수 있어!”',
      '밤에는 마을 집의 침대 옆에서 R을 눌러 아침까지 잘 수 있어. 네더에서는 피글린·가스트·블레이즈와 검은 요새를 만날 수 있어.',
      '나무 → 제작대 → 돌·철 도구 → 다이아몬드 장비. 포탈 한가운데로 걸어 들어가 잠깐 기다리면 다른 차원으로 이동해.',
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
    if (G.mobs.some(isBoss)) return api.toast('보스와 싸우는 동안에는 포탈을 쓸 수 없어!');
    close();
    const destination = a.dimension === 'overworld' ? kind : 'overworld';
    a.worlds[a.dimension] = capture(G);
    let d = a.worlds[destination];
    if (!d) {
      const w = destination === 'school' ? makeSchool(a.seed) : destination === 'moon' ? makeMoon(a.seed) : destination === 'end' ? makeEnd(a.seed) : makeNether(a.seed);
      const x = destination==='school'?660:W / 2, floor = w.surface[x] - 1;
      const portal = destination === 'moon' ? null : { ...portalFrame(w, x, floor, destination), kind: destination };
      if(destination==='moon'){a.rocketSites??={};a.rocketSites.moon=landingPad(w,x);}
      // 포탈 양옆에 평평한 발판을 두어 용암으로 떨어지지 않는다.
      for (let dx = -5; dx <= 6; dx++) for (let dy = 0; dy < 5; dy++) {
        const i = idx(x + dx, floor + 1 + dy); w.tiles[i] = ['moon','school'].includes(destination) ? B.STONE_BRICKS : destination === 'end' ? B.END_STONE : B.NETHERRACK; w.meta[i] = 0;
      }
      d = { w, position: { x, y: floor - 1.85 }, spawn: { x, y: floor - 1.85 }, villagers: [], portals: portal?[portal]:[], mobs: [], drops: [], arrows: [], tnts: [], falling: [], chests: new Map(), furnaces: new Map(), water: new Set(), lava: new Set() };
    }
    delete a.worlds[destination];
    G.w = d.w;
    for (const k of WORLD_FIELDS) G[k] = d[k] ?? [];
    a.dimension = destination; a.visited = [...new Set([...(a.visited ?? []), destination])]; a.villagers = d.villagers; a.portals = d.portals;
    Object.assign(G.player, d.position, { spawn: d.spawn, vx: 0, vy: 0, fire: 0, invT: 2, fallTop: d.position.y });
    G.companion && Object.assign(G.companion, d.position, { x: d.position.x + 0.7, vx: 0, vy: 0, fallTop: d.position.y });
    G.cam = { ...d.position }; G.mining = null; G.target = null; G.dirty = [0, W - 1];
    G.portalBlockedUntilExit = true; G.portalHold = 0;
    if (destination === 'nether') api.populateNether();
    if (destination === 'end') api.populateEnd();
    if(destination==='school')G.time=.15;
    G.fade = 1; api.save(); api.toast(destination === 'school' ? '학교 세계에 도착했어! 교실을 걸어 보고, 오른쪽 포탈로 다시 모험을 떠날 수 있어.' : destination === 'moon' ? '달에 착륙했어! 낮은 중력으로 뛰어 보고, 하늘의 네모난 지구도 찾아봐!' : destination === 'nether' ? '네더에 도착했어. 붉은 땅과 용암을 조심해!' : destination === 'end' ? '엔드의 떠 있는 섬에 도착했어!' : '숲 세계로 돌아왔어!');
  }
  function interact() {
    const G = get();
    if (!G || G.dead || G.paused || api.UI.open) return;
    if(G.builder)return buildPlan();
    if (G.jump) return show(G.jump.completed ? '점프맵 완주!' : '극한 점프맵 기록', [`진행: ${G.jump.progress} / ${JUMP_LAST} · 시간: ${Math.floor(G.jump.elapsed)}초 · 떨어진 횟수: ${G.jump.falls}`, '황금 발판에 도착하면 완주! R로 언제든 기록을 확인할 수 있어.'], [['처음부터 다시 도전', () => { G.jump = newJumpState(); G.w = makeJumpWorld(G.adventure.seed); G.jumpRuntime = undefined; resetJumper(G.player, 0); resetJumper(G.companion, 0); G.cam = { x: G.player.x, y: G.player.y }; close(); api.save(); }]]);
    const a = G.adventure, p = G.player;
    if(BOOK_IDS.includes(p.inv[p.sel]?.id))return readBook(p.inv[p.sel].id);
    const near = (e, r) => Math.hypot(e.x - p.x, e.y - p.y) < r;
    const rocket=a.rocketSites?.[a.dimension];
    if(rocket&&Math.hypot(p.x-rocket.x,p.y+p.h-rocket.y)<5)return show(a.dimension==='moon'?'지구로 돌아가기':'달 탐사선', [a.dimension==='moon'?'네모난 지구가 기다려. 가방과 달에 지은 건물은 그대로 남아.':'우주선을 타고 달로 떠나자! 월석과 운석을 찾고, 낮은 중력으로 높이 뛰어 봐.'], [[a.dimension==='moon'?'지구로 귀환':'달로 발사!',()=>switchDimension('moon')]]);
    const v = a.villagers.find(v => near(v, 4));
    const bed = nearestBed(G);
    if (bed) return api.sleepInBed(bed.x, bed.y);
    if (v) return trade(v);
    const piglin = G.mobs.find(m => m.type === 'piglin' && !m.dead && near(m, 3));
    if (piglin) return show('피글린의 금 교환', ['금괴 4개를 주면 엔더의 눈을 줄게. 금 방어구를 입으면 피글린이 먼저 공격하지 않아.'], [['금괴 4개 → 엔더의 눈 1개', () => {
      const copy = G.player.inv.map(s => s ? { ...s } : null);
      if (countItem(copy, [I.GOLD_INGOT]) < 4) return api.toast('금괴가 4개 필요해!');
      let left = 4;
      for (let k = 0; k < copy.length && left; k++) if (copy[k]?.id === I.GOLD_INGOT) { const n = Math.min(left, copy[k].count); copy[k].count -= n; left -= n; if (!copy[k].count) copy[k] = null; }
      if (addItem(copy, I.ENDER_EYE, 1)) return api.toast('가방을 비워 줘!');
      G.player.inv.splice(0, 36, ...copy); api.hudDirty(); api.save(); close(); api.toast('엔더의 눈을 받았어!');
    }]]);
    const portal = a.portals.find(e => insidePortal(p, e)) ?? a.portals.find(e => near(e, 5));
    if (portal) {
      if (!portalIntact(G.w, portal)) { if (lightPortal()) return; return api.toast('포탈 틀이 부서졌어. 틀을 고치고 다시 켜 줘!'); }
      const enter = () => {
        if (!insidePortal(G.player, portal) || !portalIntact(G.w, portal)) return api.toast('포탈 한가운데로 걸어 들어가 줘!');
        portal.kind === 'ending' ? ending() : switchDimension(portal.kind);
      };
      return show(a.dimension !== 'overworld' ? '숲으로 돌아가는 포탈' : portal.kind === 'ending' ? '학교로 돌아가는 황금 포탈' : portal.kind === 'end' ? '엔드 포탈' : '네더 포탈', ['포탈 한가운데로 걸어 들어가 잠깐 기다리면 이동해. 포탈 바깥에서는 이동하지 않아. 지은 집과 가방은 보존돼.'], insidePortal(p, portal) ? [['포탈로 들어가기', enter]] : []);
    }
    if (lightPortal()) return;
    api.toast('주민이나 보랏빛 포탈 가까이에서 사용해 줘. 마을 침대·주민·포탈 가까이에서 R을 눌러 줘.');
  }
  function nearestBed(G) {
    for (let x = Math.floor(G.player.x) - 2; x <= G.player.x + 2; x++) for (let y = Math.floor(G.player.y) - 1; y <= G.player.y + 3; y++) {
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      if ([B.BED_FOOT, B.BED_HEAD].includes(G.w.tiles[idx(x,y)]) && Math.hypot(x-G.player.x,y-G.player.y)<2.6) return {x,y};
    }
    return null;
  }
  function lightPortal() {
    const G = get(); if (!G || G.jump) return false;
    const id = G.player.inv[G.player.sel]?.id;
    for (const kind of ['nether', 'end']) {
      const frame = findPortal(G.w, G.player.x, G.player.y, kind);
      if (!frame) continue;
      if (G.adventure.portals.some(p => p.x === frame.x && p.y === frame.y && portalIntact(G.w,p))) return false;
      if (id !== (kind === 'nether' ? I.FLINT_STEEL : I.ENDER_EYE)) { api.toast(kind === 'end' ? '엔더의 눈을 들고 R을 눌러 켜 줘!' : '부싯돌과 부시를 들고 R을 눌러 켜 줘!'); return true; }
      G.adventure.portals = G.adventure.portals.filter(p => p.x !== frame.x || p.y !== frame.y);
      G.adventure.portals.push({...frame,kind});
      openPortalSides(G.w,{...frame,kind});
      if (G.mode !== 'creative') {
        if (kind === 'nether') api.wearTool(1);
        else { const item = G.player.inv[G.player.sel]; if (--item.count === 0) G.player.inv[G.player.sel]=null; }
      }
      G.portalBlockedUntilExit = false; G.portalHold = 0; api.hudDirty(); api.save();
      api.toast('포탈이 켜졌어! 한가운데로 걸어 들어가 줘.'); return true;
    }
    return false;
  }
  function defeated(m) {
    const G = get(), a = G?.adventure;
    if(!a)return;
    if(m.type==='skeleton_summoner'){if(!a.skeletonDefeated){a.skeletonDefeated=true;a.skeletonBoss={spawned:true,defeated:true};api.toast('스켈레톤 소환사를 이겼어! 100일의 도전을 정복했어!');api.save();}return;}
    if (m.type !== 'summoner' || a.bossDefeated) return;
    a.bossDefeated = true; a.pendingEnding = false; a.boss = { spawned: true, defeated: true };
    const x = Math.max(3, Math.min(W-4, Math.floor(m.x))), floor = G.w.surface[x]-1;
    a.portals.push({...portalFrame(G.w,x,floor),kind:'ending'});
    G.dirty=[Math.max(0,x-10),Math.min(W-1,x+10)];
    api.toast('소환사 좀비를 이겼어! 현실로 돌아가는 문이 열렸어.'); api.save();
  }
  function tickPortals(dt) {
    const G=get(),a=G.adventure;
    const portal=a.portals.find(p=>insidePortal(G.player,p)&&portalIntact(G.w,p));
    if (!portal) { G.portalHold=0; G.portalBlockedUntilExit=false; return; }
    if (G.portalBlockedUntilExit || G.dead || G.mobs.some(isBoss)) return;
    G.portalHold=(G.portalHold||0)+dt;
    if (G.portalHold<.18) return;
    G.portalHold=0; G.portalBlockedUntilExit=true;
    if (portal.kind==='ending') ending(); else switchDimension(portal.kind);
  }
  function ending() {
    const G = get();
    if(G.adventure.dimension==='overworld')switchDimension('school');
    G.adventure.endingSeen = true; G.adventure.pendingEnding = false; updateJournal(G); api.save();
    show('현실로 돌아가는 길', ['소환사 좀비가 쓰러지자, 숲을 잠그던 어둠이 걷혔어.', '네가 만든 집, 함께 나눈 음식, 끝까지 싸운 용기. 그 기억을 안고 빛나는 포탈을 지나갔어.', '눈을 뜨니 다시 학교야. 이제 진짜 교실 안을 걸어 다닐 수 있어. 오른쪽 포탈로 모험 세계에 다시 돌아갈 수도 있어.', '이야기 끝 · 네모난 세계는 언제든 다시 찾아갈 수 있어.'], [['학교 세계 둘러보기', () => { G.adventure.endingSeen = true; close(); api.save(); }]]);
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
    p.vx += (move * (fluid ? 2.5 : G.jump && keys.has('ShiftRight') ? 5.6 : 4.3) - p.vx) * Math.min(1, dt * jumpGrip(G, p, move, 14));
    p.vy = Math.min(28, p.vy + (fluid ? 9 : G.adventure?.dimension==='moon'?7:30) * dt);
    if (keys.has('ArrowUp') && !api.UI.open && (p.onGround || fluid)) p.vy = fluid ? -4 : -9.4;
    if (move) p.face = move;
    moveBody(G.w, p, dt); p.stepLift *= Math.exp(-dt * 18); p.walkT += dt * Math.abs(p.vx) * 0.3;
    if (p.onGround) { if (p.y - p.fallTop > (G.adventure?.dimension==='moon'?14:3.5)) hurtCompanion(Math.floor((p.y - p.fallTop - 3)*(G.adventure?.dimension==='moon'?.25:1)), 'fall'); p.fallTop = p.y; }
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
    if(G.builder){tickBuildGuide(G,api.toast,api.save);return;}
    if (G.jump) { tickJumpWorld(G, dt, api.toast, api.save); return; }
    a.achievements ??= [];
    for (const [id, label, done] of achievementList(G)) if (done && !a.achievements.includes(id)) { a.achievements.push(id); api.toast(`도전과제 달성: ${label}`); }

    if (a.dimension === 'overworld' && G.day >= 50 && !a.bossDefeated && !a.boss?.spawned && !G.dead) summonBoss();
    let m = G.mobs.find(m => m.type === 'summoner');
    if (!m && a.dimension === 'overworld' && a.boss?.spawned && !a.bossDefeated && !G.dead) { summonBoss(); m = G.mobs.find(m=>m.type==='summoner'); }
    if (m?.dead && !a.bossDefeated) defeated(m);
    updateJournal(G);
    tickSkeletonBoss(G,dt,api);
    const beforeWorld=G.w; tickPortals(dt);
    if (G.paused || G.w !== beforeWorld) return;
    if (!m || m.dead || G.dead) return;
    if (m.y > H - 5) { m.x = Math.max(2, Math.min(W - 3, G.player.x + 12)); m.y = G.w.surface[Math.floor(m.x)] - m.h; m.vx = 0; m.vy = 0; }
    const phase = bossPhase(m.hp);
    m.burstT = (m.burstT ?? 6) - dt;
    if (m.burstT <= 0) {
      for (const p of [G.player,...(a.coop&&!G.companion.spectator?[G.companion]:[])]) if (Math.hypot(p.x-m.x,p.y-m.y)<5) api.hurtPlayer(5+phase,'소환사 좀비',m.x,{player:p});
      m.burstT = phase === 3 ? 4 : 6; G.shake=.3;
    }
    if (phase !== m.phase) { m.phase = phase; m.summonT = 1; G.shake = 0.35; api.toast(`${phase}페이즈! ${phase === 2 ? '좀비 무리가 몰려온다!' : '스켈레톤 소환과 마법 화살!'} `); }
    m.summonT -= dt; m.volleyT -= dt;
    if (m.summonT <= 0) {
      m.summonT = phase === 3 ? 4.5 : phase === 2 ? 6 : 7.5;
      const count = G.mobs.filter(e => e.summoned && !e.dead).length;
      for (let k = 0; k < Math.min(phase + 1, 12 - count); k++) {
        const x = Math.max(2, Math.min(W - 3, m.x + (k % 2 ? -1 : 1) * (3 + k)));
        const type = phase === 3 && k % 2 === 0 ? 'skeleton' : 'zombie';
        const s = api.makeMob(type, x, G.w.surface[Math.floor(x)] - 1.85);
        s.summoned = true; s.hp = phase === 1 ? 16 : 24; G.mobs.push(s);
      }
    }
    if (m.volleyT <= 0 && phase >= 2) {
      m.volleyT = phase === 3 ? 2.2 : 3.2;
      const p = a.coop && !G.companion.spectator && Math.abs(G.companion.x - m.x) < Math.abs(G.player.x - m.x) ? G.companion : G.player;
      for (const offset of phase === 3 ? [-.9, 0, .9] : [0]) api.shootArrow(m.x + .5, m.y + .6, p.x + .3, p.y + .6 + offset, 14 + phase, 'mob', phase + 2);
    }
    if (Math.abs(m.x - G.player.x) > 55 && a.dimension === 'overworld') {
      m.x = Math.max(2, Math.min(W - 3, G.player.x + 16)); m.y = G.w.surface[Math.floor(m.x)] - m.h; m.vx = 0; m.vy = 0;
    }
  }
  function draw(g, G, sx, sy, T) {
    const a = G.adventure;
    if (!a) return;
    if(G.builder)return drawBuildGuide(g,G,sx,sy,T);
    if (G.jump) return drawJumpWorld(g, G, sx, sy, T);
    drawRocket(g,G,sx,sy,T);
    if(a.dimension==='school'){g.save();g.fillStyle='#e3edcf';g.font=`${T*.3}px Galmuri11`;g.textAlign='left';g.fillText('다시 학교에 온 걸 환영해!',sx(619.4),sy(77.2));g.font=`${T*.22}px Galmuri11`;g.fillText('오늘의 수업 · 모험의 기억',sx(619.4),sy(78.2));g.restore();}
    const boss = G.mobs.find(isBoss);
    if (boss && boss.burstT < .9) { g.strokeStyle='#ffb450'; g.lineWidth=3; g.beginPath(); g.ellipse(sx(boss.x+.5),sy(boss.y+boss.h),T*5,T*.4,0,0,Math.PI*2); g.stroke(); }
    for (const p of a.portals) {
      if (!portalIntact(G.w,p)) continue;
      const x = sx(p.x), y = sy(p.y), gold = ['ending','school'].includes(p.kind), end = p.kind === 'end';
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
    $('blueprintButton').hidden=!G.builder;$('journalButton').hidden=!!G.builder;
    if(G.builder){const p=guideProgress(G);$('worldLine').textContent=`블록 따라 쌓기 · ${BLUEPRINTS[G.builder.plan].name}`;$('questLine').textContent=`완성 ${p.done} / ${p.total} · 반투명 자리에 블록 놓기 · 그림 R`;$('interactButton').textContent='그림·필요한 블록 R';$('bossHUD').hidden=true;return;}
    if (G.jump) {
      $('worldLine').textContent = `${G.jump.assisted ? '연습 · ' : ''}${themeAt(G.player.x).name} · ${G.jump.progress} / ${JUMP_LAST} · ${Math.floor(G.jump.elapsed)}초`;
      $('questLine').textContent = G.jump.completed ? `★ 완주! · 떨어진 횟수 ${G.jump.falls} · R로 다시 도전` : `체크포인트 ${checkpointNumber(G.jump.checkpoint)} · ${themeAt(G.player.x).hint}`;
      $('interactButton').textContent = '기록 · 재도전 R';
      $('bossHUD').hidden = true; return;
    }
    $('interactButton').textContent = a.rocketSites?.[a.dimension]&&Math.abs(G.player.x-a.rocketSites[a.dimension].x)<5 ? '우주선 타기 R' : nearestBed(G) ? '침대에서 자기 R' : '대화·포탈 R';
    const p = G.player;
    $('questLine').textContent = a.bossDefeated ? (a.endingSeen ? '이야기 완료 · 자유롭게 세계를 탐험해!' : '황금빛 포탈에서 현실로 돌아가자') : G.day < 50 ? `소환사 좀비까지 ${50 - G.day}일 · 집과 장비를 준비하자` : '소환사 좀비를 쓰러뜨려 포탈을 열자';
    if(a.dimension==='school')$('questLine').textContent='현실로 돌아왔어! 교실 오른쪽 포탈로 다시 모험하기';
    if(a.dimension==='moon')$('questLine').textContent='우주선 옆 R로 귀환 · 월석과 운석을 찾아봐!';
    if(a.dimension==='end')$('questLine').textContent='동쪽 바깥 섬의 보물과 탑을 찾아봐 · 모험책 J';
    $('worldLine').textContent = `${a.dimension === 'school' ? '학교 세계' : a.dimension === 'moon' ? '달 · 낮은 중력' : a.dimension === 'nether' ? '네더' : a.dimension === 'end' ? '엔드' : '숲 세계'} · ${G.day}일째 · ${W}칸${a.coop ? ` · 2P ${G.companion.spectator ? '관전 중' : `HP ${Math.ceil(G.companion.hp)}/20`}` : ''}`;
    const nearby = [...a.villagers, ...a.portals].some(e => Math.hypot(e.x - p.x, e.y - p.y) < 5);
    $('interactButton').classList.toggle('near', nearby);
    const m = G.mobs.find(m=>m.type==='skeleton_summoner'&&!m.dead)??G.mobs.find(isBoss);
    $('bossHUD').hidden = !m;
    if(m){const skull=m.type==='skeleton_summoner',max=skull?SKELETON_BOSS_HP:BOSS_HP;$('bossHealth').max=max;$('bossLabel').textContent=`${skull?'스켈레톤 소환사':'소환사 좀비'} · ${skull?skeletonPhase(m.hp):bossPhase(m.hp)}페이즈 · ${Math.ceil(m.hp)} / ${max}`;$('bossHealth').value=m.hp;}
  }
  function key(e) {
    const G = get();
    if (!G?.adventure) return false;
    if (dialog) { if (e.code === 'Escape') close(); return true; }
    if (G.paused || G.dead || api.UI.open) return false;
    if(e.code==='KeyJ'&&!G.jump&&!G.builder){readBook();return true;}
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
    if (!G.jump&&!G.builder) {
      // 현재 차원과 보관 중인 차원의 구버전 마을·포탈도 함께 보완한다.
      const a=G.adventure, dimensions=[[a.dimension,{w:G.w,villagers:a.villagers,portals:a.portals}],...Object.entries(a.worlds)];
      for (const [kind,d] of dimensions) {
        if (a.bedsVersion!==1) for (const v of d.villagers??[]) {
          const x=Math.round(v.x-4.8), y=Math.round(v.y-.2);
          if (d.w.tiles[idx(x,y)]===B.AIR && d.w.tiles[idx(x+1,y)]===B.AIR && d.w.tiles[idx(x,y+1)]===B.PLANKS) { d.w.tiles[idx(x,y)]=B.BED_FOOT; d.w.tiles[idx(x+1,y)]=B.BED_HEAD; }
        }
        for (const p of (d.portals??[]).filter(p=>p.kind==='end')) for(let dx=-1;dx<=2;dx++) for(let dy=-1;dy<=4;dy++) if(dx===-1||dx===2||dy===-1||dy===4) {const i=idx(p.x+dx,p.y+dy);if(d.w.tiles[i]===B.OBSIDIAN)d.w.tiles[i]=B.END_FRAME;}
        if(kind==='overworld'&&a.watersVersion!==1)upgradeWaters(d.w);
        if(kind==='end'&&a.endVersion!==2)addEndIslands(d.w);
        if (kind==='nether' && a.fortressVersion!==1) addNetherFortress(d.w);
        if(kind==='end')openEndScenery(d.w);
        for(const p of d.portals??[])openPortalSides(d.w,p);
      }
      a.bedsVersion=1; a.fortressVersion=1; a.endVersion=2; a.watersVersion=1;
      a.rocketSites??={};
      if(a.dimension==='overworld'&&!a.rocketSites.overworld){
        // 착륙장은 플레이어가 지은 블록을 피해서 고른다.
        const natural=new Set([B.AIR,B.GRASS,B.DIRT,B.STONE,B.SNOW_GRASS,B.SAND,B.TALL_GRASS,B.POPPY,B.DANDELION,B.OAK_TRUNK,B.BIRCH_TRUNK,B.SPRUCE_TRUNK,B.OAK_LEAVES,B.BIRCH_LEAVES,B.SPRUCE_LEAVES]);
        for(let x=W/2-32;x>W/2-150;x-=12){let clear=true;const floor=G.w.surface[x];for(let xx=x-5;xx<=x+5;xx++)for(let y=floor-10;y<=floor;y++)if(!natural.has(G.w.tiles[idx(xx,y)]))clear=false;if(clear){a.rocketSites.overworld=landingPad(G.w,x);G.dirty=[0,W-1];break;}}
      }
      if(a.dimension==='end')api.populateEnd();
      if (G.adventure.bossDefeated && !G.adventure.portals.some(p=>p.kind==='ending') && G.adventure.dimension==='overworld') { const x=Math.max(3,Math.min(W-4,Math.floor(G.player.x+5))); G.adventure.portals.push({...portalFrame(G.w,x,G.w.surface[x]-1),kind:'ending'}); }
      G.adventure.pendingEnding=false;
      if(!a.booksGiven){for(const id of BOOK_IDS){const slot=G.player.inv.lastIndexOf(null);if(slot>=0)G.player.inv[slot]={id,count:1};}a.booksGiven=true;}
    }
    G.portalBlockedUntilExit=true; G.portalHold=0;
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
      ['skeleton-boss', '100일의 뼈 왕을 꺾다', a.skeletonDefeated],
    ];
  }
  function buildPlan(){const G=get(),p=guideProgress(G),plan=BLUEPRINTS[G.builder.plan];show(`블록 따라 쌓기 · ${plan.name}`,[`완성 ${p.done} / ${p.total} · 아래 완성 그림을 따라 직접 지어 봐!`,`남은 블록 · ${[...p.needs].map(([id,n])=>`${ITEMS[id].name} ${n}개`).join(' · ')||'모두 완성!'}`,'가방의 재료는 줄어들지 않아. 반투명 자리에 같은 블록을 놓아 줘. 노란 테두리가 다음 추천 자리야. F로 날기를 켜고 스페이스로 올라가면 지붕도 만들 수 있어.'],BLUEPRINTS.map((b,i)=>[`${b.name} 그림 선택`,()=>{if(G.builder.plan!==i){G.builder.plan=i;G.builder.x=W/2-5+i*22;Object.assign(G.player,{x:G.builder.x-3,y:85.1,vx:0,vy:0,fallTop:85.1});G.cam={x:G.player.x,y:G.player.y};}api.save();buildPlan();}]));$('adventureBody').prepend(guidePreview(G));}
  $('blueprintButton').onclick=()=>buildPlan();
  function readBook(id){const G=get();if(!G||G.jump)return false;id??=bookForDimension(G.adventure.dimension);if(!BOOK_IDS.includes(id))return false;show(ITEMS[id].name,bookPages(G,id),BOOK_IDS.filter(other=>other!==id).map(other=>[ITEMS[other].name,()=>readBook(other)]));api.save();return true;}
  $('journalButton').onclick=()=>readBook();
  $('recordsButton').onclick=()=>{const G=get();if(!G)return;show('나의 세계 기록',[`설치한 블록 · ${G.stats.placed??0}회`,`부순 블록 · ${G.stats.mined??0}회`,`모험한 시간 · ${Math.floor((G.playTime??0)/60)}분`,`지금은 ${G.day}일째 · 기록은 이 세계에 저장돼.`]);};
  $('achievementButton').onclick = () => { const G = get(); if (G) show('도전과제', achievementList(G).map(([id, label, done]) => `${done || G.adventure.achievements?.includes(id) ? '◆ 달성' : '◇ 미달성'} · ${label}`)); };
  $('interactButton').onclick = interact;
  $('storyButton').onclick = story;
  return { start, reset, readBook, key, tick, draw, hud, interact, lightPortal, defeated, switchDimension, summonBoss, hurtCompanion };
}
