import { B,I } from './data.mjs';
import { idx } from './core.mjs';
import { END_TREASURES } from './expedition-world.mjs';
export function populateEnd(G) {
 if(G.adventure?.dimension!=='end'||G.adventure.endLoot)return;
 for(const {x,y} of END_TREASURES)if(G.w.tiles[idx(x,y)]===B.CHEST&&!G.chests.has(idx(x,y)))G.chests.set(idx(x,y),[{id:I.DIAMOND,count:3},{id:I.GOLDEN_APPLE,count:2},{id:I.ARROW,count:32},...Array(24).fill(null)]);
 G.adventure.endLoot=true;
}
