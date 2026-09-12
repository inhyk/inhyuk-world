import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../../public/play/undertale/core.mjs';
import * as Wd from '../../public/play/undertale/world.mjs';

// 호스트 역할: 요청을 자동으로 처리해 스크립트를 끝까지 돌린다.
function runRequests(w, { battle = () => ({ ended: 'spare' }), choice = () => 0, log = [] } = {}) {
  let guard = 0;
  while (w.request && guard++ < 200) {
    const r = w.request; log.push(r.type === 'say' ? `${r.who || '*'}: ${r.lines.join(' / ')}` : r.type);
    if (r.type === 'battle') Wd.resolveRequest(w, battle(r));
    else if (r.type === 'choice') Wd.resolveRequest(w, choice(r));
    else if (r.type === 'ending') { log.push(`ENDING:${r.kind}`); Wd.resolveRequest(w); }
    else Wd.resolveRequest(w);
  }
  return log;
}
const walk = (w, dir, seconds) => { for (let i = 0; i < seconds * 60; i++) { Wd.update(w, 1 / 60, { [dir]: true }); if (w.request) return; } };

test('모든 방은 20×15이고 출구가 실제 방을 가리키며 이벤트 스크립트가 존재한다', () => {
  for (const [id, r] of Object.entries(Wd.ROOMS)) {
    assert.equal(r.tiles.length, 15, id); r.tiles.forEach(t => assert.equal(t.length, 20, id));
    for (const d in r.exits) assert.ok(Wd.ROOMS[r.exits[d].room], `${id}.${d}`);
    for (const ev of r.events) assert.ok(Wd.SCRIPTS[ev.script], `${id}.${ev.script}`);
    for (const n of r.npcs) if (n.script) assert.ok(Wd.SCRIPTS[n.script], `${id}.${n.id}`);
  }
});
test('플라위 도입부: 알갱이 두 번 → 토리엘 등장, 이후 플라위가 사라진다', () => {
  const p = C.createPlayer('x'); const w = Wd.createWorld(p); assert.equal(w.room.id, 'ruins_flowerbed');
  walk(w, 'up', 3); assert.ok(w.request);
  const battles = []; const log = runRequests(w, { battle: r => { battles.push(r.scripted); return { ended: 'scripted' }; } });
  assert.deepEqual(battles, ['pellets', 'ring']); assert.ok(log.some(l => l.startsWith('토리엘:'))); assert.equal(p.flags.floweyDone, true);
  assert.ok(!Wd.activeActors(w).some(a => a.id === 'flowey'));
});
test('벽은 막히고 바닥은 지나가며 방 사이를 이동한다', () => {
  const p = C.createPlayer('x'); p.flags.floweyDone = true; const w = Wd.createWorld(p, { room: 'ruins_entry', x: 9, y: 12 });
  walk(w, 'left', 1); assert.ok(w.x >= 7 * 32 && w.x < 9 * 32); // 좁은 복도라 왼쪽 벽에 막힌다
  walk(w, 'down', 3); assert.equal(w.room.id, 'ruins_flowerbed');
});
test('스위치를 밟으면 문이 열리고, 세이브 지점은 HP를 회복한다', () => {
  const p = C.createPlayer('x'); p.flags.floweyDone = true; p.flags.torielMet = true; const w = Wd.createWorld(p, { room: 'ruins_entry', x: 4, y: 6 });
  assert.equal(Wd.passable(w.room, 8, 1, p.flags), false); walk(w, 'up', 1); runRequests(w); assert.equal(p.flags.ruins_entry_door, true); assert.equal(Wd.passable(w.room, 8, 1, p.flags), true);
  const w2 = Wd.createWorld(p, { room: 'ruins_hall', x: 2, y: 6 }); p.hp = 3; w2.dir = 'up'; w2.y = 6 * 32 + 16; w2.x = 1 * 32 + 16; w2.dir = 'up'; assert.equal(Wd.interact(w2), true); assert.equal(w2.request.type, 'save'); assert.equal(p.hp, p.maxHp);
});
test('인카운터 바닥에서는 전투가 걸리고, 몰살 할당량을 채우면 아무도 오지 않는다', () => {
  const p = C.createPlayer('x'); p.flags.floweyDone = true; const w = Wd.createWorld(p, { room: 'ruins_leaves', x: 3, y: 7 }); w.rng = () => 0; w.encounterCooldown = 0;
  walk(w, 'right', 2); assert.equal(w.request?.type, 'battle'); assert.equal(w.request.random, true);
  p.areaKills.ruins = 6; p.kills = 6; Wd.resolveRequest(w); w.encounterCooldown = 0; walk(w, 'right', 2); assert.equal(w.request?.type, 'say'); assert.equal(w.request.lines[0], '* 아무도 오지 않았다.');
});
test('상자에서 아이템을 얻고, 새 집 상자는 몰살 루트에서만 진짜 칼과 로켓을 준다', () => {
  const p = C.createPlayer('x'); const w = Wd.createWorld(p, { room: 'ruins_leaves', x: 9, y: 3 }); w.dir = 'up'; assert.equal(Wd.interact(w), true); assert.ok(p.items.includes('toyknife'));
  const w2 = Wd.createWorld(p, { room: 'castle_home', x: 15, y: 3 }); w2.dir = 'up'; Wd.interact(w2); assert.ok(p.items.includes('pie')); assert.ok(!p.items.includes('knife'));
  const g = C.createPlayer('g'); g.kills = 24; g.areaKills = { ruins: 6, snowdin: 6, waterfall: 6, hotland: 6 }; g.bossFate = { toriel: 'killed', papyrus: 'killed', undying: 'killed', neo: 'killed' };
  const w3 = Wd.createWorld(g, { room: 'castle_home', x: 15, y: 3 }); w3.dir = 'up'; Wd.interact(w3); assert.ok(g.items.includes('knife')); assert.ok(g.items.includes('locket'));
});
test('토리엘 전투 스크립트: 살려주면 문이 열리고 플라위가 그에 맞게 말한다', () => {
  const p = C.createPlayer('x'); const w = Wd.createWorld(p, { room: 'ruins_exit', x: 9, y: 6 }); walk(w, 'down', 2);
  const log = runRequests(w, { battle: r => { assert.deepEqual(r.enemies, ['toriel']); p.bossFate.toriel = 'spared'; return { ended: 'spare' }; } });
  assert.equal(p.flags.ruins_exit_door, true); assert.ok(log.some(l => l.includes('문 너머로')));
  const w2 = Wd.createWorld(p, { room: 'ruins_flowey2', x: 9, y: 4 }); walk(w2, 'down', 1); const log2 = runRequests(w2); assert.ok(log2.some(l => l.includes('자비')));
});
test('심판의 회랑: 불살·중립은 대화, 몰살은 샌즈 전투로 이어진다', () => {
  const p = C.createPlayer('x'); const w = Wd.createWorld(p, { room: 'castle_hall', x: 8, y: 6 }); walk(w, 'right', 1);
  const log = runRequests(w); assert.ok(log.some(l => l.includes('아무도 죽이지 않았어'))); assert.ok(!log.includes('battle'));
  const g = C.createPlayer('g'); g.kills = 24; g.areaKills = { ruins: 6, snowdin: 6, waterfall: 6, hotland: 6 }; g.bossFate = { toriel: 'killed', papyrus: 'killed', undying: 'killed', neo: 'killed' };
  const w2 = Wd.createWorld(g, { room: 'castle_hall', x: 8, y: 6 }); walk(w2, 'right', 1); const enemies = []; runRequests(w2, { battle: r => { enemies.push(...r.enemies); return { ended: 'kill' }; } }); assert.deepEqual(enemies, ['sans']); assert.equal(g.flags.sansDead, true);
});
test('왕좌의 방: 세 루트가 각각 다른 결말로 끝난다', () => {
  // 불살
  const p = C.createPlayer('p'); const w = Wd.createWorld(p, { room: 'castle_throne', x: 3, y: 6 }); walk(w, 'right', 2);
  const e1 = []; const l1 = runRequests(w, { battle: r => { e1.push(...r.enemies); return { ended: 'special' }; } }); assert.deepEqual(e1, ['asriel']); assert.ok(l1.includes('ENDING:pacifist'));
  // 중립
  const n = C.createPlayer('n'); n.kills = 3; n.areaKills.ruins = 3; const w2 = Wd.createWorld(n, { room: 'castle_throne', x: 3, y: 6 }); walk(w2, 'right', 2);
  const e2 = []; const l2 = runRequests(w2, { battle: r => { e2.push(...r.enemies); return { ended: 'kill' }; }, choice: () => 0 }); assert.deepEqual(e2, ['asgore', 'flowey']); assert.ok(l2.includes('ENDING:neutral')); assert.equal(n.flags.floweySpared, true);
  assert.ok(Wd.neutralEndingLines(n).some(l => l.includes('3명')));
  // 몰살
  const g = C.createPlayer('g'); g.kills = 24; g.areaKills = { ruins: 6, snowdin: 6, waterfall: 6, hotland: 6 }; g.bossFate = { toriel: 'killed', papyrus: 'killed', undying: 'killed', neo: 'killed' }; g.flags.sansDead = true;
  const w3 = Wd.createWorld(g, { room: 'castle_throne', x: 3, y: 6 }); walk(w3, 'right', 2); const l3 = runRequests(w3, { battle: () => { throw new Error('몰살 루트의 아스고어는 컷신으로 처리된다'); } }); assert.ok(l3.includes('ENDING:genocide'));
});
test('몰살 루트에서는 언다인 더 언다잉과 메타톤 NEO가 대신 나온다', () => {
  const g = C.createPlayer('g'); g.kills = 12; g.areaKills = { ruins: 6, snowdin: 6, waterfall: 6, hotland: 0 }; g.bossFate = { toriel: 'killed', papyrus: 'killed' };
  const w = Wd.createWorld(g, { room: 'water_undyne', x: 5, y: 6 }); walk(w, 'right', 2); const e = []; runRequests(w, { battle: r => { e.push(...r.enemies); g.bossFate.undying = 'killed'; return { ended: 'kill' }; } }); assert.deepEqual(e, ['undying']);
  g.areaKills.hotland = 6; g.kills = 18; const w2 = Wd.createWorld(g, { room: 'hot_stage', x: 6, y: 6 }); walk(w2, 'right', 2); const e2 = []; runRequests(w2, { battle: r => { e2.push(...r.enemies); return { ended: 'kill' }; } }); assert.deepEqual(e2, ['neo']);
});
test('저장과 복원은 위치·플래그·스탯을 유지하고 역참조를 남기지 않는다', () => {
  const p = C.createPlayer('x'); p.flags.torielMet = true; p.gold = 33; const w = Wd.createWorld(p, { room: 'snow_town', x: 4, y: 7 });
  const save = Wd.serialize(w); assert.equal(save.player.flags._p, undefined); const json = JSON.stringify(save); const w2 = Wd.restore(JSON.parse(json));
  assert.equal(w2.room.id, 'snow_town'); assert.equal(w2.player.gold, 33); assert.equal(w2.player.flags.torielMet, true); assert.equal(Math.floor(w2.x / 32), 4);
});
test('토리엘의 집: 대화로 떠나겠다고 하면 지하실 문이 열린다', () => {
  const p = C.createPlayer('x'); const w = Wd.createWorld(p, { room: 'ruins_home', x: 9, y: 10 }); w.dir = 'down';
  assert.equal(Wd.passable(w.room, 9, 11, p.flags), false); Wd.interact(w); assert.equal(w.request.lines[0].includes('잠겨'), true); Wd.resolveRequest(w);
  const a = Wd.activeActors(w).find(x => x.id === 'toriel_home'); w.x = a.px; w.y = a.py + 30; w.dir = 'up'; assert.equal(Wd.interact(w), true);
  runRequests(w, { choice: () => 0 }); assert.equal(p.flags.torielGone, true); assert.equal(Wd.passable(w.room, 9, 11, p.flags), true);
  assert.equal(Wd.passable(w.room, 9, 10, p.flags), true);
});
