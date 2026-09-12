import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../../public/play/undertale/core.mjs';
import * as W from '../../public/play/undertale/world.mjs';
import { DETAILS, detailsFor, inspectDetail } from '../../public/play/undertale/details.mjs';

test('모든 이야기 소품은 바닥에 있고, 방의 이동 경로와 조사할 자리가 연결된다', () => {
  assert.equal(new Set(DETAILS.map(d => d.id)).size, DETAILS.length);
  for (const room of Object.values(W.ROOMS)) {
    const flags = { [room.id + '_door']: true, [room.id + '_switch']: true };
    const floor = [];
    for (let y = 0; y < 15; y++) for (let x = 0; x < 20; x++) if (W.passable(room, x, y, flags)) floor.push([x, y]);
    const queue = [floor[0]], visited = new Set([floor[0].join(',')]);
    for (let i = 0; i < queue.length; i++) {
      const [x, y] = queue[i];
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const nx = x + dx, ny = y + dy, key = [nx, ny].join(',');
        if (nx < 0 || ny < 0 || nx >= 20 || ny >= 15 || visited.has(key) || !W.passable(room, nx, ny, flags)) continue;
        visited.add(key); queue.push([nx, ny]);
      }
    }
    for (const item of detailsFor(room)) {
      assert.ok('.,'.includes(room.tiles[item.y][item.x]), item.id + ': 바닥 타일');
      assert.ok([[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => visited.has([item.x + dx, item.y + dy].join(','))), item.id + ': 조사할 위치');
      if (item.solid) assert.equal(W.passable(room, item.x, item.y, flags), false, item.id);
    }
    // Some old decorative map pockets are intentionally isolated. Every exit must
    // still join the same walkable component as the new interactable scenery.
    for (const side of Object.keys(room.exits)) {
      const edge = floor.filter(([x, y]) => side === 'up' ? y === 0 : side === 'down' ? y === 14 : side === 'left' ? x === 0 : x === 19);
      assert.ok(edge.some(pos => visited.has(pos.join(','))), room.id + ': ' + side);
    }
  }
});

test('안내가 가리키는 물건을 실제로 조사하고, 반복 대사는 새 수첩 항목을 만들지 않는다', () => {
  const p = C.createPlayer('기록'), w = W.createWorld(p, { room: 'ruins_home', x: 5, y: 3 });
  w.dir = 'up';
  const target = W.interactionTarget(w);
  assert.equal(target.item.id, 'home-books'); assert.equal(W.interact(w), true);
  assert.equal(w.request.discovery, true); const first = [...w.request.lines];
  W.resolveRequest(w); assert.equal(w.notice.title, target.item.title);
  assert.equal(W.interact(w), true); assert.equal(w.request.discovery, false);
  assert.notDeepEqual(w.request.lines, first); assert.equal(p.journal.entries.length, 1);
  assert.equal(p.journal.inspected['home-books'], 2);
});

test('환경 이야기는 현재 선택에 반응하고, 처음 간직한 기억과 루트는 바꾸지 않는다', () => {
  const p = C.createPlayer('기록'), item = DETAILS.find(d => d.id === 'home-pie');
  const before = C.routeFor(p); const first = inspectDetail(p, item);
  assert.equal(C.routeFor(p), before); assert.equal(p.kills, 0); assert.equal(p.exp, 0);
  p.bossFate.toriel = 'killed';
  const later = inspectDetail(p, item);
  assert.deepEqual(later.lines, item.dark);
  assert.deepEqual(p.journal.entries[0].lines, first.lines);
  assert.equal(p.journal.entries.length, 1);
});

test('모든 소품을 발견해도 수첩 중복이 없고 저장과 복원을 거쳐 다시 읽을 수 있다', () => {
  const p = C.createPlayer('기록'), w = W.createWorld(p);
  for (const item of DETAILS) { inspectDetail(p, item); inspectDetail(p, item); }
  const saved = JSON.parse(JSON.stringify(W.serialize(w))), restored = W.restore(saved);
  assert.equal(restored.player.journal.entries.length, DETAILS.length);
  assert.deepEqual(restored.player.journal, p.journal);
  for (const item of DETAILS) assert.equal(inspectDetail(restored.player, item).first, false);
});

test('수첩이 없던 이전 세이브도 보스 기록과 열린 문을 복구한다', () => {
  const w = W.createWorld(C.createPlayer('이전'));
  const save = JSON.parse(JSON.stringify(W.serialize(w)));
  delete save.player.journal; delete save.player.bossFate; delete save.player.areaKills;
  save.player.flags.torielGone = true;
  const restored = W.restore(save);
  assert.deepEqual(restored.player.journal.entries, []);
  assert.deepEqual(restored.player.bossFate, {});
  assert.equal(restored.player.flags.ruins_home_door, true);
  assert.equal(restored.player.areaKills.ruins, 0);
});

test('발자국은 실제 이동에만 생기고, 사라지며, 방을 옮기면 초기화된다', () => {
  let randomCalls = 0; const p = C.createPlayer('발걸음'); p.flags.sansMet = true;
  const w = W.createWorld(p, { room: 'snow_forest', x: 4, y: 7, rng: () => { randomCalls++; return .5; } });
  for (let i = 0; i < 600; i++) W.update(w, 1 / 60, { [Math.floor(i / 20) % 2 ? 'right' : 'left']: true });
  assert.ok(w.stepCount > 28); assert.ok(w.footprints.length <= 28); assert.ok(w.footprints.length > 0);
  assert.equal(randomCalls, 0);
  for (let i = 0; i < 450; i++) W.update(w, 1 / 60);
  assert.equal(w.footprints.length, 0);
  W.enterRoom(w, 'water_entry', 3, 6);
  assert.equal(w.roomTime, 0); assert.equal(w.footprints.length, 0);
});

test('전투 잔상은 제한된 시간만 남고, 일시정지는 잔상과 퇴장 연출도 멈춘다', () => {
  const b = C.createBattle(C.createPlayer('영혼'), ['froggit'], { seed: 3 });
  while (b.mode === 'text') C.advanceText(b);
  C.chooseAction(b, 'act'); C.chooseSub(b, 0); C.chooseSub(b, 0);
  while (b.mode === 'text') C.advanceText(b);
  b.soul.invincible = 99;
  for (let i = 0; i < 60; i++) C.update(b, 1 / 60, { [Math.floor(i / 10) % 2 ? 'right' : 'left']: true });
  assert.ok(b.trail.length > 0 && b.trail.length <= 10);
  b.enemy.spared = true; C.update(b, 1 / 60); b.paused = true;
  const before = JSON.stringify({ time: b.time, trail: b.trail, exit: b.enemy.exitT });
  C.update(b, 10, { right: true });
  assert.equal(JSON.stringify({ time: b.time, trail: b.trail, exit: b.enemy.exitT }), before);
});
