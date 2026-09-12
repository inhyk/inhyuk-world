// 언더테일 팬 게임 · 오버월드 (맵, NPC, 이벤트, 컷신 스크립트). DOM 없음.
// 방은 20×15 타일(32px)이고 한 화면에 들어간다. 스크립트는 제너레이터로 쓰며,
// yield한 요청(대사, 선택지, 전투, 상점, 결말)은 호스트(game.mjs)가 처리한 뒤 resolve로 돌려준다.
import { AREAS, ITEMS, MONSTERS } from './data.mjs';
import { routeFor, quotaMet, heal } from './core.mjs';

export const TILE = 32, COLS = 20, ROWS = 15;
export const WALK_SPEED = 130;

// ---------- 타일 ----------
// '#' 벽  '.' 바닥  ',' 인카운터 바닥  '~' 물/용암  '=' 다리  'S' 세이브  'o' 장식(막힘)
// '^' 가시(스위치로 해제)  'x' 스위치  'B' 상자(아이템)  'D' 문(이벤트로 열림)  '_' 어둠(바닥과 같음)
export function passable(room, tx, ty, flags) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return true; // 가장자리 밖은 출구 판정에 맡긴다
  const c = room.tiles[ty][tx];
  if ('#~oB'.includes(c)) return false;
  if (c === '^') return !!flags[`${room.id}_switch`];
  if (c === 'D') return !!flags[`${room.id}_door`];
  return true;
}

const routeOf = (f, w) => routeFor(f._p, w?.room?.area);
const R = (id, area, tiles, extra = {}) => ({ id, area, tiles, npcs: [], events: [], exits: {}, ...extra });

// ---------- 방 ----------
export const ROOMS = {};
function add(room) { ROOMS[room.id] = room; return room; }

// 폐허
add(R('ruins_flowerbed', 'ruins', [
  '####################', '########....########', '########....########', '#######......#######', '#######......#######',
  '######........######', '######........######', '######........######', '#######......#######', '#######......#######',
  '########....########', '########....########', '####################', '####################', '####################'],
  { exits: { up: { room: 'ruins_entry', x: 10, y: 13 } }, npcs: [{ id: 'flowey', x: 10, y: 4, sprite: 'flowey', dir: 'down', when: f => !f.floweyDone }],
    events: [{ id: 'flowey_intro', x: 8, y: 5, w: 4, h: 2, once: 'floweyDone', script: 'flowey_intro' }], spawn: { x: 10, y: 9 }, deco: 'flowers' }));
add(R('ruins_entry', 'ruins', [
  '####################', '#######.D..#########', '#######....#########', '#######....#########', '###...........######',
  '###.x.........######', '###...........######', '###...........######', '#######....#########', '#######....#########',
  '#######....#########', '#######....#########', '#######....#########', '#######....#########', '#######....#########'],
  { exits: { down: { room: 'ruins_flowerbed', x: 10, y: 1 }, up: { room: 'ruins_dummy', x: 2, y: 13 } },
    npcs: [{ id: 'toriel_entry', x: 9, y: 3, sprite: 'toriel', dir: 'down', when: f => f.torielMet && !f.ruins_entry_door, lines: ['스위치를 밟으면 문이 열린단다. 폐허의 첫 번째 시험이지.'] }],
    events: [{ id: 'toriel_meet', x: 7, y: 7, w: 4, h: 2, once: 'torielMet', script: 'toriel_meet' }, { id: 'switch_hint', x: 4, y: 5, w: 1, h: 1, once: 'ruins_entry_door', script: 'ruins_switch' }] }));
add(R('ruins_dummy', 'ruins', [
  '####################', '#..........#########', '#..........#########', '#..........#########', '#.....o....#########',
  '#..........#########', '#..........#########', '#...................', '#...................', '#..........#########',
  '#..........#########', '#..........#########', '#..........#########', '#..........#########', '#..........#########'],
  { exits: { down: { room: 'ruins_entry', x: 8, y: 1 }, right: { room: 'ruins_hall', x: 1, y: 7 } },
    npcs: [{ id: 'dummy', x: 6, y: 4, sprite: 'dummy', dir: 'down', when: f => !f.dummyDone, script: 'dummy_talk' }, { id: 'toriel_dummy', x: 3, y: 4, sprite: 'toriel', dir: 'right', when: f => !f.dummyDone, lines: ['저 인형에게 말을 걸어 보렴. 몬스터와 마주쳤을 때는 대화로 풀 수 있단다.'] }],
    events: [{ id: 'dummy_intro', x: 1, y: 6, w: 10, h: 2, once: 'dummyIntro', script: 'dummy_intro' }] }));
add(R('ruins_hall', 'ruins', [
  '####################', '####################', '####################', '####################', '####################',
  '#S,,,,,,,^,,,,,,,,,#', '.,,,,,,,,^,,,,,,,,,.', '.,,,,,,,,^,,,,,,,,,.', '#,,,,,x,,^,,,,,,,,,#', '####################',
  '####################', '####################', '####################', '####################', '####################'],
  { exits: { left: { room: 'ruins_dummy', x: 10, y: 7 }, right: { room: 'ruins_leaves', x: 1, y: 7 } }, encounter: 14,
    events: [{ id: 'hall_switch', x: 6, y: 8, w: 1, h: 1, once: 'ruins_hall_switch', script: 'generic_switch' }],
    npcs: [{ id: 'froggit_npc', x: 3, y: 8, sprite: 'froggit', dir: 'up', lines: ['개굴. 몬스터가 싸우고 싶어 하지 않을 때는 이름이 노랗게 변해. 그때 자비를 베풀어 줘.'] }] }));
add(R('ruins_leaves', 'ruins', [
  '####################', '####################', '#........B.........#', '#..,,,,,,,,,,,,,,..#', '#..,,,,,,,,,,,,,,..#',
  '#..,,,,,,,,,,,,,,..#', '...,,,,,,,,,,,,,,...', '...,,,,,,,,,,,,,,...', '#..,,,,,,,,,,,,,,..#', '#..,,,,,,,,,,,,,,..#',
  '#..,,,,,,,,,,,,,,..#', '#.......S..........#', '####################', '####################', '####################'],
  { exits: { left: { room: 'ruins_hall', x: 18, y: 7 }, right: { room: 'ruins_home', x: 1, y: 7 } }, encounter: 12, box: { x: 9, y: 2, item: 'toyknife', flag: 'ruins_leaves_box' },
    npcs: [{ id: 'napstablook', x: 16, y: 10, sprite: 'blook', dir: 'down', when: f => !f.blookMet, script: 'blook_talk' }] }));
add(R('ruins_home', 'ruins', [
  '####################', '#..................#', '#..S...........B...#', '#..................#', '#..................#',
  '#..................#', '...................#', '...................#', '#..................#', '#..................#',
  '#..................#', '#........D.........#', '#########.##########', '#########.##########', '#########.##########'],
  { exits: { left: { room: 'ruins_leaves', x: 18, y: 7 }, down: { room: 'ruins_exit', x: 10, y: 1 } }, box: { x: 15, y: 2, item: 'ribbon', flag: 'ruins_home_box' },
    npcs: [{ id: 'toriel_home', x: 10, y: 5, sprite: 'toriel', dir: 'down', when: f => !f.torielGone, script: 'toriel_home' }],
    events: [{ id: 'home_arrive', x: 1, y: 6, w: 3, h: 2, once: 'homeArrive', script: 'home_arrive' }] }));
add(R('ruins_exit', 'ruins', [
  '#########.##########', '#########.##########', '#########.##########', '#########.##########', '#########.##########',
  '#########.##########', '#########.##########', '#########.##########', '#####........#######', '#####........#######',
  '#####........#######', '#####........#######', '#####...DD...#######', '########..##########', '########..##########'],
  { exits: { up: { room: 'ruins_home', x: 9, y: 11 }, down: { room: 'ruins_flowey2', x: 10, y: 1 } },
    events: [{ id: 'toriel_battle', x: 5, y: 8, w: 8, h: 2, once: 'torielFight', script: 'toriel_fight' }] }));
add(R('ruins_flowey2', 'ruins', [
  '#########..#########', '#########..#########', '#########..#########', '######........######', '######........######',
  '######........######', '######.............#', '######.............#', '######........######', '######........######',
  '####################', '####################', '####################', '####################', '####################'],
  { exits: { up: { room: 'ruins_exit', x: 9, y: 11 }, right: { room: 'snow_forest', x: 1, y: 7 } },
    npcs: [{ id: 'flowey2', x: 10, y: 5, sprite: 'flowey', dir: 'down', when: f => !f.flowey2Done }],
    events: [{ id: 'flowey2', x: 8, y: 6, w: 4, h: 2, once: 'flowey2Done', script: 'flowey_after_ruins' }], deco: 'flowers' }));

