import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { appBrandPlugin } from './brand.mjs';

// mode 'app': 아이폰·안드로이드 앱에 넣는 빌드 (apps/jelly-tower/scripts/build-web.mjs). 이름과 화면 글의 "뿌요"를 "젤리"로 바꾼다.
// 앱 이름으로 미리 보려면: npm run puyo-puyo:dev -- --mode app
export default defineConfig(({ mode }) => ({
  root: fileURLToPath(new URL('.', import.meta.url)), base: './',
  plugins: mode === 'app' ? [appBrandPlugin()] : [],
  // AI 가 생각하는 워커(ai-worker.js)는 따로 묶여서 플러그인도 따로 넣어야 한다
  worker: { plugins: () => (mode === 'app' ? [appBrandPlugin()] : []) },
  build: { outDir: '../../public/play/puyo-puyo', emptyOutDir: true, chunkSizeWarningLimit: 2500 },
  server: { port: 5190, strictPort: false },
}));
