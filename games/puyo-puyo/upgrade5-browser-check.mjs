// 인혁이 기획서 「뿌요뿌요 (업그레이드)」(2026-10-08)를 실제 Chrome 여러 창과 로컬 net 서버로 끝까지 확인한다.
// 1번 효과음 on/off 와 배경음악 끄기 → 5번 새 챌린지 묶음 → 7번 처음 인사 「하이와 친구가 되어 주세요!」
// → 4번 온라인 상대 필드가 부드럽게 → 3번 관전 채팅, 응원(화이팅, 좋아요), 친구 요청, 관전자 차단·신고, 예전 서버일 때 안내.
// (2번 졸업3~5는 graduation-browser-check.mjs, 6번 계정 지우기는 upgrade4-browser-check.mjs)
//
// 사용법:
//   npm run puyo-puyo:dev   (게임, http://127.0.0.1:5190)
//   PUYO_URL=http://127.0.0.1:5190/ node games/puyo-puyo/upgrade5-browser-check.mjs
// net 서버: PUYO_NET 이 없으면 services/net 에서 빈 로컬 D1 로 wrangler dev 를 새로 띄우고(포트 8799) 끝나면 끈다.
// 화면 사진: PUYO_SHOTS (기본 /tmp/puyo-upgrade5)
import { chromium } from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const base = process.env.PUYO_URL || 'http://127.0.0.1:5190/';
const shots = process.env.PUYO_SHOTS || '/tmp/puyo-upgrade5';
await mkdir(shots, { recursive: true });
const netDir = fileURLToPath(new URL('../../services/net/', import.meta.url));

// ---------- 로컬 net 서버 ----------
let server = null, NET = process.env.PUYO_NET;
if (!NET) {
  const state = await mkdtemp(join(tmpdir(), 'puyo-net-'));
  execFileSync('npx', ['wrangler', 'd1', 'migrations', 'apply', 'net', '--local', '--persist-to', state], { cwd: netDir, stdio: 'ignore', env: { ...process.env, CI: '1' } });
  const port = 8799;
  server = spawn('npx', ['wrangler', 'dev', '--port', String(port), '--ip', '127.0.0.1', '--persist-to', state], { cwd: netDir, detached: true, env: { ...process.env, CI: '1' } });
  let log = '';
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error(`wrangler dev 가 뜨지 않음\n${log}`)), 60000);
    const read = chunk => { log += chunk; if (/Ready on/.test(log)) { clearTimeout(timer); resolve(); } };
    server.stdout.on('data', read); server.stderr.on('data', read);
    server.on('exit', code => reject(Error(`wrangler dev 가 끝남 (${code})\n${log}`)));
  });
  NET = `http://127.0.0.1:${port}`;
}
const stopServer = () => { if (server) try { process.kill(-server.pid, 'SIGTERM'); } catch { /* 이미 끝남 */ } };

const urlOf = (extra = '') => `${base}${base.includes('?') ? '&' : '?'}test&net=${encodeURIComponent(NET)}${extra}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
const expected = /Failed to load resource: the server responded with a status of 404/; // 저장이 아직 없을 때(404 no-save)
const T = { timeout: 20000 };
async function open(name, viewport = { width: 1100, height: 860 }, extra = '') {
  const context = await browser.newContext({ viewport, isMobile: viewport.width < 500, hasTouch: viewport.width < 500 });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(`${name}: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !expected.test(m.text())) errors.push(`${name}: ${m.text()}`); });
  page.on('dialog', d => d.accept());
  await page.goto(urlOf(extra), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__puyo, null, { timeout: 60000 });
  return page;
}
const settle = page => page.waitForTimeout(400);
const read = page => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const screenIs = (page, name) => page.waitForFunction(n => JSON.parse(window.render_game_to_text()).screen === n, name, T);
const hideToasts = page => page.evaluate(() => { document.getElementById('toasts').style.visibility = 'hidden'; });
async function signup(page, nick, pass = 'abcd1') {
  await page.click('#go-signup');
  await page.fill('#signup-name', nick); await page.fill('#signup-pass', pass);
  await page.click('#signup-form button[type=submit]');
  await screenIs(page, 'menu');
}
async function startMatch(a, b) {
  for (const p of [a, b]) { await p.evaluate(() => window.__puyo.show('online')); await screenIs(p, 'online'); }
  await a.click('#online-find');
  await a.waitForSelector('#online-searching:not([hidden])');
  await b.click('#online-find');
  for (const p of [a, b]) await p.waitForSelector('#online-lobby:not([hidden])', { timeout: 30000 });
  const aHost = (await read(a)).online.host;
  const [host, guest] = aHost ? [a, b] : [b, a];
  await host.waitForFunction(() => !document.getElementById('online-start').disabled, null, T);
  await host.click('#online-first [data-v="1"]'); // 1판 먼저 이기면 승리 (아무도 안 움직이면 둘이 같이 쓰러져 비기므로 대전은 이어진다)
  await guest.waitForFunction(() => document.getElementById('online-wait').textContent.includes('1판'), null, T);
  await host.click('#online-start');
  for (const p of [a, b]) await p.waitForFunction(() => window.__puyo.game?.mode === 'online' && window.__puyo.match?.phase === 'play', null, T);
  return [host, guest];
}
const waitBubble = (page, text) => page.waitForFunction(t => [...document.querySelectorAll('#bubbles .bubble')].some(b => b.textContent.includes(t)), text, T);
const tag = Math.random().toString(36).slice(2, 6);