// 설원
add(R('snow_forest', 'snowdin', [
  '####################', '#o.o.o.o.o.o.o.o.o.#', '#..................#', '#.o.o.o.o.o.o.o.o..#', '#..................#',
  '#..........=...o...#', '...........=........', '...........=........', '#..........=.......#', '#.o.o.o.o.o.o.o.o..#',
  '#..................#', '#o.o.o.o.o.o.o.o.o.#', '####################', '####################', '####################'],
  { exits: { left: { room: 'ruins_flowey2', x: 18, y: 7 }, right: { room: 'snow_papyrus', x: 1, y: 7 } },
    events: [{ id: 'sans_meet', x: 12, y: 6, w: 2, h: 2, once: 'sansMet', script: 'sans_meet' }] }));
add(R('snow_papyrus', 'snowdin', [
  '####################', '#o.....o......o....#', '#..................#', '#.,,,,,,,,,,,,,,,,.#', '#.,,,,,,,,,,,,,,,,.#',
  '#.,,,,,,,,,,,,,,,,.#', '..,,,,,,,,,,,,,,,,..', '..,,,,,,,,,,,,,,,,..', '#.,,,,,,,,,,,,,,,,.#', '#.,,,,,,,,,,,,,,,,.#',
  '#........S.........#', '#o......o......o...#', '####################', '####################', '####################'],
  { exits: { left: { room: 'snow_forest', x: 18, y: 7 }, right: { room: 'snow_puzzle', x: 1, y: 7 } }, encounter: 12,
    npcs: [{ id: 'papyrus_npc', x: 16, y: 4, sprite: 'papyrus', dir: 'left', when: f => f.papyrusMet && !f.papyrusLeft, lines: ['인간! 내 퍼즐을 풀고 오너라! 위대한 파피루스가 기다리고 있겠다! 냐하하!'] }],
    events: [{ id: 'papyrus_meet', x: 8, y: 5, w: 4, h: 3, once: 'papyrusMet', script: 'papyrus_meet' }] }));
add(R('snow_puzzle', 'snowdin', [
  '####################', '#o.o......B.......o#', '#........^^^.......#', '#........^^^.......#', '#.,,,,,,.^^^.,,,,,.#',
  '#.,,,,,,.^^^.,,,,,.#', '..,,,,,,.^^^.,,,,,..', '..,,,,,,.^^^.,,,,,..', '#.,,,,,,.^^^.,,,,,.#', '#.x......^^^.......#',
  '#........^^^.......#', '#o.o.....^^^......o#', '####################', '####################', '####################'],
  { exits: { left: { room: 'snow_papyrus', x: 18, y: 7 }, right: { room: 'snow_town', x: 1, y: 7 } }, encounter: 12, box: { x: 10, y: 1, item: 'snowman', flag: 'snow_puzzle_box' },
    events: [{ id: 'puzzle_switch', x: 2, y: 9, w: 1, h: 1, once: 'snow_puzzle_switch', script: 'generic_switch' }, { id: 'puzzle_intro', x: 2, y: 6, w: 2, h: 2, once: 'snowPuzzleIntro', script: 'snow_puzzle_intro' }] }));
add(R('snow_town', 'snowdin', [
  '####################', '#oo##########oo###o#', '#o.##########.o#.#.#', '#..#..........#....#', '#..#..........#....#',
  '#..................#', '...................#', '....S...............', '#..................#', '#..................#',
  '#..oo....oo........#', '#o.................#', '####################', '####################', '####################'],
  { exits: { left: { room: 'snow_puzzle', x: 18, y: 7 }, right: { room: 'snow_fog', x: 1, y: 7 } },
    npcs: [{ id: 'shop_rabbit', x: 6, y: 4, sprite: 'rabbit', dir: 'down', shop: 'snowdin' }, { id: 'kid_town', x: 12, y: 8, sprite: 'kid', dir: 'left', when: (f, w) => routeOf(f, w) !== 'genocide', lines: ['야! 너 언다인 본 적 있어? 언다인은 진짜 멋있어! 나중에 폭포에서 보자!'] },
      { id: 'bunny_npc', x: 16, y: 5, sprite: 'blook', dir: 'down', when: (f, w) => routeOf(f, w) === 'genocide', lines: ['…마을 사람들이 모두 피난 갔어. 나도 이제…'] },
      { id: 'sans_town', x: 3, y: 9, sprite: 'sans', dir: 'right', when: (f, w) => routeOf(f, w) !== 'genocide', lines: ['어이. 그릴비 가게에서 밥이나 먹고 갈래? …아, 지금은 문 닫았네. 다음에.'] }] }));
add(R('snow_fog', 'snowdin', [
  '####################', '#o.o.o.o.o.o.o.o.o.#', '#..................#', '#..................#', '#..................#',
  '#..................#', '....................', '....................', '#..................#', '#..................#',
  '#..................#', '#o.o.o.o.o.o.o.o.o.#', '####################', '####################', '####################'],
  { exits: { left: { room: 'snow_town', x: 18, y: 7 }, right: { room: 'water_entry', x: 1, y: 7 } }, fog: true,
    events: [{ id: 'papyrus_fight', x: 8, y: 5, w: 2, h: 4, once: 'papyrusFight', script: 'papyrus_fight' }] }));

// 폭포
add(R('water_entry', 'waterfall', [
  '####################', '#~~~~~~~~~~~~~~~~~~#', '#~~~~~~~~~~~~~~~~~~#', '#..S.......,,,,,,,.#', '#..........,,,,,,,.#',
  '#..........,,,,,,,.#', '...........,,,,,,,..', '...........,,,,,,,..', '#..........,,,,,,,.#', '#~~~~~~~~~~~~~~~~~~#',
  '#~~~~~~~~~~~~~~~~~~#', '####################', '####################', '####################', '####################'],
  { exits: { left: { room: 'snow_fog', x: 18, y: 7 }, right: { room: 'water_bridge', x: 1, y: 7 } }, encounter: 12,
    npcs: [{ id: 'sans_sentry', x: 6, y: 4, sprite: 'sans', dir: 'down', when: (f, w) => routeOf(f, w) !== 'genocide', lines: ['여기서 망보는 중이야. 뭘 보냐고? …지루함이지.', '참, 폭포 앞쪽에 언다인이 있어. 조심해.'] }] }));
add(R('water_bridge', 'waterfall', [
  '####################', '#~~~~~~~~~~~~~~~~~~#', '#~~~~~~~~~~~~~~~~~~#', '#~~~~~~~~~~~~~~~~~~#', '#~~~~~~~~~~~~~~~~~~#',
  '#~~~~~~~~~~~~~~~~~~#', '..==================', '..==================', '#~~~~~~~~~~~~~~~~~~#', '#~~~~~~~~~~~~~~~~~~#',
  '#~~~~~~~~~~~~~~~~~~#', '#~~~~~~~~~~~~~~~~~~#', '####################', '####################', '####################'],
  { exits: { left: { room: 'water_entry', x: 18, y: 7 }, right: { room: 'water_tem', x: 1, y: 7 } },
    npcs: [{ id: 'kid_bridge', x: 5, y: 7, sprite: 'kid', dir: 'right', when: f => !f.undyneBridge, lines: ['…'] }],
    events: [{ id: 'undyne_bridge', x: 8, y: 6, w: 2, h: 2, once: 'undyneBridge', script: 'undyne_bridge' }] }));
add(R('water_tem', 'waterfall', [
  '####################', '#~~~~~~~~~~~~~~~~~~#', '#....B.............#', '#.,,,,,,,,,,,,,,,,.#', '#.,,,,,,,,,,,,,,,,.#',
  '#.,,,,,,,,,,,,,,,,.#', '..,,,,,,,,,,,,,,,,..', '..,,,,,,,,,,,,,,,,..', '#.,,,,,,,,,,,,,,,,.#', '#.,,,,,,,,,,,,,,,,.#',
  '#..................#', '#~~~~~~~~~~~~~~~~~~#', '####################', '####################', '####################'],
  { exits: { left: { room: 'water_bridge', x: 18, y: 7 }, right: { room: 'water_echo', x: 1, y: 7 } }, encounter: 12, box: { x: 5, y: 2, item: 'noodles', flag: 'water_tem_box' },
    npcs: [{ id: 'tem_shop', x: 15, y: 3, sprite: 'temmie', dir: 'down', shop: 'tem' }] }));
