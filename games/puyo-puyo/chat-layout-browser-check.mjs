// 긴 친구 채팅의 모양: 대화가 길어져 채팅 칸이 넘쳐도 젤리 이모티콘·글·큰 이모지·초대가 서로 겹치지 않는지,
// 맨 아래 메시지가 다 보이는지, 받은 글이 빨간 오류 글씨가 아닌지 (.msg는 로그인 화면 오류 글에도 쓰는 이름이다).
// 인혁이 화면(맥북 크롬)과 휴대폰 크기에서 본다. 이모티콘 판을 열어도 새 메시지가 가려지지 않는지도 본다.
// 만든 친구는 "게임 중"인 척만 하고(그래야 이모티콘 판이 열린다) 아무것도 보내지 않으며, 친구 서버에도 잇지 않는다.
import { chromium } from '../../tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const base = process.env.PUYO_URL || 'http://127.0.0.1:5190/';
const shots = process.env.PUYO_SHOTS || '/tmp/puyo-puyo-chat-layout';
await mkdir(shots, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
const quiet = text => /peerjs|PeerJS|ICE|webrtc|Could not connect to peer|Failed to load resource/i.test(text);
const ERROR_RED = 'rgb(224, 50, 79)';

// 인혁이 스크린샷의 대화 + 긴 글·큰 이모지·받은 젤리 이모티콘·대전 초대. 끝은 "젤리 이모티콘 → 글" (겹치던 곳)
const LINES = [
  { me: true, text: '👋 안녕!' }, { me: true, text: '😮 와!' }, { me: true, text: '👍 잘한다!' },
  { text: '안녕' }, { sticker: 3 }, { text: '오늘 타워 몇 층까지 갔어? 나는 왕관 층 바로 앞에서 방해 젤리 때문에 졌어 ㅠㅠ 다음엔 같이 하자' },
  { me: true, text: '😂🔥' }, { me: true, sticker: 4 }, { text: '🎮 같이 하자! 대전 초대가 왔어', invite: 'HM94HE' },
  { me: true, text: '가아니에요' }, { me: true, text: '아빠 한판 해요' }, { me: true, text: '🙏 봐줘~' },
  { me: true, sticker: 6 }, { me: true, text: '아빠' },
];

try {
  const views = [
    ['desktop', { viewport: { width: 1470, height: 790 } }],
    ['phone', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }],
  ];
  for (const [label, options] of views) {
    const ctx = await browser.newContext(options);
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(`${label}: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error' && !quiet(m.text())) errors.push(`${label}: ${m.text()}`); });
    await page.goto(`${base}?test`); await page.waitForFunction(() => window.__puyo);
    await page.click('#go-signup'); await page.fill('#signup-name', '인혁'); await page.fill('#signup-pass', 'abcd');
    await page.click('#signup-form button[type=submit]'); await page.waitForSelector('#scr-menu:not([hidden])');
    await page.evaluate(() => { document.getElementById('toasts').style.display = 'none'; });
    await page.evaluate(lines => {
      const { friendNet, P, save } = window.__puyo;
      friendNet.start = async () => {}; friendNet.connect = async () => false; friendNet.send = () => false;
      friendNet.isOnline = code => code === 'ABCDEF';
      const s = P().social, t = Date.now() - 600000;
      s.friends.push({ code: 'ABCDEF', name: '은근', level: 7 });
      s.chats.ABCDEF = lines.map((l, i) => ({ me: false, ...l, time: t + i * 1000 }));
      save();
    }, LINES);
    await page.click('[data-go="friends"]'); await page.click('#friend-list [data-chat]');
    await page.waitForFunction(n => document.querySelectorAll('#chat-log .msg').length === n
      && [...document.querySelectorAll('#chat-log img')].every(i => i.complete && i.naturalWidth), LINES.length);

    // 줄마다 실제로 그려진 범위 (글 풍선·이모티콘 그림·들어가기 단추를 다 합친 것)로 맨 아래 메시지가 다 보이는지
    const lastVisible = () => page.evaluate(() => {
      const log = document.getElementById('chat-log'), view = log.getBoundingClientRect();
      const boxes = [...log.querySelector('.msg:last-child').children].map(c => c.getBoundingClientRect());
      return Math.min(...boxes.map(b => b.top)) >= view.top && Math.max(...boxes.map(b => b.bottom)) <= view.bottom + 1;
    });
    const r = await page.evaluate(() => {
      const log = document.getElementById('chat-log');
      const drawn = row => {
        const boxes = [...row.children].map(c => c.getBoundingClientRect());
        return { top: Math.min(...boxes.map(b => b.top)), bottom: Math.max(...boxes.map(b => b.bottom)) };
      };
      const rows = [...log.querySelectorAll('.msg')];
      const overlaps = [];
      for (let i = 1; i < rows.length; i++) {
        const a = drawn(rows[i - 1]), b = drawn(rows[i]);
        if (b.top < a.bottom + 2) overlaps.push(`${i - 1}→${i}: ${Math.round(a.bottom - b.top)}px`);
      }
      const them = log.querySelector('.msg.them:not(.sticker):not(.big) span');
      return {
        overflowing: log.scrollHeight > log.clientHeight + 40,
        overlaps,
        stickers: [...log.querySelectorAll('.msg.sticker')].map(row => Math.round(row.getBoundingClientRect().height)),
        themColor: getComputedStyle(them).color,
        themAlign: getComputedStyle(rows.find(row => row.querySelector('span')?.textContent.startsWith('오늘'))).textAlign,
      };
    });
    await page.screenshot({ path: `${shots}/${label}-chat.png` });
    assert.equal(r.overflowing, true, `${label}: 대화가 채팅 칸을 넘쳐야 이 검사가 의미 있다`);
    assert.deepEqual(r.overlaps, [], `${label}: 채팅 줄이 겹친다`);
    assert.ok(r.stickers.length === 3 && r.stickers.every(h => h >= 96), `${label}: 젤리 이모티콘 줄 높이 ${r.stickers}`);
    assert.equal(await lastVisible(), true, `${label}: 채팅을 열면 맨 아래 메시지가 다 보여야 한다`);
    // 채팅 칸이 넘쳐도 줄어드는 건 채팅 기록뿐: 빠른 말 줄·입력 줄·단추 줄은 납작해지지 않는다
    const squashed = () => page.evaluate(() => [...document.querySelector('.chat-card').children]
      .filter(el => !el.hidden && !el.matches('.chat-log, .chat-emoji'))
      .filter(el => el.scrollHeight > el.clientHeight + 1 || [...el.children].some(c => c.getBoundingClientRect().bottom > el.getBoundingClientRect().bottom + 1))
      .map(el => el.id || el.className));
    assert.deepEqual(await squashed(), [], `${label}: 채팅 창 아래쪽 줄이 납작해졌다`);
    assert.notEqual(r.themColor, ERROR_RED, `${label}: 받은 글이 오류 글씨처럼 빨갛다`);
    assert.notEqual(r.themAlign, 'center', `${label}: 긴 글이 가운데 정렬이다`);
    // 이모티콘 판을 열면 채팅 칸이 줄어든다 → 그래도 새 메시지가 보여야 한다
    await page.click('#chat-emoji-toggle'); await page.waitForSelector('#chat-stickers img');
    assert.equal(await lastVisible(), true, `${label}: 이모티콘 판을 열어도 맨 아래 메시지가 보여야 한다`);
    assert.deepEqual(await squashed(), [], `${label}: 이모티콘 판을 열었더니 아래쪽 줄이 납작해졌다`);
    await page.screenshot({ path: `${shots}/${label}-emoji-open.png` });

    // 검사용 계정을 지운다 (사이트에서 돌려도 우체통에 흔적이 남지 않게) → 로그인 화면
    await page.click('#chat-close');
    await page.evaluate(() => window.__puyo.show('profile'));
    await page.click('#delete-account'); await page.click('#delete-yes');
    await page.waitForSelector('#scr-login:not([hidden])');

    // 로그인 화면 오류 글(.msg)은 그대로: 빨간 글씨, 가운데, 한 줄 전체 폭
    await page.click('#go-import'); await page.fill('#import-code', '이건 기록 코드가 아니야'); await page.click('#import-form button[type=submit]');
    await page.waitForFunction(() => document.getElementById('login-msg').textContent.trim());
    const msg = await page.evaluate(() => {
      const el = document.getElementById('login-msg'), c = getComputedStyle(el), p = getComputedStyle(el.parentElement);
      const inner = el.parentElement.clientWidth - parseFloat(p.paddingLeft) - parseFloat(p.paddingRight);
      return { color: c.color, align: c.textAlign, display: c.display, fullWidth: Math.abs(el.getBoundingClientRect().width - inner) < 2 };
    });
    assert.deepEqual(msg, { color: ERROR_RED, align: 'center', display: 'block', fullWidth: true }, `${label}: 로그인 오류 글 모양`);
    await ctx.close();
  }
  assert.deepEqual(errors, []);
  console.log('PASS: 긴 친구 채팅(컴퓨터·휴대폰) — 젤리 이모티콘·글·큰 이모지·초대가 안 겹침, 이모티콘 96px, 열 때와 이모티콘 판을 열어도 맨 아래까지 보임, 받은 글은 보통 글씨 · 로그인 오류 글은 그대로 — 오류 없음');
  console.log(`Screenshots: ${shots}`);
} finally { await browser.close(); }
