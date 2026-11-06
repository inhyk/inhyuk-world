// 사회적 게임: entry point. Loads the world, buildings and props, then runs the day.
import '@fontsource/jua';
import './style.css';
import * as THREE from 'three';
import { Engine } from './src/engine.js';
import { Sky } from './src/sky.js';
import { buildWorld, groundAt, SITES, PARKING, LAYOUT, isRoad } from './src/world.js';
import { Colliders } from './src/collide.js';
import { Input, Player } from './src/player.js';
import { Hud } from './src/hud.js';
import { Build } from './src/build.js';
import { Places } from './src/places.js';
import { LightPool } from './src/lights.js';
import { Minimap } from './src/minimap.js';
import { Vehicle } from './src/vehicle.js';
import { Life } from './src/life.js';
import { Day } from './src/quests.js';
import { Cinema } from './src/cinema.js';
import { Jobs } from './src/jobs.js';
import { JOBS } from './jobs.mjs';
import { dressTown, dressJapan } from './src/deco.js';
import { Flight } from './src/flight.js';
import { Cloud } from './src/cloud.js';
import { Elevators } from './src/elevator.js';
import { guide, guideText } from './src/nav.js';
import { DriveTest } from './src/drivetest.js';
import { Album } from './src/album.js';
import { Town } from './src/town.js';
import { Show } from './src/show.js';
import { Wildlife } from './src/wildlife.js';
import { prepareStatic } from './src/perf.js';
import { texReady } from './src/tex.js';
import { sfx, unlock, engineSound, ambience } from './src/audio.js';
import { newState, tickBody, fallDamage, hurt, serialize, deserialize } from './core.mjs';

const $ = (id) => document.getElementById(id);
const T0 = performance.now();
const pct = (n, what = '') => { $('load-pct').textContent = `${Math.round(n)}%`; console.info(`[boot] ${Math.round(n)}% ${what} ${Math.round(performance.now() - T0)}ms`); };
const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
const SAVE_KEY = 'social-game-save-v1';

// modules that may still be missing while the game is being built load optionally
const siteMods = import.meta.glob('./src/sites/*.js');
const propMods = import.meta.glob('./src/props/*.js');
async function optional(map, path) {
  if (!map[path]) return null;
  try { return await map[path](); } catch (e) { console.warn('load failed', path, e); return null; }
}