add(R('water_echo', 'waterfall', [
  '####################', '#~~~~~~~~~~~~~~~~~~#', '#..................#', '#..o.....o.....o...#', '#..................#',
  '#........S.........#', '....................', '....................', '#..................#', '#..o.....o.....o...#',
  '#..................#', '#~~~~~~~~~~~~~~~~~~#', '####################', '####################', '####################'],
  { exits: { left: { room: 'water_tem', x: 18, y: 7 }, right: { room: 'water_undyne', x: 1, y: 7 } }, deco: 'echo',
    npcs: [{ id: 'echo1', x: 3, y: 4, sprite: 'echo', dir: 'down', lines: ['(메아리 꽃이 속삭인다) "…언젠가 별을 보러 가자. 진짜 별 말이야."'] },
      { id: 'echo2', x: 9, y: 4, sprite: 'echo', dir: 'down', lines: ['(메아리 꽃이 속삭인다) "인간이 또 떨어졌대. 이번엔… 우리를 구해 줄까?"'] },
      { id: 'echo3', x: 15, y: 4, sprite: 'echo', dir: 'down', lines: ['(메아리 꽃이 속삭인다) "왕은 일곱 개의 영혼이 필요하대. 벌써 여섯 개야."'] },
      { id: 'kid_echo', x: 16, y: 8, sprite: 'kid', dir: 'left', when: (f, w) => f.undyneBridge && !f.undyneFight && routeOf(f, w) !== 'genocide', lines: ['언다인이 널 인간이라고 했어… 근데 넌 나쁜 애 같지 않아. 나… 그냥 갈게.'] }] }));
add(R('water_undyne', 'waterfall', [
  '####################', '####################', '#..................#', '#..................#', '#..................#',
  '#....o........o....#', '....................', '....................', '#....o........o....#', '#..................#',
  '#..................#', '#..................#', '####################', '####################', '####################'],
  { exits: { left: { room: 'water_echo', x: 18, y: 7 }, right: { room: 'hot_lab', x: 1, y: 7 } },
    events: [{ id: 'undyne_fight', x: 7, y: 5, w: 2, h: 4, once: 'undyneFight', script: 'undyne_fight' }] }));

// 열지대
add(R('hot_lab', 'hotland', [
  '####################', '#~~~~~~~~~~~~~~~~~~#', '#~~~~~~~~~~~~~~~~~~#', '#..S...............#', '#..................#',
  '#..................#', '....................', '....................', '#..................#', '#..................#',
  '#~~~~~~~~~~~~~~~~~~#', '#~~~~~~~~~~~~~~~~~~#', '####################', '####################', '####################'],
  { exits: { left: { room: 'water_undyne', x: 18, y: 7 }, right: { room: 'hot_lasers', x: 1, y: 7 } }, lava: true,
    npcs: [{ id: 'undyne_down', x: 4, y: 7, sprite: 'undyne', dir: 'down', when: f => f.undyneFled && !f.undyneWater, script: 'undyne_water' }, { id: 'sans_hot', x: 14, y: 4, sprite: 'sans', dir: 'down', when: (f, w) => routeOf(f, w) !== 'genocide', lines: ['여기까지 왔네. 뜨겁지? …내 농담도 좀 뜨거워지려나.'] }],
    events: [{ id: 'alphys_call', x: 7, y: 6, w: 2, h: 2, once: 'alphysCall', script: 'alphys_call' }] }));
add(R('hot_lasers', 'hotland', [
  '####################', '#~~~~~~~~~~~~~~~~~~#', '#~~~~~~~~~~~~~~~~~~#', '#.,,,,,,^,,,,,,,,,.#', '#.,,,,,,^,,,,,,,,,.#',
  '#.,,,,,,^,,,,,,,,,.#', '..,,,,,,^,,,,,,,,,..', '..,,,,,,^,,,,,,,,,..', '#.,,,,,,^,,,,,,,,,.#', '#.x.....^,,,,,,,,,.#',
  '#~~~~~~~~~~~~~~~~~~#', '#~~~~~~~~~~~~~~~~~~#', '####################', '####################', '####################'],
  { exits: { left: { room: 'hot_lab', x: 18, y: 7 }, right: { room: 'hot_vending', x: 1, y: 7 } }, encounter: 11, lava: true, lasers: true,
    events: [{ id: 'laser_switch', x: 2, y: 9, w: 1, h: 1, once: 'hot_lasers_switch', script: 'generic_switch' }] }));
add(R('hot_vending', 'hotland', [
  '####################', '#~~~~~~~~~~~~~~~~~~#', '#........B.........#', '#.,,,,,,,,,,,,,,,,.#', '#.,,,,,,,,,,,,,,,,.#',
  '#.,,,,,,,,,,,,,,,,.#', '..,,,,,,,,,,,,,,,,..', '..,,,,,,,,,,,,,,,,..', '#.,,,,,,,,,,,,,,,,.#', '#....S.............#',
  '#~~~~~~~~~~~~~~~~~~#', '#~~~~~~~~~~~~~~~~~~#', '####################', '####################', '####################'],
  { exits: { left: { room: 'hot_lasers', x: 18, y: 7 }, right: { room: 'hot_stage', x: 1, y: 7 } }, encounter: 11, lava: true, box: { x: 9, y: 2, item: 'pan', flag: 'hot_vending_box' },
    npcs: [{ id: 'vending', x: 15, y: 3, sprite: 'vending', dir: 'down', shop: 'hotland' }] }));
add(R('hot_stage', 'hotland', [
  '####################', '#..................#', '#..................#', '#.oooooooooooooooo.#', '#..................#',
  '#..................#', '....................', '....................', '#..................#', '#..................#',
  '#.oooooooooooooooo.#', '#..................#', '####################', '####################', '####################'],
  { exits: { left: { room: 'hot_vending', x: 18, y: 7 }, right: { room: 'castle_home', x: 1, y: 7 } }, stage: true,
    events: [{ id: 'mettaton_fight', x: 8, y: 5, w: 2, h: 4, once: 'mettatonFight', script: 'mettaton_fight' }] }));

// 새 집 · 심판의 회랑 · 왕좌의 방
add(R('castle_home', 'castle', [
  '####################', '#..................#', '#..S...........B...#', '#..................#', '#..o..........o....#',
  '#..................#', '....................', '....................', '#..................#', '#..o..........o....#',
  '#..................#', '#..................#', '####################', '####################', '####################'],
  { exits: { left: { room: 'hot_stage', x: 18, y: 7 }, right: { room: 'castle_hall', x: 1, y: 7 } }, gray: true, box: { x: 15, y: 2, item: 'knife', flag: 'castle_home_box', genocideOnly: true, altItem: 'pie' },
    events: [{ id: 'memory', x: 6, y: 5, w: 2, h: 4, once: 'castleMemory', script: 'castle_memory' }] }));
add(R('castle_hall', 'castle', [
  '####################', '#o..o..o..o..o..o..#', '#..................#', '#..................#', '#..................#',
  '#..................#', '....................', '....................', '#..................#', '#..................#',
  '#..................#', '#o..o..o..o..o..o..#', '####################', '####################', '####################'],
  { exits: { left: { room: 'castle_home', x: 18, y: 7 }, right: { room: 'castle_throne', x: 1, y: 7 } }, hall: true,
    events: [{ id: 'judgement', x: 9, y: 5, w: 2, h: 4, once: 'judgement', script: 'judgement' }] }));
add(R('castle_throne', 'castle', [
  '####################', '#......,,,,,,......#', '#.....,,,,,,,,.....#', '#....,,,,,,,,,,....#', '#....,,,,,,,,,,....#',
  '#....,,,,,,,,,,....#', '.....,,,,,,,,,,....#', '.....,,,,,,,,,,....#', '#....,,,,,,,,,,....#', '#....,,,,,,,,,,....#',
  '#.....,,,,,,,,.....#', '#......,,,,,,......#', '####################', '####################', '####################'],
  { exits: { left: { room: 'castle_hall', x: 18, y: 7 } }, throne: true, encounter: 0,
    npcs: [{ id: 'asgore_npc', x: 10, y: 3, sprite: 'asgore', dir: 'down', when: f => !f.asgoreDone }],
    events: [{ id: 'asgore', x: 5, y: 5, w: 3, h: 4, once: 'asgoreDone', script: 'asgore' }] }));

// 출구가 있는 방향의 가장자리 타일을 연다. (맵 문자열은 가독성을 위해 벽으로 그려 두고 여기서 뚫는다)
const OPEN = '.,=_S';
for (const r of Object.values(ROOMS)) {
  const t = r.tiles.map(row => row.split(''));
  if (r.exits.up) for (let x = 0; x < COLS; x++) if (OPEN.includes(t[1][x])) t[0][x] = '.';
  if (r.exits.down) for (let x = 0; x < COLS; x++) if (OPEN.includes(t[ROWS - 2][x])) t[ROWS - 1][x] = '.';
  if (r.exits.left) for (let y = 0; y < ROWS; y++) if (OPEN.includes(t[y][1])) t[y][0] = '.';
  if (r.exits.right) for (let y = 0; y < ROWS; y++) if (OPEN.includes(t[y][COLS - 2])) t[y][COLS - 1] = '.';
  r.tiles = t.map(a => a.join(''));
}

