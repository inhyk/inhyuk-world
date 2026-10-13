export const ARENA = { left: 155, right: 645, top: 350, bottom: 540 };
export const INTRO = [
  'ASRIEL DREEMURR',
  '토리엘과 아스고어의 아들. 돌아온 별의 아이.',
  '“드디어 만났네. 이제 우리 둘만 남았어.”',
];
export const FRIENDS = [
  { name: '토리엘 · 아스고어', memory: '따뜻한 파이와 황금꽃 차의 기억이 돌아왔다.' },
  { name: '샌즈 · 파피루스', memory: '뼈 있는 농담과 스파게티의 기억이 돌아왔다.' },
  { name: '언다인 · 알피스', memory: '함께 웃고 용기를 내던 기억이 돌아왔다.' },
];
export function saveFriend(state, index) {
  if (state.mode !== 'friends' || !FRIENDS[index] || state.savedFriends.includes(index)) return false;
  state.savedFriends.push(index); state.hp = Math.min(state.maxHp, state.hp + 16);
  state.mode = 'memory'; state.elapsed = 0; state.memoryIndex = index; state.message = FRIENDS[index].memory + ' HP 16 회복!';
  return true;
}
export function advanceIntro(state) {
  if (state.mode !== 'intro') return;
  state.introLine++;
  if (state.introLine >= INTRO.length) { state.mode = 'menu'; state.message = '아스리엘: “자, 우리 둘만의 마지막 싸움이야.”'; }
  else state.message = INTRO[state.introLine];
}
export const ATTACKS = [
  { name: '스타 블레이징', kind: 'stars', duration: 9, interval: 1.1, hint: '큰 별이 터지기 전에 거리를 벌리세요.' },
  { name: '카오스 세이버', kind: 'swords', duration: 9, interval: 1.1, hint: '보라색 부채꼴은 검이 지나갈 자리입니다.' },
  { name: '쇼커 브레이커', kind: 'lightning', duration: 10, interval: 1.1, hint: '느낌표가 없는 통로로 이동하세요.' },
  { name: '카오스 버스터', kind: 'blaster', duration: 10, interval: .8, hint: '겨냥하는 빛을 보고 옆으로 피하세요.' },
  { name: '하이퍼 고너', kind: 'vortex', duration: 11, interval: .22, hint: '끌어당기는 힘에 맞서 별 사이로 이동하세요.' },
  { name: '갤럭타 블레이징', kind: 'constellation', duration: 10, interval: 1.2, hint: '별 고리에서 비어 있는 방향을 찾으세요.' },
  { name: '카오스 슬라이서', kind: 'swords', duration: 10, interval: .85, hint: '양쪽에서 번갈아 휘두르는 검을 피하세요.' },
  { name: '쇼커 브레이커 II', kind: 'lightning', duration: 10, interval: .85, hint: '연속 번개에서도 비어 있는 통로는 남습니다.' },
  { name: '여섯 영혼의 공명', kind: 'orbit', duration: 11, interval: .55, hint: '여섯 빛의 중심을 보고 탄막이 퍼지는 곳을 피하세요.' },
  { name: '스타폴 메모리', kind: 'meteors', duration: 11, interval: .42, hint: '별똥별의 점선을 보고 반대쪽으로 이동하세요.' },
  { name: '프리즘 크로스', kind: 'prism', duration: 11, interval: 1.25, hint: '교차하는 경고선에서 미리 벗어나세요.' },
  { name: '마지막 빛 · 결의', kind: 'final', duration: 18, interval: .18, hint: '별의 통로 → 프리즘 → 마지막 별비. 끝까지 버티세요.' },
];
export function segmentDistance(horizontal, vertical, startX, startY, endX, endY) {
  const lengthSquared = (endX - startX) ** 2 + (endY - startY) ** 2;
  const position = lengthSquared ? Math.max(0, Math.min(1, ((horizontal - startX) * (endX - startX) + (vertical - startY) * (endY - startY)) / lengthSquared)) : 0;
  return Math.hypot(horizontal - startX - position * (endX - startX), vertical - startY - position * (endY - startY));
}
export function createGame() {
  return { mode: 'title', round: 0, hp: 92, maxHp: 92, dreams: 4, hits: 0, time: 0,
    elapsed: 0, musicTime: 0, introLine: 0, savedFriends: [], spawnClock: 0, wave: 0, refusals: 0, rescueT: 0, guard: false, selected: 0, bullets: [],
    soul: { x: 400, y: 455, invincible: 0 }, message: '아스리엘이 당신을 기다리고 있다.' };
}
export function startGame(state) {
  Object.assign(state, createGame(), { mode: 'intro', message: INTRO[0] });
}
export function chooseAction(state, action) {
  if (state.mode !== 'menu') return false;
  if (action === 'act') { state.mode = 'act'; state.message = '희망을 품거나 꿈을 떠올려 보자.'; return true; }
  if (action === 'save' && state.round >= 5 && state.savedFriends.length < FRIENDS.length) {
    state.mode = 'friends'; state.message = '아스리엘 안에서 친구들의 목소리가 들린다. 기억을 불러오자.'; return true;
  }
  if (state.round >= ATTACKS.length) {
    if (action === 'save') { state.mode = 'salvation'; state.elapsed = 0; state.message = '아스리엘: “…고마워. 날 포기하지 않아 줘서.”'; return true; }
    state.message = '이제 싸울 필요 없어. 구하기를 선택하세요.'; return false;
  }
  if (action === 'save') { state.message = state.round < 5 ? '1페이즈에서는 목소리가 닿지 않는다. 2페이즈에서 친구들을 구할 수 있어요.' : '친구들은 모두 돌아왔다. 마지막 공격까지 버텨 아스리엘을 구하자.'; return false; }
  if (action === 'heal') {
    if (!state.dreams) { state.message = '남아 있는 꿈이 없다. 희망으로 피해를 줄일 수 있어요.'; return false; }
    state.dreams--; state.hp = Math.min(state.maxHp, state.hp + 36);
  }
  state.guard = action === 'hope';
  state.mode = action === 'fight' ? 'strike' : 'warning';
  state.elapsed = 0; state.spawnClock = 0; state.wave = 0; state.bullets = [];
  state.message = action === 'fight' ? '빛이 중앙에 왔을 때 Z! 정확히 맞추면 HP를 회복합니다.' :
    action === 'hope' ? '희망을 품었다. 이번 공격에서 받는 피해가 절반이 된다.' : '꿈을 떠올렸다. HP 36 회복.';
  return true;
}
export function confirmStrike(state) {
  if (state.mode !== 'strike') return;
  const accuracy = Math.max(0, 1 - Math.abs((state.elapsed % 1.4) / 1.4 - .5) * 2);
  const amount = Math.round(accuracy * 12);
  state.hp = Math.min(state.maxHp, state.hp + amount);
  state.mode = 'warning'; state.elapsed = 0;
  state.message = '아스리엘의 방어력은 ∞. 결의로 HP ' + amount + ' 회복!';
}
function spawn(state, rng) {
  const attack = ATTACKS[state.round];
  const finalForm = state.round >= 5;
  const add = bullet => state.bullets.push({ age: 0, vx: 0, vy: 0, radius: 6, life: 6, ...bullet });
  const gap = ARENA.left + 65 + rng() * (ARENA.right - ARENA.left - 130);
  if (attack.kind === 'stars') {
    const targetX = ARENA.left + 60 + rng() * 370;
    const targetY = ARENA.top + 45 + rng() * 85;
    add({ kind: 'star', big: true, x: targetX, y: ARENA.top - 18, vy: (targetY - ARENA.top + 18) / .7, burstAt: .7, radius: 13, hue: state.wave * 37 });
  } else if (attack.kind === 'swords') {
    const fromLeft = state.wave % 2 === 0;
    add({ kind: 'saber', x: fromLeft ? ARENA.left : ARENA.right, y: ARENA.top - 20,
      startAngle: fromLeft ? -.1 : Math.PI + .1, direction: fromLeft ? 1 : -1,
      angle: fromLeft ? -.1 : Math.PI + .1, length: 390, delay: .8, life: 1.4, radius: 7 });
  } else if (attack.kind === 'lightning') {
    for (let column = 0; column < 5; column++) {
      const center = ARENA.left + 49 + column * 98;
      if (Math.abs(center - gap) > 65) add({ kind: 'beam', x: center, y: ARENA.top, width: finalForm ? 45 : 38, delay: .85, life: 1.2 });
    }
  } else if (attack.kind === 'blaster') {
    const origin = { x: state.wave % 2 ? ARENA.left : ARENA.right, y: ARENA.top - 12 };
    const angle = Math.atan2(state.soul.y - origin.y, state.soul.x - origin.x);
    for (let offset = -1; offset <= 1; offset++) add({ kind: 'orb', ...origin, vx: Math.cos(angle + offset * .22) * 170, vy: Math.sin(angle + offset * .22) * 170, hue: 190, delay: .35 });
    if (state.wave % 3 === 2) add({ kind: 'laser', ...origin, angle, length: 620, delay: .8, life: 1.25, radius: 13 });
  } else if (attack.kind === 'vortex') {
    const angle = state.wave * .63;
    add({ kind: 'star', x: 400 + Math.cos(angle) * 295, y: 445 + Math.sin(angle) * 170, vx: -Math.cos(angle) * 105, vy: -Math.sin(angle) * 60, hue: state.wave * 21 });
  } else if (attack.kind === 'constellation' || attack.kind === 'orbit') {
    const centerX = 400 + Math.sin(state.wave * .7) * 130, centerY = ARENA.top + 30;
    const count = attack.kind === 'orbit' ? 12 : 16, opening = state.wave % count;
    for (let i = 0; i < count; i++) {
      if (i === opening || i === (opening + 1) % count || i === (opening + count - 1) % count) continue;
      const angle = i * Math.PI * 2 / count;
      add({ kind: 'orb', x: centerX, y: centerY, vx: Math.cos(angle) * 130, vy: Math.sin(angle) * 130, delay: .55, radius: 5, hue: i * 360 / count });
    }
  } else if (attack.kind === 'meteors') {
    const x = ARENA.left + 30 + rng() * 430, vx = state.wave % 2 ? -90 : 90;
    add({ kind: 'meteor', x, y: ARENA.top - 12, vx, vy: 185, radius: 7, delay: .6, hue: state.wave * 35, life: 2.5 });
  } else if (attack.kind === 'prism' || (attack.kind === 'final' && state.elapsed > 6 && state.elapsed < 12)) {
    const fromLeft = state.wave % 2 === 0, x = fromLeft ? ARENA.left : ARENA.right, y = ARENA.top - 8;
    const angle = Math.atan2(state.soul.y - y, state.soul.x - x);
    add({ kind: 'laser', x, y, angle, length: 600, delay: .9, life: 1.25, radius: 9 });
    if (attack.kind === 'prism') add({ kind: 'laser', x: 800 - x, y, angle: Math.PI - angle, length: 600, delay: .9, life: 1.25, radius: 9 });
  } else {
    const safeX = 400 + Math.sin(state.elapsed * .65) * 155;
    for (const side of [-1, 1]) add({ kind: 'star', x: safeX + side * (70 + rng() * 150), y: ARENA.top - 12, vy: 180, hue: state.wave * 22 });
    if (state.wave % 12 === 0) add({ kind: 'beam', x: state.wave % 24 ? 205 : 595, y: ARENA.top, width: 55, delay: .9, life: 1.4 });
  }
  state.wave++;
}
export function tick(state, delta, keys = {}, rng = Math.random) {
  const step = Math.min(Math.max(delta, 0), .04);
  if (state.mode === 'paused') return;
  state.time += step;
  if (!['title', 'dead', 'won'].includes(state.mode)) state.musicTime += step;
  if (['intro', 'act', 'friends'].includes(state.mode)) return;
  if (['title', 'menu', 'dead', 'won'].includes(state.mode)) return;
  state.elapsed += step;
  if (state.mode === 'memory') { if (state.elapsed >= 2.6) state.mode = 'menu'; return; }
  if (state.mode === 'salvation') {
    if (state.elapsed >= 8) { state.mode = 'won'; state.message = '아스리엘: “…고마워. 날 포기하지 않아 줘서.”'; }
    return;
  }
  if (state.mode === 'refuse') {
    if (state.elapsed >= 2.8) { state.hp = state.maxHp; state.mode = 'warning'; state.elapsed = 0; state.spawnClock = 0; state.wave = 0; state.bullets = []; state.message = '하지만 영혼은 부서지지 않았다. 다시, 결의를.'; }
    return;
  }
  if (state.mode === 'strike') { if (state.elapsed > 4.2) confirmStrike(state); return; }
  if (state.mode === 'transform') {
    if (state.elapsed >= 3) { state.mode = 'menu'; state.message = '최종 형태. 아스리엘이 모든 힘을 해방했다. HP 24 회복!'; }
    return;
  }
  if (state.mode === 'warning') {
    if (state.elapsed >= 1.5) { state.mode = 'dodge'; state.elapsed = 0; state.message = ATTACKS[state.round].name + ' — 붉은 하트를 움직여 피하세요!'; }
    return;
  }
  if (state.mode !== 'dodge') return;
  const horizontal = Number(!!(keys.ArrowRight || keys.KeyD)) - Number(!!(keys.ArrowLeft || keys.KeyA));
  const vertical = Number(!!(keys.ArrowDown || keys.KeyS)) - Number(!!(keys.ArrowUp || keys.KeyW));
  const length = Math.hypot(horizontal, vertical) || 1;
  const speed = keys.ShiftLeft || keys.ShiftRight ? 100 : 215;
  if (ATTACKS[state.round].kind === 'vortex') {
    const pull = Math.atan2(ARENA.top - state.soul.y, 400 - state.soul.x);
    state.soul.x += Math.cos(pull) * step * 45; state.soul.y += Math.sin(pull) * step * 45;
  }
  state.soul.x = Math.max(ARENA.left + 8, Math.min(ARENA.right - 8, state.soul.x + horizontal / length * speed * step));
  state.soul.y = Math.max(ARENA.top + 8, Math.min(ARENA.bottom - 8, state.soul.y + vertical / length * speed * step));
  state.soul.invincible = Math.max(0, state.soul.invincible - step);
  state.spawnClock -= step;
  if (state.spawnClock <= 0 && state.elapsed < ATTACKS[state.round].duration - 1.3) {
    spawn(state, rng); state.spawnClock += ATTACKS[state.round].kind === 'final' && state.elapsed > 6 && state.elapsed < 12 ? .95 : ATTACKS[state.round].interval;
  }
  const fragments = [];
  for (const bullet of state.bullets) {
    bullet.age += step;
    if (bullet.big && bullet.age >= bullet.burstAt) {
      bullet.life = 0;
      const count = state.round >= 5 ? 10 : 8;
      for (let index = 0; index < count; index++) {
        const angle = index * Math.PI * 2 / count + state.wave * .3;
        fragments.push({ kind: 'star', x: bullet.x, y: bullet.y, vx: Math.cos(angle) * 115, vy: Math.sin(angle) * 115,
          radius: 5, age: 0, life: 3, hue: index * 360 / count });
      }
      continue;
    }
    if (bullet.age < (bullet.delay || 0)) continue;
    const previousAngle = bullet.angle;
    if (bullet.kind === 'saber') bullet.angle = bullet.startAngle + bullet.direction * Math.min(1, (bullet.age - bullet.delay) / .5) * 1.45;
    bullet.x += bullet.vx * step; bullet.y += bullet.vy * step;
    let collides = bullet.kind === 'beam' ? Math.abs(state.soul.x - bullet.x) < bullet.width / 2 + 4 :
      Math.hypot(state.soul.x - bullet.x, state.soul.y - bullet.y) < bullet.radius + 4;
    if (bullet.kind === 'saber' || bullet.kind === 'laser') {
      collides = false;
      const samples = Math.max(1, Math.ceil(Math.abs(bullet.angle - previousAngle) * bullet.length / 5));
      for (let sample = 0; sample <= samples; sample++) {
        const angle = previousAngle + (bullet.angle - previousAngle) * sample / samples;
        if (segmentDistance(state.soul.x, state.soul.y, bullet.x, bullet.y,
          bullet.x + Math.cos(angle) * bullet.length, bullet.y + Math.sin(angle) * bullet.length) < bullet.radius + 4) collides = true;
      }
    }
    if (bullet.age < bullet.life && collides && !state.soul.invincible) {
      state.hp = Math.max(0, state.hp - (state.guard ? 4 : 8)); state.hits++; state.soul.invincible = .85;
      if (!state.hp) {
        if (state.round >= 5 && state.refusals === 0) { state.refusals++; state.mode = 'refuse'; state.elapsed = 0; state.bullets = []; state.message = '…하지만, 거부했다.'; }
        else { state.mode = 'dead'; state.message = '아직 끝나지 않았어. 다시 한번, 결의를.'; }
        return;
      }
    }
  }
  state.bullets = state.bullets.filter(bullet => bullet.age < bullet.life && bullet.y < 580 && bullet.x > 70 && bullet.x < 730);
  state.bullets.push(...fragments);
  if (state.elapsed >= ATTACKS[state.round].duration) {
    state.round++; state.bullets = []; state.elapsed = 0; state.mode = state.round === 5 ? 'transform' : 'menu';
    state.soul.x = 400; state.soul.y = 455;
    if (state.round === 5) state.hp = Math.min(state.maxHp, state.hp + 24);
    state.message = state.round >= ATTACKS.length ? '모든 공격을 견뎌냈다. 이제 아스리엘에게 손을 내밀자. [구하기]' : '공격을 견뎌냈다. 희망은 피해 감소, 꿈은 HP 회복.';
    if (state.round >= ATTACKS.length) state.selected = 3;
  }
}