async function boot() {
  await document.fonts.load('40px Jua').catch(() => {});
  const low = localStorage.getItem('social-game-low') === '1';
  $('low').checked = low;
  const engine = new Engine($('game'), { quality: low ? 'low' : 'high' });
  const sky = new Sky(engine);
  const col = new Colliders();
  const hud = new Hud();
  const lights = new LightPool(engine.scene, low ? 3 : 6);
  pct(5); await frame();

  const props = {};
  for (const name of ['nature', 'street', 'car', 'character', 'blocks', 'airplane', 'japan']) props[name] = await optional(propMods, `./src/props/${name}.js`);
  pct(20, 'props'); await frame();

  let state = deserialize(localStorage.getItem(SAVE_KEY) ?? '') ?? newState();
  const world = buildWorld(engine.scene);
  for (const c of world.colliders) col.add(c);
  pct(30); await frame();

  // blocks
  const blocks = props.blocks?.BLOCKS ?? [];
  const build = new Build({ engine, colliders: col, groundAt, blocks, state, hud, sfx, isRoad });
  build.onLamp = (rec, on) => {
    if (on) lights.add({ pos: [rec.x, rec.y + 0.8, rec.z], intensity: 4, range: 7, color: 0xffd9a0, when: 'night', block: rec });
    else lights.remove((a) => a.block === rec);
  };

  // buildings
  const places = new Places(engine, col, lights, build);
  let k = 0;
  for (const def of SITES) {
    const mod = await optional(siteMods, `./src/sites/${def.mod}.js`);
    k++;
    pct(30 + (k / SITES.length) * 40, def.key);
    await frame();
    let ok = false;
    if (mod?.[def.fn]) { try { places.add(def, await mod[def.fn](def.args)); ok = true; } catch (e) { console.warn('site failed', def.key, e); } }
    if (!ok && def.fallback) {
      const fb = await optional(siteMods, `./src/sites/${def.fallback.mod}.js`);
      try { if (fb?.[def.fallback.fn]) places.add({ ...def, pos: def.fallback.pos, label: '우리 집' }, await fb[def.fallback.fn]()); } catch (e) { console.warn('fallback failed', def.key, e); }
    }
  }
  // town dressing (needs site footprints)
  let deco = { breakables: [], scatters: [] };
  try { deco = dressTown({ scene: engine.scene, props, build, colliders: col, lights, quality: engine.quality }); } catch (e) { console.warn('deco failed', e); }
  let jdeco = { scatters: [], breakables: [], fuji: null };
  try { jdeco = dressJapan({ scene: engine.scene, props, build, colliders: col, lights, quality: engine.quality, places }); } catch (e) { console.warn('japan deco failed', e); }
  deco.scatters.push(...jdeco.scatters);
  deco.breakables.push(...jdeco.breakables);
  pct(80, 'deco'); await frame();

  // player, car, people
  const input = new Input(engine.canvas);
  const player = new Player(engine, input, col, groundAt);
  if (props.character) try {
    const kid = state.mode === 'kid', girl = state.gender === 'girl';
    player.setAvatar(props.character.buildCharacter({ outfit: state.outfit, hair: kid ? (girl ? 'long' : 'short') : 'spiky', hairColor: 0x221a16, seed: girl ? 12 : 7 }));
    if (kid) { player.avatar.group.scale.setScalar(0.72); player.eye = 1.15; player.camDist = 2.8; }
    if (props.character.buildFirstPersonArm) {
      player.arm = props.character.buildFirstPersonArm({ outfit: state.outfit });
      engine.camera.add(player.arm.group);
      engine.scene.add(engine.camera);
    }
  } catch (e) { console.warn('character failed', e); }
  let vehicle = null;
  if (props.car) try {
    vehicle = new Vehicle(engine, props.car.buildCar({ color: 0x4f8fd8, style: 'sedan' }), col, groundAt);
    vehicle.parkAt = (where) => { const p = PARKING[where]; if (p) vehicle.park(p[0], p[1], p[2]); };
    vehicle.parkAt('home');
  } catch (e) { console.warn('car failed', e); vehicle = null; }
  const life = new Life({ engine, places, buildCharacter: props.character?.buildCharacter, buildCar: props.car?.buildCar, colliders: col, groundAt });
  try { life.spawnPeople(); } catch (e) { console.warn('people failed', e); }
  // 어린이 이야기: mom and dad at home (인혁: "어린이 모드에서는 아빠랑 엄마가 있게 해줘")
  if (state.mode === 'kid' && places.sites.home?.def?.mod === 'apartment' && life.buildCharacter) {
    const home = places.sites.home;
    const xf = (p) => { const c = Math.cos(home.worldYaw), sn = Math.sin(home.worldYaw); return new THREE.Vector3(home.worldPos[0] + p[0] * c + p[2] * sn, home.worldPos[1] + p[1], home.worldPos[2] - p[0] * sn + p[2] * c); };
    const fam = [
      { id: 'mom', label: '엄마랑 이야기하기', look: { hair: 'bob', outfit: 'casual', hairColor: 0x3b2a20, skin: 0xf1c9a5, seed: 41 }, pos: [6.05, 21.3, -3.55], yaw: Math.PI, pose: 'idle' },
      { id: 'dad', label: '아빠랑 이야기하기', look: { hair: 'short', outfit: 'office', hairColor: 0x221a16, skin: 0xe8b894, seed: 42 }, pos: [8.0, 21.3, 0.55], yaw: Math.PI / 2, pose: 'sit' },
    ];
    for (const f of fam) {
      try {
        const ch = life.buildCharacter(f.look);
        const w = xf(f.pos);
        ch.group.position.copy(w);
        ch.group.rotation.y = f.yaw + home.worldYaw;
        engine.scene.add(ch.group);
        life.people.push({ ch, mode: f.pose, base: f.pose, site: 'home', wave: 0, t: 0 });
        places.interactables.push({ id: f.id, label: f.label, site: 'home', key: `home:${f.id}`, radius: 1.8, wpos: w.clone().add(new THREE.Vector3(0, f.pose === 'sit' ? 1.1 : 1.5, 0)), seatW: null, screenW: null });
      } catch (e) { console.warn('family failed', e); }
    }
  }
  player.limp = !!state.hurt;
  try { life.spawnTraffic(engine.quality === 'high' ? 6 : 4); } catch (e) { console.warn('traffic failed', e); }
  if (vehicle) vehicle.others = life.cars;
  pct(92, 'life'); await frame();

  // saved blocks and broken things
  for (const b of state.placed ?? []) build.placeBlock(b.id, b.x, b.y, b.z, b.rot ?? 0, false);
  let cloud = null;
  let town = null; // 같이 사는 동네: while in a town the solo blocks are kept aside (town.solo)
  const soloPlaced = () => (town ? town.solo.forSave(build.dump()) : build.dump());
  let replacing = false; // a server save is being loaded: never write the old game over it
  let replacingAll = false; // a new story is starting
  // saveLocal: this computer only (timer, closing the tab). save: also the server, after real progress.
  const saveLocal = () => {
    if (replacing || replacingAll) return;
    state.placed = soloPlaced();
    try { localStorage.setItem(SAVE_KEY, serialize(state)); } catch { /* storage full or blocked */ }
  };
  const save = () => { if (replacing) return; saveLocal(); cloud?.queue(); };
  cloud = new Cloud({
    getState: () => { state.placed = soloPlaced(); const { v, ...rest } = JSON.parse(serialize(state)); void v; return rest; },
    applyState: (data) => { replacing = true; try { localStorage.setItem(SAVE_KEY, serialize({ ...newState(), ...data })); } catch { /* blocked */ } location.reload(); },
    toast: (t) => hud.toast(t, 2600),
    choose: (localText, serverText) => new Promise((resolve) => {
      $('pick-local').textContent = `💻 이 컴퓨터 기록: ${localText}`;
      $('pick-server').textContent = `☁️ 서버 기록: ${serverText}`;
      $('choose').classList.remove('hidden');
      document.exitPointerLock?.();
      const done = (v) => { $('choose').classList.add('hidden'); resolve(v); };
      $('pick-local').onclick = () => done('local');
      $('pick-server').onclick = () => done('server');
    }),
  });
  let saveTimer = null;
  build.onChange = () => { clearTimeout(saveTimer); saveTimer = setTimeout(save, 800); };
  build.onBreakProp = (e) => {
    if (e.item === 'shell') { state.counts.shells = (state.counts.shells ?? 0) + 1; hud.toast(`조개 +1 (${state.counts.shells}개)`, 1200); sfx('pickup'); }
    else { state.inventory[e.item] = (state.inventory[e.item] ?? 0) + e.count; hud.toast(`${e.name} → ${build.byId[e.item]?.name ?? e.item} +${e.count}`, 1300); build.renderHotbar(); }
    e.broken = true;
    town?.propBroken(e);
  };

  const minimap = new Minimap($('minimap'));
  const day = new Day({ state, hud, places, player, vehicle, sky, engine, sfx, build, input, save, life, col });
  day.g.cinema = new Cinema(day.g); // 영화관 1관: 진짜 영화 (햄찌 영화)
  day.g.jobs = new Jobs(day); // 경찰관, 소방관, 의사, 요리사, 마트 직원, 우체부 (인혁: "직업을 더 만들어줘")
  const flight = new Flight({ engine, player, build, hud, sfx, places, life, state, props, sky });
  let lifts = { prompt: () => null, update: () => {}, busy: false };
  try { lifts = new Elevators({ engine, colliders: col, places, player, hud, sfx, input }); } catch (e) { console.warn('elevators failed', e); }
  day.g.flight = flight;
  const album = new Album({ hud, input, sfx });
  day.g.album = album;
  places.onInterior = (site, parts) => { if (parts.frames?.length) album.fillFrames(parts.frames); };
  const driveTest = new DriveTest({ engine, places, vehicle, player, hud, sfx, state, day, cloud });
  day.g.driveTest = driveTest;
  // 분수 광장 공연 (인혁 계획 7)
  day.g.show = new Show({ engine, places, life, sky, state, hud, player, day, lights, input, sfx });
  if (!places.sites.license) state.license = true; // no test centre loaded: never lock the car
  day.g.onNewDay = () => {
    // trees, bushes and shells grow back every morning
    for (const e of deco.breakables) if (e.broken) {
      if (town?.holdsProp(e)) continue; // the shared town still has it broken
      e.broken = false; e.scatter.setVisible(e.index, true); build.addProp(e);
      if (e.col) col.add(e.col);
    }
  };
  // 반달가슴곰 in the forest (인혁: "숲에 곰이 가끔씩 있게 해줘")
  let wildlife = null;
  try { wildlife = new Wildlife({ engine, colliders: col, groundAt, player, vehicle, hud, sfx, state, places, flight, trees: deco.breakables }); } catch (e) { console.warn('wildlife failed', e); }
  let fresh = !localStorage.getItem(SAVE_KEY);
  day.wakeUp();
  day.setOutfit(state.outfit);
  sky.setHour(state.hour, true);
  if (blocks.length) build.renderHotbar(); else $('hotbar').classList.add('hidden');

  // compile every shader now so the first look around does not freeze
  pct(96, 'shaders'); await frame();
  prepareStatic({ engine, places, world });
  await texReady(); // texture pixels are made by workers while the town is built
  try { await lights.compileBoth(engine.renderer, engine.scene, engine.camera, null, engine.composer.readBuffer); } catch (e) { console.warn('precompile', e); }
  // behind the loading screen: everything goes to the GPU once, and one real frame makes the shadow and
  // post-processing shaders, so the first look around (and out of the flat) does not stop
  try { player.updateCamera(0); engine.renderOnce(); engine.warmUp(); } catch (e) { console.warn('first frame', e); }
  pct(100);
  $('loading').classList.add('hidden');
  $('play').classList.remove('hidden');
  $('low').addEventListener('change', (e) => { localStorage.setItem('social-game-low', e.target.checked ? '1' : '0'); engine.setQuality(e.target.checked ? 'low' : 'high'); });
  const start = () => {
    $('start').classList.add('hidden');
    hud.show();
    unlock();
    input.lock();
    sfx('alarm');
    const first = state.day === 1 && state.step === 0;
    const J = state.mode === 'job' ? JOBS[state.job] : null;
    hud.toast(first ? (state.mode === 'kid' ? '나는 이제 1학년! 오늘부터 학교에 가요 🎒' : J ? `${J.icon} 오늘부터 나는 ${J.name}! 열심히 일해서 1,000,000원을 모아 비행기를 타요 ✈️` : '돈이 별로 없어요… 회사에서 일해서 1,000,000원을 모아 비행기를 타요! ✈️') : '이어서 해요!', 3600);
    fresh = first;
    if (fresh) setTimeout(() => hud.toast('따르릉! 1일차 아침이에요. 오른쪽 퀘스트를 따라가요', 3000), 3800);
    if (matchMedia('(pointer: coarse)').matches) { $('touch').classList.remove('hidden'); input.locked = true; }
  };
  $('play').addEventListener('click', start);
  const ensureStarted = () => {
    if (!$('start').classList.contains('hidden')) {
      if ($('play').classList.contains('hidden')) return false; // a new game picks its story first
      start();
    }
    return true;
  };
  town = new Town({ engine, build, places, player, vehicle, hud, cloud, input, colliders: col, breakables: deco.breakables, props, state, flight, openLogin: () => openLogin(), ensureStarted });
  // story choice (인혁: 직장인 / 어린이, 어린이는 남자 / 여자)
  const begin = (mode, gender, job) => {
    replacingAll = true;
    const fresh2 = { ...newState(), mode, gender, ...(job ? { job } : {}), money: mode === 'kid' ? 10000 : 30000 };
    try { localStorage.setItem(SAVE_KEY, serialize(fresh2)); sessionStorage.setItem('sg-autoplay', '1'); } catch { /* blocked */ }
    location.reload();
  };
  $('m-office').onclick = () => begin('office');
  $('m-kid').onclick = () => $('kid-pick').classList.remove('hidden');
  $('m-boy').onclick = () => begin('kid', 'boy');
  $('m-girl').onclick = () => begin('kid', 'girl');
  // more jobs next to 직장인 (인혁: "직업을 더 만들어줘. 다양하게 경찰, 소방관 같은 것도 넣어.")
  $('job-row').innerHTML = Object.entries(JOBS).map(([k, J]) => `<button id="m-job-${k}" class="job" style="--jc:${J.color}"><span class="ji">${J.icon}</span><b>${J.name}</b><small>${J.pick}</small></button>`).join('');
  for (const k of Object.keys(JOBS)) $(`m-job-${k}`).onclick = () => begin('job', undefined, k);
  if (fresh) { $('play').classList.add('hidden'); $('modes').classList.remove('hidden'); }
  else {
    $('play').textContent = `이어서 하기 (${state.mode === 'kid' ? (state.gender === 'girl' ? '👧 어린이' : '👦 어린이') : state.mode === 'job' && JOBS[state.job] ? `${JOBS[state.job].icon} ${JOBS[state.job].name}` : '👔 직장인'} · ${state.day}일차)`;
    $('new-game').classList.remove('hidden');
    $('new-game').onclick = () => { $('modes').classList.remove('hidden'); $('new-game').classList.add('hidden'); $('who').textContent = '새로 시작하면 지금 기록은 지워져요'; };
  }
  let auto = false;
  try { auto = sessionStorage.getItem('sg-autoplay') === '1'; sessionStorage.removeItem('sg-autoplay'); } catch { /* none */ }
  if (auto) setTimeout(start, 50);
  let townNext = 0;
  try { townNext = Number(sessionStorage.getItem('sg-town') || 0); sessionStorage.removeItem('sg-town'); } catch { /* none */ }
  if (auto && townNext) setTimeout(() => town.join(townNext), 400);
  engine.canvas.addEventListener('click', () => { if (!day.seat && !$('start').offsetParent) input.lock(); });
  const toggleView = () => { player.toggleView(); hud.setView(player.view); };
  $('btn-view').addEventListener('click', toggleView);
  $('btn-help').addEventListener('click', () => $('help').classList.toggle('hidden'));
  $('btn-album').addEventListener('click', () => day.g.album?.open());
  setupTouch(input);
  setupLogin(cloud, input, hud, town);
  if (cloud.loggedIn) cloud.sync();

  // ------------------------------------------------------------------ frame
  let hurtT = 0;
  let navT = 0;
  if (wildlife) wildlife.onHurt = (n) => { hurt(state, n); hurtT = 0.6; sfx('hit'); };
  player.onLand = (h) => {
    const dmg = fallDamage(h);
    if (dmg > 0) { hurt(state, dmg); hurtT = 0.6; sfx('hit'); hud.toast(`아야! 체력 -${dmg}`, 1000); }
  };
  player.onStep = () => sfx('step', { surface: player.pos.x < LAYOUT.beachX ? 'sand' : places.inside(player.pos) ? 'wood' : 'stone' });
  let fainting = false;
  const look = { yaw: 0, pitch: 0 };

  engine.onUpdate((dt, t) => {
    if (input.hit('KeyV')) toggleView();
    if (input.hit('KeyH')) $('help').classList.toggle('hidden');
    if (input.hit('KeyM')) minimap.toggle();
    if (input.hit('KeyL')) openLogin();
    if (input.hit('KeyG') && !day.seat) album.open();
    if (input.hit('KeyP') && !day.seat) day.photo();
    const driving = vehicle?.driving;
    flight.update(dt, input);
    driveTest.update(dt);
    lifts.update(dt);
    // movement
    if (!driving) player.update(dt);
    if (vehicle) {
      vehicle.lights = sky.daylight < 0.4;
      vehicle.update(dt, driving ? input : null);
      if (driving) {
        look.yaw = THREE.MathUtils.clamp(look.yaw - input.mouse.dx * 0.002, -1.6, 1.6) * (input.mouse.dx ? 1 : 0.97);
        look.pitch = THREE.MathUtils.clamp(look.pitch - input.mouse.dy * 0.002, -0.5, 0.4) * (input.mouse.dy ? 1 : 0.97);
        engineSound(vehicle.speed);
        if (vehicle.impact > 9) { hurt(state, 5); hurtT = 0.5; sfx('hit'); hud.toast('쿵! 조심해서 운전해요', 1000); }
        if (input.hit('KeyF')) sfx('horn');
        player.pos.copy(vehicle.pos);
      } else engineSound(null);
    }
    // E: car, doors, things
    let prompt = '', action = null;
    if (!day.seat && !day.busy && !flight.active) {
      if (driving) {
        if (Math.abs(vehicle.speed) < 2) { prompt = '차에서 내리기'; action = () => { vehicle.driving = false; const p = vehicle.exitPoint(); player.place(p.x, Math.max(p.y, groundAt(p.x, p.z)) + 0.05, p.z, vehicle.yaw); if (player.avatar) player.avatar.group.visible = player.view === 'third'; if (player.arm) player.arm.group.visible = player.view === 'first'; sfx('carDoor'); }; }
      } else {
        const cand = [];
        if (vehicle && vehicle.pos.distanceTo(player.pos) < 3.4) cand.push({ d: vehicle.pos.distanceTo(player.pos) - 0.5, label: state.license ? '차 타기' : '차 타기 (면허 필요)', fn: () => {
          if (!state.license) { hud.toast('운전면허가 없어서 운전할 수 없어요! 면허시험장에서 시험을 봐요 🪪', 3200); sfx('wrong'); return; } vehicle.driving = true; look.yaw = look.pitch = 0; if (player.avatar) player.avatar.group.visible = false; if (player.arm) player.arm.group.visible = false; sfx('carDoor'); hud.toast('W 가속 · S 브레이크 · A D 핸들 · E 내리기', 2600); } });
        const fwd = player.forward;
        const eye = new THREE.Vector3(player.pos.x, player.pos.y + 1.6, player.pos.z);
        for (const it of places.interactables) {
          const d = it.wpos.distanceTo(eye);
          if (d > (it.radius ?? 1.8) + 0.6) continue;
          const to = it.wpos.clone().sub(eye).normalize();
          if (to.dot(fwd) < 0.35 && d > 0.9) continue;
          cand.push({ d: d - to.dot(fwd), label: it.label, fn: () => day.use(it) });
        }
        const lp = lifts.prompt(player.pos);
        if (lp) cand.push({ d: 0.5, label: lp.label, fn: lp.fn });
        const door = places.doorNear(player.pos);
        if (door) cand.push({ d: 1.2, label: door.want ? '문 닫기' : '문 열기', fn: () => { door.want = door.want ? 0 : 1; sfx('door'); } });
        cand.sort((a, b) => a.d - b.d);
        if (cand[0]) { prompt = cand[0].label; action = cand[0].fn; }
      }
    }
    hud.prompt(prompt);
    if (action && input.hit('KeyE')) action();
    // blocks (on foot, not in menus)
    build.enabled = !driving && !day.seat && !day.busy && !day.g.jobs?.tool && input.locked;
    if (blocks.length) build.update(dt, input, player.pos);
    if (player.arm) player.arm.update?.(dt, { swing: build.swing ?? 0, walk: Math.min(1, player.speed / 5) });
    build.swing = Math.max(0, (build.swing ?? 0) - dt * 3);
    if (player.arm && build.selectedId && player.arm.hold && player._held !== build.selectedId()) {
      player._held = build.selectedId();
      const p = player._held ? build.proto(player._held).clone() : null;
      if (p) p.scale.setScalar(0.1);
      player.arm.hold(p);
    }
    // body, time, world
    const inside = flight.active ? 'plane' : places.inside(player.pos);
    tickBody(state, dt, { running: player.speed > 5.5 && !driving, sleeping: day.busy });
    day.update(dt);
    sky.indoor = inside ? 1 : 0;
    // ambient occlusion matters most in rooms and costs a lot outside, so it runs indoors only
    if (engine.gtao) engine.gtao.enabled = !!inside || !!day.seat;
    sky.setHour(state.hour);
    if (!flight.active) sky.focus.copy(driving ? vehicle.pos : player.pos);
    if (jdeco.fuji) { const fm = jdeco.fuji.material; fm.emissive.copy(engine.scene.fog.color).multiplyScalar(0.55); fm.color.setScalar(0.35 + 0.4 * sky.daylight); }
    sky.update(dt, t);
    const night = 1 - sky.daylight;
    lights.update(dt, engine.camera.position, night, inside);
    places.updateDoors(dt, [player.pos, ...life.walkers.map((w) => w.ch.group.position)], sfx);
    life.update(dt, driving ? null : player.pos, driving ? vehicle.pos : null, night);
    wildlife?.update(dt);
    if (props.nature?.windUniform) props.nature.windUniform.value = t;
    const wn = world.sea.material.normalMap; if (wn) { wn.offset.set(t * 0.004, t * 0.0025); }
    if (world.foam) { world.foam.position.x = LAYOUT.beachX - 27.2 + Math.sin(t * 0.6) * 0.9; world.foam.material.opacity = 0.35 + 0.25 * Math.sin(t * 0.6 + 1); }
    if ((deco._t = (deco._t ?? 0) - dt) <= 0) {
      deco._t = 0.25;
      for (const sc of deco.scatters) sc.update(engine.camera.position);
      places.cullFar(engine.camera.position, engine.scene.fog.density);
      places.updateInteriors(engine.camera.position, (spots) => { try { life.spawnSpots(spots); } catch (e) { console.warn('people failed', e); } });
    }
    ambience(sky.daylight, night, Math.max(0, Math.min(1, (LAYOUT.beachX + 40 - player.pos.x) / 60)));
    hud.bars(state.hp, state.food);
    $('hurt').style.opacity = hurtT > 0 ? 1 : 0; hurtT -= dt;
    if (state.hp <= 0 && !fainting) {
      fainting = true;
      (async () => {
        const f = $('fade'); f.textContent = '어지러워… 쓰러졌어요. 집에서 쉬어요'; f.classList.add('on');
        if (vehicle) vehicle.driving = false;
        await new Promise((r) => setTimeout(r, 1800));
        state.hp = 60; state.food = Math.max(state.food, 50); state.money = Math.max(0, state.money - 5000);
        day.wakeUp(); f.classList.remove('on'); fainting = false;
        hud.toast('밥을 잘 챙겨 먹어요! (병원비 -5,000원)', 2600);
      })();
    }
    // navigation box while driving
    const navEl = $('nav');
    const tgt = day.target();
    if (driving && tgt && vehicle.pos.x < 1500 && tgt.x < 1500) {
      if ((navT = navT - dt) <= 0) {
        navT = 0.3;
        const f = vehicle.forward;
        const tx = guideText(guide(vehicle.pos.x, vehicle.pos.z, f.x, f.z, tgt.x, tgt.z));
        if (tx) { $('nav-arrow').textContent = tx.arrow; $('nav-head').textContent = tx.head; $('nav-sub').textContent = tx.sub; }
      }
      navEl.classList.remove('hidden');
    } else navEl.classList.add('hidden');
    town.update(dt);
    day.g.show.update(dt);
    minimap.draw(player.pos, driving ? vehicle.yaw : player.yaw, vehicle && !driving ? vehicle.pos : null, day.target(), wildlife ? [...town.dots(), ...wildlife.dots()] : town.dots());
  });
  engine.onUpdate((dt) => {
    if (flight.active) { /* flight.update placed the camera */ }
    else if (vehicle?.driving) vehicle.updateCamera(dt, player.view, look);
    else if (!day.seat) player.updateCamera(dt);
    input.endFrame();
  }, true);
  engine.start();
  addEventListener('beforeunload', saveLocal);
  setInterval(saveLocal, 15000);
  window.__game = { engine, sky, player, state, places, vehicle, build, day, life, col, flight, cloud, lifts, kind: () => day.kind, driveTest, town, deco, wildlife, jobs: day.g.jobs };
  window.__ready = true;
}