// 워프 메뉴용 방 이름
export const ROOM_NAMES = { ruins_flowerbed: '폐허 · 꽃밭', ruins_entry: '폐허 · 입구', ruins_dummy: '폐허 · 인형 방', ruins_hall: '폐허 · 가시 복도', ruins_leaves: '폐허 · 낙엽 방', ruins_home: '폐허 · 토리엘의 집', ruins_exit: '폐허 · 지하 출구', ruins_flowey2: '폐허 · 출구 밖',
  snow_forest: '설원 · 숲길', snow_papyrus: '설원 · 파피루스 초소', snow_puzzle: '설원 · 가시 퍼즐', snow_town: '설원 · 마을', snow_fog: '설원 · 안개 (파피루스전)',
  water_entry: '폭포 · 입구', water_bridge: '폭포 · 다리', water_tem: '폭포 · 템 마을', water_echo: '폭포 · 메아리 꽃밭', water_undyne: '폭포 · 끝 (언다인전)',
  hot_lab: '열지대 · 연구소 앞', hot_lasers: '열지대 · 레이저', hot_vending: '열지대 · 자판기', hot_stage: '열지대 · 무대 (메타톤전)',
  castle_home: '새 집', castle_hall: '심판의 회랑', castle_throne: '왕좌의 방' };

// ---------- 스크립트 ----------
const say = (who, lines, opts = {}) => ({ type: 'say', who, lines: Array.isArray(lines) ? lines : [lines], ...opts });
const narrate = lines => say(null, lines);
const choice = (prompt, options) => ({ type: 'choice', prompt, options });
const battle = (enemies, opts = {}) => ({ type: 'battle', enemies, ...opts });
const wait = s => ({ type: 'wait', s });
const music = name => ({ type: 'music', name });
const sound = name => ({ type: 'sound', name });
const shake = () => ({ type: 'shake' });
const ending = (kind, extra = {}) => ({ type: 'ending', kind, ...extra });
const moveNpc = (id, x, y, opts = {}) => ({ type: 'move', id, x, y, ...opts });
const removeNpc = id => ({ type: 'remove', id });
const showNpc = (id, sprite, x, y, dir = 'down') => ({ type: 'show', id, sprite, x, y, dir });
const flash = () => ({ type: 'flash' });

