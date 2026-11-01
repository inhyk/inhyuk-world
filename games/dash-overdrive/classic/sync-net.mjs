// Keep the static game's copy of the shared room client identical to packages/net.
import { copyFile, mkdir } from 'node:fs/promises';
const destination = new URL('../../../public/play/dash-overdrive/classic/net-client/', import.meta.url);
await mkdir(destination, { recursive: true });
for (const name of ['index.mjs', 'social.mjs']) await copyFile(new URL(`../../../packages/net/${name}`, import.meta.url), new URL(name, destination));
