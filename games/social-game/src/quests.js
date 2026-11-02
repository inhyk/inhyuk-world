// The day: quest steps, interactions, sitting, time skips, sleeping, and the mini games
// (work computer, company dinner grill, meeting presentation, beach photo).
import * as THREE from 'three';
import { dayKind, weekday, stepsFor, STEP_TIME, eat, workTask, checkWork, meatState, WAGE, SNACK_PRICE, formatClock } from '../core.mjs';
import { paint } from './mat.js';
import { rbox } from './geom.js';
import { LAYOUT } from './world.js';

const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const OUTFIT_FOR = { work: 'suit', dinner: 'suit', visit: 'suit', trip: 'beach' };

export class Day {
  constructor(g) {
    this.g = g; // {state, hud, places, player, vehicle, sky, engine, sfx, build, input, save, life}
    this.seat = null;
    this.busy = false;
    this.timeTo = null;
    this.snackCd = 0;
    this.marker = this.makeMarker();
    g.engine.scene.add(this.marker);
  }

  get s() { return this.g.state; }
  get kind() { return dayKind(this.s.day); }
  get steps() { return stepsFor(this.kind); }
  get step() { return this.steps[this.s.step] ?? null; }

  makeMarker() {
    const grp = new THREE.Group();
    const beamMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'varying vec2 vUv; uniform float uTime; void main(){ float a = (1.0 - vUv.y) * (0.55 + 0.15 * sin(uTime * 3.0 + vUv.y * 20.0)) * smoothstep(0.0, 0.08, vUv.y); gl_FragColor = vec4(vec3(1.0, 0.85, 0.35) * a, a); }',
      fog: false,
    });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 40, 16, 1, true), beamMat);
    beam.position.y = 20;
    beam.renderOrder = 5;
    grp.add(beam);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), new THREE.MeshStandardMaterial({ color: 0xffd23a, emissive: 0xffb000, emissiveIntensity: 2.5, roughness: 0.3 }));
    gem.position.y = 2.6;
    grp.add(gem);
    grp.userData = { beamMat, gem };
    return grp;
  }

  /** World target of the current step (for the marker and the minimap). */
  target() {
    const st = this.step;
    if (!st) return null;
    const [site, id] = st.target.split(':');
    const P = this.g.places;
    if (site === 'beach') return id === 'shells' ? new THREE.Vector3(-300, 0, 12) : new THREE.Vector3(-306, 0, -2);
    if (id === 'door') return P.entrance(site);
    const it = P.interactables.find((i) => i.key === st.target);
    return it ? it.wpos.clone() : P.entrance(site);
  }

  questCard() {
    const st = this.step;
    const from = Math.max(0, Math.min(this.s.step - 1, this.steps.length - 6));
    const list = this.steps.map((x, i) => ({ label: x.label + (x.count ? ` (${Math.min(this.s.counts[x.id] ?? 0, x.count)}/${x.count})` : ''), done: i < this.s.step, now: i === this.s.step })).slice(from, from + 6);
    const title = { work: '평범한 출근 날', dinner: '오늘은 회식 날', visit: '오늘은 출장 날', trip: '주말 여행' }[this.kind];
    this.g.hud.quest(st ? st.text : '오늘 할 일 끝! 자유롭게 놀아요', list);
    this.g.hud.clock(`${this.s.day}일차 · ${weekday(this.s.day)} · ${title}`, formatClock(this.s.hour), this.s.money);
  }

  complete(id) {
    const st = this.step;
    if (!st || st.id !== id) return false;
    this.s.step++;
    this.g.sfx('done');
    this.g.hud.toast(`✔ ${st.label} 완료!`);
    const t = STEP_TIME[id];
    if (t != null && this.s.hour < t) this.timeTo = t;
    this.g.save();
    return true;
  }

  // ------------------------------------------------------------------ main loop
  update(dt) {
    const s = this.s, P = this.g.places, pl = this.g.player;
    // time: slow flow plus quick skips after steps
    if (this.timeTo != null) {
      s.hour = Math.min(this.timeTo, s.hour + dt * 2.5);
      if (s.hour >= this.timeTo) this.timeTo = null;
    } else if (!this.busy) s.hour += dt / 90; // 1.5 real minutes per game hour
    if (s.hour >= 24) s.hour = 23.99;
    this.snackCd -= dt;
    // location steps
    const st = this.step;
    const where = this.g.vehicle?.driving ? this.g.vehicle.pos : pl.pos;
    if (st && !this.busy) {
      const [site, id] = st.target.split(':');
      if (st.auto && !this.seat && pl.speed > 0.5) this.complete(st.id);
      if (id === 'door' && !this.g.vehicle?.driving) {
        const e = P.entrance(site);
        if (P.inside(pl.pos) === site || (e && e.distanceTo(pl.pos) < 7)) this.complete(st.id);
      }
      if (site === 'beach' && id === 'arrive' && where.x < LAYOUT.beachX - 4) this.complete(st.id);
      if (st.id === 'shells' && (s.counts.shells ?? 0) >= 5) this.complete(st.id);
    }
    // marker
    const tg = this.target();
    this.marker.visible = !!tg && !this.seat;
    if (tg) {
      const near = where.distanceTo(tg) < 6;
      this.marker.position.set(tg.x, tg.y, tg.z);
      this.marker.userData.beamMat.uniforms.uTime.value += dt;
      this.marker.children[0].visible = !near;
      const gem = this.marker.userData.gem;
      gem.rotation.y += dt * 2;
      gem.position.y = (near ? 2.2 : 3.2) + Math.sin(performance.now() / 300) * 0.12;
    }
    this.questCard();
    if (this.seat) this.updateSeat(dt);
  }

  // ------------------------------------------------------------------ interactions
  /** Called with an interactable from places.interactables when the player presses E. */
  async use(it) {
    if (this.busy) return;
    const s = this.s, st = this.step, hud = this.g.hud;
    const now = st && st.target === it.key;
    switch (it.id) {
      case 'bed':
      case 'hotelBed':
        if ((st && st.id === 'sleep' && it.id === 'bed') || (st && st.id === 'pension' && it.id === 'hotelBed') || s.hour >= 21.5) { if (st && (st.id === 'sleep' || st.id === 'pension')) this.s.step++; await this.sleep(); }
        else hud.toast(st && st.id === 'wake' ? '벌써 일어났어요! 이제 준비해요' : '아직 잘 시간이 아니에요');
        break;
      case 'sink':
        await this.fadeAction('어푸어푸… 💦', 'water');
        hud.toast('세수 완료! 개운하다');
        if (now) this.complete('sink');
        break;
      case 'breakfast':
        if (now || s.hour < 11) {
          eat(s, 40); this.g.sfx('eat');
          const food = this.g.places.sites.home?.extra?.breakfastFood;
          if (food) food.visible = false;
          hud.toast('냠냠! 아침 맛있다 (배고픔 +40)');
          if (now) this.complete('breakfast');
        } else hud.toast('아침은 이미 먹었어요');
        break;
      case 'fridge':
        if (this.snackCd > 0) { hud.toast('방금 먹었어요. 조금 있다가!'); break; }
        this.snackCd = 25; eat(s, 15); this.g.sfx('eat'); hud.toast('냉장고에서 우유랑 과일! (배고픔 +15)');
        break;
      case 'wardrobe': {
        const outfit = OUTFIT_FOR[this.kind] ?? 'suit';
        await this.fadeAction(outfit === 'beach' ? '여행 옷으로 갈아입는 중…' : '정장으로 갈아입는 중…');
        this.setOutfit(outfit);
        hud.toast(outfit === 'beach' ? '여행 옷 완성! 신난다' : '정장 완성! 멋있다');
        if (now) this.complete('wardrobe');
        break;
      }
      case 'shower':
        await this.fadeAction('쏴아아… 🚿 샤워 중', 'water', 1600);
        this.setOutfit('pajama');
        hud.toast('샤워 끝! 잠옷으로 갈아입었어요');
        if (now) this.complete('shower');
        break;
      case 'tv': {
        const scr = this.g.places.sites.home?.extra?.tvScreen;
        if (scr) { this._tvOn = !this._tvOn; scr.emissiveIntensity = this._tvOn ? (scr.userData.onIntensity ?? 1.3) : 0; if (!this._tvOn) break; }
        hud.toast(['뉴스: “오늘은 맑고 따뜻하겠습니다”', '만화: 햄찌가 해바라기씨를 숨겨요', '요리 방송: 오늘의 메뉴는 김치찌개!'][Math.floor(Math.random() * 3)], 2600);
        break;
      }
      case 'shop':
        if (s.money < SNACK_PRICE) { hud.toast('돈이 모자라요'); break; }
        s.money -= SNACK_PRICE; eat(s, 25); this.g.sfx('coin'); this.g.sfx('eat');
        hud.toast(`삼각김밥이랑 우유! -${SNACK_PRICE.toLocaleString()}원 (배고픔 +25)`);
        break;
      case 'lunch':
        if (now || (s.hour > 11 && s.hour < 14)) {
          eat(s, 45); this.g.sfx('eat'); hud.toast('구내식당 제육볶음! (배고픔 +45)');
          if (now) this.complete('lunch');
        } else hud.toast('지금은 점심시간이 아니에요');
        break;
      case 'desk':
        if (st && (st.id === 'work' || st.id === 'work2')) await this.work(it, st);
        else hud.toast('지금은 일할 시간이 아니에요');
        break;
      case 'meeting':
        if (now) await this.meeting(it); else hud.toast('오늘은 회의가 없어요');
        break;
      case 'grill':
        if (now) await this.grill(it); else hud.toast(this.kind === 'dinner' ? '회식은 퇴근하고 해요' : '오늘은 회식 날이 아니에요');
        break;
      default:
        hud.toast(it.label);
    }
  }

  setOutfit(o) {
    this.s.outfit = o;
    this.g.player.avatar?.setOutfit?.(o);
    this.g.player.arm?.setOutfit?.(o);
  }

  async fadeAction(text, sound, ms = 1100) {
    this.busy = true;
    const f = $('fade');
    f.textContent = text;
    f.classList.add('on');
    if (sound) this.g.sfx(sound);
    await wait(ms);
    f.classList.remove('on');
    await wait(300);
    this.busy = false;
  }

  // ------------------------------------------------------------------ sleeping and mornings
  async sleep() {
    this.busy = true;
    const f = $('fade');
    f.textContent = '쿨쿨… 💤';
    f.classList.add('on');
    await wait(1600);
    const s = this.s;
    s.day++;
    s.step = 0;
    s.hour = 6.9;
    s.counts = {};
    s.food = Math.max(25, s.food - 15);
    s.hp = Math.min(100, s.hp + 30);
    s.broken = [];
    this.setOutfit('pajama');
    this.g.onNewDay?.();
    this.wakeUp();
    f.textContent = `${s.day}일차 · ${weekday(s.day)}`;
    await wait(900);
    f.classList.remove('on');
    this.busy = false;
    this.g.sfx('alarm');
    this.g.hud.toast(this.kind === 'trip' ? '주말이다! 오늘은 바다 여행 🌊' : this.kind === 'dinner' ? '따르릉! 오늘은 회식 날이에요' : this.kind === 'visit' ? '따르릉! 오늘은 별빛테크로 출장!' : '따르릉! 일어날 시간이에요', 3000);
    this.g.save();
  }

  /** Put the player beside the bed and the car on the driveway. */
  wakeUp() {
    const home = this.g.places.sites.home;
    const pl = this.g.player;
    if (home?.spawn) {
      const [x, y, z] = xformPt(home, home.spawn.pos);
      pl.place(x, y, z, (home.spawn.yaw ?? 0) + home.worldYaw);
    } else pl.place(-150, 0.1, -15, 0);
    this.g.vehicle?.parkAt?.('home');
    const food = home?.extra?.breakfastFood;
    if (food) food.visible = true;
  }

  // ------------------------------------------------------------------ sitting (desk, grill, meeting)
  sit(it) {
    const pl = this.g.player;
    this.seat = { it, t: 0, from: this.g.engine.camera.position.clone(), fromQ: this.g.engine.camera.quaternion.clone() };
    pl.frozen = true;
    this.g.build.enabled = false;
    this.g.hud.prompt('');
    document.exitPointerLock?.();
  }
  stand() {
    const pl = this.g.player;
    this.seat = null;
    pl.frozen = false;
    this.g.build.enabled = true;
    const scr = $('screen');
    scr.innerHTML = '';
    scr.classList.add('hidden');
    this.g.input.lock();
  }
  updateSeat(dt) {
    const se = this.seat, cam = this.g.engine.camera, w = se.it.seatW;
    se.t = Math.min(1, se.t + dt * 1.8);
    const k = se.t * se.t * (3 - 2 * se.t);
    const yaw = w.yaw, pitch = w.pitch;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
    cam.position.lerpVectors(se.from, w.pos, k);
    cam.quaternion.slerpQuaternions(se.fromQ, q, k);
    const scr = se.it.screenW;
    if (scr && se.t >= 1) this.placeScreen(scr);
  }
  /** Position the #screen overlay exactly over a 3D screen rectangle. */
  placeScreen(scr) {
    const cam = this.g.engine.camera;
    const right = new THREE.Vector3(Math.cos(scr.yaw), 0, -Math.sin(scr.yaw));
    const pts = [];
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const p = scr.center.clone().addScaledVector(right, a * scr.w / 2);
      p.y += b * scr.h / 2;
      p.project(cam);
      pts.push([(p.x + 1) / 2 * innerWidth, (1 - p.y) / 2 * innerHeight]);
    }
    const x0 = Math.min(...pts.map((p) => p[0])), x1 = Math.max(...pts.map((p) => p[0]));
    const y0 = Math.min(...pts.map((p) => p[1])), y1 = Math.max(...pts.map((p) => p[1]));
    const el = $('screen');
    el.style.left = `${x0}px`; el.style.top = `${y0}px`; el.style.width = `${x1 - x0}px`; el.style.height = `${y1 - y0}px`;
    el.style.fontSize = `${Math.max(9, Math.min((y1 - y0) / 17, (x1 - x0) / 30))}px`;
    el.classList.remove('hidden');
  }

  // ------------------------------------------------------------------ work computer
  async work(it, st) {
    this.sit(it);
    const s = this.s;
    s.counts[st.id] = s.counts[st.id] ?? 0;
    const need = st.tasks ?? 2;
    const el = $('screen');
    await wait(700);
    await new Promise((resolve) => {
      const show = () => {
        const n = s.counts[st.id];
        if (n >= need) { resolve(true); return; }
        const task = workTask(s.day, n + (st.id === 'work2' ? 2 : 0));
        el.innerHTML = `<div class="os"><div class="os-bar"><b>SEONN OS</b><span>업무 ${n + 1} / ${need}</span><span class="sp"></span><span>${formatClock(s.hour)}</span><button class="alt exit" id="leave">일어나기</button></div>
          <div class="os-win"><div class="os-title">📁 ${task.title}</div><div class="os-body"><p>${task.prompt}</p><div id="task-area" class="${task.kind === 'mail' ? 'col' : 'row'}"></div></div></div></div>`;
        const area = el.querySelector('#task-area');
        const ok = this._ok = () => { this._ok = null; this.g.sfx('done'); s.counts[st.id]++; s.hour = Math.min(s.hour + 1.4, 18); this.g.hud.toast('업무 완료! 👍', 1200); setTimeout(show, 500); };
        const bad = () => { this.g.sfx('wrong'); area.classList.remove('shake'); void area.offsetWidth; area.classList.add('shake'); };
        if (task.kind === 'type') {
          area.innerHTML = '<input id="ti" autocomplete="off" placeholder="여기에 쳐요"><button id="tb">보내기</button>';
          const inp = area.querySelector('#ti');
          const go = () => (checkWork(task, inp.value) ? ok() : bad());
          area.querySelector('#tb').onclick = go;
          inp.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.isComposing) go(); };
          setTimeout(() => inp.focus(), 50);
        } else if (task.kind === 'sort') {
          const picked = [];
          const shuffled = [...task.nums].sort((a, b) => ((a * 7 + s.day) % 5) - ((b * 7 + s.day) % 5));
          for (const v of shuffled) {
            const b = document.createElement('button'); b.className = 'alt'; b.textContent = v;
            b.onclick = () => {
              if (task.answer[picked.length] !== v) { bad(); picked.length = 0; area.querySelectorAll('button').forEach((x) => x.classList.remove('on')); return; }
              picked.push(v); b.classList.add('on'); this.g.sfx('click');
              if (picked.length === task.answer.length) ok();
            };
            area.appendChild(b);
          }
        } else if (task.kind === 'mail') {
          task.options.forEach((t, i) => { const b = document.createElement('button'); b.className = 'alt'; b.textContent = t; b.onclick = () => (checkWork(task, i) ? ok() : bad()); area.appendChild(b); });
        } else {
          const marks = task.docs.map(() => false);
          area.className = 'col';
          const grid = document.createElement('div'); grid.className = 'docs'; area.appendChild(grid);
          task.docs.forEach((d, i) => { const c = document.createElement('div'); c.className = 'doc'; c.textContent = d.name; c.onclick = () => { marks[i] = !marks[i]; c.classList.toggle('on', marks[i]); this.g.sfx('click'); }; grid.appendChild(c); });
          const b = document.createElement('button'); b.textContent = '도장 다 찍었어요 · 제출'; b.style.alignSelf = 'flex-start'; b.onclick = () => (checkWork(task, marks) ? ok() : bad()); area.appendChild(b);
        }
        el.querySelector('#leave').onclick = () => resolve(false);
      };
      show();
    });
    const finished = (s.counts[st.id] ?? 0) >= (st.tasks ?? 2);
    this.stand();
    if (finished) {
      if (st.id === 'work2' || (this.kind === 'visit' && st.id === 'work')) {
        s.money += WAGE; this.g.sfx('coin');
        this.g.hud.toast(`오늘 일당 들어왔다! +${WAGE.toLocaleString()}원 💰`, 3000);
      }
      this.complete(st.id);
    }
  }

  // ------------------------------------------------------------------ meeting at the other company
  async meeting(it) {
    this.sit(it);
    const el = $('screen');
    const qs = [
      { q: '“새 제품의 좋은 점이 뭔가요?”', o: ['아주 빠르고 튼튼해요!', '잘 모르겠어요…', '점심 뭐 먹지?'], a: 0 },
      { q: '“가격은 어떻게 되나요?”', o: ['비밀이에요', '합리적인 가격으로 드릴게요', '100억 원이요!'], a: 1 },
      { q: '“언제 받을 수 있나요?”', o: ['100년 뒤에요', '다음 주에 바로 보내 드릴게요', '몰라요'], a: 1 },
    ];
    await wait(700);
    let i = 0;
    const ok = await new Promise((resolve) => {
      const show = () => {
        if (i >= qs.length) { resolve(true); return; }
        const q = qs[i];
        el.innerHTML = `<div class="meet"><h2>발표 ${i + 1} / ${qs.length}</h2><p>별빛테크 손님: ${q.q}</p><div class="row" id="opts"></div><button class="alt exit" id="leave">나가기</button></div>`;
        const box = el.querySelector('#opts');
        this._ok = () => { this._ok = null; this.g.sfx('done'); i++; show(); };
        q.o.forEach((t, k) => { const b = document.createElement('button'); b.textContent = t; b.onclick = () => { if (k === q.a) { this.g.sfx('done'); i++; show(); } else { this.g.sfx('wrong'); box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake'); } }; box.appendChild(b); });
        el.querySelector('#leave').onclick = () => resolve(false);
      };
      show();
    });
    this.stand();
    if (ok) {
      this.s.money += 30000; this.g.sfx('coin');
      this.g.hud.toast('계약 성공! 🎉 보너스 +30,000원', 3000);
      this.complete('meeting');
    }
  }

  // ------------------------------------------------------------------ company dinner grill
  async grill(it) {
    const site = this.g.places.sites.restaurant;
    const gt = site?.extra?.grillTop;
    if (!gt) { this.complete('dinner'); return; }
    this.sit(it);
    const center = new THREE.Vector3(...xformPt(site, gt.center));
    const R = (gt.radius ?? 0.22) * 0.75;
    const scene = this.g.engine.scene;
    const meats = [];
    const lean = [0xf0a3a0, 0xb8693a, 0x2e1c14], fat = [0xfbe9e0, 0xe8b468, 0x4a3020];
    const lerp3 = (cs, t) => { const a = new THREE.Color(cs[0]), b = new THREE.Color(cs[1]), c = new THREE.Color(cs[2]); return t < 1 ? a.lerp(b, t) : b.lerp(c, Math.min(1, t - 1)); };
    const spawn = (k) => {
      const grp = new THREE.Group();
      const mL = paint(0xffffff, 0.55).clone(), mF = paint(0xffffff, 0.45).clone();
      const a = rbox(0.15, 0.012, 0.065, 0.005), b = rbox(0.15, 0.008, 0.065, 0.003);
      for (const [geo, m, y] of [[a, mL, 0.006], [b, mF, 0.016], [a, mL, 0.026]]) { const mm = new THREE.Mesh(geo, m); mm.position.y = y; mm.castShadow = true; grp.add(mm); }
      const ang = (k / 5) * Math.PI * 2 + Math.random() * 0.3;
      grp.position.set(center.x + Math.cos(ang) * R * 0.75, center.y + 0.003, center.z + Math.sin(ang) * R * 0.75);
      grp.rotation.y = ang + Math.PI / 2;
      scene.add(grp);
      const me = { grp, mL, mF, t: 0, side: 0 };
      grp.traverse((o) => { o.userData.meat = me; });
      meats.push(me);
    };
    for (let k = 0; k < 5; k++) spawn(k);
    const help = document.createElement('div');
    help.id = 'grill-help';
    document.body.appendChild(help);
    let eaten = 0;
    const need = 5;
    const ray = new THREE.Raycaster();
    const tick = setInterval(() => this.g.sfx('sizzle'), 900);
    await wait(600);
    await new Promise((resolve) => {
      const upd = () => {
        help.innerHTML = `🥩 노릇노릇 익은 고기를 클릭해서 먹어요! (${eaten}/${need}) · 덜 익으면 뒤집고, 타면 버려요 <button id="gq" style="margin-left:8px">그만 먹기</button>`;
        help.querySelector('#gq').onclick = () => resolve();
      };
      upd();
      const onClick = (e) => {
        const r = this.g.engine.canvas.getBoundingClientRect();
        ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.g.engine.camera);
        const hits = ray.intersectObjects(meats.map((m) => m.grp), true);
        const me = hits[0]?.object.userData.meat;
        if (!me) return;
        const st = meatState(me.t);
        if (st === 'raw') { me.side ^= 1; me.grp.rotation.x = me.side * Math.PI; me.t = Math.max(0, me.t - 1); this.g.hud.toast('아직 덜 익었어! 뒤집기', 900); this.g.sfx('click'); }
        else if (st === 'cooked') { eaten++; eat(this.s, 10); this.g.sfx('eat'); this.g.hud.toast(['냠냠! 맛있다', '쌈 싸 먹기 최고!', '고기 굿!'][eaten % 3], 900); scene.remove(me.grp); meats.splice(meats.indexOf(me), 1); if (eaten < need) spawn(eaten); upd(); if (eaten >= need) setTimeout(resolve, 600); }
        else { this.g.hud.toast('앗, 탔다! 버리자', 900); this.g.sfx('wrong'); scene.remove(me.grp); meats.splice(meats.indexOf(me), 1); spawn(eaten + 3); }
      };
      this.g.engine.canvas.addEventListener('click', onClick);
      const loop = setInterval(() => {
        for (const me of meats) {
          me.t += 0.1;
          const k = Math.min(2, me.t / 5.5);
          me.mL.color.copy(lerp3(lean, k)); me.mF.color.copy(lerp3(fat, k));
        }
      }, 100);
      this._grillCleanup = () => { this.g.engine.canvas.removeEventListener('click', onClick); clearInterval(loop); };
    });
    this._grillCleanup?.();
    clearInterval(tick);
    for (const me of meats) scene.remove(me.grp);
    help.remove();
    this.stand();
    if (eaten >= need) {
      this.g.sfx('cheers');
      this.g.hud.toast('다 같이 건배! 🥤 사이다로 짠!', 3000);
      this.g.life?.cheers?.('restaurant');
      this.complete('dinner');
    }
  }

  // ------------------------------------------------------------------ photo (P)
  photo() {
    const eng = this.g.engine;
    eng.renderOnce();
    const url = eng.canvas.toDataURL('image/jpeg', 0.85);
    this.g.sfx('shutter');
    const fl = $('flash'); fl.style.transition = 'none'; fl.style.opacity = '0.9'; requestAnimationFrame(() => { fl.style.transition = 'opacity .6s'; fl.style.opacity = '0'; });
    $('photo')?.remove();
    const d = document.createElement('div');
    d.id = 'photo';
    const atBeach = this.g.player.pos.x < LAYOUT.beachX;
    d.innerHTML = `<img src="${url}" alt="사진"><div>${atBeach ? '🌊 바다 여행' : '📷 찰칵'} · ${this.s.day}일차</div>`;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 2600);
    if (atBeach && this.step?.id === 'photo') this.complete('photo');
  }
}

export function xformPt(site, p) {
  const [px, py, pz] = site.worldPos, c = Math.cos(site.worldYaw), s = Math.sin(site.worldYaw);
  return [px + p[0] * c + p[2] * s, py + p[1], pz - p[0] * s + p[2] * c];
}