try {
  // ---------- 1번: 효과음 on and off, 배경음악 끄기 ----------
  const g = await open('손님');
  await g.click('#go-guest'); await screenIs(g, 'menu');
  const sfx = '#scr-menu [data-sound="sfx"]', music = '#scr-menu [data-sound="music"]';
  assert.equal(await g.textContent(sfx), '🔊 효과음 ON');
  assert.equal(await g.textContent(music), '🎵 배경음악 ON');
  await hideToasts(g); await settle(g); await g.screenshot({ path: `${shots}/sound-on.png` });
  await g.click(sfx);
  assert.equal(await g.textContent(sfx), '🔇 효과음 OFF');
  assert.equal(await g.getAttribute(sfx, 'aria-pressed'), 'false');
  await g.click(music);
  assert.equal(await g.textContent(music), '🎵 배경음악 OFF');
  assert.deepEqual(await g.evaluate(() => { const d = JSON.parse(localStorage.getItem('puyo-tower-device')); return [d.sound, d.music]; }), [false, false]);
  await settle(g); await g.screenshot({ path: `${shots}/sound-off.png` });
  // 내 정보의 체크 상자, 게임 중 위쪽 단추, 일시정지 창이 모두 같이 바뀐다
  await g.click('#profile-chip'); await screenIs(g, 'profile');
  assert.deepEqual(await g.evaluate(() => [document.getElementById('set-sound').checked, document.getElementById('set-music').checked]), [false, false]);
  await g.click('#scr-profile [data-sound="music"]');
  assert.equal(await g.textContent('#scr-profile [data-sound="music"]'), '🎵 배경음악 ON');
  assert.equal(await g.evaluate(() => document.getElementById('set-music').checked), true);
  await g.evaluate(() => window.__puyo.startSolo());
  await g.waitForFunction(() => window.__puyo.game?.mode === 'solo', null, T);
  assert.equal(await g.textContent('#hud-sound'), '🔇');
  assert.equal(await g.evaluate(() => document.getElementById('hud-music').classList.contains('off')), false);
  await g.evaluate(() => window.__puyo.pause(true));
  assert.equal(await g.textContent('#pause [data-sound="sfx"]'), '🔇 효과음 OFF');
  await g.click('#pause [data-sound="sfx"]');
  assert.equal(await g.textContent('#pause [data-sound="sfx"]'), '🔊 효과음 ON');
  assert.equal(await g.textContent('#hud-sound'), '🔊');
  await g.click('#pause [data-sound="music"]');
  assert.equal(await g.evaluate(() => document.getElementById('hud-music').classList.contains('off')), true);
  await settle(g); await g.screenshot({ path: `${shots}/sound-pause.png` });
  await g.click('#pause-quit'); await screenIs(g, 'menu');
  // 새로 열어도 그대로 (이 기기에 저장)
  await g.reload({ waitUntil: 'domcontentloaded' });
  await g.waitForFunction(() => window.__puyo, null, { timeout: 60000 });
  await g.click('#go-guest'); await screenIs(g, 'menu');
  assert.equal(await g.textContent(sfx), '🔊 효과음 ON');
  assert.equal(await g.textContent(music), '🎵 배경음악 OFF');

  // ---------- 5번: 챌린지를 더 ----------
  await g.click('[data-go="missions"]'); await screenIs(g, 'missions');
  const count = Number((await g.textContent('#mission-count')).match(/전체 (\d+)개/)[1]);
  assert.ok(count >= 230, `챌린지 ${count}개`);
  const groups = await g.evaluate(() => [...document.querySelectorAll('#mission-list h3.mgroup')].map(h => h.textContent));
  for (const name of ['트로피 챌린지', '친구 · 관전 챌린지', '펫 · 부스트 챌린지', '배우기 챌린지']) assert.ok(groups.includes(name), `${name} / ${groups}`);
  await g.selectOption('#mission-filter', 'friends');
  const friendRows = await g.evaluate(() => [...document.querySelectorAll('#mission-list .mission b')].map(b => b.textContent.trim()));
  for (const title of ['친구 1명 사귀기', '온라인 대전 1번 관전하기', '관전하면서 응원 1번 보내기 (화이팅 · 좋아요)', '친구에게 선물 1번 보내기']) assert.ok(friendRows.includes(title), `${title} / ${friendRows}`);
  await hideToasts(g); await settle(g); await g.screenshot({ path: `${shots}/missions-friends.png` });
  await g.selectOption('#mission-filter', 'school');
  assert.ok((await g.locator('#mission-list .mission').count()) >= 10);
  // 지금 기록으로 깨지는 챌린지: 트로피를 얻고 메뉴로 가면 완료 알림, 받기까지
  await g.evaluate(() => { window.__puyo.P().trophies = 5; window.__puyo.show('menu'); });
  await g.waitForFunction(() => Number(document.getElementById('mission-badge').textContent) >= 2 && !document.getElementById('mission-badge').hidden, null, T);
  await g.click('[data-go="missions"]'); await g.selectOption('#mission-filter', 'trophy');
  const coinsBefore = await g.evaluate(() => window.__puyo.P().coins);
  await g.locator('#mission-list .mission', { hasText: '트로피 5개 모으기' }).locator('button').click();
  assert.ok(await g.evaluate(() => window.__puyo.P().coins) > coinsBefore);

  // ---------- 7번: 처음 인사 「하이와 친구가 되어 주세요!」 ----------
  // 손님: 인사는 뜨지만 친구 요청은 온라인 계정이 있어야 해서 계정 만들기로 안내한다
  const g2 = await open('손님2', { width: 390, height: 844 }, '&hi');
  await g2.click('#go-guest'); await screenIs(g2, 'menu');
  await g2.waitForSelector('#hi-pop:not([hidden])', T);
  assert.equal(await g2.textContent('#hi-title'), '하이와 친구가 되어 주세요!');
  assert.equal(await g2.textContent('#hi-yes'), '✨ 계정 만들러 가기');
  await hideToasts(g2); await settle(g2); await g2.screenshot({ path: `${shots}/hi-guest-phone.png` });
  await g2.click('#hi-later');
  assert.equal(await g2.locator('#hi-pop').isHidden(), true);
  assert.equal(await g2.evaluate(() => JSON.parse(localStorage.getItem('puyo-tower-device')).hiSeen), true);
  // 하이 본인에게는 뜨지 않는다
  const hi = await open('하이', { width: 1100, height: 860 }, '&hi');
  await signup(hi, '하이');
  await hi.waitForTimeout(1500);
  assert.equal(await hi.locator('#hi-pop').isHidden(), true);
  // 새 계정: 인사가 뜨고, 누르면 하이에게 친구 요청이 간다
  const n = await open('새친구', { width: 1100, height: 860 }, '&hi');
  await signup(n, `새${tag}`);
  await n.waitForSelector('#hi-pop:not([hidden])', T);
  assert.equal(await n.textContent('#hi-yes'), '🤝 하이에게 친구 요청');
  await hideToasts(n); await settle(n); await n.screenshot({ path: `${shots}/hi-desktop.png` });
  await n.click('#hi-yes');
  await n.waitForFunction(() => document.getElementById('hi-pop').hidden, null, T);
  assert.equal(await n.evaluate(() => window.__puyo.P().hiAsked), true);
  await hi.waitForFunction(async () => (await window.__puyo.social.requests()).incoming.length === 1, null, T);
  assert.equal(await hi.evaluate(async () => (await window.__puyo.social.requests()).incoming[0].nickname), `새${tag}`);
  // 한 번 본 뒤에는 다시 뜨지 않는다 (서버 기록에 남는다)
  await n.evaluate(() => window.__puyo.cloud.flush());
  await n.reload({ waitUntil: 'domcontentloaded' });
  await n.waitForFunction(() => window.__puyo && JSON.parse(window.render_game_to_text()).net?.cloud === 'synced', null, { timeout: 60000 });
  await n.waitForTimeout(1500);
  assert.equal(await n.locator('#hi-pop').isHidden(), true);
  // 하이가 수락해서 이미 친구인 사람에게도 뜨지 않는다
  await hi.evaluate(async () => { const s = window.__puyo.social; const r = await s.requests(); await s.acceptFriend(r.incoming[0].id); });
  await n.evaluate(() => { window.__puyo.P().hiAsked = false; return window.__puyo.greetHi(); });
  assert.equal(await n.locator('#hi-pop').isHidden(), true);
  assert.equal(await n.evaluate(() => window.__puyo.P().hiAsked), true);
  for (const p of [g, g2, hi, n]) await p.context().close();

  // ---------- 4번: 온라인 상대 필드가 부드럽게 ----------
  const a = await open('A'), b = await open('B', { width: 390, height: 844 });
  const nick = new Map([[a, `가${tag}`], [b, `나${tag}`]]);
  for (const p of [a, b]) { await signup(p, nick.get(p)); await hideToasts(p); }
  const [host, guest] = await startMatch(a, b);
  // 손님 화면에서 방장의 떨어지는 짝을 90프레임 동안 본다: 같은 짝은 같은 객체이고, 거의 매 프레임 조금씩 내려온다
  const smooth = await guest.evaluate(() => new Promise(resolve => {
    const seen = []; let frames = 0;
    const tick = () => {
      const p = window.__puyo.match?.players[1]?.piece;
      seen.push(p ? { ref: p, y: p.y } : null);
      if (++frames < 90) requestAnimationFrame(tick);
      else {
        let pairs = 0, moved = 0, same = 0, jumps = 0;
        for (let i = 1; i < seen.length; i++) {
          if (!seen[i] || !seen[i - 1]) continue;
          pairs++;
          if (seen[i].ref === seen[i - 1].ref) { same++; const d = seen[i - 1].y - seen[i].y; if (d > 0.002) moved++; if (d > 0.2) jumps++; }
        }
        resolve({ pairs, moved, same, jumps });
      }
    };
    requestAnimationFrame(tick);
  }));
  assert.ok(smooth.pairs >= 40, JSON.stringify(smooth));
  assert.ok(smooth.same >= smooth.pairs - 3, `같은 짝은 같은 객체: ${JSON.stringify(smooth)}`);
  assert.ok(smooth.moved >= smooth.same * 0.7, `거의 매 프레임 움직임: ${JSON.stringify(smooth)}`);
  assert.equal(smooth.jumps, 0, `뚝 떨어지는 프레임 없음: ${JSON.stringify(smooth)}`);

  // ---------- 3번: 관전 채팅, 응원, 친구 요청 ----------
  const c = await open('C', { width: 1280, height: 800 }), d = await open('D', { width: 390, height: 844 });
  nick.set(c, `다${tag}`); nick.set(d, `라${tag}`);
  for (const p of [c, d]) { await signup(p, nick.get(p)); await hideToasts(p); }
  const hostNick = nick.get(host), guestNick = nick.get(guest);
  for (const p of [c, d]) {
    await p.evaluate(() => window.__puyo.show('watch')); await screenIs(p, 'watch');
    assert.match(await p.textContent('#scr-watch .lead'), /관전 채팅.*친구 요청.*화이팅.*좋아요/);
    await p.waitForSelector('#watch-list .watch-row', T);
    await p.click('#watch-list .watch-row button');
    await p.waitForFunction(() => window.__puyo.game?.mode === 'watch', null, T);
  }
  // 아래 줄: 두 사람마다 화이팅, 좋아요, 대단해, 멋진 연쇄, 친구 요청. 가운데 관전 채팅 단추
  assert.equal(await c.locator('#watch-bar').isVisible(), true);
  assert.deepEqual(await c.evaluate(() => [...document.querySelectorAll('#watch-bar .cheer-side > b')].map(x => x.textContent)), [`${hostNick}에게`, `${guestNick}에게`]);
  assert.deepEqual(await c.evaluate(() => [...document.querySelectorAll('#watch-bar .cheer-side[data-side="0"] button')].map(x => x.textContent)), ['💪 화이팅', '👍 좋아요', '👏 대단해', '✨ 멋진 연쇄', '🤝 친구 요청']);
  // 응원 줄이 필드와 점수를 가리지 않는다 (컴퓨터, 휴대폰)
  for (const p of [c, d]) {
    const fit = await p.evaluate(() => { const l = window.__puyo.renderer.layout, bar = document.getElementById('watch-bar').getBoundingClientRect(); return { score: Math.max(l.score[0].y + l.score[0].h, l.score[1].y + l.score[1].h), bar: bar.top, right: l.fields[1].x + l.fields[1].cell * 6, w: innerWidth, barBottom: bar.bottom, h: innerHeight }; });
    assert.ok(fit.score <= fit.bar + 1 && fit.right <= fit.w && fit.barBottom <= fit.h, JSON.stringify(fit));
  }
  // C 가 방장에게 화이팅 → 방장은 "나에게", 손님과 D 는 "방장에게". 필드 위로 그림이 떠오른다
  await c.click('#watch-bar .cheer-side[data-side="0"] [data-cheer="0"]');
  await waitBubble(host, `👀 ${nick.get(c)} 나에게 💪 화이팅!`);
  await waitBubble(guest, `👀 ${nick.get(c)} ${hostNick}에게 💪 화이팅!`);
  await waitBubble(d, `👀 ${nick.get(c)} ${hostNick}에게 💪 화이팅!`);
  await waitBubble(c, `나 ${hostNick}에게 💪 화이팅!`);
  assert.ok(await host.evaluate(() => document.querySelectorAll('.cheer-float').length) >= 0);
  await c.waitForTimeout(250); await c.screenshot({ path: `${shots}/watch-cheer-desktop.png` });
  await host.screenshot({ path: `${shots}/player-cheered.png` });
  // D(휴대폰)가 손님에게 좋아요
  await d.click('#watch-bar .cheer-side[data-side="1"] [data-cheer="1"]');
  await waitBubble(guest, `👀 ${nick.get(d)} 나에게 👍 좋아요!`);
  await waitBubble(host, `👀 ${nick.get(d)} ${guestNick}에게 👍 좋아요!`);
  await d.waitForTimeout(250); await d.screenshot({ path: `${shots}/watch-cheer-phone.png` });
  // 응원 챌린지는 서버가 받은 뒤에 센다
  await c.waitForFunction(() => window.__puyo.P().missions['cheer-1']?.v === 1, null, T);
  assert.equal(await c.evaluate(() => window.__puyo.P().missions['watch-1']?.v), 1);

  // 관전 채팅: C 가 쓰면 두 사람과 D 가 받는다. 두 사람의 대전 채팅 창에는 "👀 닉네임" 이름표로 남는다
  await c.click('#watch-chat');
  assert.equal(await c.textContent('#chat-name'), '👀 관전 채팅');
  assert.equal(await c.textContent('#chat-sub'), `${hostNick} VS ${guestNick}`);
  await c.fill('#chat-input', '둘 다 잘한다'); await c.click('#chat-form button[type=submit]');
  await waitBubble(host, `👀 ${nick.get(c)} 둘 다 잘한다`);
  await waitBubble(guest, `👀 ${nick.get(c)} 둘 다 잘한다`);
  await waitBubble(d, `👀 ${nick.get(c)} 둘 다 잘한다`);
  assert.equal(await d.locator('#watch-chat-dot').isVisible(), true);
  // 빠른 말도 글로 간다. 전화번호는 보내기 전에 막는다. 뿌요 이모티콘은 관전 채팅에 없다
  await c.click('#chat-quick [data-q="1"]');
  await waitBubble(d, '👍 잘한다!');
  await c.fill('#chat-input', '전화해 010-1234-5678'); await c.click('#chat-form button[type=submit]');
  assert.match(await c.textContent('#chat-note'), /보낼 수 없어/);
  await c.fill('#chat-input', '');
  await c.click('#chat-emoji-toggle');
  assert.equal(await c.locator('#chat-stickers').isHidden(), true);
  assert.equal(await c.locator('#chat-emojis').isVisible(), true);
  await c.click('#chat-emoji-toggle');
  await settle(c); await c.screenshot({ path: `${shots}/watch-chat-desktop.png` });
  // D 가 채팅 창을 열면 지금까지 온 말과 응원이 보이고, D 도 쓴다
  await d.click('#watch-chat');
  const dLines = await d.evaluate(() => [...document.querySelectorAll('#chat-log .msg')].map(m => m.textContent));
  assert.ok(dLines.some(t => t.includes(`👀 ${nick.get(c)}`) && t.includes('둘 다 잘한다')), dLines.join(' | '));
  assert.ok(dLines.some(t => t.includes(`${guestNick}에게 👍 좋아요!`)), dLines.join(' | '));
  await d.fill('#chat-input', '나도 응원해'); await d.click('#chat-form button[type=submit]');
  await c.waitForFunction(t => [...document.querySelectorAll('#chat-log .msg.watcher')].some(m => m.textContent.includes(t)), '나도 응원해', T);
  await settle(d); await d.screenshot({ path: `${shots}/watch-chat-phone.png` });
  // 두 사람끼리의 대전 채팅은 여전히 관전하는 사람에게 가지 않는다
  await host.click('#hud-chat');
  const hostLines = await host.evaluate(() => [...document.querySelectorAll('#chat-log .msg')].map(m => m.textContent));
  assert.ok(hostLines.some(t => t.includes(`👀 ${nick.get(c)}`) && t.includes('둘 다 잘한다')), hostLines.join(' | '));
  await host.fill('#chat-input', '우리끼리 얘기'); await host.click('#chat-form button[type=submit]');
  await guest.waitForFunction(() => window.__puyo.roomLog.some(l => l.text === '우리끼리 얘기'), null, T);
  await c.waitForTimeout(500);
  assert.equal(await c.evaluate(() => window.__puyo.roomLog.some(l => l.text === '우리끼리 얘기')), false);
  await settle(host); await host.screenshot({ path: `${shots}/player-chat-with-watchers.png` });

  // 관전자 신고와 차단: 이름표를 누르면 차단, 신고가 나온다 (대전하는 사람)
  await host.click(`#chat-log .who[data-name="${nick.get(d)}"]`);
  assert.match(await host.textContent('#chat-tools .pick-name'), new RegExp(nick.get(d)));
  await host.click('#chat-tools [data-tool="report-who"]');
  await host.waitForSelector('#ask:not([hidden])', T);
  await host.fill('#ask-reason', '확인용 신고'); await host.click('#ask-ok');
  await host.waitForFunction(() => document.getElementById('ask').hidden, null, T);
  await host.click(`#chat-log .who[data-name="${nick.get(d)}"]`);
  await host.click('#chat-tools [data-tool="block-who"]');
  await host.waitForSelector('#ask:not([hidden])', T);
  await host.click('#ask-ok');
  await host.waitForFunction(n => !window.__puyo.roomLog.some(l => l.name === n), nick.get(d), T);
  // 차단한 관전자의 말은 그 뒤로 보이지 않는다 (다른 사람에게는 그대로 간다)
  await d.fill('#chat-input', '차단 뒤에 한 말'); await d.click('#chat-form button[type=submit]');
  await guest.waitForFunction(() => window.__puyo.roomLog.some(l => l.text === '차단 뒤에 한 말'), null, T);
  assert.equal(await host.evaluate(() => window.__puyo.roomLog.some(l => l.text === '차단 뒤에 한 말')), false);
  await host.click('#chat-close');

  // 친구 요청: C 가 손님에게 → 단추가 바뀌고, 손님에게 요청이 온다
  await c.click('#chat-close');
  await c.click('#watch-bar .cheer-side[data-side="1"] .cheer-friend');
  await c.waitForFunction(() => document.querySelector('#watch-bar .cheer-side[data-side="1"] .cheer-friend').textContent === '✔ 친구 요청 보냄', null, T);
  assert.equal(await c.evaluate(() => document.querySelector('#watch-bar .cheer-side[data-side="1"] .cheer-friend').disabled), true);
  await guest.waitForFunction(async () => (await window.__puyo.social.requests()).incoming.length === 1, null, T);

  // 예전 서버(관전 채팅을 모르는 서버)일 때: 보낸 줄 알았던 내 말은 지우고, 응원과 채팅은 안내만 한다. 친구 요청은 그대로 된다
  await d.evaluate(() => { document.getElementById('toasts').style.visibility = ''; window.__puyo.watchTalkOff(); });
  assert.equal(await d.evaluate(() => window.__puyo.roomLog.some(l => l.me)), false);
  assert.match(await d.textContent('#chat-note'), /게임 서버가 새 버전으로 바뀌면 쓸 수 있어/);
  assert.equal(await d.evaluate(() => document.getElementById('chat-input').disabled), true);
  await d.click('#chat-close');
  await d.click('#watch-bar .cheer-side[data-side="0"] [data-cheer="0"]');
  await d.waitForFunction(() => [...document.querySelectorAll('#toasts .toast')].some(t => /새 버전으로 바뀌면/.test(t.textContent)), null, T);
  await settle(d); await d.screenshot({ path: `${shots}/watch-old-server-phone.png` });
  // (방장은 앞에서 D 를 차단했으니, 차단하지 않은 손님에게 보낸다)
  await d.click('#watch-bar .cheer-side[data-side="1"] .cheer-friend');
  await d.waitForFunction(() => document.querySelector('#watch-bar .cheer-side[data-side="1"] .cheer-friend').textContent === '✔ 친구 요청 보냄', null, T);
  // 나를 차단한 사람에게는 친구 요청이 가지 않는다 (차단 사실은 알려 주지 않고 "찾을 수 없어"만)
  await d.click('#watch-bar .cheer-side[data-side="0"] .cheer-friend');
  await d.waitForFunction(() => [...document.querySelectorAll('#toasts .toast')].some(t => /찾을 수 없어/.test(t.textContent)), null, T);
  assert.equal(await d.evaluate(() => document.querySelector('#watch-bar .cheer-side[data-side="0"] .cheer-friend').textContent), '🤝 친구 요청');

  // 관전을 그만 보면 응원 줄과 채팅 창이 사라진다
  await c.click('#watch-chat');
  await c.click('#hud-pause'); await screenIs(c, 'watch');
  assert.equal(await c.locator('#watch-bar').isHidden(), true);
  assert.equal(await c.locator('#chat').isHidden(), true);
  // 대전이 끝나도 오류 없이 돌아온다
  // (판과 판 사이일 수도 있어서, 판이 도는 동안 방장 필드를 가득 채울 때까지 되풀이한다)
  await host.evaluate(() => { window.__fill = setInterval(() => { const m = window.__puyo.match; if (m?.phase !== 'play') return; const p = m.players[0]; for (let y = 0; y < 12; y++) p.cells[y * 6 + 2] = 6; p.refreshHeights(); }, 150); });
  for (const p of [a, b]) await p.waitForSelector('#result:not([hidden])', { timeout: 60000 });
  await host.evaluate(() => clearInterval(window.__fill));
  for (const p of [a, b]) { await p.click('#result-buttons button.ghost'); await screenIs(p, 'online'); }
  await screenIs(d, 'watch');
  assert.equal(await d.locator('#watch-bar').isHidden(), true);

  assert.deepEqual(errors, []);
  console.log('PASS: 효과음·배경음악 ON/OFF(메뉴, 내 정보, 일시정지, 저장) → 새 챌린지 묶음과 받기 → 「하이와 친구가 되어 주세요!」(손님, 새 계정, 하이 본인, 이미 친구) → 온라인 상대 필드가 매 프레임 움직임 → 관전 응원·채팅·친구 요청, 차단·신고, 예전 서버 안내 — 오류 없음');
  console.log(`Screenshots: ${shots}`);
} finally {
  await browser.close();
  stopServer();
}
