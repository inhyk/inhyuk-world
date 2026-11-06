// 세온 시네마 1관: a real movie on the big screen (인혁: "진짜 영화를 볼 수 있게 해줘", drawing: a big screen
// with "햄찌 영화 13분 31초" and two seats with people in front, one holding popcorn).
// The movie is the 콩떡이 극장판 "햄찌 영화": opening + 콩떡이 1~10화 + 극장판 특별편 and credits = 811 s.
// It plays as a THREE.VideoTexture on the screen, with its sound, while the room goes dark.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { eat } from '../core.mjs';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Parts of the movie in order. dur = real length of each mp4 (seconds). */
export const MOVIE = {
  title: '햄찌 영화',
  parts: [
    { file: 'movie-open.mp4', name: '오프닝 · 햄찌 영화', dur: 14 },
    { file: 'ep1.mp4', name: '1화 · 콩떡이의 간식 대작전', dur: 58.6 },
    { file: 'ep2.mp4', name: '2화 · 쌩쌩이의 100킬로 대도전', dur: 69.1 },
    { file: 'ep3.mp4', name: '3화 · 새 친구 눈송이가 왔다?!', dur: 58.1 },
    { file: 'ep4.mp4', name: '4화 · 아기 햄스터가 태어났다?!', dur: 59.6 },
    { file: 'ep5.mp4', name: '5화 · 햄스터 운동회!', dur: 66.6 },
    { file: 'ep6.mp4', name: '6화 · 야생 햄스터 삼촌이 왔다?!', dur: 63.6 },
    { file: 'ep7.mp4', name: '7화 · 콩떡이의 영상통화', dur: 59.6 },
    { file: 'ep8.mp4', name: '8화 · 아기 햄스터 유치원', dur: 58.6 },
    { file: 'ep9.mp4', name: '9화 · 햄스터 건강검진', dur: 58.6 },
    { file: 'ep10.mp4', name: '10화 · 콩떡이의 생일 파티!', dur: 61.1 },
    { file: 'movie-special.mp4', name: '극장판 특별편 · 콩떡이네 영화관 나들이', dur: 183.5 },
  ],
};
const sum = (list) => Math.round(list.reduce((a, p) => a + p.dur, 0) * 1000) / 1000;
MOVIE.total = sum(MOVIE.parts); // 811 s = 13분 31초
const START = MOVIE.parts.map((_, i) => sum(MOVIE.parts.slice(0, i)));
const FOV_MOVIE = 54; // the camera zooms in a little while the film runs (the screen looks big, like the drawing)
const MOVIE_HOURS = 2; // the whole movie moves the game clock by 2 hours, like a real cinema visit
const POPCORN = 30;
const _q = new THREE.Quaternion(), TILT = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.35, 0, 0));

/** Where the videos live: same origin on seonn.dev, the live site from the Vite dev server, or ?movies=<url>. */
export function videoBase(loc = location) {
  const q = new URLSearchParams(loc.search).get('movies');
  if (q) return q.endsWith('/') ? q : `${q}/`;
  if (loc.pathname.includes('/play/')) return `${loc.origin}/play/kongtteok/videos/`;
  return 'https://seonn.dev/play/kongtteok/videos/';
}

