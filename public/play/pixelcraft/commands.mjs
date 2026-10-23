import { applyEnchant } from './enchantments.mjs';
import { B, I, ITEMS, MC_BLOCK_IDS, durabilityOf } from './data.mjs';
import { W, H, addItem, collides, findSpawn } from './core.mjs';
import { JUMP_LAST, CHECKPOINT_EVERY, jumpSpawn } from './jump-world.mjs';

export const COMMAND_HELP = [
  '/help · 명령어 목록', '/give diamond_sword 1 · 아이템 받기 (한글 이름·숫자 ID도 가능)',
  '/gamemode creative 또는 survival · 모드 바꾸기', '/tp 640 40 또는 /tp ~3 ~-2 · 순간이동',
  '/spawn · 저장된 출발점으로 돌아가기', '/heal · 체력과 배고픔 회복',
  '/time set day 또는 night · 낮/밤 바꾸기 (숲 세계)', '50day 또는 /day 50 · 날짜 바꾸기',
  '/difficulty peaceful 또는 normal 또는 hard · 난이도 (숲 세계)',
  '/enchant sharpness 5 · 손의 장비에 인챈트', '/xp add 30 levels · 경험치 30레벨 받기',
  '/checkpoint 0~4 · 점프맵 체크포인트 이동', '/where · 현재 좌표',
];
const ok = (text, changed = false) => ({ ok: true, text, changed });
const fail = text => ({ ok: false, text, changed: false });
const integer = (s, min, max) => /^\d+$/.test(s ?? '') && Number(s) >= min && Number(s) <= max;
function position(G, x, y) {
  const p = G.player;
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x + p.w > W || y < 0 || y + p.h > H - 1) return fail('세계 안의 좌표를 써 줘.');
  if (collides(G.w, x, y, p.w, p.h)) return fail('그곳은 블록으로 막혀 있어. 빈 공간을 골라 줘.');
  Object.assign(p, { x, y, vx: 0, vy: 0, fallTop: y, fire: 0, invT: 2, onGround: false });
  G.cam = { x, y }; G.mining = null; G.target = null;
  return ok(`이동했어: ${x.toFixed(1)}, ${y.toFixed(1)}`, true);
}
export function runCommand(G, input) {
  if (!G || G.dead) return fail('살아 있는 세계 안에서 명령어를 사용해 줘.');
  if (typeof input !== 'string' || input.length > 160) return fail('명령어는 160자 안으로 써 줘.');
  const parts = input.trim().replace(/^\//, '').split(/\s+/);
  let name = parts.shift().toLowerCase();
  const args = parts;
  const dayShortcut = name.match(/^(\d+)day$/);
  if (dayShortcut && !args.length) { name = 'day'; args.push(dayShortcut[1]); }
  if (name === 'help' || name === '도움말' || name === '?') return ok(COMMAND_HELP.join('\n'));
  if (name === 'where' || name === '좌표') return ok(`현재 좌표: ${G.player.x.toFixed(2)}, ${G.player.y.toFixed(2)} · ${G.adventure?.dimension ?? 'overworld'}`);
  if(name==='enchant'){if(['@s','@p'].includes(args[0]))args.shift();if(args.length<1||args.length>2)return fail('사용법: /enchant sharpness 5');const result=applyEnchant(G,G.player.inv[G.player.sel],(args[0]??'').replace('minecraft:',''),args[1]===undefined?1:Number(args[1]),{command:true});return result.ok?ok(result.text,true):fail(result.text);}
  if(name==='xp'){if(args[0]==='add')args.shift();if(['@s','@p'].includes(args[0]))args.shift();if(!integer(args[0],1,1000)||args.length>2||args[1]&&!['levels','points'].includes(args[1]))return fail('사용법: /xp add 30 levels 또는 /xp add 100 points');const n=Number(args[0]);G.player.xp=args[1]==='levels'?7*(Math.floor(Math.sqrt((G.player.xp??0)/7))+n)**2:(G.player.xp??0)+n;return ok('경험치를 받았어!',true);}
  if (name === 'give' || name === '지급') {
    if (args[0] === '@s' || args[0] === '@p') args.shift();
    if (!args.length) return fail('사용법: /give diamond 64 또는 /give 다이아몬드 64');
    let count = 1;
    if (args.length > 1 && /^-?\d+$/.test(args.at(-1))) {
      const raw = args.pop();
      if (!integer(raw, 1, 2304)) return fail('개수는 1~2304 사이 정수로 써 줘.');
      count = Number(raw);
    }
    const word = args.join('').replace(/["']/g, '').replace(/^minecraft:/i, '');
    const id = /^\d+$/.test(word) ? Number(word) : I[word.toUpperCase()] ?? MC_BLOCK_IDS[word.toLowerCase()] ?? B[word.toUpperCase()] ?? ITEMS.find(it => it?.name.replace(/\s/g, '') === word)?.id;
    if (!ITEMS[id] || id === B.AIR) return fail('아이템을 찾지 못했어. 예: diamond, diamond_sword, iron_helmet, stone 또는 한글 이름');
    const left = addItem(G.player.inv, id, count, durabilityOf(id));
    return left === count ? fail('가방이 가득 찼어. 빈 칸을 만들어 줘.') : ok(`${ITEMS[id].name} ${count - left}개를 받았어.${left ? ` 가방이 차서 ${left}개는 받지 못했어.` : ''}`, true);
  }
  if (name === 'gamemode' || name === '모드') {
    const mode = { creative: 'creative', survival: 'survival', '1': 'creative', '0': 'survival', '크리에이티브': 'creative', '서바이벌': 'survival' }[args[0]?.toLowerCase()];
    if (!mode || args.length !== 1) return fail('사용법: /gamemode creative 또는 /gamemode survival');
    G.mode = mode; G.player.flying = false;
    return ok(mode === 'creative' ? '크리에이티브! F 또는 스페이스 두 번으로 날 수 있어.' : '서바이벌로 바꿨어.', true);
  }
  if (name === 'tp' || name === '이동') {
    if (args[0] === '@s' || args[0] === '@p') args.shift();
    if (args.length !== 2) return fail('사용법: /tp x y 또는 /tp ~3 ~-2');
    const coordinate = (s, base) => /^~(?:-?\d+(?:\.\d+)?)?$/.test(s) ? base + Number(s.slice(1) || 0) : /^-?\d+(?:\.\d+)?$/.test(s) ? Number(s) : NaN;
    return position(G, coordinate(args[0], G.player.x), coordinate(args[1], G.player.y));
  }
  if (name === 'spawn' || name === '귀환') {
    let sp = G.jump ? jumpSpawn(G.jump.checkpoint) : G.player.spawn;
    if (collides(G.w, sp.x, sp.y, G.player.w, G.player.h)) sp = findSpawn(G.w);
    return position(G, sp.x, sp.y);
  }
  if (name === 'heal' || name === '회복') {
    Object.assign(G.player, { hp: 20, food: 20, sat: 5, air: 10, fire: 0, hurtT: 0 });
    return ok('체력과 배고픔을 모두 회복했어!', true);
  }
  if (name === 'checkpoint' || name === '체크포인트') {
    if (!G.jump) return fail('점프맵 세계에서 사용할 수 있어.');
    if (args.length !== 1 || !integer(args[0], 0, JUMP_LAST / CHECKPOINT_EVERY)) return fail('사용법: /checkpoint 0~4');
    const i = Number(args[0]) * CHECKPOINT_EVERY, sp = jumpSpawn(i);
    const result = position(G, sp.x, sp.y);
    if (!result.ok) return result;
    G.jump.checkpoint = i; G.jump.progress = Math.max(G.jump.progress, i); G.player.spawn = { ...sp };
    if (G.companion) G.companion.spawn = { ...sp };
    return ok(`체크포인트 ${args[0]}로 이동했어.`, true);
  }
  if (['time', 'day', 'difficulty'].includes(name)) {
    if (G.jump && name !== 'day') return fail('이 명령어는 숲 세계에서 써 줘. 점프맵은 낮과 평화로움으로 고정돼.');
    if (name === 'time') {
      if (args[0] === 'set') args.shift();
      if (!args.length) return ok(`현재 시간: ${Math.floor(G.time * 24000)} / 24000`);
      const value = { day: 0.1, noon: 0.25, night: 0.65, midnight: 0.8, '낮': 0.1, '밤': 0.65 }[args[0]] ?? (integer(args[0], 0, 23999) ? Number(args[0]) / 24000 : undefined);
      if (value === undefined || args.length !== 1) return fail('사용법: /time set day 또는 night 또는 0~23999');
      G.time = value; return ok('시간을 바꿨어!', true);
    }
    if (name === 'day') {
      if (args.length !== 1 || !integer(args[0], 1, 9999)) return fail('사용법: /day 1~9999 (50일째 소환사 좀비 등장)');
      G.day = Number(args[0]); return ok(`${G.day}일째로 바꿨어.`, true);
    }
    const diff = { peaceful: 0, normal: 1, hard: 2, '0': 0, '1': 1, '2': 2, '평화로움': 0, '보통': 1, '어려움': 2 }[args[0]];
    if (diff === undefined || args.length !== 1) return fail('사용법: /difficulty peaceful 또는 normal 또는 hard');
    G.diff = diff; return ok('난이도를 바꿨어!', true);
  }
  return fail('모르는 명령어야. /help로 목록을 확인해 줘.');
}
