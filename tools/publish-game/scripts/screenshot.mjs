#!/usr/bin/env node
// 배포된 게임 화면을 자동으로 찍습니다.
// 사용법: node screenshot.mjs --url <주소> --slug <slug> --out <폴더> [--manual <게임폴더/screenshots>]
import { existsSync, mkdirSync, readdirSync, copyFileSync } from "node:fs";
import path from "node:path";
import { log, step } from "./lib.mjs";

function arg(name, def = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
}

const url = arg("url");
const slug = arg("slug");
const outDir = arg("out");
const manualDir = arg("manual");
const count = Number(arg("count", "3"));

if (!url || !slug || !outDir) {
  console.error("사용법: screenshot.mjs --url <주소> --slug <slug> --out <폴더>");
  process.exit(2);
}
mkdirSync(outDir, { recursive: true });

// 1) 인혁이가 직접 찍은 사진이 있으면 그걸 우선 사용합니다.
if (manualDir && existsSync(manualDir)) {
  const imgs = readdirSync(manualDir)
    .filter((f) => /\.(png|jpe?g)$/i.test(f))
    .sort();
  if (imgs.length) {
    const saved = [];
    imgs.slice(0, count).forEach((f, i) => {
      const dest = path.join(outDir, `${slug}-${i + 1}.png`);
      copyFileSync(path.join(manualDir, f), dest);
      saved.push(`/images/games/${slug}-${i + 1}.png`);
    });
    copyFileSync(path.join(manualDir, imgs[0]), path.join(outDir, `${slug}-thumb.png`));
    log(`직접 찍은 사진 ${saved.length}장을 사용했어요`);
    console.log(JSON.stringify({ mode: "manual", thumbnail: `/images/games/${slug}-thumb.png`, screenshots: saved }));
    process.exit(0);
  }
}

// 2) 자동 캡처
let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("playwright 가 없어요. ~/inhyuk/inhyuk-world/tools 폴더에서 `npm install` 을 해주세요.");
  console.log(JSON.stringify({ mode: "skipped", reason: "playwright-missing", thumbnail: "", screenshots: [] }));
  process.exit(0);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let browser;
try {
  step(`화면 찍는 중: ${url}`);
  try {
    browser = await chromium.launch({ channel: "chrome" });
  } catch {
    browser = await chromium.launch(); // 번들 크로미움 폴백
  }
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(url, { waitUntil: "load", timeout: 45000 });
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await sleep(2500);

  const screenshots = [];
  const shoot = async (i) => {
    const file = path.join(outDir, `${slug}-${i}.png`);
    await page.screenshot({ path: file });
    screenshots.push(`/images/games/${slug}-${i}.png`);
    log(`${i}/${count} 장 완료`);
  };

  // 1장: 아무것도 건드리지 않은 첫 화면. 보통 이게 가장 깔끔합니다.
  await shoot(1);

  // 진짜 '시작' 버튼처럼 보이는 것만 누릅니다.
  // 아무 데나 클릭하면 메뉴나 팝업이 열려서 게임 화면을 가려버립니다.
  const startBtn = page
    .locator('button, a, [role="button"], .start, #start')
    .filter({ hasText: /^\s*(시작|스타트|게임 ?시작|start|play|start game|new game)\s*$/i })
    .first();
  if (await startBtn.count().catch(() => 0)) {
    await startBtn.click({ timeout: 4000 }).catch(() => {});
  } else {
    await page.keyboard.press("Space").catch(() => {});
  }
  await sleep(3000);

  for (let i = 2; i <= count; i++) {
    // 실수로 열린 팝업이 있으면 닫고 찍습니다.
    await page.keyboard.press("Escape").catch(() => {});
    await sleep(600);
    await shoot(i);
    if (i < count) {
      await page.mouse.move(300 + i * 200, 350 + i * 60).catch(() => {});
      await sleep(2500);
    }
  }
  copyFileSync(path.join(outDir, `${slug}-1.png`), path.join(outDir, `${slug}-thumb.png`));

  console.log(JSON.stringify({
    mode: "auto",
    thumbnail: `/images/games/${slug}-thumb.png`,
    screenshots,
  }));
} catch (e) {
  console.error(`화면 찍기 실패: ${e.message}`);
  console.log(JSON.stringify({ mode: "failed", reason: e.message, thumbnail: "", screenshots: [] }));
} finally {
  await browser?.close().catch(() => {});
}
