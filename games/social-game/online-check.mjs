// 같이 사는 동네 (shared town) against a LOCAL net server (never the real one):
//   (cd services/net && ST=$(mktemp -d) && CI=1 npx wrangler d1 migrations apply net --local --persist-to "$ST" && CI=1 npx wrangler dev --port 8787 --ip 127.0.0.1 --persist-to "$ST")
//   npm run social-game:dev
//   node games/social-game/online-check.mjs http://127.0.0.1:5173/ [outDir]
// Two computers sign up, join 동네 1, see each other, share a block and a broken tree, chat (a phone
// number gets masked), report and block, leave, and A comes back later: the block is still there and
// A's own solo blocks were never touched.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';

const pw = await import('../../tools/node_modules/playwright/index.mjs').catch(() => import(process.env.PLAYWRIGHT_MJS ?? 'playwright'));
const base = process.argv[2] ?? 'http://127.0.0.1:5173/';
const out = process.argv[3] ?? '/tmp/social-online';
mkdirSync(out, { recursive: true });
const url = `${base}${base.includes('?') ? '&' : '?'}net=http://127.0.0.1:8787`;
const tag = Math.random().toString(36).slice(2, 7);
const browser = await pw.chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const G = (c, f, a) => c.page.evaluate(f, a);
const until = (c, f, a, timeout = 20000) => c.page.waitForFunction(f, a, { timeout });
const shot = (c, name) => c.page.screenshot({ path: `${out}/${name}.png` });

async function computer(name) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
  // new game: 직장인 story (the page reloads and starts)
  await Promise.all([page.waitForEvent('load', { timeout: 60000 }), page.click('#m-office')]);
  await page.waitForFunction(() => window.__ready === true && !!window.__game, null, { timeout: 180000 });
  await page.waitForFunction(() => document.getElementById('start').classList.contains('hidden'), null, { timeout: 20000 });
  const nick = `${name.toLowerCase()}${tag}`;
  await page.click('#btn-login');
  await page.fill('#nick', nick);
  await page.fill('#pw', 'abcd1234');
  await page.click('#do-signup');
  await page.waitForFunction(() => !document.getElementById('login-in').classList.contains('hidden'), null, { timeout: 20000 });
  await page.click('#login-close');
  return { ctx, page, errors, name, nick };
}

async function joinTown(c, n = 1) {
  await c.page.click('#btn-town');
  await until(c, () => !document.getElementById('town-pick').classList.contains('hidden'));
  await c.page.click(`#town-pick .town-ch[data-n="${n}"]`);
  await until(c, () => window.__game.town.live === true);
}
// stand somewhere public (the office plaza) looking along x
const stand = (c, x, z, yaw, pitch = 0) => G(c, ([x, z, yaw, pitch]) => { const p = window.__game.player; p.place(x, 1.2, z, yaw); p.pitch = pitch; }, [x, z, yaw, pitch]);

const A = await computer('A');
const B = await computer('B');

// A's solo (personal) blocks before going online
const SOLO = [{ id: 'stone', x: -146.5, z: -8.5 }, { id: 'brick', x: -145.5, z: -8.5 }];
const soloA = await G(A, (list) => {
  const g = window.__game;
  for (const b of list) g.build.placeBlock(b.id, b.x, 0.3, b.z, 1);
  return g.build.dump();
}, SOLO);
assert.equal(soloA.length, 2);

// props have the same keys on both computers (seeded placement)
const sig = (c) => G(c, () => window.__game.deco.breakables.map((e) => `${e.key}@${e.min[0].toFixed(2)},${e.min[2].toFixed(2)}`).join(';'));
const [sigA, sigB] = [await sig(A), await sig(B)];
assert.ok(sigA.length > 1000, 'there are breakable props');
assert.equal(sigA, sigB, 'prop keys are deterministic across computers');

// both join 동네 1
await joinTown(A);
await joinTown(B);
assert.equal(await G(A, () => window.__game.build.placed.size), 0, 'online, the solo blocks are not shown');
await stand(A, 30.5, -16.5, -Math.PI / 2, -0.12);
await stand(B, 36.5, -16.5, Math.PI / 2, -0.32);
const seesOther = (c, nick) => until(c, (nick) => [...window.__game.town.remotes.values()].some((r) => r.visible && r.user?.nickname === nick), nick);
await seesOther(A, B.nick);
await seesOther(B, A.nick);
const people = await G(B, () => document.getElementById('town-people').textContent);
assert.match(people, new RegExp(A.nick), 'player list shows the other nickname');

