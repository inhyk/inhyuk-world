// SANS 보스전만 바로 띄워 보는 가벼운 테스트 서버. public/ 을 그대로 내보내고 캐시를 끈다.
// 실행: node games/sans/dev-server.mjs [포트=3030]  →  http://127.0.0.1:3030/play/sans/
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public');
const port = Number(process.argv[2]) || 3030;
const types = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.png': 'image/png', '.json': 'application/json' };

http.createServer((request, response) => {
  let pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  if (pathname === '/') pathname = '/play/sans/';
  // 끝에 / 없이 폴더를 열면 / 를 붙여 다시 보낸다 (상대 경로가 어긋나지 않게)
  if (!pathname.endsWith('/') && fs.existsSync(path.resolve(root, '.' + pathname, 'index.html'))) { response.writeHead(302, { location: pathname + '/' }); response.end(); return; }
  if (pathname.endsWith('/')) pathname += 'index.html';
  const filename = path.resolve(root, '.' + pathname);
  if (!filename.startsWith(root + path.sep) || !fs.existsSync(filename) || !fs.statSync(filename).isFile()) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('아직 없는 파일: ' + pathname);
    return;
  }
  response.writeHead(200, { 'content-type': types[path.extname(filename)] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(filename).pipe(response);
}).listen(port, '127.0.0.1', () => console.log(`SANS 테스트 서버: http://127.0.0.1:${port}/play/sans/`));
