import test from 'node:test';
import assert from 'node:assert/strict';
import { planDay, TICKET, WAGE, dayKind, weekday, stepsFor, newState, tickBody, eat, fallDamage, snapCell, formatClock, workTask, checkWork, meatState, serialize, deserialize, tickClock, stepStart, stepReady, minutesLeft, LAST_HOUR } from './core.mjs';
import { JOBS, JOB_KEYS, jobWork, CUSTOMERS, changeFor, changeOptions, cartTotal, REPORT, TRAFFIC, FIRE_GEAR, PATIENTS, DOC_TOOLS, DOC_MEDS, PIZZAS, TOPPINGS, STOCK, AISLES, LETTERS, SLOTS } from './jobs.mjs';
import { isShowDay, SHOW_HOUR } from './show-days.mjs';

test('a week has work, a company dinner, a business trip and a weekend trip', () => {
  assert.equal(weekday(1), '월요일');
  assert.equal(dayKind(1), 'work');
  assert.equal(dayKind(3), 'dinner');
  assert.equal(dayKind(4), 'visit');
  assert.equal(dayKind(6), 'trip');
  assert.equal(dayKind(7), 'trip2');
  assert.equal(dayKind(8), 'work');
});

test('a normal day: wake, wash, eat, dress, drive to work, work, come home, shower, sleep', () => {
  const ids = stepsFor('work').map((s) => s.id);
  assert.deepEqual(ids, ['wake', 'sink', 'breakfast', 'wardrobe', 'drive-work', 'badge', 'coffee', 'work', 'teamMeeting', 'lunch', 'work2', 'print', 'boss', 'badge-out', 'gohome', 'shower', 'sleep']);
  assert.ok(stepsFor('dinner').some((s) => s.id === 'dinner'));
  assert.ok(stepsFor('visit').some((s) => s.target === 'other:meeting'));
  assert.equal(stepsFor('trip').at(-1).target, 'ryokan:futon');
});

test('the weekend is a trip to Japan: airport, plane, shrine, ramen, souvenir, ryokan, onsen, home', () => {
  const sat = stepsFor('trip').map((s) => s.id), sun = stepsFor('trip2').map((s) => s.id);
  assert.deepEqual(sat, ['wake', 'wardrobe', 'drive-airport', 'fly-japan', 'photo-jp', 'ramen', 'souvenir', 'ryokan']);
  assert.deepEqual(sun, ['wake', 'onsen', 'fly-home', 'drive-home', 'shower', 'sleep']);
  assert.equal(stepsFor('trip2')[0].target, 'ryokan:futon');
});

test('hunger drains, an empty stomach hurts and food heals', () => {
  const s = newState();
  s.food = 1;
  tickBody(s, 20);
  assert.equal(s.food, 0);
  const hp = s.hp;
  tickBody(s, 10);
  assert.ok(s.hp < hp);
  eat(s, 80);
  assert.equal(s.food, 80);
  const before = s.hp;
  tickBody(s, 10);
  assert.ok(s.hp > before);
});

test('falls hurt only above 3.5 m', () => {
  assert.equal(fallDamage(3), 0);
  assert.ok(fallDamage(6) > 20);
});

test('blocks snap to a 1 m grid', () => {
  assert.deepEqual(snapCell(2.3, 0.0, -1.2), { x: 2.5, y: 0, z: -1.5 });
  assert.deepEqual(snapCell(-0.01, 1.99, 0.99), { x: -0.5, y: 1, z: 0.5 });
});

test('clock text', () => {
  assert.equal(formatClock(7), '오전 7:00');
  assert.equal(formatClock(13.5), '오후 1:30');
  assert.equal(formatClock(0.25), '오전 12:15');
});

test('work tasks are answerable', () => {
  for (let d = 1; d < 6; d++) for (let n = 0; n < 4; n++) {
    const t = workTask(d, n);
    assert.ok(checkWork(t, t.answer), `${d}/${n} ${t.kind}`);
    if (t.kind === 'mail') assert.ok(!checkWork(t, (t.answer + 1) % 3));
  }
});

test('meat cooks then burns', () => {
  assert.equal(meatState(1), 'raw');
  assert.equal(meatState(7), 'cooked');
  assert.equal(meatState(13), 'burnt');
});