// A places a block between them (the same steps as a right click in Build.update)
const cellKey = await G(A, () => {
  const g = window.__game, b = g.build;
  g.state.inventory.stone = 5;
  const y = window.__game.player.pos.y;
  const rec = b.placeBlock('stone', 33.5, y, -16.5, 0);
  g.state.inventory.stone--;
  b.onPlaced(rec);
  return `b|${rec.x}|${rec.y.toFixed(2)}|${rec.z}`;
});
await until(A, (k) => window.__game.town.world.cells.get(k)?.owner?.nickname !== undefined && window.__game.town.pending.size === 0, cellKey);
await until(B, (k) => window.__game.build.placed.has(k.slice(2)), cellKey);
assert.equal(await G(A, () => window.__game.state.inventory.stone), 4, 'placing used one stone');

// screenshots: each sees the other and the shared block
await A.page.waitForTimeout(1200);
await shot(A, '01-A-sees-B-and-block');
await shot(B, '02-B-sees-A-and-block');

// B cannot break A's block: hold the left button on it for 3 seconds
const bInv = await G(B, () => window.__game.state.inventory.stone ?? 0);
await G(B, () => { const i = window.__game.build; void i; const inp = window.__game.player.input; inp.locked = true; inp.mouse.left = true; inp.mouse.leftPressed = true; });
await until(B, () => [...document.querySelectorAll('#toast div')].some((d) => d.textContent.includes('님의 블럭이에요')), null, 8000);
const toastB = await G(B, () => [...document.querySelectorAll('#toast div')].map((d) => d.textContent).join(' | '));
assert.match(toastB, new RegExp(`${A.nick} 님의 블럭이에요`));
await shot(B, '03-B-cannot-break');
await B.page.waitForTimeout(3000);
await G(B, () => { const inp = window.__game.player.input; inp.mouse.left = false; inp.locked = false; });
assert.equal(await G(B, (k) => window.__game.build.placed.has(k.slice(2)), cellKey), true, 'A\'s block is still there on B');
assert.equal(await G(B, () => window.__game.state.inventory.stone ?? 0), bInv, 'B got nothing');
assert.equal(await G(A, (k) => window.__game.town.world.cells.has(k), cellKey), true, 'and on the server');

// A breaks a tree (the same steps as Build.update when a prop breaks) and B sees it gone
const treeKey = await G(A, () => {
  const g = window.__game, p = g.player.pos;
  const trees = g.deco.breakables.filter((e) => e.item === 'log' && !e.broken).sort((a, b) => Math.hypot(a.min[0] - p.x, a.min[2] - p.z) - Math.hypot(b.min[0] - p.x, b.min[2] - p.z));
  const e = trees[0];
  e.scatter?.setVisible(e.index, false);
  g.build.removeProp(e);
  g.build.onBreakProp(e);
  return e.key;
});
await until(B, (k) => window.__game.deco.breakables.find((e) => e.key === k)?.broken === true, treeKey);
const cellExp = await G(A, (k) => { const c = window.__game.town.world.cells.get(`p|${k}`); return c ? c.exp - Date.now() : -1; }, treeKey);
assert.ok(cellExp > 590000 && cellExp <= 600000, `tree grows back in 10 minutes (${cellExp} ms)`);
// the morning regrow does not bring it back while the town has it broken
await G(B, () => window.__game.day.g.onNewDay());
assert.equal(await G(B, (k) => window.__game.deco.breakables.find((e) => e.key === k).broken, treeKey), true, 'morning regrow skips town-broken props');

// while online the personal save keeps the solo blocks, not the town's
const savedOnline = await G(A, () => { window.__game.day.g.save(); return JSON.parse(localStorage.getItem('social-game-save-v1')).placed; });
assert.deepEqual(savedOnline, soloA, 'online save keeps the solo blocks');

// chat: A writes a phone number, B sees it masked with A's server nickname, and block / report buttons
await A.page.keyboard.press('t');
await until(A, () => !document.getElementById('chat-input').classList.contains('hidden'));
await A.page.fill('#chat-input', '안녕! 내 번호 010-1234-5678');
await A.page.press('#chat-input', 'Enter');
await until(B, (nick) => document.getElementById('chat-log').textContent.includes(nick), A.nick);
const line = await G(B, () => { const l = [...document.querySelectorAll('#chat-log .line')].pop(); return { text: l.textContent, buttons: [...l.querySelectorAll('button')].map((b) => b.textContent) }; });
assert.ok(!/1234|5678/.test(line.text), `phone number masked: ${line.text}`);
assert.match(line.text, /\*/);
assert.match(line.text, /안녕/);
assert.deepEqual(line.buttons, ['🚫 차단', '🚨 신고']);
await B.page.waitForTimeout(300);
await shot(B, '04-B-chat-masked');
await shot(A, '05-A-chat');

