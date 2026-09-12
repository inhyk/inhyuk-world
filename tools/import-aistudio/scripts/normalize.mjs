#!/usr/bin/env node
// AI Studio에서 받은 소스 폴더를 빌드 가능한 Vite 프로젝트로 바꿉니다.
//
// AI Studio가 Drive에 저장하는 zip에는 소스만 들어 있고
// package.json / vite.config.ts / tsconfig.json 이 없습니다.
// 대신 index.html의 importmap에 의존성과 버전이 적혀 있어서, 그걸 읽어 스캐폴딩을 만듭니다.
//
// 사용법: node normalize.mjs <소스폴더> <대상폴더> [slug]

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  cpSync,
  readdirSync,
} from "node:fs";
import path from "node:path";

// esm.sh / aistudiocdn 형태의 URL에서 패키지명과 버전을 뽑습니다.
// 예) https://esm.sh/react@^19.1.1  ->  { name: "react", version: "^19.1.1" }
//     https://aistudiocdn.com/@google/genai@^1.0.0 -> { name: "@google/genai", ... }
const CDN_RE = /^https?:\/\/[^/]+\/((?:@[^/@]+\/)?[^/@]+)@([^/]+?)\/?$/;

export function parseImportmap(html) {
  const m = html.match(/<script\s+type="importmap"\s*>([\s\S]*?)<\/script>/i);
  if (!m) return { deps: {}, raw: null };

  let map;
  try {
    map = JSON.parse(m[1]);
  } catch {
    return { deps: {}, raw: m[0] };
  }

  const deps = {};
  for (const url of Object.values(map.imports || {})) {
    const hit = String(url).match(CDN_RE);
    if (hit) deps[hit[1]] = hit[2];
  }
  return { deps, raw: m[0] };
}

// 소스에서 실제로 쓰는 import를 훑어 importmap이 놓친 의존성을 채웁니다.
function scanBareImports(dir) {
  const found = new Set();
  const stack = [dir];
  const IMPORT_RE = /(?:from|import)\s+["']([^"'.][^"']*)["']/g;

  while (stack.length) {
    const cur = stack.pop();
    for (const e of readdirSafe(cur)) {
      const p = path.join(cur, e.name);
      if (e.isDirectory()) {
        if (e.name !== "node_modules" && !e.name.startsWith(".")) stack.push(p);
      } else if (/\.(tsx?|jsx?)$/.test(e.name)) {
        const src = readFileSync(p, "utf8");
        for (const m of src.matchAll(IMPORT_RE)) {
          const spec = m[1];
          const name = spec.startsWith("@")
            ? spec.split("/").slice(0, 2).join("/")
            : spec.split("/")[0];
          found.add(name);
        }
      }
    }
  }
  return found;
}

function readdirSafe(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

const KNOWN_VERSIONS = {
  react: "^19.1.1",
  "react-dom": "^19.1.1",
  three: "^0.170.0",
  "@react-three/fiber": "^9.0.0",
  "@react-three/drei": "^10.0.0",
  "@google/genai": "^1.0.0",
  zustand: "^5.0.0",
  "framer-motion": "^11.0.0",
};

export function normalize(srcDir, outDir, slug) {
  if (!existsSync(srcDir)) throw new Error(`소스 폴더가 없습니다: ${srcDir}`);

  mkdirSync(outDir, { recursive: true });
  cpSync(srcDir, outDir, { recursive: true });

  const htmlPath = path.join(outDir, "index.html");
  if (!existsSync(htmlPath)) throw new Error(`index.html이 없습니다: ${srcDir}`);

  let html = readFileSync(htmlPath, "utf8");
  const { deps, raw } = parseImportmap(html);

  // importmap을 지우고 의존성을 번들에 포함시킵니다.
  // 외부 CDN(esm.sh 등)이 죽으면 게임도 같이 죽기 때문입니다.
  if (raw) html = html.replace(raw, "").replace(/\n{3,}/g, "\n\n");

  // 소스가 쓰는데 importmap에 없던 패키지를 채웁니다.
  for (const name of scanBareImports(outDir)) {
    if (!deps[name] && KNOWN_VERSIONS[name]) deps[name] = KNOWN_VERSIONS[name];
  }
  if (!deps.react) deps.react = KNOWN_VERSIONS.react;
  if (!deps["react-dom"]) deps["react-dom"] = KNOWN_VERSIONS["react-dom"];

  writeFileSync(htmlPath, html);

  const meta = existsSync(path.join(outDir, "metadata.json"))
    ? JSON.parse(readFileSync(path.join(outDir, "metadata.json"), "utf8"))
    : {};

  const usesGenai = Object.keys(deps).some((d) => d.includes("genai"));

  writeFileSync(
    path.join(outDir, "package.json"),
    JSON.stringify(
      {
        name: slug,
        private: true,
        version: "0.0.0",
        type: "module",
        scripts: { dev: "vite", build: "vite build", preview: "vite preview" },
        dependencies: Object.fromEntries(Object.entries(deps).sort()),
        devDependencies: {
          "@types/node": "^22.14.0",
          "@types/react": "^19.1.0",
          "@types/react-dom": "^19.1.0",
          typescript: "~5.8.2",
          vite: "^6.2.0",
        },
      },
      null,
      2
    ) + "\n"
  );

  // base: "./" 가 핵심입니다.
  // seonn.dev/play/<slug>/ 같은 하위 경로에 올리려면 자산 경로가 상대경로여야 합니다.
  writeFileSync(
    path.join(outDir, "vite.config.ts"),
    `import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: './',
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY ?? ''),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY ?? ''),
    },
    resolve: {
      alias: { '@': path.resolve(__dirname, '.') },
    },
  };
});
`
  );

  writeFileSync(
    path.join(outDir, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          useDefineForClassFields: true,
          lib: ["ES2022", "DOM", "DOM.Iterable"],
          module: "ESNext",
          skipLibCheck: true,
          moduleResolution: "bundler",
          allowImportingTsExtensions: true,
          resolveJsonModule: true,
          isolatedModules: true,
          noEmit: true,
          jsx: "react-jsx",
          strict: false,
          paths: { "@/*": ["./*"] },
        },
        include: ["**/*.ts", "**/*.tsx"],
        exclude: ["node_modules", "dist"],
      },
      null,
      2
    ) + "\n"
  );

  return {
    slug,
    title: meta.name || slug,
    description: meta.description || "",
    deps,
    usesGenai,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [src, out, slug] = process.argv.slice(2);
  if (!src || !out) {
    console.error("사용법: node normalize.mjs <소스폴더> <대상폴더> [slug]");
    process.exit(1);
  }
  const result = normalize(
    path.resolve(src),
    path.resolve(out),
    slug || path.basename(out)
  );
  console.log(JSON.stringify(result, null, 2));
}