export const clockText = (sec) => { const s = Math.max(0, Math.ceil(sec - 0.001)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

const CSS = `
#cinema-ui { position: fixed; left: 16px; bottom: 16px; z-index: 40; width: min(620px, calc(100vw - 32px)); padding: 10px 14px 12px; border-radius: 18px; background: rgba(14, 10, 14, .72); border: 1px solid rgba(255,255,255,.18); color: #fffaf0; font-size: 16px; box-shadow: 0 6px 22px rgba(0,0,0,.45); }
#cinema-ui .cr { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
#cinema-ui .ct { color: #ffd75a; font-size: 20px; }
#cinema-ui .cp { flex: 1; min-width: 120px; color: #e8e2d8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#cinema-ui .cl { font-size: 20px; color: #fff; } #cinema-ui .cl b { font-weight: normal; color: #9fe39a; font-variant-numeric: tabular-nums; }
#cinema-ui .cbar { position: relative; height: 8px; margin: 8px 0 9px; border-radius: 5px; background: rgba(255,255,255,.16); overflow: hidden; display: flex; gap: 2px; }
#cinema-ui .cbar i { display: block; height: 100%; background: rgba(255,255,255,.12); position: relative; }
#cinema-ui .cbar i s { position: absolute; inset: 0 auto 0 0; background: linear-gradient(90deg, #ffb35a, #ffd75a); }
#cinema-ui button { font-family: inherit; font-size: 15px; padding: 6px 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,.25); background: rgba(255,255,255,.1); color: #fffaf0; cursor: pointer; }
#cinema-ui button:hover { background: rgba(255,255,255,.2); }
#cinema-ui button.sound { background: #e8505a; border-color: #ff9aa0; }
#cinema-ui kbd { font-family: inherit; padding: 0 5px; border-radius: 5px; background: #ffe39a; color: #2b2620; margin-left: 4px; }
body.cinema-on #hud > :not(#toast) { display: none !important; }
@media (max-width: 640px) { #cinema-ui { font-size: 13px; } #cinema-ui .ct, #cinema-ui .cl { font-size: 16px; } #cinema-ui kbd { display: none; } }
`;

/** Red and white striped popcorn bucket, about 0.24 m tall, origin at the bottom. */
function popcornBucket() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 16;
  const x = c.getContext('2d');
  for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#fff8ee' : '#d8232f'; x.fillRect(i * 16, 0, 16, 16); }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const g = new THREE.Group();
  g.name = 'popcorn';
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.06, 0.2, 24, 1, true), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, side: THREE.DoubleSide }));
  cup.position.y = 0.1;
  const base = new THREE.Mesh(new THREE.CircleGeometry(0.06, 20), cup.material);
  base.rotation.x = Math.PI / 2; base.position.y = 0.002;
  const R = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const bits = [];
  for (let i = 0; i < 46; i++) {
    const a = R() * Math.PI * 2, r = Math.sqrt(R()) * 0.082;
    const k = new THREE.IcosahedronGeometry(0.019 + R() * 0.008, 0);
    k.translate(Math.cos(a) * r, 0.2 + (1 - r / 0.09) * 0.045 + R() * 0.012, Math.sin(a) * r);
    bits.push(k);
  }
  const corn = new THREE.Mesh(mergeGeometries(bits), new THREE.MeshStandardMaterial({ color: 0xfff0c2, roughness: 0.85, emissive: 0x3a2a08 }));
  g.add(cup, base, corn);
  for (const m of g.children) { m.castShadow = false; m.receiveShadow = false; }
  return g;
}

/** "햄찌 영화 · 13분 31초" poster shown on the screen until the film has its first frame. */
function posterTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 576;
  const x = c.getContext('2d');
  const gr = x.createLinearGradient(0, 0, 0, 576); gr.addColorStop(0, '#2a1418'); gr.addColorStop(1, '#0c080a');
  x.fillStyle = gr; x.fillRect(0, 0, 1024, 576);
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = '150px Jua, sans-serif'; x.lineWidth = 14; x.strokeStyle = '#3a1a0a'; x.strokeText('햄찌 영화', 512, 220); x.fillStyle = '#ffd75a'; x.fillText('햄찌 영화', 512, 220);
  x.font = '86px Jua, sans-serif'; x.fillStyle = '#ffffff'; x.fillText('13분 31초', 512, 360);
  x.font = '38px Jua, sans-serif'; x.fillStyle = '#e8b8a0'; x.fillText('콩떡이 극장판 · 곧 시작해요', 512, 470);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Free the shapes (and with mats=true the materials and textures) of a tree we made. */
function dispose(obj, mats) {
  obj.traverse((o) => {
    o.geometry?.dispose();
    if (mats && o.material) { o.material.map?.dispose(); o.material.dispose(); }
  });
}

export class Cinema {
  constructor(g) {
    this.g = g; // {engine, places, player, build, hud, sfx, life, sky, state, save}
    this.active = false;
    this.video = null;
    this.part = 0;
    this.pos = 0; // seconds into the whole movie
    this.maxPos = 0;
    this.popcorn = 0;
  }

  get movie() { return MOVIE; }

  /** Position in the whole movie (seconds) and what is playing, for the UI and tests. */
  get status() {
    const v = this.video;
    return { active: this.active, part: this.part, name: MOVIE.parts[this.part]?.name, pos: this.pos, left: MOVIE.total - this.pos, total: MOVIE.total, playing: !!v && !v.paused && !v.ended && v.readyState > 2, muted: !!v?.muted, time: v?.currentTime ?? 0, src: v?.currentSrc ?? '', popcorn: this.popcorn };
  }