export const SCRIPTS = {
  *flowey_intro(w) {
    const p = w.player;
    yield music('flowey');
    yield say('플라위', ['안녕! 나는 플라위. 꽃 플라위야!', '넌 새로 왔구나? 지하 세계에 대해선 아무것도 모르겠네.', '누군가 가르쳐 줘야겠지? 작고 귀여운 내가 해 줄게!', '봐, 저 하트가 네 영혼이야. 네 존재의 정수지.', '영혼은 LV를 올리면서 강해져. LV가 뭐냐고? LOVE지! 사랑!', '사랑은… 작고 하얀 "우정 알갱이"로 나눠. 자, 최대한 많이 모아 봐!']);
    yield battle(['floweyIntro'], { scripted: 'pellets' });
    yield say('플라위', ['멍청이.', '이 세계에선 죽이거나 죽거나야.', '누가 이런 기회를 놓치겠어?', '죽어.']);
    yield battle(['floweyIntro'], { scripted: 'ring' });
    yield sound('fire'); yield flash();
    yield showNpc('toriel_save', 'toriel', 7, 4, 'right');
    yield removeNpc('flowey'); p.hp = p.maxHp;
    yield say('토리엘', ['가엾은 아이를 괴롭히다니, 참으로 형편없는 존재로구나.', '무서워하지 말렴, 나의 아이. 나는 토리엘, 폐허의 관리인이란다.', '매일 이곳을 돌며 누군가 떨어지지 않았는지 살펴본단다. 네가 오랜만에 처음이구나.', '따라오렴. 폐허를 지나는 길을 안내해 주마.']);
    yield moveNpc('toriel_save', 10, 1, { speed: 90 }); yield removeNpc('toriel_save');
    p.flags.torielSeen = true;
  },
  *toriel_meet() { yield say('토리엘', ['여기가 폐허의 입구란다. 폐허에는 퍼즐이 많아. 오래된 놀이이자 열쇠지.', '바닥의 스위치를 밟으면 위쪽 문이 열린단다. 한번 해 보렴.']); },
  *ruins_switch(w) { w.player.flags.ruins_entry_door = true; yield sound('switch'); yield narrate('* 찰칵. 문이 열렸다.'); },
  *generic_switch(w) { w.player.flags[`${w.room.id}_switch`] = true; yield sound('switch'); yield narrate('* 찰칵. 가시가 내려갔다.'); },
  *dummy_intro() { yield say('토리엘', ['몬스터와 마주치면 전투가 시작된단다. 하지만 싸울 필요는 없어.', '"행동"으로 대화를 나누렴. 내가 올 때까지 시간을 끌면 된단다.', '저 인형으로 연습해 보렴.']); },
  *dummy_talk(w) {
    const r = yield battle(['dummy']);
    w.player.flags.dummyDone = true;
    if (r.ended === 'kill') yield say('토리엘', ['…인형에게 그런 짓을 하다니. 어쨌든, 다음 방으로 가자꾸나.']);
    else if (r.ended === 'flee') yield say('토리엘', ['…도망치는 것도 방법이지. 하지만 대화가 더 좋단다.']);
    else yield say('토리엘', ['아주 잘했어, 나의 아이! 이제 다음 방으로 가자꾸나.']);
  },
  *blook_talk(w) { w.player.flags.blookMet = true; yield say('냅스타블룩', ['…아, 미안. 길을 막았네…', '난 그냥 여기 누워 있는 게 좋아서…', '…그래도 네가 지나가는 걸 보니 좋다. …잘 가.']); },
  *home_arrive() { yield say('토리엘', ['여기가 내 집이란다. 마침 파이를 구웠어. 버터스카치 시나몬 파이지.', '방 안의 상자에 파이를 넣어 뒀단다. 마음껏 쉬렴.']); },
  *toriel_home(w) {
    const p = w.player, g = routeFor(p, w.room.area) === 'genocide';
    if (g) { yield say('토리엘', ['…나의 아이. 네 눈에서… 무언가 이상한 것이 보이는구나.', '…지하실 계단은 저쪽이란다. 네가 어디로 갈지 이미 알고 있어.']); yield narrate('* 토리엘이 먼저 지하실로 내려갔다.'); p.flags.torielGone = true; p.flags.ruins_home_door = true; return; }
    yield say('토리엘', ['여기서 함께 살자꾸나. 나는 너에게 많은 것을 가르쳐 줄 수 있단다.', '…폐허를 나가고 싶다고? 그건… 안 된단다.']);
    const c = yield choice('폐허를 나가고 싶다고 말할까?', ['말한다', '조금 더 머문다']);
    if (c === 1) { yield say('토리엘', ['그래, 천천히 생각하렴. 나는 여기 있을 테니.']); return; }
    yield say('토리엘', ['…아래 지하실로 가면 폐허의 출구가 있단다.', '나는 그 문을 부수러 갈 거야. 아무도 나가지 못하게.', '…따라오지 말렴.']);
    yield narrate('* 토리엘이 지하실로 내려갔다.'); p.flags.torielGone = true; p.flags.ruins_home_door = true;
  },
  *toriel_fight(w) {
    const p = w.player, g = routeFor(p, w.room.area) === 'genocide';
    yield showNpc('toriel_gate', 'toriel', 9, 11, 'up'); yield wait(.4);
    yield say('토리엘', g ? ['…너는 다른 아이들과 다르구나. 이미 알고 있었어.', '네가 지하 세계로 나가면… 모두가 죽겠지.', '그러니 여기서 널 멈추마.'] : ['…네가 폐허를 나가면 아스고어가 널 죽일 거야. 그는 인간의 영혼을 모으고 있단다.', '나는 이미 여러 아이를 잃었어. 더는 잃고 싶지 않구나.', '…그러니 증명해 보렴. 네가 살아남을 만큼 강한지를.']);
    yield music('boss');
    const r = yield battle(['toriel']);
    yield music(null);
    if (r.ended === 'dead') return;
    yield removeNpc('toriel_gate');
    if (r.ended === 'kill') { yield narrate(g ? ['* 먼지가 흩날린다.', '* 문이 열려 있다.'] : ['* …', '* 무언가 되돌릴 수 없는 일을 저지른 기분이다.']); }
    else yield narrate(['* 토리엘이 문 너머로 사라졌다.', '* "다시는 돌아오지 말아 주렴."']);
    p.flags.ruins_exit_door = true; yield sound('door');
  },
  *flowey_after_ruins(w) {
    const p = w.player, route = routeFor(p, w.room.area);
    yield music('flowey');
    if (route === 'genocide') yield say('플라위', ['…너. 너구나.', '내가 아는 그 느낌이야. 너도 알잖아, 우린 같은 편이야.', '이 세계는 죽이거나 죽거나. 네가 제일 잘 알겠지. 크크…', '먼저 가서 기다릴게, 파트너.']);
    else if (p.bossFate.toriel === 'killed') yield say('플라위', ['똑똑하네. 이 세계에선 그게 맞아.', '하지만… 죄책감이 들지? 크크, 그건 곧 사라질 거야.', '먼저 가서 지켜볼게.']);
    else yield say('플라위', ['똑똑한 척하지 마. 누구도 안 죽였다고?', '언젠가 널 죽이려 드는 놈이 나올 거야. 그때 넌 죽이거나… 죽겠지.', '"자비"라는 게 얼마나 가는지 지켜볼게. 크크크.']);
    yield removeNpc('flowey2'); yield music(null);
  },
  *sans_meet(w) {
    const p = w.player, g = routeFor(p, w.room.area) === 'genocide';
    yield showNpc('sans_shadow', 'sans', 9, 7, 'right'); yield sound('step'); yield wait(.4);
    if (g) yield say('???', ['…', '인간. 몬스터를 만나면 어떻게 인사하는지 아나?', '…', '…안 해도 돼. 네가 뭘 했는지는 알아.']);
    else yield say('???', ['인 간.', '몬스터를 만나면 어떻게 인사하는지 알아?', '돌아서서 내 손을 잡아.', '(뿌우우우웅) 하하, 방귀 쿠션이야. 옛날 개그지.']);
    yield say('샌즈', g ? ['난 샌즈. 형 파피루스가 이 길을 지키고 있어.', '…형은 널 만나고 싶어 해. 아직도.', '…부탁인데, 형한테는 잘 대해 줘.'] : ['난 샌즈. 인간 감시를 맡았는데, 사실 별로 할 마음은 없어.', '근데 내 형 파피루스는 인간을 정말 잡고 싶어 해.', '저 앞에 있을 거야. 형 퍼즐, 너무 대충 풀지 마. 형이 기뻐하니까.']);
    yield removeNpc('sans_shadow');
  },
  *papyrus_meet(w) {
    const p = w.player, g = routeFor(p, w.room.area) === 'genocide';
    yield showNpc('papyrus_show', 'papyrus', 12, 5, 'left'); yield showNpc('sans_show', 'sans', 13, 6, 'left'); yield wait(.3);
    yield say('파피루스', ['샌즈!! 너 또 감시 초소에서 자고 있었지?!', '난 위대한 파피루스로서 인간을 붙잡아 왕실 근위대에 들어가야 한단 말이야!']);
    yield say('샌즈', ['형. 저기 봐. 저게 뭐로 보여?']);
    yield say('파피루스', ['…!!! 저건… 인간?! 오, 마이, 갓!!', '인간! 너는 이 위대한 파피루스의 퍼즐을 통과해야 한다!', g ? '…음? 표정이 좀 무섭구나. 그래도 퍼즐은 재밌게 풀어 주렴!' : '기대하라! 냐하하하!']);
    yield removeNpc('papyrus_show'); yield removeNpc('sans_show');
  },
  *snow_puzzle_intro() { yield narrate(['* 안내판: 왼쪽 아래 스위치를 밟으면 가시가 내려간다. - 파피루스', '* 그 밑에 작은 글씨: "그리고 상자 안에 눈사람 조각이 있어. 가져가 줘." - 눈사람']); },
  *papyrus_fight(w) {
    const p = w.player, g = routeFor(p, w.room.area) === 'genocide';
    yield showNpc('papyrus_gate', 'papyrus', 15, 7, 'left'); yield wait(.4);
    yield say('파피루스', g ? ['인간. 안개 속에서 널 지켜봤다.', '샌즈가 그러더군. 넌 누구나 좋은 사람이 될 수 있다는 걸 모른다고.', '하지만 나, 파피루스는 널 믿는다! 자, 내 손을 잡아 줘!'] : ['인간! 잠깐 멈춰라!', '너를 보고 있으니 이상한 감정이 든다… 이건 우정?! 아니, 안 돼!', '나는 왕실 근위대가 될 거야! 널 붙잡아서 말이야!', '위대한 파피루스의 파란 공격을 받아라!']);
    yield music('boss');
    const r = yield battle(['papyrus']);
    yield music(null);
    if (r.ended === 'dead') return;
    yield removeNpc('papyrus_gate');
    if (r.ended === 'kill') { yield narrate(['* 파피루스의 머리가 먼지가 되었다.', '* …']); }
    else { p.flags.papyrusFriend = true; yield say('파피루스', ['냐하하! 그럼 이제 넌 폭포로 가는 거구나!', '언다인은 무서운 사람이지만… 넌 잘할 거야! 친구니까!']); }
    p.flags.papyrusLeft = true;
  },
  *undyne_bridge(w) {
    const p = w.player, g = routeFor(p, w.room.area) === 'genocide';
    yield showNpc('undyne_far', 'undyne', 15, 3, 'left'); yield sound('spear'); yield wait(.5);
    yield say('???', g ? ['…인간. 넌 파피루스를… 아니. 아무 말 안 해도 돼.', '폭포 끝에서 기다리지. 거기서 끝내자.'] : ['(창이 다리 옆 물에 꽂혔다.)', '거기 인간! 도망칠 곳은 없어! 폭포 끝에서 기다리겠다!']);
    yield removeNpc('undyne_far');
    if (!g) { yield say('몬스터 키드', ['우와! 저게 언다인이야! 진짜 멋있다! 나도 따라갈래!']); }
    yield removeNpc('kid_bridge');
  },
  *undyne_fight(w) {
    const p = w.player, g = routeFor(p, w.room.area) === 'genocide';
    if (!g && p.bossFate.papyrus !== 'killed') { yield showNpc('kid_stop', 'kid', 5, 7, 'right'); yield say('몬스터 키드', ['잠깐! 언다인이 그러는데 넌 나쁜 인간이라던데… 정말이야?', '…아니지? 넌 나를 한 번도 해치지 않았잖아. 난… 그냥 갈게. 조심해.']); yield removeNpc('kid_stop'); }
    if (g) { yield showNpc('kid_stop', 'kid', 5, 7, 'right'); yield say('몬스터 키드', ['야! 너… 너 정말 다들 죽인 거야? 언다인이 그랬어…', '나… 무서워도 안 비켜! 내가 널 막을 거야!']); yield showNpc('undyne_gate', 'undyne', 8, 6, 'left'); yield sound('hurt'); yield say('언다인', ['…물러서, 꼬마야.', '(언다인이 당신의 칼날을 대신 받았다.)', '…이 정도로… 안 돼. 아직 안 돼!', '몬스터 세계의 미래를 위해… 알피스… 아스고어… 모두를 위해서!!', '내 몸이 결의로 떨린다. 널 여기서 멈추게 하겠어!']); yield removeNpc('kid_stop'); yield music('boss'); const r = yield battle(['undying']); yield music(null); if (r.ended === 'dead') return; yield removeNpc('undyne_gate'); yield narrate(['* 언다인이 녹아내렸다.', '* 아무도 남지 않았다.']); return; }
    yield showNpc('undyne_gate', 'undyne', 8, 6, 'left'); yield wait(.4);
    yield say('언다인', ['…일곱. 일곱 개의 영혼만 있으면 아스고어 왕은 결계를 부술 수 있어.', '여섯은 이미 모았지. 네 영혼이 마지막이야.', '인간! 몬스터의 미래를 위해 넌 여기서 죽어야 해!', '…도망칠 생각은 마. 초록 영혼으론 움직일 수 없으니까!']);
    yield music('boss');
    const r = yield battle(['undyne']);
    yield music(null);
    if (r.ended === 'dead') return;
    yield removeNpc('undyne_gate');
    if (r.ended === 'kill') { yield narrate(['* 언다인이 먼지가 되었다.', '* …']); }
    else { p.flags.undyneFled = true; yield say('언다인', ['쫓아간다!! 열지대까지 도망쳐 봤자 소용없어!!']); }
  },
  *undyne_water(w) {
    const p = w.player; p.flags.undyneWater = true;
    yield say('언다인', ['헉… 헉… 갑옷이… 너무 뜨거워…']);
    const c = yield choice('언다인이 쓰러져 있다. 어떻게 할까?', ['물을 준다', '그냥 지나간다']);
    if (c === 0) { p.flags.undyneWatered = true; p.bossFate.undyne = 'friend'; yield narrate('* 물을 부어 주었다.'); yield say('언다인', ['…뭐야, 너. 날 죽이려던 인간을 살려 줘?', '…젠장. 이래서야 널 못 죽이잖아.', '…파피루스가 그러더라. 넌 좋은 애라고. 흥. 다음에 스파게티나 같이 먹자.']); yield narrate('* 언다인이 뒤돌아 걸어갔다. 왠지 등이 조금 따뜻해 보였다.'); }
    else { yield narrate('* 그냥 지나갔다. 뒤에서 뭔가 쓰러지는 소리가 났다.'); }
  },
  *alphys_call(w) {
    const p = w.player, g = routeFor(p, w.room.area) === 'genocide';
    yield sound('ring');
    if (g) yield say('전화', ['…(잡음)', '"여기는 알피스. 모두 대피시켰어. 넌… 이제 아무도 못 죽일 거야."', '"메타톤이 널 기다리고 있어. …제발 거기서 멈춰."']); 
    else yield say('알피스', ['어, 어, 안녕! 나는 알피스, 왕실 과학자야!', '네가 폐허에서 나온 뒤로 쭉 지켜봤어… 아, 이상한 뜻은 아니고!', '열지대는 레이저랑 컨베이어가 많아. 내가 전화로 도와줄게!', '아, 그리고… 메타톤이라는 로봇이 있는데, 좀… 인간을 죽이고 싶어 해. 미안!']);
  },
  *mettaton_fight(w) {
    const p = w.player, g = routeFor(p, w.room.area) === 'genocide';
    yield showNpc('mtt', 'mettaton', 12, 7, 'left'); yield wait(.4);
    if (g) { yield say('메타톤', ['…인간. 알피스가 모두를 대피시켰어.', '나는 원래 사람들을 즐겁게 하는 로봇이지만… 오늘은 다르다.', '이 몸은 NEO. 지하 세계를 지키기 위한 최종 형태다!']); yield music('boss'); const r = yield battle(['neo']); yield music(null); if (r.ended === 'dead') return; yield removeNpc('mtt'); yield narrate(['* 메타톤 NEO가 쓰러졌다.', '* 정말로 아무도 남지 않았다.']); return; }
    yield say('메타톤', ['OH YES!! 드디어 나타났군, 달링!', '시청자 여러분! 오늘의 메인 이벤트! 인간 vs 메타톤 EX!', '네 영혼을 가져가서 지상에 갈 거야. 스타가 되기 위해!', '자, 시청률을 올려 보자고!']);
    yield music('boss');
    const r = yield battle(['mettaton']);
    yield music(null);
    if (r.ended === 'dead') return;
    yield removeNpc('mtt');
    if (r.ended === 'kill') yield narrate(['* 메타톤의 전원이 꺼졌다.', '* 알피스에게서 전화가 오지 않는다.']);
    else { p.flags.mettatonSpared = true; yield say('메타톤', ['…시청률이 이렇게 높다니. 다들 내 쇼를 사랑하는구나.', '그래, 지상은 나중에 가도 돼. 이 사람들을 두고 갈 순 없지.', '달링, 코어를 지나면 왕의 성이야. …행운을 빌게.']); }
  },
  *castle_memory(w) {
    const p = w.player, g = routeFor(p, w.room.area) === 'genocide';
    yield narrate(['* 회색 집. 어딘가 폐허의 토리엘 집과 닮았다.', '* 벽에 걸린 그림 속에는 왕과 왕비, 그리고 두 아이가 있다.']);
    yield say('몬스터의 기억', ['"오래전, 인간 아이가 산에서 떨어졌어. 왕자 아스리엘이 아이를 데려왔지."', '"두 아이는 남매처럼 자랐어. 하지만 인간 아이가 병으로 죽자…"', '"아스리엘은 아이의 영혼을 흡수해 결계를 넘었어. 인간들은 그를 공격했지."', '"아스리엘은 마을로 돌아와 정원의 꽃밭 위에서 먼지가 되었어."', '"왕은 선포했어. 떨어지는 인간은 모두 죽인다고. 일곱 영혼으로 결계를 부수겠다고."', g ? '"…그리고 너는, 그 이야기의 결말을 지우러 왔지."' : '"…그리고 지금, 일곱 번째 인간이 왕의 앞에 서려 한다."']);
  },
  *judgement(w) {
    const p = w.player, route = routeFor(p, w.room.area);
    yield music('judgement');
    yield showNpc('sans_judge', 'sans', 12, 7, 'left'); yield wait(.6);
    if (route === 'genocide') {
      yield say('샌즈', ['좋은 날이지? 새들이 지저귀고, 꽃이 피고…', '이런 날엔 너 같은 애들은…', '…지옥에서 불타야 해.']);
      yield music('sans');
      const r = yield battle(['sans']);
      yield music(null);
      if (r.ended === 'dead') return;
      yield removeNpc('sans_judge');
      yield narrate(['* 회랑에는 붉은 먼지와 파란 후드만 남았다.']);
      p.flags.sansDead = true; return;
    }
    const lines = ['여기까지 왔네. 이곳은 심판의 회랑. 네가 한 일을 돌아보는 곳이야.', `너의 LV는 ${p.lv}, EXP는 ${p.exp}. 이 숫자가 뭘 뜻하는지 알아?`];
    if (route === 'pacifist') lines.push('LV는 폭력의 단계(Level Of ViolencE), EXP는 처형 점수(EXecution Points)야.', '넌 아무도 죽이지 않았어. 단 한 명도.', '…고마워. 형이 널 좋아한 이유를 알겠다.', '왕은 저 너머에 있어. 그는… 널 죽이려 들 거야. 하지만 넌 네 방식대로 해.');
    else { lines.push('LV는 폭력의 단계, EXP는 처형 점수야. 넌 누군가를 죽였어.', p.kills >= 10 ? '많이도 죽였네. 그래도 멈출 수 있었을 텐데… 지금이라도 다르게 할 수 있어.' : '몇 명. 두려워서였겠지. 하지만 그들에게도 가족이 있었어.'); if (p.bossFate.papyrus === 'killed') lines.push('…형은 마지막까지 널 믿었어. 그거 알아?'); lines.push('왕은 저 너머에 있어. 그는 널 죽이려 들 거야.', '…그 다음은 네가 정해.'); }
    yield say('샌즈', lines);
    yield removeNpc('sans_judge'); yield music(null);
  },
  *asgore(w) {
    const p = w.player, route = routeFor(p, w.room.area);
    yield music('asgore');
    if (route === 'genocide') {
      yield say('아스고어', ['…아. 인간이여. 아니… 너는 인간이 아니구나.', '어떻게 이런 일이… 모두… 모두 죽었단 말인가.', '…그래. 나를 죽이고 싶다면 그리하거라. 나는 이미 모든 걸 잃었다.']);
      yield sound('slash'); yield shake(); yield removeNpc('asgore_npc');
      yield narrate(['* 아스고어가 먼지가 되었다. 단 한 번의 공격으로.', '* …']);
      yield showNpc('flowey_end', 'flowey', 10, 6, 'down');
      yield say('플라위', ['…뭐야. 뭐 하는 거야? 나… 나야, 파트너! 우리 같은 편이잖아!', '왜 그런 눈으로… 안 돼, 안 돼, 제발! 죽이지 마! 난…', '…엄마… 아빠…']);
      yield sound('slash'); yield removeNpc('flowey_end'); yield wait(1);
      yield ending('genocide'); return;
    }
    if (route === 'pacifist') {
      yield say('아스고어', ['…인간이여. 결국 여기까지 왔구나.', '나는 이 순간이 오지 않기를 바랐다. 하지만 왕으로서… 의무가 있다.', '…미안하구나. 준비되었느냐.']);
      yield sound('fire'); yield flash();
      yield showNpc('toriel_end', 'toriel', 5, 7, 'right');
      yield say('토리엘', ['그만두렴, 아스고어. 이 아이는 아무도 해치지 않았어.', '결계를 부수는 데 누군가의 목숨이 필요하다면, 그건 잘못된 길이야.']);
      yield showNpc('undyne_end', 'undyne', 4, 4, 'right'); yield showNpc('papyrus_end', 'papyrus', 4, 10, 'right'); yield showNpc('sans_end', 'sans', 6, 10, 'right');
      yield say('파피루스', ['인간! 내 친구!! 안녕!! 모두 데려왔어!']); yield say('언다인', ['…이 인간은 나한테 물을 줬어. 왕, 이 녀석은 내 친구야.']);
      yield say('아스고어', ['…토리엘. …모두. 그래… 나는 정말… 형편없는 왕이었구나.']);
      yield sound('pellet'); yield shake();
      yield say('???', ['…멍청이들.']);
      yield narrate(['* 하얀 알갱이가 모두를 감쌌다. 여섯 개의 인간 영혼이 빛난다.', '* 플라위가 웃는다. "이 세계는 이제 내 거야. …아니, 우리 거지, 크리스?"']);
      yield flash(); yield narrate(['* 눈부신 빛. 몬스터들의 영혼까지 모두 흡수되었다.', '* 그리고 그곳에… 뿔 달린 소년이 서 있다.']);
      yield say('아스리엘', ['…안녕. 오랜만이야, 크리스.', '나는 아스리엘 드리무르. 이 세계를… 다시 시작할 거야.', '너와 내가 처음 만난 그날로. 영원히.']);
      yield music('asriel');
      const r = yield battle(['asriel']);
      yield music(null);
      if (r.ended === 'dead') return;
      yield say('아스리엘', ['…미안해. 난 그냥… 다시 혼자가 되기 싫었어.', '결계를 부술게. 모두의 영혼으로. 그럼 모두 자유가 될 거야.', '…나는 곧 다시 꽃으로 돌아가겠지. 그래도 괜찮아.', '…잘 가, 크리스. 아니… 네 이름이 뭐든. 잘 가.']);
      yield flash(); yield ending('pacifist', { soulless: !!p.flags.soulless }); return;
    }
    // 중립
    yield say('아스고어', ['…인간이여. 결국 여기까지 왔구나.', '왕으로서 나는… 네 영혼을 가져가야 한다.', '…미안하구나. 준비되었느냐.']);
    const r = yield battle(['asgore']);
    if (r.ended === 'dead') return;
    yield music(null); yield removeNpc('asgore_npc');
    if (r.ended === 'spare') { yield sound('pellet'); yield say('플라위', ['멍청이. 이 세계에서 자비는 통하지 않아.']); yield narrate('* 플라위가 아스고어의 영혼을 부숴 버렸다.'); }
    else yield narrate('* 아스고어가 먼지가 되었다.');
    yield showNpc('flowey_end', 'flowey', 10, 6, 'down');
    yield say('플라위', ['하하하! 여섯 영혼은 내 거야!', '네 세이브 파일도, 이 세계도 이제 내 거지!', '죽이거나 죽거나. 이번엔 네가 죽을 차례야!']);
    yield music('flowey_boss');
    const r2 = yield battle(['flowey']);
    yield music(null);
    if (r2.ended === 'dead') return;
    yield say('플라위', ['…왜… 왜 못 이기는 거야…', '…죽여. 어서 죽여. 넌 그럴 수 있잖아.']);
    const c = yield choice('플라위를 어떻게 할까?', ['살려 준다', '죽인다']);
    if (c === 0) { p.flags.floweySpared = true; yield say('플라위', ['…뭐야, 왜 살려 주는 거야. 이해가 안 돼.', '…넌 진짜 이상한 애야. 다음엔… 그렇게 안 될 거야.']); yield removeNpc('flowey_end'); }
    else { yield sound('slash'); yield removeNpc('flowey_end'); yield narrate('* 플라위가 사라졌다.'); }
    yield ending('neutral');
  },
};

