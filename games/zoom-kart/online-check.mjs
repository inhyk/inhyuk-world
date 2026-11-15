// 같이 하기 확인. 로컬 공용 서버(8787)와 개발 서버(5198)를 켠 뒤: node games/zoom-kart/online-check.mjs
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '../../tools/node_modules/playwright/index.mjs');
import { mkdir } from 'node:fs/promises';
const origin = process.argv[2] || 'http://127.0.0.1:5198/';
const out = process.argv[3] || new URL('../../artifacts/zoom-kart', import.meta.url).pathname;
const url = new URL(origin); url.searchParams.set('debug', '1'); url.searchParams.set('net', process.env.NET || 'http://127.0.0.1:8787');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const errors = [];
const open = async () => { const p = await browser.newPage({ viewport: { width: 1100, height: 680 } }); p.on('pageerror', (e) => errors.push(String(e))); await p.goto(url.href); await p.waitForFunction(() => window.__kart); return p; };
const A = await open(), B = await open();
// A 가 방을 만들고 B 가 코드로 들어간다
await A.locator('#b-online').click(); await A.locator('#r-make').click();
await A.waitForFunction(() => window.__kart.net.code && window.__kart.net.state === 'waiting');
const code = await A.evaluate(() => window.__kart.net.code);
await A.screenshot({ path: out + '/online-room-wait.png' });
await B.locator('.grid button').nth(3).click(); // B 는 나비
await B.locator('#b-online').click(); await B.locator('#r-code').fill(code.toLowerCase()); await B.locator('#r-join').click();
await A.waitForFunction(() => window.__kart.net.live && window.__kart.friends.size === 1);
await B.waitForFunction(() => window.__kart.net.live && window.__kart.friends.size === 1);
if (await A.evaluate(() => [...window.__kart.friends.values()][0].r) !== 3) throw Error('friend racer not shared');
if (await B.locator('#r-go').count()) throw Error('guest must not see start');
await A.screenshot({ path: out + '/online-room.png' });
// 방장이 출발 → 둘 다 같은 트랙에서 시작
await A.locator('#r-go').click();
for (const p of [A, B]) await p.waitForFunction(() => window.__kart.race && window.__kart.race.online && window.__kart.race.state === 'race', null, { timeout: 10000 });
const kinds = (p) => p.evaluate(() => window.__kart.race.karts.map((k) => k.kind + (k.owned ? '*' : '')).join(','));
if (await kinds(A) !== 'me*,remote,ai*,ai*,ai*,ai*,ai*,ai*') throw Error('host slots ' + await kinds(A));
if (await kinds(B) !== 'remote,me*,ai,ai,ai,ai,ai,ai') throw Error('guest slots ' + await kinds(B));
await A.keyboard.down('ArrowUp'); await B.keyboard.down('ArrowUp');
await A.waitForTimeout(3500);
// 서로의 카트와 컴퓨터 카트가 같은 곳에 보인다
const pos = (p) => p.evaluate(() => window.__kart.race.karts.map((k) => [k.x, k.z, k.total]));
const pa = await pos(A), pb = await pos(B);
for (let i = 0; i < 8; i++) { const d = Math.hypot(pa[i][0] - pb[i][0], pa[i][1] - pb[i][1]); if (d > 12) throw Error(`kart ${i} apart ${d.toFixed(1)}`); }
if (!(pb[0][2] > -380 + 20)) throw Error('host kart not moving on guest');
await B.screenshot({ path: out + '/online-race.png' });
// 아이템: A 가 젤리를 놓으면 B 화면에도 생긴다
await A.evaluate(() => { const k = window.__kart.race.player; k.items = ['jelly']; k.rollT = 0; });
await A.keyboard.press('ControlLeft');
await B.waitForFunction(() => window.__kart.race.traps.length === 1, null, { timeout: 4000 });
// 멈춤은 안 되고 나가기만 뜬다
await B.keyboard.press('Escape');
if (!(await B.locator('button[data-a=quit]').count())) throw Error('online pause menu');
await B.keyboard.press('Escape');
// B 가 골인 → A 순위표에 들어온다
await B.evaluate(() => { const r = window.__kart.race, k = r.player, T = r.track, p = window.__kart.C.trackPos(T, T.n - 6, 0); k.lap = r.laps - 1; k.x = p.x; k.z = p.z; k.h = k.mv = p.h; k.idx = T.n - 6; });
await A.waitForFunction(() => window.__kart.race.karts[1].finished, null, { timeout: 10000 });
await B.waitForFunction(() => window.__kart.shownResult, null, { timeout: 10000 });
await B.screenshot({ path: out + '/online-result.png' });
// B 가 방을 나가면 A 에서 카트가 빠지고, A 는 계속 달린다
await B.locator('button[data-a=quit]').click();
await A.waitForFunction(() => window.__kart.race.karts[1].gone && !window.__kart.net.live, null, { timeout: 8000 });
await A.keyboard.up('ArrowUp');
await browser.close();
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('zoom-kart online check ok →', out);