test('save round trip keeps inventory and placed blocks', () => {
  const s = newState();
  s.placed.push({ id: 'stone', x: 1.5, y: 0, z: 2.5, rot: 0 });
  s.inventory.stone = 3;
  const back = deserialize(serialize(s));
  assert.equal(back.inventory.stone, 3);
  assert.equal(back.placed.length, 1);
  assert.equal(deserialize('nope'), null);
});

test('the plane ticket costs 1,000,000원: weekends are trips only once it is saved', () => {
  const s = newState();
  s.day = 6;
  assert.equal(planDay(s).kind, 'rest');
  s.money = TICKET;
  assert.equal(planDay(s).kind, 'trip');
  s.day = 7; s.wakeAt = 'home';
  assert.equal(planDay(s).kind, 'rest');
  s.wakeAt = 'ryokan';
  assert.equal(planDay(s).kind, 'trip2');
  // a week of work (5 days) is not quite enough, the second week is
  assert.ok(30000 + 5 * WAGE < TICKET && 30000 + 7 * WAGE >= TICKET);
});

test('no driving licence yet: the first day starts with the licence test before driving', () => {
  const s = newState();
  const plan = planDay(s);
  assert.equal(plan.needLicense, true);
  const ids = stepsFor(plan.kind, plan).map((x) => x.id);
  assert.ok(ids.indexOf('license') > ids.indexOf('wardrobe') && ids.indexOf('license') < ids.indexOf('drive-work'));
  s.license = true;
  assert.ok(!stepsFor(planDay(s).kind, planDay(s)).some((x) => x.id === 'license'));
  assert.equal(planDay(newState(), { hasLicenseCenter: false }).needLicense, false);
});

test('child story: school, 태권도 → 피아노 → 1시간 쉬기 → 영어, hurt on day 2, licence and car from day 3', () => {
  const s = newState();
  s.mode = 'kid';
  let plan = planDay(s);
  assert.equal(plan.kind, 'school');
  const ids = stepsFor(plan.kind, plan).map((x) => x.id);
  const order = ['class', 'schoolLunch', 'rest1', 'taekwondo', 'piano', 'rest2', 'english', 'gohome'].map((id) => ids.indexOf(id));
  assert.ok(order.every((v, i) => v >= 0 && (i === 0 || v > order[i - 1])), ids.join(','));
  assert.ok(!ids.includes('license'));
  s.day = 2;
  plan = planDay(s);
  assert.equal(plan.hurtToday, true);
  assert.ok(stepsFor(plan.kind, plan).some((x) => x.id === 'hurt'));
  s.hurt = true; s.day = 3;
  plan = planDay(s);
  assert.equal(plan.needLicense, true);
  const d3 = stepsFor(plan.kind, plan).map((x) => x.id);
  assert.ok(d3.indexOf('license') < d3.indexOf('drive-school'));
  s.day = 6;
  assert.equal(planDay(s).kind, 'kidRest');
});

// ------------------------------------------------------------------ clock and waiting (인혁 plan: "1분을 0.5초로", "기다리고 다음 일을 하게")
test('the clock: 0.5 real seconds per game minute, and it stops at midnight until you sleep', () => {
  const s = newState();
  s.hour = 7;
  tickClock(s, 0.5);
  assert.ok(Math.abs(s.hour - (7 + 1 / 60)) < 1e-9, 'half a second is one minute');
  tickClock(s, 30);
  assert.ok(Math.abs(s.hour - (8 + 1 / 60)) < 1e-9, '30 seconds is one hour');
  tickClock(s, 3, 60); // test speed-up
  assert.ok(Math.abs(s.hour - (14 + 1 / 60)) < 1e-9);
  tickClock(s, 10000);
  assert.equal(s.hour, LAST_HOUR);
});

test('a step waits for its time; if you are late it can be done at once', () => {
  const s = newState();
  const badge = stepsFor('work').find((x) => x.id === 'badge');
  assert.equal(badge.at, 9);
  s.hour = 8.5;
  assert.equal(stepReady(badge, s), false);
  assert.equal(minutesLeft(badge, s), 30);
  s.hour = 9;
  assert.equal(stepReady(badge, s), true);
  s.hour = 10.25; // late
  assert.equal(stepReady(badge, s), true);
  assert.equal(minutesLeft(badge, s), 0);
  const coffee = stepsFor('work').find((x) => x.id === 'coffee');
  assert.equal(stepStart(coffee, s), null, 'no time: any time');
});