  /** Sit in the seat (already done by Day.visit) and watch until the end or until E. */
  async watch(it) {
    if (this.active) return;
    this.active = true;
    const g = this.g;
    this.it = it;
    this.base = videoBase();
    this.part = 0; this.pos = 0; this.maxPos = 0; this.errors = 0;
    this.popcorn = POPCORN;
    this.dim = 0; this.dimTarget = 0;
    this.fov0 = g.engine.camera.fov;
    this.makeVideo();
    this.play(0); // inside the E key press, so the browser lets the film play with sound
    this.makeScreen(it);
    this.makeAudience(it);
    this.holdPopcorn(true);
    this.makeUi();
    this.listen(true);
    document.body.classList.add('cinema-on');
    if (g.player.avatar) g.player.avatar.group.visible = false;
    this.offUpdate = g.engine.onUpdate((dt) => this.update(dt), true);
    g.hud.toast('🎟️ 영화표랑 🍿 팝콘을 받았어요! 불이 꺼져요… 쉿!', 2600);
    this.dimTarget = 1;
    const how = await new Promise((resolve) => { this.finish = resolve; });
    this.finish = null;
    this.video.pause();
    this.dimTarget = 0;
    await wait(900); // lights come back up
    this.cleanup();
    // game clock: a whole movie is 2 hours, leaving early counts only what was watched
    const hours = Math.min(MOVIE_HOURS, MOVIE_HOURS * this.maxPos / MOVIE.total);
    const s = g.state;
    if (hours > 0.01) s.hour = Math.max(s.hour, Math.min(23.5, s.hour + hours));
    const min = Math.round(this.maxPos / 60);
    if (how === 'end') g.hud.toast('“햄찌 영화” 끝! 정말 재밌었다 🍿👏', 3000);
    else if (how === 'error') g.hud.toast('영화를 불러오지 못했어요. 인터넷을 확인하고 다시 와요 🎬', 3200);
    else g.hud.toast(min ? `영화를 ${min}분 보고 나왔어요 🎬` : '영화관에서 나왔어요 🎬', 2600);
    g.save?.();
    this.active = false;
  }

  /** Stop watching (E key, button or tests). */
  leave(how = 'leave') { this.finish?.(how); }

  /** Skip to the next part (N key or button). */
  next() {
    if (!this.finish) return;
    if (this.part + 1 >= MOVIE.parts.length) { this.leave('end'); return; }
    this.g.sfx?.('click');
    this.play(this.part + 1);
  }

  makeVideo() {
    const v = document.createElement('video');
    v.crossOrigin = 'anonymous';
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.preload = 'auto';
    v.volume = 1;
    v.addEventListener('ended', () => { if (this.video === v && this.finish) this.next(); });
    v.addEventListener('playing', () => { this.errors = 0; this.showFilm(); });
    v.addEventListener('error', () => {
      if (this.video !== v || !this.finish || !v.getAttribute('src')) return;
      console.warn('movie part failed', v.currentSrc, v.error);
      if (++this.errors >= 3) { this.leave('error'); return; }
      this.g.hud.toast(`${MOVIE.parts[this.part].name}: 불러오지 못해서 다음으로 넘어가요`, 2200);
      setTimeout(() => { if (this.video === v && this.finish) this.next(); }, 1200);
    });
    this.video = v;
  }

  play(i) {
    const v = this.video;
    this.part = i;
    v.src = this.base + MOVIE.parts[i].file;
    const p = v.play();
    p?.catch?.((e) => {
      if (e?.name !== 'NotAllowedError' || this.video !== v) return;
      // no sound allowed yet: play muted and show a big "소리 켜기" button
      v.muted = true;
      v.play().catch(() => {});
      this.ui?.querySelector('.sound')?.classList.remove('hidden');
    });
  }

  unmute() {
    const v = this.video;
    if (!v) return;
    v.muted = false;
    v.play().catch(() => {});
    this.ui?.querySelector('.sound')?.classList.add('hidden');
  }