// privacy: inside our home (802호) A sends a hidden pose and B stops drawing A
await G(A, () => { const g = window.__game, h = g.places.sites.home, sp = h.spawn.pos, c = Math.cos(h.worldYaw), s = Math.sin(h.worldYaw); g.player.place(h.worldPos[0] + sp[0] * c + sp[2] * s, h.worldPos[1] + sp[1] + 0.05, h.worldPos[2] - sp[0] * s + sp[2] * c, 0); });
await until(B, (nick) => { const r = [...window.__game.town.remotes.values()].find((r) => r.user?.nickname === nick); return r && r.target?.hidden === true && !r.visible && r.target.x === undefined; }, A.nick);
assert.equal(await G(B, () => window.__game.town.dots().length), 0, 'no minimap dot either');
await stand(A, 30.5, -16.5, -Math.PI / 2, -0.12);
await seesOther(B, A.nick);

// B reports A (world context), then blocks A
await B.page.click('#chat-log .line button:has-text("신고")');
await until(B, () => !document.getElementById('town-ask').classList.contains('hidden'));
await B.page.fill('#town-ask-reason', '시험 신고');
await B.page.click('#town-ask-ok');
await until(B, () => [...document.querySelectorAll('#toast div')].some((d) => d.textContent.includes('신고했어요')));
await B.page.click('#town-people button:has-text("차단")');
await until(B, () => !document.getElementById('town-ask').classList.contains('hidden'));
await B.page.click('#town-ask-ok');
await until(B, () => [...document.querySelectorAll('#toast div')].some((d) => d.textContent.includes('차단했어요')));
await until(B, () => [...window.__game.town.remotes.values()].every((r) => !r.visible));
assert.equal(await G(B, () => document.getElementById('chat-log').textContent.includes('안녕')), false, 'blocked player\'s lines are gone');

// both leave; A's solo blocks are back exactly
await A.page.click('#town-leave');
await B.page.click('#town-leave');
await until(A, () => !window.__game.town.live && !window.__game.town.world);
const afterLeave = await G(A, () => ({ dump: window.__game.build.dump(), saved: (window.__game.day.g.save(), JSON.parse(localStorage.getItem('social-game-save-v1')).placed), stone: window.__game.state.inventory.stone }));
assert.deepEqual(afterLeave.dump, soloA, 'solo blocks are back after leaving');
assert.deepEqual(afterLeave.saved, soloA, 'and saved');
assert.equal(afterLeave.stone, 4, 'inventory is personal and kept');
const treeSolo = await G(A, (k) => window.__game.deco.breakables.find((e) => e.key === k).broken, treeKey);
assert.equal(treeSolo, false, 'the town\'s broken tree is not broken in solo play');
await shot(A, '06-A-solo-again');

// later, A comes back: the block is still in the town
await A.page.waitForTimeout(1500);
await joinTown(A);
const back = await G(A, (k) => { const r = window.__game.build.placed.get(k.slice(2)); return r ? { id: r.id, owner: r.owner?.nickname } : null; }, cellKey);
assert.deepEqual(back, { id: 'stone', owner: A.nick }, 'the block stayed in the town');
assert.equal(await G(A, (k) => window.__game.deco.breakables.find((e) => e.key === k).broken, treeKey), true, 'the tree is still broken in the town');
// the connection drops: back to solo with a reconnect button, then back in with a fresh ticket
await G(A, () => window.__game.town.world.socket.close());
await until(A, () => !document.getElementById('town-lost').classList.contains('hidden') && !window.__game.town.live);
assert.deepEqual(await G(A, () => window.__game.build.dump()), soloA, 'solo blocks are back after a disconnect');
await shot(A, '07-A-disconnected');
await A.page.click('#town-retry');
await until(A, () => window.__game.town.live === true);
assert.equal(await G(A, (k) => window.__game.build.placed.has(k.slice(2)), cellKey), true, 'reconnected: the town block is back');
// A breaks its own block: the stone comes back, the cell is gone
await G(A, (k) => { const g = window.__game, rec = g.build.placed.get(k.slice(2)); g.build.removeBlock(rec); g.state.inventory.stone++; g.build.onBlockBroken(rec); }, cellKey);
await until(A, (k) => !window.__game.town.world.cells.has(k), cellKey);
assert.equal(await G(A, () => window.__game.state.inventory.stone), 5);
await A.page.click('#town-leave');
assert.deepEqual(await G(A, () => window.__game.build.dump()), soloA, 'solo blocks intact after the second visit');

for (const c of [A, B]) assert.deepEqual(c.errors, [], `page errors on ${c.name}`);
console.log('online check ok', A.nick, B.nick, out);
await browser.close();
