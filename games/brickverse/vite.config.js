import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

// 핸드폰 seonn.dev 앱: 사이트 게임 목록(src/data/games.json)에서 이름, 그림, 주소만 넣는다
const GAMES_JSON = fileURLToPath(new URL('../../src/data/games.json', import.meta.url));
const seonnGames = {
  name: 'seonn-games',
  resolveId(id) { return id === 'virtual:seonn-games' ? '\0seonn-games' : null; },
  load(id) {
    if (id !== '\0seonn-games') return null;
    this.addWatchFile(GAMES_JSON);
    const list = JSON.parse(readFileSync(GAMES_JSON, 'utf8'))
      .filter(g => g.slug !== 'brickverse' && typeof g.playUrl === 'string' && g.playUrl)
      .map(g => ({ s: g.slug, t: g.title, e: g.emoji, u: g.playUrl }));
    return `export default ${JSON.stringify(list)};`;
  },
};
// 브릭버스: games/brickverse → public/play/brickverse (base './', /play/brickverse 에서 iframe 으로 연다)
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  plugins: [seonnGames],
  build: { outDir: '../../public/play/brickverse', emptyOutDir: true, chunkSizeWarningLimit: 2500 },
  server: { host: '127.0.0.1' },
});
