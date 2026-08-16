#!/usr/bin/env node
// 1회성: 이미 Vercel에 배포돼 있지만 seonn.dev에는 안 올라온 게임들을 등록합니다.
// 사용법: node tools/backfill.mjs [--dry]
import { existsSync } from "node:fs";
import path from "node:path";
import {
  loadConfig, readJson, writeJson, run, tryRun, git, tryGit,
  ensureGhAccount, log, step, fail,
} from "./publish-game/scripts/lib.mjs";

const DRY = process.argv.includes("--dry");

// 이미 배포돼 있어서 재배포 없이 카드만 추가하면 되는 게임들
const ALREADY_DEPLOYED = [
  {
    slug: "minecraft",
    title: "Minecraft 2D",
    description: "블록을 캐고 쌓는 2D 마인크래프트",
    longDescription:
      "마인크래프트를 2D로 옮긴 샌드박스 게임입니다. 블록을 캐서 모으고, 원하는 곳에 다시 쌓아 나만의 세계를 만들 수 있습니다. Node 서버를 붙여 여러 명이 같은 세계에 들어와 함께 노는 멀티플레이도 넣었습니다.",
    emoji: "⛏️",
    techStack: ["JavaScript", "Canvas", "Node.js", "WebSocket"],
    category: "샌드박스",
    playUrl: "https://minecraft-2d.vercel.app",
    githubUrl: "https://github.com/inhyk/minecraft",
    createdAt: "2026-02",
  },
  {
    slug: "diep-io",
    title: "diep.io",
    description: "탱크를 키워 살아남는 실시간 슈팅 게임",
    longDescription:
      "diep.io 스타일의 아레나 슈팅 게임입니다. 도형을 부숴 경험치를 모으고, 레벨이 오르면 탱크를 원하는 방향으로 강화합니다. 라이브러리 없이 Canvas만으로 직접 만들었습니다.",
    emoji: "🔺",
    techStack: ["JavaScript", "Canvas"],
    category: "슈팅",
    playUrl: "https://diep-io-indol.vercel.app",
    githubUrl: "https://github.com/inhyk/diep.io",
    createdAt: "2026-04",
  },
  {
    slug: "bean-dash-arena",
    title: "Bean Dash Arena",
    description: "장애물을 뚫고 결승선까지 달리는 파티 게임",
    longDescription:
      "Fall Guys 감성의 장애물 코스 게임입니다. 코스를 다시 만들 때마다 다른 프리셋이 나오고, 랭킹 모드에서는 최고 기록이 저장됩니다. 라이브러리 없이 Canvas로 직접 만들었습니다.",
    emoji: "🫘",
    techStack: ["JavaScript", "Canvas", "HTML", "CSS"],
    category: "액션",
    playUrl: "https://bean-dash-arena.vercel.app",
    githubUrl: "https://github.com/inhyk/bean-dash-arena",
    createdAt: "2026-03",
  },
  {
    slug: "sans-boss-fight",
    title: "Sans Boss Fight",
    description: "언더테일 산스와의 탄막 보스전",
    longDescription:
      "언더테일의 산스 보스전을 직접 만들어 본 탄막 회피 게임입니다. 쏟아지는 뼈 공격과 가스터 블래스터를 피하면서 하트를 조종해 살아남아야 합니다. 패턴을 외우고 타이밍을 잡는 것이 관건입니다.",
    emoji: "💀",
    techStack: ["JavaScript", "Canvas", "Node.js"],
    category: "액션",
    playUrl: "https://sans-boss-fight.vercel.app",
    githubUrl: "https://github.com/inhyk/sans-boss-fight",
    createdAt: "2026-04",
  },
];

async function urlOk(url) {
  try {
    const r = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15000) });
    return r.ok;
  } catch {
    return false;
  }
}

async function main() {
  const cfg = loadConfig();
  ensureGhAccount(cfg);

  const dataFile = path.join(cfg.hubPath, "src", "data", "games.json");
  if (!existsSync(dataFile)) fail(`허브를 못 찾겠어요: ${dataFile}`);
  const games = readJson(dataFile, []);

  step("배포 주소 확인");
  for (const g of ALREADY_DEPLOYED) {
    const ok = await urlOk(g.playUrl);
    log(`${ok ? "✓" : "✗"} ${g.title} — ${g.playUrl}`);
    if (!ok) fail(`${g.title} 주소가 죽어 있어요. 확인이 필요합니다.`);
  }

  step("허브에 등록");
  let maxOrder = Math.max(0, ...games.map((g) => g.order || 0));
  for (const g of ALREADY_DEPLOYED) {
    const entry = {
      ...g,
      thumbnail: "",
      screenshots: [],
      featured: false,
      order: 0,
    };
    const i = games.findIndex((x) => x.slug === g.slug);
    if (i >= 0) {
      entry.order = games[i].order;
      entry.thumbnail = games[i].thumbnail;
      entry.screenshots = games[i].screenshots;
      entry.featured = games[i].featured;
      games[i] = entry;
      log(`갱신: ${g.title}`);
    } else {
      entry.order = ++maxOrder;
      games.push(entry);
      log(`추가: ${g.title}`);
    }
  }
  games.sort((a, b) => a.order - b.order);

  if (DRY) {
    console.log(JSON.stringify(games, null, 2));
    log("--dry 라서 저장하지 않았어요");
    return;
  }
  writeJson(dataFile, games);

  step("사이트에 올리기");
  git(["add", "-A"], cfg.hubPath);
  if (tryGit(["diff", "--cached", "--quiet"], cfg.hubPath).ok) {
    log("바뀐 게 없어요");
  } else {
    git(["commit", "-m", "feat: 기존 게임 4종 포트폴리오 등록"], cfg.hubPath);
    const push = tryRun("git", ["push"], { cwd: cfg.hubPath });
    if (!push.ok) fail(`올리기 실패\n${push.out.slice(-1500)}`);
    log("완료 — Vercel이 곧 사이트를 새로 만듭니다");
  }
  console.log(JSON.stringify({ total: games.length, slugs: games.map((g) => g.slug) }, null, 2));
}

main().catch((e) => fail(e.stack || String(e)));
