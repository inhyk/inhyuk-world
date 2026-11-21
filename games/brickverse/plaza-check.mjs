// 모두의 광장을 내 컴퓨터 서버(services/net, wrangler dev)로 시험한다. 진짜 서버는 쓰지 않는다.
//   node games/brickverse/plaza-check.mjs                         빈 DB 로 로컬 서버(8787)를 띄우고, 시험하고, 끈다
//   node games/brickverse/plaza-check.mjs http://127.0.0.1:8787    이미 띄워 둔 로컬 서버를 쓴다 (끄지 않는다)
// 게임이 쓰는 연결(src/plaza.js 의 Plaza)으로 계정 둘이 brickverse:plaza-1 에 들어가서 서로의 hi 와 위치,
// 정해 둔 말을 받고, 돈 주기와 타워 메시지는 받는 쪽이 버리고, 한쪽이 나가면 다른 쪽이 leave 를 받는지 본다.
// 가입은 같은 서버에서 IP 하나당 1시간에 10번까지라, 이미 띄운 서버로 여러 번 하면 막힐 수 있다 (그때는 새로 띄운다).
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Account, memoryStorage } from '../../packages/net/index.mjs';
import { Plaza, plazaHi, plazaSay } from './src/plaza.js';
import { NET_VERSION, defaultSave, lookToArray, packPose, unpackPose } from './core.mjs';

const LOCAL = /^http:\/\/(127\.0\.0\.1|localhost):\d{1,5}$/;
const given = process.argv[2]?.replace(/\/+$/, '');
if (given && !LOCAL.test(given)) { console.error('내 컴퓨터 서버 주소만 받아요 (예: http://127.0.0.1:8787)'); process.exit(2); }
const SERVER = given ?? 'http://127.0.0.1:8787';
const ORIGIN = 'http://127.0.0.1:5173'; // 서버는 내 컴퓨터 주소에서 온 요청을 언제나 받는다
const NET_DIR = fileURLToPath(new URL('../../services/net/', import.meta.url));
const WRANGLER = join(NET_DIR, 'node_modules/.bin/wrangler');

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(what, fn, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await fn()) return; await sleep(50); }
  throw Error(`기다렸는데 안 됨: ${what}`);
}
const withOrigin = (url, init = {}) => fetch(url, { ...init, headers: { ...(init.headers ?? {}), Origin: ORIGIN } });
const connect = url => new WebSocket(url, { headers: { Origin: ORIGIN } });

async function alive() {
  try { return (await (await fetch(`${SERVER}/`)).text()).includes('inhyuk net ok'); } catch { return false; }
}

