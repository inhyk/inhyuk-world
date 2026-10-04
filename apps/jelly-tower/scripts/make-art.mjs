// 앱 아이콘(1024, PNG)과 시작 화면(2732, JPEG) 그림을 게임의 젤리 그림 코드로 그려서 assets/에 저장한다.
// 쓰는 법: 게임 개발 서버를 켜고(npm run puyo-puyo:dev) → PUYO_URL=http://127.0.0.1:5190/ node scripts/make-art.mjs
// 그다음 scripts/install-art.sh 가 아이폰 프로젝트(Assets.xcassets)에 넣는다.
import { chromium } from '../../../tools/node_modules/playwright/index.mjs';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const base = process.env.PUYO_URL || 'http://127.0.0.1:5190/';
const out = fileURLToPath(new URL('../assets/', import.meta.url));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  await page.goto(`${base}?test`);
  await page.waitForFunction(() => window.__puyo);
  await page.evaluate(() => document.fonts.load('200px Jua', '젤리 타워'));
  const art = await page.evaluate(async () => {
    const skins = await import('/skins.mjs');
    const chars = await import('/characters.mjs');
    const TAU = Math.PI * 2;
    function sky(ctx, S) {
      const g = ctx.createLinearGradient(0, 0, S * 0.4, S);
      g.addColorStop(0, '#ffb3d6'); g.addColorStop(0.5, '#b9a6ff'); g.addColorStop(1, '#8fd8ff');
      ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    }
    function sparkles(ctx, k, list) {
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      for (const [x, y, r] of list) { ctx.beginPath(); ctx.arc(x * k, y * k, r * k, 0, TAU); ctx.fill(); }
    }
    function jelly(ctx, x, y, r, c) {
      ctx.save(); ctx.translate(x, y);
      skins.drawSkinLayer(ctx, 'classic', c, r, 'body', 0); skins.drawSkinLayer(ctx, 'classic', c, r, 'face', 0);
      ctx.restore();
    }
    // 젤리 세 개를 쌓은 탑과 왕관. (cx, cy)는 탑 가운데, k는 크기 배율 (1 = 1024 아이콘)
    function tower(ctx, cx, cy, k) {
      ctx.fillStyle = 'rgba(80,40,140,.18)'; ctx.beginPath(); ctx.ellipse(cx, cy + 393 * k, 330 * k, 46 * k, 0, 0, TAU); ctx.fill();
      jelly(ctx, cx - 152 * k, cy + 223 * k, 165 * k, 1); jelly(ctx, cx + 152 * k, cy + 223 * k, 165 * k, 3);
      jelly(ctx, cx, cy - 32 * k, 165 * k, 2);
      chars.drawGarbageIcon(ctx, 'crown', cx, cy - 264 * k, 190 * k, 0);
    }
    const canvas = S => { const cv = document.createElement('canvas'); cv.width = cv.height = S; return cv; };
    const icon = canvas(1024), ic = icon.getContext('2d');
    sky(ic, 1024);
    sparkles(ic, 1, [[150, 170, 10], [860, 210, 14], [800, 120, 6], [120, 820, 8], [900, 860, 9], [210, 300, 5]]);
    tower(ic, 512, 512, 1);
    const splash = canvas(2732), sc = splash.getContext('2d');
    sky(sc, 2732);
    sparkles(sc, 2732 / 1024, [[420, 330, 6], [610, 260, 4], [400, 700, 4], [640, 760, 5], [470, 520, 3]]);
    tower(sc, 1366, 1180, 1.15);
    sc.font = '210px Jua'; sc.textAlign = 'center'; sc.textBaseline = 'middle'; sc.lineJoin = 'round';
    sc.lineWidth = 34; sc.strokeStyle = '#6b43c9'; sc.strokeText('젤리 타워', 1366, 1800);
    sc.fillStyle = '#fff'; sc.fillText('젤리 타워', 1366, 1800);
    // 시작 화면은 크기가 커서 JPEG로 (저장소를 가볍게)
    return { 'icon.png': icon.toDataURL('image/png'), 'splash.jpg': splash.toDataURL('image/jpeg', 0.9) };
  });
  for (const [name, url] of Object.entries(art)) await writeFile(`${out}${name}`, Buffer.from(url.split(',')[1], 'base64'));
  console.log(`그림 저장: ${out}icon.png, ${out}splash.jpg`);
} finally { await browser.close(); }