let openLogin = () => {};
function setupLogin(cloud, input, hud, town) {
  const box = $('login'), err = $('login-err');
  const refresh = () => {
    const on = cloud.loggedIn;
    $('login-out').classList.toggle('hidden', on);
    $('login-in').classList.toggle('hidden', !on);
    $('me-nick').textContent = cloud.nickname;
    $('cloud-status').textContent = cloud.statusText || '';
    $('btn-login').textContent = on ? `👤 ${cloud.nickname}` : '👤 로그인';
    $('who').textContent = on ? `${cloud.nickname} 님으로 로그인했어요 · 서버에 저장돼요` : '로그인하면 다른 컴퓨터에서도 이어서 할 수 있어요';
    $('btn-login-start').textContent = on ? '계정' : '로그인';
  };
  cloud.onStatus = refresh;
  openLogin = () => { err.textContent = ''; refresh(); box.classList.remove('hidden'); input.enabled = false; document.exitPointerLock?.(); setTimeout(() => (cloud.loggedIn ? null : $('nick').focus()), 50); };
  const close = () => { box.classList.add('hidden'); input.enabled = true; };
  $('btn-login').addEventListener('click', openLogin);
  $('btn-login-start').addEventListener('click', openLogin);
  $('login-close').addEventListener('click', close);
  const go = async (kind) => {
    const n = $('nick').value.trim(), p = $('pw').value;
    if (n.length < 2 || p.length < 4) { err.textContent = '닉네임은 2글자, 비밀번호는 4글자 이상이에요.'; return; }
    err.textContent = kind === 'signup' ? '계정 만드는 중…' : '로그인 중…';
    for (const b of box.querySelectorAll('button')) b.disabled = true;
    try {
      await (kind === 'signup' ? cloud.signup(n, p) : cloud.login(n, p));
      $('pw').value = '';
      err.textContent = '';
      hud.toast(kind === 'signup' ? `환영해요, ${cloud.nickname}! 계정을 만들었어요` : `${cloud.nickname} 님 안녕! 로그인했어요`, 2600);
      refresh();
    } catch (e) {
      err.textContent = e?.message && !/^[a-z-]+$/.test(e.message) ? e.message : '로그인이 안 됐어요. 인터넷을 확인하고 다시 해 봐요.';
    }
    for (const b of box.querySelectorAll('button')) b.disabled = false;
  };
  $('do-login').addEventListener('click', () => go('login'));
  $('do-signup').addEventListener('click', () => go('signup'));
  for (const id of ['nick', 'pw']) $(id).addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.isComposing) go('login'); });
  $('do-save').addEventListener('click', () => cloud.upload());
  $('do-logout').addEventListener('click', async () => { town?.leave(true); await cloud.logout(); hud.toast('로그아웃했어요. 이 컴퓨터에는 계속 저장돼요', 2400); refresh(); });
  refresh();
}