test('rest steps are plain waits from when they begin (1시간 쉬기 = 60 game minutes)', () => {
  const s = newState();
  s.mode = 'kid';
  const steps = stepsFor('school', planDay(s));
  const rest2 = steps.find((x) => x.id === 'rest2');
  assert.equal(rest2.rest, 60);
  s.hour = 15.5; s.restFrom = { id: 'rest2', hour: 15.5, day: s.day };
  assert.equal(stepStart(rest2, s), 16.5);
  s.hour = 16.4;
  assert.equal(stepReady(rest2, s), false);
  s.hour = 16.5;
  assert.equal(stepReady(rest2, s), true);
  // a rest that would run past midnight still ends before the clock stops
  s.hour = 23.5; s.restFrom = { id: 'rest2', hour: 23.5, day: s.day };
  assert.ok(stepStart(rest2, s) < LAST_HOUR);
  // no more second-based waits
  assert.ok(steps.every((x) => x.wait == null));
});

test('every story has start times that only go forward through the day and end before midnight', () => {
  const kid = { ...newState(), mode: 'kid' };
  const days = [
    ['work', {}], ['dinner', {}], ['visit', {}], ['rest', {}], ['trip', {}], ['trip2', {}], ['work', { show: true }],
    ['school', planDay(kid)], ['school', { ...planDay(kid), show: true }], ['kidRest', {}],
    ...JOB_KEYS.map((job) => ['job', { job, show: true }]),
  ];
  for (const [kind, opts] of days) {
    const ats = stepsFor(kind, opts).filter((x) => x.at != null).map((x) => x.at);
    assert.ok(ats.length >= 1, kind);
    for (let i = 1; i < ats.length; i++) assert.ok(ats[i] >= ats[i - 1], `${kind}${opts.job ? '/' + opts.job : ''}: ${ats.join(',')}`);
    assert.ok(ats.every((t) => t <= 21), `${kind}: everything before 21:00 (${ats.join(',')})`);
    assert.equal(stepsFor(kind, opts).at(-1).id === 'sleep' ? stepsFor(kind, opts).at(-1).at : 21, 21, `${kind}: sleep from 21:00`);
  }
});

// ------------------------------------------------------------------ jobs (인혁 plan: "직업을 더 만들어줘. 다양하게 경찰, 소방관 같은 것도 넣어.")
test('jobs: 경찰관, 소방관 and more, each a work day at its own building', () => {
  assert.ok(JOB_KEYS.includes('police') && JOB_KEYS.includes('fire'));
  assert.ok(JOB_KEYS.length >= 6);
  for (const k of JOB_KEYS) {
    const J = JOBS[k], work = jobWork(k), ids = work.map((x) => x.id);
    assert.equal(new Set(ids).size, ids.length, `${k}: unique step ids`);
    assert.equal(work[0].target, `${J.site}:door`, `${k}: drive to ${J.place}`);
    assert.ok(J.steps.length >= 3 && J.steps.length <= 7, `${k}: ${J.steps.length} tasks`);
    assert.equal(work.at(-1).id, 'job-out');
    assert.equal(work.at(-1).at, 18, '퇴근 at 6 p.m.');
    assert.equal(J.steps[0].at >= 9, true, `${k}: work starts at 9 or later`);
    for (const st of J.steps) assert.ok(st.target.startsWith(J.site + ':') || st.target.startsWith('job:'), `${k}/${st.id}: ${st.target}`);
    assert.ok(J.icon && J.name && J.pick && J.outfit);
  }
});

