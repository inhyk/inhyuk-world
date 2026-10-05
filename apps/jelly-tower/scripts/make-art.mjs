// 앱 아이콘(1024, PNG)과 시작 화면(2732, JPEG) 그림을 게임의 젤리 그림 코드로 그려서 assets/에 저장한다.
// 안드로이드용으로 아이콘을 두 겹(뒤 하늘 + 앞 젤리 탑)으로 나눈 그림과 동그란 아이콘,
// 구글 플레이 대표 그림(1024×500, store/feature-graphic.jpg)도 같이 그린다.
// 쓰는 법: 게임 개발 서버를 켜고(npm run puyo-puyo:dev) → PUYO_URL=http://127.0.0.1:5190/ node scripts/make-art.mjs
// 그다음 scripts/install-art.sh 가 아이폰·안드로이드 프로젝트에 넣는다.
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
    const canvas = (S, H = S) => { const cv = document.createElement('canvas'); cv.width = S; cv.height = H; return cv; };
    const icon = canvas(1024), ic = icon.getContext('2d');
    sky(ic, 1024);
    sparkles(ic, 1, [[150, 170, 10], [860, 210, 14], [800, 120, 6], [120, 820, 8], [900, 860, 9], [210, 300, 5]]); // 아래 iconSparkles와 같음
    tower(ic, 512, 512, 1);
    const splash = canvas(2732), sc = splash.getContext('2d');
    sky(sc, 2732);
    sparkles(sc, 2732 / 1024, [[420, 330, 6], [610, 260, 4], [400, 700, 4], [640, 760, 5], [470, 520, 3]]);
    tower(sc, 1366, 1180, 1.15);
    sc.font = '210px Jua'; sc.textAlign = 'center'; sc.textBaseline = 'middle'; sc.lineJoin = 'round';
    sc.lineWidth = 34; sc.strokeStyle = '#6b43c9'; sc.strokeText('젤리 타워', 1366, 1800);
    sc.fillStyle = '#fff'; sc.fillText('젤리 타워', 1366, 1800);
    // 안드로이드 적응형 아이콘: 기기마다 동그라미·둥근 네모로 잘라 내므로 앞 그림(탑)은 가운데 66%(안전 구역) 안에 둔다
    const iconSparkles = [[150, 170, 10], [860, 210, 14], [800, 120, 6], [120, 820, 8], [900, 860, 9], [210, 300, 5]];
    const back = canvas(1024), bc = back.getContext('2d');
    sky(bc, 1024); sparkles(bc, 1, iconSparkles);
    const front = canvas(1024), fc = front.getContext('2d');
    tower(fc, 512, 512 - 40 * 0.6, 0.6);
    const round = canvas(1024), rc = round.getContext('2d');
    rc.beginPath(); rc.arc(512, 512, 512, 0, TAU); rc.clip(); rc.drawImage(icon, 0, 0);
    // 구글 플레이 대표 그림 (1024×500): 왼쪽에 탑, 오른쪽에 이름
    const feature = canvas(1024, 500), gc = feature.getContext('2d');
    const fg = gc.createLinearGradient(0, 0, 1024, 500);
    fg.addColorStop(0, '#ffb3d6'); fg.addColorStop(0.5, '#b9a6ff'); fg.addColorStop(1, '#8fd8ff');
    gc.fillStyle = fg; gc.fillRect(0, 0, 1024, 500);
    sparkles(gc, 1, [[90, 70, 6], [470, 60, 8], [960, 80, 7], [560, 440, 5], [980, 430, 9], [60, 430, 5]]);
    tower(gc, 270, 238, 0.5);
    gc.textAlign = 'center'; gc.textBaseline = 'middle'; gc.lineJoin = 'round';
    gc.font = '120px Jua'; gc.lineWidth = 22; gc.strokeStyle = '#6b43c9'; gc.strokeText('젤리 타워', 700, 210);
    gc.fillStyle = '#fff'; gc.fillText('젤리 타워', 700, 210);
    gc.font = '44px Jua'; gc.lineWidth = 12; gc.strokeText('같은 색 4개를 이어 퐁!', 700, 330);
    gc.fillText('같은 색 4개를 이어 퐁!', 700, 330);
    // 시작 화면·대표 그림은 JPEG로 (저장소를 가볍게, 플레이 대표 그림은 투명 부분이 있으면 안 됨)
    return {
      'icon.png': icon.toDataURL('image/png'), 'splash.jpg': splash.toDataURL('image/jpeg', 0.9),
      'icon-background.png': back.toDataURL('image/png'), 'icon-foreground.png': front.toDataURL('image/png'),
      'icon-round.png': round.toDataURL('image/png'), '../store/feature-graphic.jpg': feature.toDataURL('image/jpeg', 0.92),
    };
  });
  for (const [name, url] of Object.entries(art)) await writeFile(`${out}${name}`, Buffer.from(url.split(',')[1], 'base64'));
  console.log(`그림 저장: ${Object.keys(art).map(n => out + n).join(', ')}`);
} finally { await browser.close(); }
