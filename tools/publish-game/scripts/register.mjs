#!/usr/bin/env node
// 게임을 seonn.dev 허브(inhyuk-world)에 등록합니다.
// 사용법: node register.mjs <게임폴더> [--no-shot] [--no-push]
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import {
  loadConfig, readJson, writeJson, validateGameJson,
  tryRun, git, tryGit, ensureGhAccount, log, step, fail,
} from "./lib.mjs";

const HERE = path.dirname(new URL(import.meta.url).pathname);

// 허브는 이 도구가 들어있는 레포 자신이라 내려받을 필요가 없습니다.
// 최신화만 시도하고, 실패해도 뒤의 push 가 큰 소리로 막아주니 그냥 진행합니다.
function ensureHub(cfg) {
  const pull = tryGit(["pull", "--ff-only"], cfg.hubPath);
  if (!pull.ok) log("⚠ 사이트 최신화 실패 — 그대로 진행합니다 (올릴 때 다시 걸리면 알려줄게요)");
  const dataFile = path.join(cfg.hubPath, "src", "data", "games.json");
  if (!existsSync(dataFile)) {
    fail("src/data/games.json 이 없어요. 사이트 소스가 깨진 것 같아요.");
  }
  return dataFile;
}

async function main() {
  const dir = path.resolve(process.argv[2] || ".");
  const noShot = process.argv.includes("--no-shot");
  const noPush = process.argv.includes("--no-push");
  const cfg = loadConfig();

  const gamePath = path.join(dir, "game.json");
  const game = readJson(gamePath);
  if (!game) fail("game.json 이 없어요.");
  validateGameJson(game);
  if (!game.playUrl) fail("playUrl 이 없어요. publish.mjs 를 먼저 돌려주세요.");

  ensureGhAccount(cfg);
  const dataFile = ensureHub(cfg);
  const imgDir = path.join(cfg.hubPath, "public", "images", "games");
  mkdirSync(imgDir, { recursive: true });

  // 1. 화면 사진
  let shots = { thumbnail: game.thumbnail || "", screenshots: game.screenshots || [] };
  if (!noShot) {
    const r = tryRun("node", [
      path.join(HERE, "screenshot.mjs"),
      "--url", game.playUrl,
      "--slug", game.slug,
      "--out", imgDir,
      "--manual", path.join(dir, "screenshots"),
      "--count", String(cfg.screenshotCount),
    ]);
    const line = r.out.split("\n").filter((l) => l.trim().startsWith("{")).pop();
    if (line) {
      const parsed = JSON.parse(line);
      if (parsed.screenshots?.length) shots = parsed;
      else log(`⚠ 화면 사진은 못 찍었어요 (${parsed.reason || parsed.mode}) — 이모지로 표시됩니다`);
    }
  }

  // 2. games.json 갱신 (있으면 수정, 없으면 추가)
  const games = readJson(dataFile, []);
  const entry = {
    slug: game.slug,
    title: game.title,
    description: game.description,
    longDescription: game.longDescription || game.description,
    emoji: game.emoji,
    thumbnail: shots.thumbnail || "",
    screenshots: shots.screenshots || [],
    techStack: game.techStack || [],
    category: game.category,
    playUrl: game.playUrl,
    githubUrl: game.githubUrl || "",
    createdAt: game.createdAt || new Date().toISOString().slice(0, 7),
    featured: game.featured ?? false,
    order: 0,
  };

  // --no-shot 으로 다시 돌려도 사진이 사라지지 않게 game.json에도 적어 둡니다.
  if (shots.screenshots?.length) {
    game.thumbnail = shots.thumbnail;
    game.screenshots = shots.screenshots;
    writeJson(gamePath, game);
  }

  const i = games.findIndex((g) => g.slug === game.slug);
  const nextOrder = Math.max(0, ...games.map((g) => g.order || 0)) + 1;
  if (i >= 0) {
    // order 는 마지막 발행 순번입니다. 다시 올린 게임도 목록 맨 위로 보냅니다.
    entry.order = nextOrder;
    games[i] = entry;
    log(`기존 항목 갱신: ${game.title}`);
  } else {
    entry.order = nextOrder;
    games.push(entry);
    log(`새 항목 추가: ${game.title}`);
  }
  games.sort((a, b) => b.order - a.order);
  writeJson(dataFile, games);

  // 3. 허브에 올리기
  if (noPush) {
    log("--no-push 라서 여기까지만 합니다");
    console.log(JSON.stringify({ slug: game.slug, registered: true, pushed: false }, null, 2));
    return;
  }

  step("사이트에 반영하는 중");
  // 게임 데이터와 사진만 담습니다. 도구(tools/)나 사이트 코드를 고치던 중이어도
  // 그게 "게임 등록" 커밋에 딸려 들어가지 않게 합니다.
  git(["add", "--", "src/data/games.json", "public/images/games"], cfg.hubPath);
  const clean = tryGit(["diff", "--cached", "--quiet"], cfg.hubPath);
  if (clean.ok) {
    log("바뀐 게 없어요");
  } else {
    git(["commit", "-m", `feat: ${game.title} 게임 등록`], cfg.hubPath);
    const push = tryRun("git", ["push"], { cwd: cfg.hubPath });
    if (!push.ok) fail(`사이트에 올리지 못했어요.\n${push.out.slice(-1500)}`);
    log("올리기 완료 — Vercel이 1~2분 안에 사이트를 새로 만듭니다");
  }

  console.log(JSON.stringify({
    slug: game.slug,
    pageUrl: `${cfg.siteUrl}/games/${game.slug}`,
    playUrl: game.playUrl,
    registered: true,
    pushed: true,
  }, null, 2));
}

main().catch((e) => fail(e.stack || String(e)));