  // ------------------------------------------------------------------ the screen
  makeScreen(it) {
    const scr = it.screenW;
    this.screen = null;
    if (!scr) return;
    const n = new THREE.Vector3(Math.sin(scr.yaw), 0, Math.cos(scr.yaw));
    const grp = new THREE.Group();
    grp.position.copy(scr.center).addScaledVector(n, 0.13); // in front of the projector beam's end, so the beam does not haze the film
    grp.rotation.y = scr.yaw;
    // black cloth over the painted picture, then the film (16:9) in the middle
    const black = new THREE.Mesh(new THREE.PlaneGeometry(scr.w, scr.h), new THREE.MeshBasicMaterial({ color: 0x050505 }));
    const fh = Math.min(scr.h, scr.w * 9 / 16), fw = fh * 16 / 9;
    this.tex = new THREE.VideoTexture(this.video);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.minFilter = THREE.LinearMipmapLinearFilter; this.tex.magFilter = THREE.LinearFilter; this.tex.generateMipmaps = true; // the screen is small on the monitor: mipmaps keep it from sparkling
    this.poster = posterTexture();
    // AgX tone mapping greys out plain white a little, so the film is pushed up to look like a bright cinema screen
    const film = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), new THREE.MeshBasicMaterial({ map: this.poster, color: new THREE.Color(1.35, 1.35, 1.35), toneMapped: false }));
    film.position.z = 0.01;
    film.name = 'cinema-film';
    for (const m of [black, film]) { m.castShadow = false; m.receiveShadow = false; }
    grp.add(black, film);
    grp.userData.dynamic = true;
    this.g.engine.scene.add(grp);
    this.screen = grp;
    this.film = film;
    // the projector beam's open end draws a ring over the film in the dark, so it rests while the film runs
    this.beams = [];
    this.g.places.sites[it.site]?.interior?.group?.traverse((o) => { if (o.material?.name === 'civicBeam' && o.visible) { o.visible = false; this.beams.push(o); } });
    // a light in front of the screen that takes the film's colours (the audience glows a little)
    const lights = this.g.places.lights;
    if (lights) {
      this.dimmed = lights.anchors.filter((a) => a.site === it.site).map((a) => ({ a, i: a.intensity }));
      this.glow = { pos: scr.center.clone().addScaledVector(n, 3.2).setY(scr.center.y - 0.4), color: 0x8090b0, intensity: 0, range: 16, when: 'always', site: it.site };
      lights.add(this.glow);
      this.glow = lights.anchors[lights.anchors.length - 1];
    }
    this.sampler = document.createElement('canvas');
    this.sampler.width = 4; this.sampler.height = 2;
    this.sampleT = 0;
  }

  showFilm() {
    if (this.film && this.film.material.map !== this.tex) { this.film.material.map = this.tex; this.film.material.needsUpdate = true; }
  }

  // ------------------------------------------------------------------ people in front (the drawing) and popcorn
  makeAudience(it) {
    this.audience = [];
    const life = this.g.life, site = this.g.places.sites[it.site];
    if (!life?.buildCharacter || !site || !it.seat) return;
    const [ex, ey, ez] = it.seat.pos; // eye of the movie seat (row 4, seat 4) in building space
    const c = Math.cos(site.worldYaw), s = Math.sin(site.worldYaw);
    const W = (p) => new THREE.Vector3(site.worldPos[0] + p[0] * c + p[2] * s, site.worldPos[1] + p[1], site.worldPos[2] - p[0] * s + p[2] * c);
    // rows are 1.2 m apart and 0.22 m lower towards the screen, seats 0.6 m apart; the eye is 1.17 m above the row
    const seats = [[-1, -1, true], [-1, 1, false], [-3, 1, false], [-4, -1, false]];
    seats.forEach(([dr, ds, pop], k) => {
      const ch = life.person(900 + k, k % 2 ? 'casual' : 'office');
      ch.group.position.copy(W([ex + dr * 1.2, ey - 1.17 + dr * 0.22, ez + ds * 0.6]));
      ch.group.rotation.y = Math.PI / 2 + site.worldYaw;
      this.g.engine.scene.add(ch.group);
      const p = { ch, mode: 'sit', base: 'sit', site: it.site, wave: 0, t: k * 3.1 };
      life.people.push(p);
      let cup = null;
      if (pop && ch.bones?.handL) {
        cup = popcornBucket();
        cup.scale.setScalar(1.15);
        ch.bones.handL.add(cup);
        cup.position.set(-0.02, -0.04, -0.06);
      }
      this.audience.push({ p, cup });
    });
  }

  /** Popcorn person: keep the left hand up at the chest so the bucket shows above the seat back. */
  poseAudience() {
    for (const a of this.audience) {
      if (!a.cup) continue;
      const b = a.p.ch.bones;
      b.shoulderL.rotation.set(0.62, 0, -0.4);
      b.elbowL.rotation.set(1.45, 0.45, 0);
      b.handL.rotation.set(0, 0, 0);
      // stand the bucket upright whatever the arm does
      a.cup.parent.getWorldQuaternion(_q);
      a.cup.quaternion.copy(_q.invert().multiply(a.p.ch.group.quaternion));
    }
  }

  holdPopcorn(on) {
    const pl = this.g.player, arm = pl.arm;
    if (!arm?.hold) return;
    if (on) {
      this.cup = popcornBucket();
      this.cup.scale.setScalar(0.55);
      arm.hold(this.cup);
      pl._held = this.g.build?.selectedId?.(); // the main loop only swaps what the hand holds when this changes
    } else {
      arm.hold(null);
      pl._held = undefined; // the main loop puts the selected block back in the hand
      if (this.cup) dispose(this.cup, true);
      this.cup = null;
    }
  }

  munch() {
    if (!this.finish) return;
    if (this.popcorn <= 0) { this.g.hud.toast('팝콘을 다 먹었어요 🍿', 1200); return; }
    this.popcorn--;
    eat(this.g.state, 2);
    this.g.sfx?.('eat');
    if (this.g.build) this.g.build.swing = 1;
    if (this.cup) this.cup.children[2].scale.y = 0.35 + 0.65 * (this.popcorn / POPCORN);
    this.drawUi(true);
  }

  // ------------------------------------------------------------------ UI and keys
  makeUi() {
    if (!document.getElementById('cinema-css')) {
      const st = document.createElement('style');
      st.id = 'cinema-css'; st.textContent = CSS;
      document.head.appendChild(st);
    }
    const el = document.createElement('div');
    el.id = 'cinema-ui';
    const bar = MOVIE.parts.map((p) => `<i style="flex:${p.dur}"><s></s></i>`).join('');
    el.innerHTML = `<div class="cr"><span class="ct">🎬 ${MOVIE.title}</span><span class="cp"></span><span class="cl">남은 시간 <b>13:31</b></span></div>
      <div class="cbar">${bar}</div>
      <div class="cr"><button class="sound hidden">🔇 소리 켜기</button><button class="pop">🍿 팝콘 먹기<kbd>Space</kbd> <span class="pn"></span></button><span style="flex:1"></span><button class="nx">⏭ 다음 편<kbd>N</kbd></button><button class="ex">🚪 나가기<kbd>E</kbd></button></div>`;
    el.querySelector('.sound').onclick = () => this.unmute();
    el.querySelector('.pop').onclick = () => this.munch();
    el.querySelector('.nx').onclick = () => this.next();
    el.querySelector('.ex').onclick = () => this.leave();
    document.body.appendChild(el);
    this.ui = el;
    this.bars = [...el.querySelectorAll('.cbar s')];
    if (this.video.muted) el.querySelector('.sound').classList.remove('hidden');
    this._uiKey = '';
    this.drawUi(true);
  }

  drawUi(force = false) {
    const el = this.ui;
    if (!el) return;
    const v = this.video, part = MOVIE.parts[this.part];
    const loading = v.readyState < 3 && !v.paused;
    const key = `${this.part}|${Math.ceil(MOVIE.total - this.pos)}|${loading}|${this.popcorn}`;
    if (!force && key === this._uiKey) return;
    this._uiKey = key;
    el.querySelector('.cp').textContent = loading ? `${part.name} · 불러오는 중…` : part.name;
    el.querySelector('.cl b').textContent = clockText(MOVIE.total - this.pos);
    el.querySelector('.pn').textContent = `${this.popcorn}`;
    this.bars.forEach((b, i) => { const p = MOVIE.parts[i]; const f = THREE.MathUtils.clamp((this.pos - START[i]) / p.dur, 0, 1); b.style.width = `${(f * 100).toFixed(1)}%`; });
  }

  listen(on) {
    if (!on) { removeEventListener('keydown', this._key, true); this._key = null; return; }
    const t0 = performance.now();
    this._key = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const act = { KeyE: () => this.leave(), Escape: () => this.leave(), KeyN: () => this.next(), Space: () => this.munch(), KeyV: () => {} }[e.code];
      if (!act) return;
      // keep these keys away from the game (E would sit down again right after leaving)
      e.preventDefault(); e.stopPropagation();
      if (e.repeat || performance.now() - t0 < 800) return;
      if (this.video?.muted) this.unmute(); // any key press is a gesture: try the sound again
      act();
    };
    addEventListener('keydown', this._key, true);
  }

  // ------------------------------------------------------------------ every frame (after the sky set its lights)
  update(dt) {
    const g = this.g, v = this.video;
    if (!v) return;
    this.pos = START[this.part] + Math.min(v.currentTime || 0, MOVIE.parts[this.part].dur);
    if (this.finish) this.maxPos = Math.max(this.maxPos, this.pos);
    this.dim += (this.dimTarget - this.dim) * Math.min(1, dt * 1.6);
    const k = 1 - 0.82 * this.dim; // room light: 100% → 18%
    const sky = g.sky, scene = g.engine.scene;
    scene.environmentIntensity *= k;
    if (sky?.hemi) sky.hemi.intensity *= k;
    if (sky?.sun) sky.sun.intensity *= k;
    for (const d of this.dimmed ?? []) d.a.intensity = d.i * (1 - 0.88 * this.dim);
    if (this.glow) {
      this.sampleT -= dt;
      if (this.sampleT <= 0 && v.readyState >= 2) {
        this.sampleT = 0.2;
        try {
          const x = this.sampler.getContext('2d', { willReadFrequently: true });
          x.drawImage(v, 0, 0, 4, 2);
          const d = x.getImageData(0, 0, 4, 2).data;
          let r = 0, gg = 0, b = 0;
          for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
          this.glowColor = new THREE.Color(r / 8 / 255, gg / 8 / 255, b / 8 / 255).convertSRGBToLinear();
        } catch { this.glowColor = new THREE.Color(0.55, 0.6, 0.75); }
      }
      const lum = this.glowColor ? Math.max(0.15, this.glowColor.r * 0.3 + this.glowColor.g * 0.55 + this.glowColor.b * 0.15) : 0.4;
      this.glow.intensity = (v.paused ? 0.4 : 2.4) * this.dim / Math.max(0.35, lum) * 0.5;
      const l = g.places.lights?.lights?.find((x) => x.userData.target === this.glow);
      if (l && this.glowColor) l.color.copy(this.glowColor).lerp(new THREE.Color(1, 1, 1), 0.25);
    }
    const cam = g.engine.camera;
    cam.fov = this.fov0 + (FOV_MOVIE - this.fov0) * this.dim;
    cam.updateProjectionMatrix();
    this.poseAudience();
    if (this.cup && g.player.arm) {
      if (!this.cup.parent) { g.player.arm.hold(this.cup); g.player._held = g.build?.selectedId?.(); } // a block was picked meanwhile
      // keep the bucket upright in the hand, tipped a little so the popcorn shows
      this.cup.parent.getWorldQuaternion(_q);
      this.cup.quaternion.copy(_q.invert().multiply(g.engine.camera.quaternion)).multiply(TILT);
    }
    this.drawUi();
  }

  cleanup() {
    const g = this.g;
    this.offUpdate?.(); this.offUpdate = null;
    this.listen(false);
    const v = this.video;
    if (v) { v.pause(); v.removeAttribute('src'); v.load(); }
    this.video = null;
    this.tex?.dispose(); this.tex = null;
    this.poster?.dispose(); this.poster = null;
    if (this.screen) {
      g.engine.scene.remove(this.screen);
      dispose(this.screen, true);
      this.screen = null; this.film = null;
    }
    for (const d of this.dimmed ?? []) d.a.intensity = d.i;
    for (const b of this.beams ?? []) b.visible = true;
    this.beams = null;
    this.dimmed = null;
    if (this.glow) { const gl = this.glow; g.places.lights?.remove((a) => a === gl); this.glow = null; }
    for (const a of this.audience ?? []) {
      g.engine.scene.remove(a.p.ch.group);
      if (a.cup) { a.cup.removeFromParent(); dispose(a.cup, true); }
      dispose(a.p.ch.group, false); // character materials are shared, their shapes are not
      const i = g.life.people.indexOf(a.p);
      if (i >= 0) g.life.people.splice(i, 1);
    }
    this.audience = [];
    this.holdPopcorn(false);
    this.ui?.remove(); this.ui = null;
    document.body.classList.remove('cinema-on');
    g.engine.camera.fov = this.fov0;
    g.engine.camera.updateProjectionMatrix();
    const pl = g.player;
    if (pl.avatar) pl.avatar.group.visible = pl.view === 'third';
  }
}
