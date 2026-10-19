// Keep the static game's shared account client identical to the canonical package.
import { copyFile, mkdir } from 'node:fs/promises';
const destination = new URL('../../public/play/pixelcraft/net-client/', import.meta.url);
await mkdir(destination, { recursive: true });
for (const name of ['index.mjs', 'social.mjs']) await copyFile(new URL(`../../packages/net/${name}`, import.meta.url), new URL(name, destination));