// 중립 결말 전화 내용을 상황에 따라 만든다.
export function neutralEndingLines(p) {
  const dead = id => p.bossFate[id] === 'killed' || (id === 'undyne' && p.bossFate.undying === 'killed');
  const lines = ['(전화가 울린다.)'];
  if (dead('toriel') && dead('papyrus') && dead('undyne')) lines.push('샌즈: "…거기 있어? 여기 남은 건 나 혼자야. 형도, 토리엘도… 다들 갔어."', '"…네가 뭘 남겼는지 잘 봐 둬. 그리고 다시 오지 마."');
  else if (dead('papyrus')) lines.push('샌즈: "인간. 넌 결계를 나갔지. 여긴… 형이 없어. 왜 그랬는지는 묻지 않을게."', '"…그냥, 다음엔 다르게 해 줘."');
  else if (dead('undyne')) lines.push('샌즈: "어이, 여긴 파피루스랑 나야. 언다인이 없으니 근위대는 형이 맡았어."', '"…근데 왜 언다인이었어? 그 애는 그냥 몬스터를 지키려던 거였는데."');
  else if (dead('toriel')) lines.push('샌즈: "여기 형이랑 언다인이랑… 다 잘 지내. 폐허의 문 뒤에 있던 사람 빼고."', '"…네가 그렇게 만든 거지. 뭐, 지금이라도 다르게 살아."');
  else if (p.kills > 0) lines.push('샌즈: "어이, 잘 나갔어? 여기는 다 괜찮아. 토리엘이 여왕이 됐어."', `"…네가 죽인 ${p.kills}명 얘기는… 다음에 하자. 어쨌든 잘 지내."`);
  else lines.push('샌즈: "어이. 여기는 다 잘 지내. 토리엘이 왕이 됐고, 형은 인간을 위한 스파게티 축제를 열었어."', '"아무도 죽이지 않고 나갔지. 근데 뭔가 빠졌어… 아마 다시 돌아오면 알게 될 거야."');
  lines.push('(뚝.)');
  return lines;
}

