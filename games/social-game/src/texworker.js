// Texture pixels on another CPU core (see tex.js). Message {id, name, params} → {id, size, col, nor, rough}.
import { texPixels } from './texgen.js';

self.onmessage = (e) => {
  const { id, name, params } = e.data;
  const d = texPixels(name, params);
  self.postMessage({ id, ...d }, [d.col.buffer, d.nor.buffer, d.rough.buffer]);
};
