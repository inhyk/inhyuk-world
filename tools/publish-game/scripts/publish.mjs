#!/usr/bin/env node
// 게임 폴더 하나를 GitHub에 올리고 Vercel에 배포합니다.
// 사용법: node publish.mjs <게임폴더> [--skip-build]
import { existsSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import path from "node:path";
import {
  loadConfig, readJson, writeJson, validateGameJson,
  run, tryRun, git, tryGit, ensureGhAccount, ensureGitIdentity, log, step, fail,
} from "./lib.mjs";
import { detect } from "./detect.mjs";

const IGNORE_LINES = ["node_modules/", ".vercel/", ".DS_Store", ".omx/", "*.log"];

function ensureGitignore(dir, info) {
  const p = path.join(dir, ".gitignore");
  const cur = existsSync(p) ? readFileSync(p, "utf8") : "";
  const want = [...IGNORE_LINES];
  // 빌드 결과물은 Vercel이 다시 만들므로 커밋하지 않습니다.
  if (info.outDir && info.outDir !== ".") want.push(`${info.outDir}/`);
  const missing = want.filter((l) => !cur.split("\n").includes(l));
  if (missing.length) {
    appendFileSync(p, (cur && !cur.endsWith("\n") ? "\n" : "") + missing.join("\n") + "\n");
    log(`.gitignore 갱신 (+${missing.length}줄)`);
  }
}

// <이름>.vercel.app 은 전 세계가 나눠 쓰는 주소라서,
// 접속이 된다고 우리 게임이라는 뜻이 아닙니다. (남이 먼저 쓰고 있으면 남의 게임이 뜹니다)
// 그래서 "우리 Vercel 계정 것이 맞는지" 까지 확인합니다.
function isOurs(url, cfg) {
  const r = tryRun("vercel", ["inspect", url, "--scope", cfg.vercelScope]);
  return r.ok && !r.out.includes("Can't find the deployment");
}

// 로그인해야 볼 수 있는 주소면 남들은 게임을 못 합니다.
async function isPublic(url) {
  try {
    const r = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15000) });
    return r.ok && !r.url.includes("vercel.com/login");
  } catch {
    return false;
  }
}

async function main() {
  const dir = path.resolve(process.argv[2] || ".");
  const skipBuild = process.argv.includes("--skip-build");
  const cfg = loadConfig();

  if (!existsSync(dir)) fail(`폴더를 못 찾겠어요: ${dir}`);

  const gamePath = path.join(dir, "game.json");
  const game = readJson(gamePath);
  if (!game) fail("game.json 이 없어요. 먼저 만들어 주세요. (/publish-game 이 물어봐 줍니다)");
  validateGameJson(game);

  const slug = game.slug;
  ensureGhAccount(cfg);

  step(`${game.title} (${slug}) 발행 시작`);
  const info = detect(dir);
  log(`프로젝트 유형: ${info.type}`);
  if (info.warning) log(`⚠ ${info.warning}`);
  if (info.type === "unknown") fail(info.warning);

  // 1. 빌드 (배포 전에 깨지는지 먼저 확인)
  if (!skipBuild && info.needsInstall && existsSync(path.join(dir, "package.json"))) {
    if (!existsSync(path.join(dir, "node_modules"))) {
      step("필요한 것 설치 중 (npm install)");
      run("npm", ["install", "--no-audit", "--no-fund"], { cwd: dir });
    }
    if (info.buildCmd) {
      step("빌드 중");
      const b = tryRun("npm", ["run", info.buildCmd], { cwd: dir });
      if (!b.ok) fail(`빌드가 실패했어요.\n${b.out.slice(-2000)}`);
      log("빌드 성공");
    }
  }

  // 2. GitHub
  step("GitHub에 올리는 중");
  if (!existsSync(path.join(dir, ".git"))) {
    git(["init", "-b", "main"], dir);
    log("git 저장소 새로 만듦");
  }
  ensureGitIdentity(dir, cfg);
  ensureGitignore(dir, info);
  git(["add", "-A"], dir);
  const dirty = tryGit(["diff", "--cached", "--quiet"], dir);
  if (!dirty.ok) {
    git(["commit", "-m", `chore: ${game.title} 발행`], dir);
    log("커밋 완료");
  } else {
    log("바뀐 게 없어서 커밋 건너뜀");
  }

  const repo = game.repo || `${cfg.ghUser}/${slug}`;
  const exists = tryRun("gh", ["repo", "view", repo, "--json", "name"]);
  if (!exists.ok) {
    step(`GitHub 저장소 만드는 중: ${repo}`);
    run("gh", ["repo", "create", repo, `--${cfg.gameRepoVisibility}`,
      "--source", dir, "--remote", "origin", "--push"], { cwd: dir });
  } else {
    const hasRemote = tryGit(["remote", "get-url", "origin"], dir);
    if (!hasRemote.ok) {
      git(["remote", "add", "origin", `https://github.com/${repo}.git`], dir);
    }
    const branch = git(["rev-parse", "--abbrev-ref", "HEAD"], dir);
    const push = tryRun("git", ["push", "-u", "origin", branch], { cwd: dir });
    if (!push.ok) fail(`GitHub에 올리지 못했어요.\n${push.out.slice(-1500)}`);
  }
  log(`https://github.com/${repo}`);

  // 3. Vercel
  step("Vercel에 배포하는 중 (조금 걸려요)");
  if (!existsSync(path.join(dir, ".vercel", "project.json"))) {
    const link = tryRun("vercel", ["link", "--yes", "--project", slug, "--scope", cfg.vercelScope], { cwd: dir });
    if (!link.ok) fail(`Vercel 프로젝트 연결 실패\n${link.out.slice(-1500)}`);
  }
  const dep = tryRun("vercel", ["--prod", "--yes", "--scope", cfg.vercelScope], { cwd: dir });
  if (!dep.ok) fail(`배포가 실패했어요.\n${dep.out.slice(-2000)}`);
  const deployUrl = (dep.out.match(/https:\/\/[a-z0-9.-]+\.vercel\.app/gi) || []).pop();

  // 예쁜 주소(<slug>.vercel.app)를 쓰되, 그게 진짜 우리 것이고 누구나 볼 수 있을 때만 씁니다.
  const pretty = `https://${slug}.vercel.app`;
  let playUrl = null;
  if (isOurs(pretty, cfg) && (await isPublic(pretty))) {
    playUrl = pretty;
  } else if (deployUrl && (await isPublic(deployUrl))) {
    log(`⚠ ${slug}.vercel.app 은 다른 사람이 쓰고 있어서 배포 주소를 씁니다`);
    playUrl = deployUrl;
  }
  if (!playUrl) {
    fail(
      `쓸 수 있는 주소를 못 찾았어요.\n` +
      `  · ${slug}.vercel.app 을 남이 먼저 쓰고 있거나\n` +
      `  · 배포 주소가 Vercel 로그인으로 막혀 있어요.\n` +
      `game.json 의 slug 를 "inh-${slug}" 처럼 겹치지 않는 이름으로 바꾸고 다시 해보세요.`
    );
  }
  log(`플레이 주소: ${playUrl}`);

  // 4. game.json 갱신
  game.playUrl = playUrl;
  game.githubUrl = `https://github.com/${repo}`;
  game.repo = repo;
  writeJson(gamePath, game);

  console.log(JSON.stringify({ slug, playUrl, githubUrl: game.githubUrl, dir }, null, 2));
}

main().catch((e) => fail(e.stack || String(e)));
