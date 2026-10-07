// 게임(games/puyo-puyo)을 앱에 넣을 수 있게 빌드해서 apps/jelly-tower/www에 담는다.
// 웹사이트용 빌드(public/play/puyo-puyo)와 같은 코드이고, 나가는 폴더와 이름만 다르다:
// 사이트는 「뿌요뿌요 타워」, 앱은 「젤리 타워」(mode 'app' 이면 화면 글의 "뿌요"를 "젤리"로 바꾼다. games/puyo-puyo/brand.mjs).
// 빌드가 끝나면 www 를 전부 훑어서 "뿌요"가 하나라도 남아 있으면 실패한다 (앱 심사에서 다른 회사 게임 이름은 거절된다).
import { build } from 'vite';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { hasWebBrand } from '../../../games/puyo-puyo/brand.mjs';

const app = fileURLToPath(new URL('..', import.meta.url));
const repo = fileURLToPath(new URL('../../..', import.meta.url));
await build({
  configFile: `${repo}games/puyo-puyo/vite.config.js`,
  mode: 'app',
  build: { outDir: `${app}www`, emptyOutDir: true },
  logLevel: 'warn',
});

const left = [];
for (const entry of await readdir(`${app}www`, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile() || !/\.(m?js|css|html|json|txt|webmanifest)$/.test(entry.name)) continue;
  const file = `${entry.parentPath}/${entry.name}`;
  if (hasWebBrand(await readFile(file, 'utf8'))) left.push(file.slice(`${app}www/`.length));
}
if (left.length) {
  console.error(`앱 빌드에 "뿌요"가 남아 있어요: ${left.join(', ')}\n(games/puyo-puyo/brand.mjs 와 vite.config.js 의 mode 'app' 을 확인해 주세요)`);
  process.exit(1);
}
console.log(`www 준비 완료 → ${app}www (이름: 젤리 타워)`);