// ---------- 월드 상태 ----------
export function createWorld(player, opts = {}) {
  const w = { player, room: null, x: 0, y: 0, dir: 'down', frame: 0, walkT: 0, moving: false, stepAcc: 0, actors: [], script: null, request: null, rng: opts.rng || Math.random,
    encounterCooldown: 2, visited: {}, seed: 0, transition: 0, blocked: false };
  player.flags._p = player; // NPC 조건식에서 플레이어를 참조하기 위한 역참조 (저장 시 제거)
  enterRoom(w, opts.room || 'ruins_flowerbed', opts.x, opts.y);
  return w;
}
export function enterRoom(w, roomId, tx, ty) {
  const room = ROOMS[roomId]; w.room = room; w.visited[roomId] = true;
  const sp = tx === undefined ? (room.spawn || { x: 10, y: 7 }) : { x: tx, y: ty };
  w.x = sp.x * TILE + TILE / 2; w.y = sp.y * TILE + TILE / 2;
  w.actors = room.npcs.map(n => ({ ...n, px: n.x * TILE + TILE / 2, py: n.y * TILE + TILE / 2, temp: false }));
  w.encounterCooldown = 3; w.transition = .4;
}
export function activeActors(w) { return w.actors.filter(a => !a.when || a.when(w.player.flags, w)); }

function blocked(w, x, y) {
  const flags = w.player.flags, room = w.room; const hw = 9, hh = 6;
  for (const [dx, dy] of [[-hw, -hh], [hw, -hh], [-hw, hh], [hw, hh]]) {
    const tx = Math.floor((x + dx) / TILE), ty = Math.floor((y + dy + 8) / TILE);
    if (!passable(room, tx, ty, flags)) return true;
  }
  for (const a of activeActors(w)) if (Math.abs(a.px - x) < 20 && Math.abs(a.py - y - 4) < 18) return true;
  return false;
}
export function update(w, dt, input = {}) {
  if (w.transition > 0) w.transition -= dt;
  if (w.request || w.script?.busy) { w.moving = false; tickActors(w, dt); return; }
  let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0), dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  if (dx && dy) { dx *= Math.SQRT1_2; dy *= Math.SQRT1_2; }
  if (dx > 0) w.dir = 'right'; else if (dx < 0) w.dir = 'left'; else if (dy > 0) w.dir = 'down'; else if (dy < 0) w.dir = 'up';
  const speed = WALK_SPEED * (input.slow ? .5 : 1);
  const nx = w.x + dx * speed * dt, ny = w.y + dy * speed * dt;
  const moved = { x: false, y: false };
  if (dx && !blocked(w, nx, w.y)) { w.x = nx; moved.x = true; }
  if (dy && !blocked(w, w.x, ny)) { w.y = ny; moved.y = true; }
  w.moving = moved.x || moved.y;
  if (w.moving) { w.walkT += dt; w.frame = Math.floor(w.walkT * 6) % 4; w.stepAcc += Math.hypot(moved.x ? dx * speed * dt : 0, moved.y ? dy * speed * dt : 0); }
  else w.frame = 0;
  tickActors(w, dt);
  // 출구
  const ex = w.room.exits;
  if (w.x < 4 && ex.left) return enterRoom(w, ex.left.room, ex.left.x, ex.left.y);
  if (w.x > COLS * TILE - 4 && ex.right) return enterRoom(w, ex.right.room, ex.right.x, ex.right.y);
  if (w.y < 4 && ex.up) return enterRoom(w, ex.up.room, ex.up.x, ex.up.y);
  if (w.y > ROWS * TILE - 4 && ex.down) return enterRoom(w, ex.down.room, ex.down.x, ex.down.y);
  w.x = Math.max(2, Math.min(COLS * TILE - 2, w.x)); w.y = Math.max(2, Math.min(ROWS * TILE - 2, w.y));
  // 이벤트
  const tx = Math.floor(w.x / TILE), ty = Math.floor((w.y + 8) / TILE);
  for (const ev of w.room.events) {
    if (ev.once && w.player.flags[ev.once]) continue;
    if (ev.when && !ev.when(w.player.flags, w)) continue;
    if (tx >= ev.x && tx < ev.x + ev.w && ty >= ev.y && ty < ev.y + ev.h) { if (ev.once) w.player.flags[ev.once] = true; runScript(w, ev.script); return; }
  }
  // 인카운터
  if (w.stepAcc >= TILE) {
    w.stepAcc -= TILE; w.encounterCooldown--;
    const tile = w.room.tiles[ty]?.[tx];
    if (tile === ',' && w.room.encounter && w.encounterCooldown <= 0 && w.rng() < 1 / w.room.encounter) { w.encounterCooldown = 6; startEncounter(w); }
  }
}
function tickActors(w, dt) {
  for (const a of w.actors) {
    if (a.target) { const dx = a.target.x - a.px, dy = a.target.y - a.py, d = Math.hypot(dx, dy), s = (a.speed || 90) * dt; if (d <= s) { a.px = a.target.x; a.py = a.target.y; a.target = null; a.walk = 0; } else { a.px += dx / d * s; a.py += dy / d * s; a.walk = (a.walk || 0) + dt; a.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); } }
  }
}
function startEncounter(w) {
  const area = AREAS[w.room.area], p = w.player;
  if (quotaMet(p, w.room.area)) { w.request = { type: 'say', who: null, lines: ['* 아무도 오지 않았다.'], resolve: () => { w.request = null; } }; return; }
  const id = area.encounters[Math.floor(w.rng() * area.encounters.length)];
  const enemies = w.rng() < .25 && area.encounters.length > 1 ? [id, area.encounters[(area.encounters.indexOf(id) + 1) % area.encounters.length]] : [id];
  w.request = { type: 'battle', enemies, random: true, resolve: () => { w.request = null; } };
}