let server = null, store = '';
async function startServer() {
  if (await alive()) throw Error(`${SERVER} 에 이미 서버가 있어요. 그 서버로 하려면 주소를 넘겨 주세요: node games/brickverse/plaza-check.mjs ${SERVER}`);
  store = mkdtempSync(join(tmpdir(), 'brickverse-plaza-'));
  const env = { ...process.env, CI: '1' };
  const migrate = spawnSync(WRANGLER, ['d1', 'migrations', 'apply', 'net', '--local', '--persist-to', store], { cwd: NET_DIR, env, encoding: 'utf8' });
  if (migrate.status !== 0) throw Error(`DB 만들기 실패\n${migrate.stdout}\n${migrate.stderr}`);
  const port = new URL(SERVER).port;
  server = spawn(WRANGLER, ['dev', '--port', port, '--ip', '127.0.0.1', '--persist-to', store], { cwd: NET_DIR, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  server.stdout.on('data', d => { log += d; });
  server.stderr.on('data', d => { log += d; });
  try { await until('로컬 서버 켜짐', alive, 90000); } catch (e) { throw Error(`${e.message}\n${log.slice(-3000)}`); }
}
function stopServer() {
  if (server) {
    try { process.kill(-server.pid, 'SIGTERM'); } catch { /* 이미 꺼짐 */ }
    server = null;
  }
  if (store) { try { rmSync(store, { recursive: true, force: true }); } catch { /* 무시 */ } store = ''; }
}

// 게임(main.js)과 같은 순서로 보낸다: 들어오면 모두에게 hi 와 위치, 새 사람이 오면 그 사람에게 hi 와 위치.
function client(name, account, hi, pose) {
  const got = { hi: new Map(), pose: new Map(), say: [], join: [], leave: [], resets: 0, notices: [] };
  const plaza = new Plaza({
    opened: () => { plaza.send(hi); plaza.pose(pose); },
    join: id => { got.join.push(id); plaza.sendTo(id, hi); plaza.pose(pose); },
    leave: id => got.leave.push(id),
    reset: () => { got.resets++; },
    pose: (id, d) => got.pose.set(id, d),
    message: (data, from) => { if (data.t === 'hi') got.hi.set(from, data); else if (data.t === 'say') got.say.push([from, data]); },
    notice: text => got.notices.push(text),
  }, { server: SERVER, ticket: () => account.ticket(), connect, fetch: withOrigin });
  return { name, account, plaza, got, hi, pose };
}

const tag = Math.random().toString(36).slice(2, 7);
const clients = [];
try {
  if (!given) await startServer();
  const look = defaultSave().look;
  const make = async (name, n, w, pt, at) => {
    const account = new Account({ server: SERVER, fetch: withOrigin, storage: memoryStorage() });
    await account.signup(`${name}${tag}`, 'abcd1234');
    const hi = plazaHi({ t: 'hi', v: NET_VERSION, n, l: lookToArray({ ...look, hat: n[0] % 16 }), w, pt, o: [1, 2, 3] });
    const c = client(name, account, hi, packPose(at, Math.PI / 2, w, 0, 0));
    clients.push(c);
    return c;
  };
  const A = await make('pa', [3, 4], 0, 2, { x: 1.25, y: 0.3, z: 18 });
  const B = await make('pb', [7, 11], 1, 0, { x: -4.5, y: 12.75, z: -30.25 });

  A.plaza.want(true);
  await until('A 가 광장에 들어감', () => A.plaza.live);
  assert.equal(A.plaza.name, 'plaza-1');
  assert.equal(A.plaza.world.options.game, 'brickverse');
  B.plaza.want(true);
  await until('B 가 광장에 들어감', () => B.plaza.live);
  assert.equal(B.plaza.name, 'plaza-1', '둘 다 plaza-1');
  const aId = A.plaza.id, bId = B.plaza.id;
  assert.notEqual(aId, bId);

  await until('서로의 hi 와 위치', () => A.got.hi.has(bId) && B.got.hi.has(aId) && A.got.pose.has(bId) && B.got.pose.has(aId));
  assert.deepEqual(A.got.join, [bId], 'A 는 나중에 온 B 를 join 으로 안다');
  assert.deepEqual(B.got.join, [], 'B 는 이미 있던 A 를 join 이 아니라 A 의 hi 로 안다');
  assert.deepEqual(A.got.hi.get(bId), B.hi, 'B 가 보낸 hi 가 서버 거르개를 지나 그대로 왔다');
  assert.deepEqual(B.got.hi.get(aId), A.hi, 'A 가 보낸 hi 가 그대로 왔다');
  assert.equal('o' in A.got.hi.get(bId), false, '타이쿤 물건 목록은 광장으로 가지 않는다');
  assert.deepEqual(A.got.pose.get(bId), B.pose, 'B 의 위치가 그대로 왔다');
  assert.deepEqual(B.got.pose.get(aId), A.pose);
  assert.ok(unpackPose(A.got.pose.get(bId)));

  // 움직이면 새 위치가 온다
  const moved = packPose({ x: 2.5, y: 0.3, z: 10 }, 0, 0, 1, 0);
  B.plaza.pose(moved);
  await until('B 의 새 위치', () => JSON.stringify(A.got.pose.get(bId)) === JSON.stringify(moved));

  // 돈 주기와 타워 블록은 광장에서 받아도 버린다 (Plaza 가 hi, say 만 넘긴다). 같은 연결이라 뒤에 보낸 say 가 오면 앞의 것도 왔다.
  B.plaza.world.send({ t: 'gift', amt: 5000, n: 7 });
  B.plaza.world.send({ t: 'tw', a: 0, p: 0, b: [1, 2, 3, 4] });
  B.plaza.send(plazaSay(3));
  await until('B 의 정해 둔 말', () => A.got.say.length === 1);
  assert.deepEqual(A.got.say, [[bId, { t: 'say', i: 3 }]]);

  // B 가 나가면 A 는 leave 를 받는다
  B.plaza.want(false);
  assert.equal(B.plaza.live, false);
  assert.equal(B.got.resets, 1);
  await until('A 가 B 의 leave 를 받음', () => A.got.leave.includes(bId));
  assert.equal(A.plaza.count, 0);
  A.plaza.want(false);
  assert.deepEqual([...A.got.notices, ...B.got.notices], []);
  console.log(`plaza check ok: ${A.account.user.nickname}(${aId}), ${B.account.user.nickname}(${bId}) 가 brickverse:plaza-1 에서 만나고 헤어짐`);
} catch (error) {
  console.error('plaza check 실패:', error?.stack ?? error);
  process.exitCode = 1;
} finally {
  for (const c of clients) c.plaza.want(false);
  stopServer();
}
