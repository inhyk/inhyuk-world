// 그린 체스(정적 게임)가 쓰는 공용 서버 클라이언트를 packages/net 과 똑같이 맞춘다.
import { copyFile, mkdir } from 'node:fs/promises';
const destination = new URL('../../public/play/chess/net-client/', import.meta.url);
await mkdir(destination, { recursive: true });
for (const name of ['index.mjs', 'social.mjs']) await copyFile(new URL(`../../packages/net/${name}`, import.meta.url), new URL(name, destination));
