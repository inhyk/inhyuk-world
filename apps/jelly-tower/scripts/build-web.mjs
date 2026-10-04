// 게임(games/puyo-puyo)을 앱에 넣을 수 있게 빌드해서 apps/jelly-tower/www에 담는다.
// 웹사이트용 빌드(public/play/puyo-puyo)와 같은 코드이고, 나가는 폴더만 다르다.
import { build } from 'vite';
import { fileURLToPath } from 'node:url';

const app = fileURLToPath(new URL('..', import.meta.url));
const repo = fileURLToPath(new URL('../../..', import.meta.url));
await build({
  configFile: `${repo}games/puyo-puyo/vite.config.js`,
  build: { outDir: `${app}www`, emptyOutDir: true },
  logLevel: 'warn',
});
console.log(`www 준비 완료 → ${app}www`);
