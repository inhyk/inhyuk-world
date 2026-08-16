#!/usr/bin/env node
// 게임 폴더의 프로젝트 유형을 알아냅니다.
// 사용법: node detect.mjs <게임폴더>
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { readJson } from "./lib.mjs";

export function detect(dir) {
  const pkg = readJson(path.join(dir, "package.json"));
  const has = (f) => existsSync(path.join(dir, f));

  if (has("next.config.ts") || has("next.config.js") || has("next.config.mjs")) {
    return { type: "next", buildCmd: "build", outDir: ".next", needsInstall: true };
  }

  if (pkg) {
    const build = pkg.scripts?.build || "";
    const start = pkg.scripts?.start || "";

    if (/vite build/.test(build)) {
      return { type: "vite", buildCmd: "build", outDir: "dist", needsInstall: true };
    }
    if (/^node .*server/.test(start) || has("server.js") || has("server.mjs")) {
      return {
        type: "node-server",
        buildCmd: build ? "build" : null,
        outDir: null,
        needsInstall: true,
        warning:
          "이 게임은 Node 서버가 필요한 유형이에요. Vercel 기본 정적 배포로는 멀티플레이 기능이 동작하지 않을 수 있어요.",
      };
    }
    if (build) {
      return { type: "npm-build", buildCmd: "build", outDir: "dist", needsInstall: true };
    }
  }

  if (has("index.html")) {
    return { type: "static", buildCmd: null, outDir: ".", needsInstall: false };
  }

  const sub = readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("."))
    .map((d) => d.name);
  return {
    type: "unknown",
    buildCmd: null,
    outDir: null,
    needsInstall: false,
    subdirs: sub,
    warning: "index.html 도 package.json 도 없어서 어떻게 배포할지 모르겠어요.",
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = path.resolve(process.argv[2] || ".");
  console.log(JSON.stringify({ dir, ...detect(dir) }, null, 2));
}
