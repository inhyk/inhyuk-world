// 게임 발행 도구 공용 헬퍼
import { execFileSync, execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

// 도구가 사는 곳 (inhyuk-world/tools)
export const TOOL_ROOT = path.resolve(HERE, "../..");
// 허브 사이트 = 이 도구를 품고 있는 레포 자신 (inhyuk-world)
export const HUB_ROOT = path.resolve(HERE, "../../..");

export function expand(p) {
  return p.startsWith("~") ? path.join(homedir(), p.slice(1)) : p;
}

export function loadConfig() {
  const cfg = JSON.parse(readFileSync(path.join(TOOL_ROOT, "config.json"), "utf8"));
  // 허브는 더 이상 남의 레포가 아니라 우리 자신이라 clone/pull 할 필요가 없습니다.
  cfg.hubPath = HUB_ROOT;
  cfg.gamesRoot = expand(cfg.gamesRoot);
  return cfg;
}

export function log(msg) {
  process.stderr.write(`  ${msg}\n`);
}

export function step(msg) {
  process.stderr.write(`\n▶ ${msg}\n`);
}

export function fail(msg) {
  process.stderr.write(`\n✗ ${msg}\n`);
  process.exit(1);
}

// 셸을 거치지 않고 실행 (공백/한글 경로 안전)
export function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, {
    encoding: "utf8",
    stdio: opts.quiet ? ["ignore", "pipe", "pipe"] : ["ignore", "pipe", "inherit"],
    cwd: opts.cwd,
    env: { ...process.env, ...opts.env },
    maxBuffer: 64 * 1024 * 1024,
  }).trim();
}

export function tryRun(cmd, args, opts = {}) {
  try {
    return { ok: true, out: run(cmd, args, { ...opts, quiet: true }) };
  } catch (e) {
    return { ok: false, out: ((e.stdout || "") + (e.stderr || "")).trim() };
  }
}

export function git(args, cwd) {
  return run("git", args, { cwd, quiet: true });
}

export function tryGit(args, cwd) {
  return tryRun("git", args, { cwd });
}

// gh를 항상 지정된 계정으로 실행 (이 맥에는 계정이 두 개 있음)
export function gh(args, cfg, opts = {}) {
  return run("gh", args, {
    ...opts,
    env: { GH_HOST: "github.com", ...opts.env },
  });
}

export function ensureGhAccount(cfg) {
  const st = tryRun("gh", ["auth", "status"]);
  if (!st.ok) fail("gh 로그인이 안 돼 있어요. 터미널에서 `gh auth login` 을 먼저 해주세요.");
  if (!st.out.includes(`account ${cfg.ghUser}`)) {
    fail(`GitHub에 ${cfg.ghUser} 계정이 로그인돼 있지 않아요. \`gh auth login\` 으로 추가해주세요.`);
  }
  const active = st.out.match(/account (\S+) \([^)]*\)\n\s*- Active account: true/);
  if (!active || active[1] !== cfg.ghUser) {
    log(`gh 계정을 ${cfg.ghUser} 로 전환합니다`);
    run("gh", ["auth", "switch", "--user", cfg.ghUser], { quiet: true });
  }
}

// 이 맥에는 git 계정이 아빠(kubony)로 잡혀 있습니다.
// 인혁이 저장소에는 커밋 이름을 인혁이 것으로 따로 박아 둡니다.
export function ensureGitIdentity(dir, cfg) {
  const cur = tryRun("git", ["config", "--local", "user.email"], { cwd: dir });
  if (cur.ok && cur.out) return;
  const id = tryRun("gh", ["api", "user", "-q", ".id"]);
  const email = id.ok
    ? `${id.out}+${cfg.ghUser}@users.noreply.github.com`
    : `${cfg.ghUser}@users.noreply.github.com`;
  run("git", ["config", "--local", "user.name", cfg.ghUser], { cwd: dir, quiet: true });
  run("git", ["config", "--local", "user.email", email], { cwd: dir, quiet: true });
  log(`커밋 이름을 ${cfg.ghUser} 로 설정`);
}

export function readJson(p, fallback = null) {
  if (!existsSync(p)) return fallback;
  return JSON.parse(readFileSync(p, "utf8"));
}

export function writeJson(p, data) {
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
}

export function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export const GAME_JSON_FIELDS = [
  "slug",
  "title",
  "description",
  "longDescription",
  "emoji",
  "techStack",
  "category",
  "createdAt",
  "featured",
  "playUrl",
  "githubUrl",
  "repo",
];

export function validateGameJson(g) {
  const missing = ["slug", "title", "description", "emoji", "category"].filter(
    (k) => !g[k]
  );
  if (missing.length) {
    fail(`game.json 에 다음 항목이 없어요: ${missing.join(", ")}`);
  }
  if (!/^[a-z0-9-]+$/.test(g.slug)) {
    fail(`slug 는 영어 소문자·숫자·하이픈만 쓸 수 있어요 (지금: ${g.slug})`);
  }
  return g;
}