// ---------- 상호작용 ----------
export function facingTile(w) { const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[w.dir]; return { tx: Math.floor(w.x / TILE) + d[0], ty: Math.floor((w.y + 8) / TILE) + d[1] }; }
export function interact(w) {
  if (w.request || w.script) return false;
  const { tx, ty } = facingTile(w); const room = w.room, p = w.player;
  // NPC
  for (const a of activeActors(w)) {
    const ax = Math.floor(a.px / TILE), ay = Math.floor(a.py / TILE);
    if (Math.abs(ax - tx) <= 0 && Math.abs(ay - ty) <= 0 || (Math.hypot(a.px - w.x, a.py - w.y) < 40 && facingToward(w, a))) {
      a.dir = { up: 'down', down: 'up', left: 'right', right: 'left' }[w.dir];
      if (a.script) { runScript(w, a.script); return true; }
      if (a.shop) { w.request = { type: 'shop', shop: a.shop, resolve: () => { w.request = null; } }; return true; }
      if (a.lines) { w.request = { type: 'say', who: displayName(a), lines: a.lines, resolve: () => { w.request = null; } }; return true; }
    }
  }
  const c = room.tiles[ty]?.[tx];
  if (c === 'S') { const healed = p.maxHp - p.hp; p.hp = p.maxHp; w.request = { type: 'save', lines: [saveLine(w), `* HP가 완전히 회복되었다.${healed ? '' : ''}`], resolve: () => { w.request = null; } }; return true; }
  if (c === 'B' && room.box) {
    const box = room.box; if (p.flags[box.flag]) { w.request = { type: 'say', who: null, lines: ['* 상자는 비어 있다.'], resolve: () => { w.request = null; } }; return true; }
    let item = box.item; if (box.genocideOnly && routeFor(p, w.room.area) !== 'genocide') item = box.altItem;
    p.flags[box.flag] = true; if (p.items.length >= 8) { w.request = { type: 'say', who: null, lines: ['* 가방이 가득 찼다.'], resolve: () => { w.request = null; } }; p.flags[box.flag] = false; return true; }
    p.items.push(item); const it = ITEMS[item];
    const extra = item === 'knife' ? ['* …여기서 왔다. 이제 돌아갈 곳이다.', '* 로켓 목걸이도 함께 있었다. "최고의 친구들에게".'] : [];
    if (item === 'knife') p.items.push('locket');
    w.request = { type: 'say', who: null, lines: [`* ${it.name}을(를) 얻었다.`, ...extra], resolve: () => { w.request = null; } }; return true;
  }
  if (c === 'D' && !p.flags[`${room.id}_door`]) { w.request = { type: 'say', who: null, lines: [room.id === 'ruins_home' ? '* 지하실 문이 잠겨 있다. 토리엘에게 말을 걸어 보자.' : '* 문이 잠겨 있다.'], resolve: () => { w.request = null; } }; return true; }
  if (c === 'o' && room.deco === 'echo') { w.request = { type: 'say', who: null, lines: ['* 메아리 꽃. 마지막으로 들은 말을 되풀이한다.'], resolve: () => { w.request = null; } }; return true; }
  return false;
}
function facingToward(w, a) { const dx = a.px - w.x, dy = a.py - w.y; return w.dir === 'right' ? dx > 8 && Math.abs(dy) < 24 : w.dir === 'left' ? dx < -8 && Math.abs(dy) < 24 : w.dir === 'down' ? dy > 8 && Math.abs(dx) < 24 : dy < -8 && Math.abs(dx) < 24; }
function displayName(a) { return { flowey: '플라위', toriel: '토리엘', sans: '샌즈', papyrus: '파피루스', undyne: '언다인', kid: '몬스터 키드', rabbit: '토끼 아주머니', temmie: '템미', blook: '냅스타블룩', echo: '메아리 꽃', froggit: '프로깃', vending: '자판기', asgore: '아스고어', mettaton: '메타톤' }[a.sprite] || a.id; }
function saveLine(w) {
  const p = w.player, route = routeFor(p, w.room.area);
  const pool = { ruins: ['* 폐허의 조용한 공기.', '* 낙엽 밟는 소리가 마음을 가라앉힌다.'], snowdin: ['* 눈 위에 찍힌 발자국들.', '* 마을의 불빛이 따뜻해 보인다.'], waterfall: ['* 반짝이는 동굴 벽.', '* 물소리가 잔잔하게 들린다.'], hotland: ['* 뜨거운 바람.', '* 멀리서 쇼의 음악이 들린다.'], castle: ['* 회색 복도. 아무 소리도 나지 않는다.', '* 창밖의 빛이 바닥에 길게 늘어졌다.'] }[w.room.area];
  const line = pool[Object.keys(w.visited).length % pool.length];
  if (route === 'genocide') return `${line.replace('.', '…')} ${p.kills}명. 결의가 차오른다.`;
  return `${line} 결의가 차오른다.`;
}

// ---------- 스크립트 실행 ----------
export function runScript(w, name) {
  const gen = SCRIPTS[name]; if (!gen) return;
  w.script = { name, it: gen(w), busy: true };
  step(w, undefined);
}
function step(w, value) {
  const s = w.script; if (!s) return;
  const { value: req, done } = s.it.next(value);
  if (done) { w.script = null; return; }
  // 즉시 처리 가능한 요청
  if (req.type === 'move') { const a = w.actors.find(x => x.id === req.id); if (a) { a.target = { x: req.x * TILE + TILE / 2, y: req.y * TILE + TILE / 2 }; a.speed = req.speed || 90; } w.request = { type: 'wait', s: a ? Math.hypot(a.target.x - a.px, a.target.y - a.py) / (a.speed || 90) : 0, resolve: r => finish(w, r) }; return; }
  if (req.type === 'remove') { w.actors = w.actors.filter(x => x.id !== req.id); step(w, undefined); return; }
  if (req.type === 'show') { w.actors = w.actors.filter(x => x.id !== req.id); w.actors.push({ id: req.id, sprite: req.sprite, dir: req.dir, px: req.x * TILE + TILE / 2, py: req.y * TILE + TILE / 2, temp: true }); step(w, undefined); return; }
  w.request = { ...req, resolve: r => finish(w, r) };
}
function finish(w, result) { w.request = null; step(w, result); }
export function resolveRequest(w, result) { const r = w.request; if (!r) return; r.resolve(result); }

// ---------- 저장 ----------
export function serialize(w) {
  const p = { ...w.player, flags: { ...w.player.flags } }; delete p.flags._p;
  return { player: p, room: w.room.id, x: Math.floor(w.x / TILE), y: Math.floor(w.y / TILE), visited: w.visited, savedAt: Date.now() };
}
export function restore(save) {
  const player = save.player; player.flags = player.flags || {};
  if (player.flags.torielGone) player.flags.ruins_home_door = true; // 이전 버전 세이브 호환 player.bossFate = player.bossFate || {}; player.areaKills = player.areaKills || { ruins: 0, snowdin: 0, waterfall: 0, hotland: 0 };
  const w = createWorld(player, { room: save.room, x: save.x, y: save.y }); w.visited = save.visited || {}; return w;
}

// 플라위 도입부의 스크립트 전투용 가짜 몬스터
MONSTERS.floweyIntro = { name: '플라위', area: 'ruins', hp: 999, at: 19, df: 0, exp: 0, gold: 0, boss: true, scripted: true, flavor: ['* 플라위가 웃고 있다.'], acts: [], patterns: ['none'] };
export { heal };