function setupTouch(input) {
  const stick = $('stick'), knob = $('knob');
  let sid = null, cx = 0, cy = 0;
  stick.addEventListener('pointerdown', (e) => { sid = e.pointerId; const r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; stick.setPointerCapture(sid); });
  stick.addEventListener('pointermove', (e) => {
    if (e.pointerId !== sid) return;
    const dx = Math.max(-50, Math.min(50, e.clientX - cx)), dy = Math.max(-50, Math.min(50, e.clientY - cy));
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    input.stick.x = dx / 50; input.stick.y = dy / 50;
  });
  const end = () => { sid = null; knob.style.transform = ''; input.stick.x = input.stick.y = 0; };
  stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
  let lid = null, lx = 0, ly = 0;
  $('game').addEventListener('pointerdown', (e) => { if (e.pointerType !== 'touch') return; lid = e.pointerId; lx = e.clientX; ly = e.clientY; });
  $('game').addEventListener('pointermove', (e) => { if (e.pointerId !== lid) return; input.touchLook.dx += (e.clientX - lx) * 1.4; input.touchLook.dy += (e.clientY - ly) * 1.4; lx = e.clientX; ly = e.clientY; });
  $('game').addEventListener('pointerup', (e) => { if (e.pointerId === lid) lid = null; });
  for (const b of document.querySelectorAll('#tbtns button')) {
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (b.dataset.k) { input.pressed.add(b.dataset.k); input.keys.add(b.dataset.k); }
      if (b.dataset.m === 'left') { input.mouse.left = true; input.mouse.leftPressed = true; input.locked = true; }
      if (b.dataset.m === 'right') { input.mouse.rightPressed = true; input.locked = true; }
    });
    b.addEventListener('pointerup', () => { if (b.dataset.k) input.keys.delete(b.dataset.k); if (b.dataset.m === 'left') input.mouse.left = false; });
  }
}

boot().catch((e) => { console.error(e); $('loading').textContent = '오류: ' + e.message; window.__error = String(e.stack || e); window.__ready = true; });