test('a job day: morning at home, drive to work, the job tasks, 6 p.m., home, sleep; the weekend is like 직장인', () => {
  const s = { ...newState(), mode: 'job', job: 'police', license: true };
  let plan = planDay(s);
  assert.equal(plan.kind, 'job');
  assert.equal(plan.job, 'police');
  const ids = stepsFor(plan.kind, plan).map((x) => x.id);
  assert.deepEqual(ids, ['wake', 'sink', 'breakfast', 'wardrobe', 'go-job', 'p-check', 'p-uniform', 'p-patrol', 'p-lost', 'p-mom', 'p-traffic', 'p-report', 'job-out', 'gohome', 'shower', 'sleep']);
  s.job = 'fire';
  const fire = stepsFor('job', planDay(s)).map((x) => x.id);
  assert.ok(['f-suit', 'f-wait', 'f-truck', 'f-hose', 'f-back', 'f-check'].every((id) => fire.includes(id)));
  assert.equal(stepsFor('job', planDay(s)).find((x) => x.id === 'f-wait').rest, 20, 'the alarm rings after a wait');
  // Wednesday and Thursday are work days too (no company dinner, no business trip)
  s.day = 3; assert.equal(planDay(s).kind, 'job');
  s.day = 4; assert.equal(planDay(s).kind, 'job');
  // weekend: rest until the ticket money is saved, then the Japan trip
  s.day = 6; assert.equal(planDay(s).kind, 'rest');
  s.money = TICKET; assert.equal(planDay(s).kind, 'trip');
  // no licence yet: the test first, like 직장인
  s.day = 1; s.license = false;
  plan = planDay(s);
  const d1 = stepsFor(plan.kind, plan).map((x) => x.id);
  assert.ok(d1.indexOf('license') > d1.indexOf('wardrobe') && d1.indexOf('license') < d1.indexOf('go-job'));
});

test('job mini game data is answerable', () => {
  for (const c of CUSTOMERS) {
    const opts = changeOptions(c, 0);
    assert.equal(new Set(opts).size, 3);
    assert.ok(opts.includes(changeFor(c)));
    assert.ok(changeFor(c) >= 0 && c.paid >= cartTotal(c));
  }
  for (const r of REPORT) assert.ok(r.line.includes('___') && r.o[r.a]);
  assert.ok(TRAFFIC.some((t) => t.a === 'stop') && TRAFFIC.some((t) => t.a === 'go') && TRAFFIC.length >= 6);
  assert.deepEqual(FIRE_GEAR.map((g) => g.k).slice(0, 2), ['pants', 'boots'], 'turnout pants and boots go on first');
  for (const p of PATIENTS) assert.ok(DOC_TOOLS[p.tool] && DOC_MEDS[p.med]);
  for (const p of PIZZAS) for (const t of p.top) assert.ok(TOPPINGS[t]);
  for (const x of STOCK) assert.ok(AISLES[x.to]);
  for (const x of LETTERS) assert.ok(SLOTS[x.box]);
});

// ------------------------------------------------------------------ 분수 공연 hook (the plaza site is built by another helper)
test('fountain show on Fridays at 19:00, only once the plaza exists', () => {
  assert.equal(SHOW_HOUR, 19);
  assert.equal(isShowDay(5), true);
  assert.equal(isShowDay(12), true);
  assert.equal(isShowDay(1), false);
  assert.equal(isShowDay(6), false);
  const s = { ...newState(), license: true, day: 5 };
  assert.equal(planDay(s).show, false, 'no plaza: no show step');
  assert.ok(!stepsFor(planDay(s).kind, planDay(s)).some((x) => x.id === 'show'));
  const plan = planDay(s, { hasPlaza: true });
  const steps = stepsFor(plan.kind, plan), ids = steps.map((x) => x.id);
  assert.ok(ids.indexOf('show') > ids.indexOf('badge-out') && ids.indexOf('show') < ids.indexOf('gohome'));
  assert.equal(steps.find((x) => x.id === 'show').target, 'plaza:show');
  assert.equal(steps.find((x) => x.id === 'show').at, 19);
  s.day = 4;
  assert.ok(!stepsFor(planDay(s, { hasPlaza: true }).kind, planDay(s, { hasPlaza: true })).some((x) => x.id === 'show'), 'not on Thursday');
  const kid = { ...newState(), mode: 'kid', day: 5, hurt: true, license: true };
  const kp = planDay(kid, { hasPlaza: true });
  const kids = stepsFor(kp.kind, kp).map((x) => x.id);
  assert.ok(kids.indexOf('show') > kids.indexOf('english') && kids.indexOf('show') < kids.indexOf('gohome'));
  const job = { ...newState(), mode: 'job', job: 'fire', day: 5, license: true };
  const jp = planDay(job, { hasPlaza: true });
  const js = stepsFor(jp.kind, jp).map((x) => x.id);
  assert.ok(js.indexOf('show') > js.indexOf('job-out') && js.indexOf('show') < js.indexOf('gohome'));
});
