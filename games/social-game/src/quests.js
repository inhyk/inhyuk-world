// The day: quest steps, interactions, sitting, time skips, sleeping, and the mini games
// (work computer, company dinner grill, meeting presentation, beach photo).
import * as THREE from 'three';
import { planDay, TICKET, weekday, stepsFor, STEP_TIME, eat, workTask, checkWork, meatState, WAGE, SNACK_PRICE, formatClock } from '../core.mjs';
import { paint } from './mat.js';
import { note } from './audio.js';
import { rbox } from './geom.js';
import { LAYOUT } from './world.js';

const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const OUTFIT_FOR = { work: 'suit', dinner: 'suit', visit: 'suit', trip: 'beach', trip2: 'beach', rest: 'casual', school: 'casual', kidRest: 'casual' };
// 학교종 (a traditional children's song) first line: 솔 솔 라 라 솔 솔 미
const SONG = ['솔', '솔', '라', '라', '솔', '솔', '미', '솔', '솔', '미', '미', '레'];
const NOTES = { 도: [262, 'A'], 레: [294, 'S'], 미: [330, 'D'], 파: [349, 'F'], 솔: [392, 'G'], 라: [440, 'H'], 시: [494, 'J'] };

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
  get plan() {
    const s = this.s;
    if (!s.plan || s.plan.day !== s.day) s.plan = planDay(s, { hasLicenseCenter: !!this.g.places.sites.license });
    return s.plan;
  }
  get kind() { return this.plan.kind; }
  get steps() { return stepsFor(this.kind, this.plan); }
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
    if (this.g.driveTest?.active) return this.g.driveTest.target();
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
    const title = { work: '평범한 출근 날', dinner: '오늘은 회식 날', visit: '오늘은 출장 날', trip: '일본 여행 1일째', trip2: '일본 여행 2일째', rest: '쉬는 날', school: '1학년 학교 가는 날', kidRest: '신나는 주말' }[this.kind];
    const goal = this.s.mode === 'kid' || this.s.ticket || this.kind === 'trip' || this.kind === 'trip2' ? null : { label: '✈️ 비행기표 모으기', now: this.s.money, max: TICKET };
    const text = st ? st.text + (st.wait && this._waitFor === st.id ? ` (${this.restLeft ?? st.wait}초)` : '') : '오늘 할 일 끝! 자유롭게 놀아요';
    this.g.hud.quest(text, list, goal);
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
    } else if (!this.busy) s.hour += dt / 600; // 10 real seconds per game minute (인혁: "10초마다 1분")
    if (s.hour >= 24) s.hour = 23.99;
    this.snackCd -= dt;
    // location steps
    const st = this.step;
    const where = this.g.vehicle?.driving ? this.g.vehicle.pos : pl.pos;
    if (st && !this.busy) {
      const [site, id] = st.target.split(':');
      if (st.auto && !this.seat && pl.speed > 0.5) this.complete(st.id);
      if (id === 'door' && st.id !== 'hurt' && !st.wait && !this.g.vehicle?.driving) {
        const e = P.entrance(site);
        if (P.inside(pl.pos) === site || (e && e.distanceTo(pl.pos) < 7)) this.complete(st.id);
      }
      if (site === 'beach' && id === 'arrive' && where.x < LAYOUT.beachX - 4) this.complete(st.id);
      if (st.id === 'shells' && (s.counts.shells ?? 0) >= 5) this.complete(st.id);
      if (st.wait) {
        if (this._waitFor !== st.id) { this._waitFor = st.id; this._waitT = st.wait; }
        this._waitT -= dt;
        this.restLeft = Math.max(0, Math.ceil(this._waitT));
        if (this._waitT <= 0) { this.g.hud.toast('쉬는 시간 끝!', 1500); this.complete(st.id); }
      }
      if (st.id === 'hurt' && !P.inside(pl.pos)) this.hurtEvent();
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
        if (st && st.id === 'dinner') {
          eat(s, 40); this.g.sfx('eat');
          hud.toast('엄마 아빠랑 맛있는 저녁! 오늘 학교 이야기를 했어요 🍚', 2600);
          this.complete('dinner');
          break;
        }
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
        if (st && st.id === 'snack') this.complete('snack');
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
      case 'board': {
        const toJapan = it.site === 'airport';
        if (!this.g.flight) { hud.toast('비행기 준비 중이에요'); break; }
        if (!s.ticket) {
          if (!toJapan) { hud.toast('비행기표가 없어요'); break; }
          if (s.money < TICKET) { hud.toast(`비행기표는 1,000,000원이에요. 지금 ${s.money.toLocaleString('ko-KR')}원… 회사에서 더 모아요!`, 3200); break; }
          s.money -= TICKET; s.ticket = true; this.g.sfx('coin');
          hud.toast('✈️ 비행기표 샀다! 일본 왕복 -1,000,000원', 3000);
          await wait(900);
        }
        this.busy = true;
        await this.g.flight.fly(it.site, toJapan ? 'jpAirport' : 'airport', toJapan ? '일본으로 날아가는 중 ✈️ 창밖을 봐요!' : '집으로 돌아가는 중 ✈️');
        this.busy = false;
        if (!toJapan) s.ticket = false; // round trip used up
        if (st && st.id === (toJapan ? 'fly-japan' : 'fly-home')) this.complete(st.id);
        hud.toast(toJapan ? '일본 도착! 사쿠라 공항이에요 🇯🇵' : '우리 동네 도착! 주차장에 차가 있어요', 3000);
        break;
      }
      case 'badge':
        this.g.sfx('click'); setTimeout(() => this.g.sfx('pickup'), 120);
        if (st && st.id === 'badge') { hud.toast('삑! 출근 완료 ✅ 오늘도 화이팅!', 2400); this.complete('badge'); }
        else if (st && st.id === 'badge-out') { hud.toast('삑! 퇴근 완료 🏠 오늘도 수고했어요!', 2600); this.complete('badge-out'); }
        else hud.toast('삑! 사원증 확인', 1200);
        break;
      case 'coffee':
        await this.fadeAction('☕ 커피 머신 위이잉…', 'water', 900);
        eat(s, 5);
        hud.toast('아메리카노 완성! 잠이 확 깬다 ☕', 2200);
        if (now) this.complete('coffee');
        break;
      case 'teamMeeting':
        if (!now) { hud.toast('지금은 회의 시간이 아니에요'); break; }
        await this.meeting(it, {
          title: '팀 회의', who: '김 부장님',
          qs: [
            { q: '“이번 주 우리 팀 목표가 뭐죠?”', o: ['신제품 반짝이 3000 출시!', '낮잠 많이 자기', '잘 모르겠어요'], a: 0 },
            { q: '“그럼 오늘 할 일은?”', o: ['게임하기', '보고서 만들어서 퇴근 전에 결재 받기', '집에 일찍 가기'], a: 1 },
          ],
          done: () => { hud.toast('회의 끝! 오늘 할 일: 보고서 출력해서 부장님 결재 받기 📋', 3000); this.complete('teamMeeting'); },
        });
        break;
      case 'print':
        this.g.sfx('slide');
        s.report = true;
        hud.toast('위이잉~ 보고서 출력 완료 📄', 2200);
        if (now) this.complete('print');
        break;
      case 'boss':
        if (st && st.id === 'boss') {
          if (!s.report) { hud.toast('부장님: “보고서는요? 프린터에서 먼저 뽑아 와요!”', 2600); break; }
          await this.fadeAction('📋 부장님이 보고서를 읽는 중…', null, 1200);
          s.report = false; this.g.sfx('done');
          hud.toast('부장님: “아주 잘했어요!” 쾅! 결재 완료 ✅', 2800);
          this.complete('boss');
        } else hud.toast(['부장님: “오늘도 열심히!”', '부장님: “커피 한 잔 했어요?”', '부장님: “회의 때 봐요”'][Math.floor(Math.random() * 3)], 2000);
        break;
      case 'class':
        if (!now) { hud.toast(st && ['schoolLunch', 'rest1'].includes(st.id) ? '수업 끝났어요!' : '아직 수업 시간이 아니에요'); break; }
        await this.meeting(it, {
          title: '1학년 수업', who: '선생님',
          qs: [
            { q: '“3 + 2 는 얼마일까요?”', o: ['4', '5', '6'], a: 1 },
            { q: '“사과는 무슨 색일까요?”', o: ['파란색', '빨간색', '보라색'], a: 1 },
            { q: '“‘나무’ 글자는 몇 글자예요?”', o: ['두 글자', '세 글자', '한 글자'], a: 0 },
          ],
          done: () => { hud.toast('수업 끝! 참 잘했어요 💯', 2400); this.complete('class'); },
        });
        break;
      case 'schoolLunch':
        eat(s, 45); this.g.sfx('eat'); hud.toast('급식 최고! 카레라이스 냠냠 (배고픔 +45)', 2400);
        if (now) this.complete('schoolLunch');
        break;
      case 'english':
        if (!now) { hud.toast('영어는 피아노 끝나고 1시간 쉰 다음이에요'); break; }
        await this.meeting(it, {
          title: '헬로 영어', who: 'Teacher',
          qs: [
            { q: '“사과는 영어로?”', o: ['apple', 'banana', 'cat'], a: 0 },
            { q: '“고양이는 영어로?”', o: ['dog', 'cat', 'sun'], a: 1 },
            { q: '“안녕하세요는 영어로?”', o: ['bye', 'thank you', 'hello'], a: 2 },
          ],
          done: () => { hud.toast('Great job! 영어 끝! 오늘 학원 끝 🎉', 2600); this.complete('english'); },
        });
        break;
      case 'taekwondo':
        if (!now) { hud.toast(st && st.id === 'rest1' ? '조금 쉬고 가요!' : '지금은 태권도 시간이 아니에요'); break; }
        if (await this.timingGame()) { hud.toast('기합! 태권도 끝 🥋 이제 바로 피아노!', 2600); this.complete('taekwondo'); }
        break;
      case 'piano':
        if (!now) { hud.toast(st && ['wake', 'sink', 'breakfast'].includes(st.id) ? '피아노는 학원 시간에!' : '피아노는 태권도 다음이에요'); break; }
        this.sit(it);
        if (await this.pianoGame()) { hud.toast('짝짝짝! 학교종 완주 🎹', 2600); this.stand(); this.complete('piano'); } else this.stand();
        break;
      case 'mom':
        if (st && st.id === 'license') {
          await this.fadeAction('🚗 엄마 차 타고 면허시험장으로…', null, 1500);
          const lic = this.g.places.interactables.find((i) => i.key === 'license:license');
          if (lic) this.g.player.place(lic.wpos.x, Math.max(0.15, lic.wpos.y - 1.4), lic.wpos.z + 1.6, this.g.places.sites.license.worldYaw);
          hud.toast('엄마: “시험 잘 봐! 창구에서 신청해”', 2600);
        } else hud.toast(['엄마: “숙제는 했니?”', '엄마: “오늘 학교 재밌었어?”', '엄마: “사랑해~”'][Math.floor(Math.random() * 3)], 2200);
        break;
      case 'dad':
        hud.toast(['아빠: “태권도 몇 단이야?”', '아빠: “피아노 한 곡 쳐 줄래?”', '아빠: “주말에 놀이터 가자!”'][Math.floor(Math.random() * 3)], 2200);
        break;
      case 'license':
        if (s.license) { hud.toast('운전면허증 있어요! 🪪 이미 합격했어요', 2200); break; }
        if (!this.g.driveTest) { hud.toast('시험장이 준비 중이에요'); break; }
        await this.g.driveTest.start(it);
        break;
      case 'pray':
        this.g.sfx('cheers');
        hud.toast('짝짝! 소원을 빌었어요: 내일도 즐거운 하루 🙏', 2600);
        break;
      case 'ramen': {
        const bowl = this.g.places.sites.ramen?.extra?.bowl;
        this.sit(it);
        this.busy = true;
        await wait(1600);
        for (let i = 0; i < 3; i++) { this.g.sfx('eat'); await wait(450); }
        if (bowl) bowl.visible = false;
        eat(s, 50);
        hud.toast('후루룩! 라멘 최고 🍜 (배고픔 +50)', 2400);
        await wait(1300);
        this.busy = false;
        this.stand();
        setTimeout(() => { if (bowl) bowl.visible = true; }, 60000);
        if (now) this.complete('ramen');
        break;
      }
      case 'souvenir':
        if (s.money < 10000) { hud.toast('돈이 모자라요 (10,000원)'); break; }
        s.money -= 10000; s.souvenirs = (s.souvenirs ?? 0) + 1; this.g.sfx('coin');
        hud.toast('마네키네코 인형을 샀다! 🐱 -10,000원', 2600);
        if (now) this.complete('souvenir');
        break;
      case 'futon':
        if ((st && st.id === 'ryokan') || s.hour >= 21.5) { if (st && st.id === 'ryokan') this.s.step++; await this.sleep('ryokan'); }
        else hud.toast(st && st.id === 'wake' ? '좋은 아침! 온천 하러 가요' : '아직 잘 시간이 아니에요');
        break;
      case 'onsen':
        await this.fadeAction('♨️ 따끈따끈 온천… 아 좋다~', 'water', 1800);
        s.hp = 100;
        hud.toast('온천 끝! 체력이 꽉 찼어요', 2400);
        if (now) this.complete('onsen');
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
  async sleep(where = 'home') {
    this.busy = true;
    this.s.wakeAt = where;
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
    s.plan = null;
    if (s.mode === 'kid' && s.hurt && (s.day - 1) % 7 === 5) { s.hurt = false; this._healed = true; }
    this.g.player.limp = !!s.hurt;
    if (where === 'home') this.setOutfit('pajama');
    this.g.onNewDay?.();
    this.wakeUp();
    f.textContent = `${s.day}일차 · ${weekday(s.day)}`;
    await wait(900);
    f.classList.remove('on');
    this.busy = false;
    this.g.sfx('alarm');
    this.g.hud.toast(this.kind === 'trip' ? '주말이다! 오늘은 일본 여행 ✈️' : this.kind === 'trip2' ? '료칸에서 맞는 아침! 🇯🇵' : this.kind === 'rest' ? '주말이다! 오늘은 쉬는 날 (비행기표는 아직 모으는 중)' : this.kind === 'dinner' ? '따르릉! 오늘은 회식 날이에요' : this.kind === 'visit' ? '따르릉! 오늘은 별빛테크로 출장!' : '따르릉! 일어날 시간이에요', 3000);
    this.g.save();
  }

  /** Put the player beside the bed and the car on the driveway. */
  wakeUp() {
    const pl = this.g.player;
    const ry = this.g.places.sites.ryokan;
    if (this.s.wakeAt === 'ryokan' && ry?.spawn) {
      const [x, y, z] = xformPt(ry, ry.spawn.pos);
      pl.place(x, y, z, (ry.spawn.yaw ?? 0) + ry.worldYaw);
      return;
    }
    const home = this.g.places.sites.home;
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
  async meeting(it, custom) {
    this.sit(it);
    const el = $('screen');
    const qs = custom?.qs ?? [
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
        el.innerHTML = `<div class="meet"><h2>${custom?.title ?? '발표'} ${i + 1} / ${qs.length}</h2><p>${custom?.who ?? '별빛테크 손님'}: ${q.q}</p><div class="row" id="opts"></div><button class="alt exit" id="leave">나가기</button></div>`;
        const box = el.querySelector('#opts');
        this._ok = () => { this._ok = null; this.g.sfx('done'); i++; show(); };
        q.o.forEach((t, k) => { const b = document.createElement('button'); b.textContent = t; b.onclick = () => { if (k === q.a) { this.g.sfx('done'); i++; show(); } else { this.g.sfx('wrong'); box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake'); } }; box.appendChild(b); });
        el.querySelector('#leave').onclick = () => resolve(false);
      };
      show();
    });
    this.stand();
    if (ok && custom) { custom.done?.(); return; }
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

  // ------------------------------------------------------------------ kid story
  async hurtEvent() {
    if (this._hurting) return;
    this._hurting = true;
    this.busy = true;
    this.g.sfx('hit');
    await this.fadeAction('앗! 체육 시간에 넘어져서 다리를 다쳤어요 🤕', 'wrong', 1800);
    this.s.hurt = true;
    this.g.player.limp = true;
    this.g.hud.toast('다리가 아파서 천천히만 걸을 수 있어요… (내일부터는 면허를 따서 차로 다녀요)', 4000);
    this._hurting = false;
    this.complete('hurt');
  }

  overlay(html) {
    let el = document.getElementById('mini');
    if (!el) { el = document.createElement('div'); el.id = 'mini'; document.body.appendChild(el); }
    el.innerHTML = html;
    el.classList.remove('hidden');
    document.exitPointerLock?.();
    this.g.input.enabled = false;
    return el;
  }
  closeOverlay() {
    document.getElementById('mini')?.classList.add('hidden');
    this.g.input.enabled = true;
    this.g.input.lock();
  }

  /** 태권도: press when the moving foot is in the green zone, 5 good kicks. */
  timingGame() {
    return new Promise((resolve) => {
      this.busy = true;
      const el = this.overlay(`<div class="mcard"><h2>🥋 반짝 태권도</h2><p class="small">발이 초록 칸에 왔을 때 스페이스(또는 화면 누르기)! 5번 성공하면 끝</p><div class="tk"><div class="zone"></div><div class="foot">🦶</div></div><div class="big" id="tk-n">0 / 5</div><button class="alt close" id="tk-x">그만하기</button></div>`);
      const foot = el.querySelector('.foot'), zone = el.querySelector('.zone');
      let t = 0, ok = 0, raf = 0, last = performance.now();
      const zoneAt = () => { const z = 0.25 + Math.random() * 0.5; zone.style.left = `${z * 100 - 9}%`; return z; };
      let z = zoneAt();
      const loop = (now) => { t += (now - last) / 1000; last = now; const x = (Math.sin(t * 2.4) + 1) / 2; foot.style.left = `${x * 100}%`; raf = requestAnimationFrame(loop); foot.dataset.x = x; };
      raf = requestAnimationFrame(loop);
      const kick = () => {
        const x = Number(foot.dataset.x);
        if (Math.abs(x - z) < 0.09) { ok++; this.g.sfx('hit'); this.g.hud.toast(['얍!', '이얍!', '기합!'][ok % 3], 600); z = zoneAt(); }
        else this.g.sfx('wrong');
        el.querySelector('#tk-n').textContent = `${ok} / 5`;
        if (ok >= 5) finish(true);
      };
      const key = (e) => { if (e.code === 'Space') { e.preventDefault(); kick(); } };
      const finish = this._miniFinish = (v) => { this._miniFinish = null; cancelAnimationFrame(raf); removeEventListener('keydown', key); this.closeOverlay(); this.busy = false; resolve(v); };
      addEventListener('keydown', key);
      el.querySelector('.tk').onclick = kick;
      el.querySelector('#tk-x').onclick = () => finish(false);
    });
  }

  /** 피아노: play the first line of 학교종 with A S D F G H J (도 레 미 파 솔 라 시) or by clicking. */
  pianoGame() {
    return new Promise((resolve) => {
      this.busy = true;
      const keys = Object.entries(NOTES).map(([n, [, k]]) => `<button class="pk" data-n="${n}">${n}<small>${k}</small></button>`).join('');
      const el = this.overlay(`<div class="mcard"><h2>🎹 도레미 피아노 · 학교종</h2><div class="song" id="pg-song"></div><div class="pkeys">${keys}</div><button class="alt close" id="pg-x">그만하기</button></div>`);
      let i = 0;
      const draw = () => { el.querySelector('#pg-song').innerHTML = SONG.map((n, k) => `<span class="${k < i ? 'done' : k === i ? 'now' : ''}">${n}</span>`).join(' '); };
      draw();
      const play = (n) => {
        note(NOTES[n][0]);
        const b = el.querySelector(`.pk[data-n="${n}"]`); b.classList.add('on'); setTimeout(() => b.classList.remove('on'), 150);
        if (n === SONG[i]) { i++; draw(); if (i >= SONG.length) setTimeout(() => finish(true), 600); }
        else this.g.hud.toast(`다음은 ${SONG[i]}!`, 700);
      };
      const key = (e) => { const hit = Object.entries(NOTES).find(([, [, k]]) => `Key${k}` === e.code); if (hit) { e.preventDefault(); play(hit[0]); } };
      const finish = this._miniFinish = (v) => { this._miniFinish = null; removeEventListener('keydown', key); this.closeOverlay(); this.busy = false; resolve(v); };
      addEventListener('keydown', key);
      el.querySelectorAll('.pk').forEach((b) => { b.onclick = () => play(b.dataset.n); });
      el.querySelector('#pg-x').onclick = () => finish(false);
    });
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
    const jp = this.g.player.pos.x > 1500;
    d.innerHTML = `<img src="${url}" alt="사진"><div>${jp ? '🇯🇵 일본 여행' : atBeach ? '🌊 바다' : '📷 찰칵'} · ${this.s.day}일차</div>`;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 2600);
    if (atBeach && this.step?.id === 'photo') this.complete('photo');
    const shrine = this.g.places.sites.shrine;
    if (shrine && this.step?.id === 'photo-jp') {
      const c = new THREE.Vector3(...shrine.worldPos);
      if (Math.hypot(this.g.player.pos.x - c.x, this.g.player.pos.z - c.z) < 32) this.complete('photo-jp');
      else this.g.hud.toast('신사(빨간 문) 가까이 가서 찍어요', 1800);
    }
  }
}

export function xformPt(site, p) {
  const [px, py, pz] = site.worldPos, c = Math.cos(site.worldYaw), s = Math.sin(site.worldYaw);
  return [px + p[0] * c + p[2] * s, py + p[1], pz - p[0] * s + p[2] * c];
}
