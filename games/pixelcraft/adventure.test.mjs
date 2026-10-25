import test from 'node:test';
import assert from 'node:assert/strict';
import { W, H, generateWorld, idx, rleEncode } from '../../public/play/pixelcraft/core.mjs';
import { B, BLOCKS } from '../../public/play/pixelcraft/data.mjs';
import { bossPhase, makeVillage, makeNether, makeEnd, portalFrame, findPortal, portalIntact, restoreTerrain, terrainSave, remapIndex } from '../../public/play/pixelcraft/adventure-world.mjs';

test('이전 640칸 저장은 모든 행의 블록·메타·상자 위치를 보존한다', () => {
 const w = generateWorld(1234), legacy = new Uint8Array(640 * H), meta = new Uint8Array(640 * H);
 for (let y = 0; y < H; y++) for (let x = 0; x < 640; x++) { legacy[y * 640 + x] = (x+y)%59; meta[y*640+x] = x%9; }
 const right = w.tiles[idx(900, 99)];
 restoreTerrain(w, { tiles: rleEncode(legacy), meta: rleEncode(meta) });
 for (let y = 0; y < H; y++) for (let x = 0; x < 640; x++) { assert.equal(w.tiles[idx(x,y)], legacy[y*640+x]); assert.equal(w.meta[idx(x,y)], meta[y*640+x]); }
 assert.equal(w.tiles[idx(900,99)],right); assert.equal(remapIndex(33*640+21,640),idx(21,33));
});
test('1280칸 지형은 저장 후 배경·높이까지 동일하다', () => {
 const a = makeNether(44), b = generateWorld(44); restoreTerrain(b, terrainSave(a));
 for(const key of ['tiles','meta','bg','surface']) assert.deepEqual(a[key],b[key]);
});
test('마을 주민은 단단한 땅 위에 서며 포탈 프레임이 검출된다', () => {
 const w = generateWorld(1234), villagers = makeVillage(w,705);
 assert.equal(villagers.length,3);
 for(const p of villagers) assert.ok(BLOCKS[w.tiles[idx(Math.floor(p.x),Math.floor(p.y+p.h))]].solid);
 const portal=portalFrame(w,742,w.surface[742]-1); assert.ok(findPortal(w,portal.x,portal.y));
 w.tiles[idx(portal.x-1,portal.y)]=B.DIRT; assert.equal(findPortal(w,portal.x,portal.y),null);
});
test('네더와 엔드는 고유 지형, 용암·발광석 및 떠 있는 섬을 갖는다', () => {
 const n = makeNether(7), e = makeEnd(7);
 assert.ok(n.tiles.includes(B.LAVA)); assert.ok(n.tiles.includes(B.GLOWSTONE)); assert.ok(n.tiles.includes(B.NETHERRACK));
 assert.ok(e.tiles.includes(B.END_STONE)); assert.ok(e.tiles.includes(B.PURPUR)); assert.equal(e.tiles[idx(W/2-100,90)],B.AIR);
 assert.equal(n.seed,7);
});
test('보스의 세 페이즈는 체력 경계에서 정확히 전환된다', () => {
 for (const [hp,phase] of [[540,1],[361,1],[360,2],[181,2],[180,3],[1,3]]) assert.equal(bossPhase(hp),phase);
});

test('네더 차원문 블록은 틀의 내부를 막지 않으며 틀 파손은 계속 감지한다',()=>{
 const w=generateWorld(1234),p={...portalFrame(w,742,w.surface[742]-1),kind:'nether'};
 w.tiles[idx(p.x,p.y+3)]=B.NETHER_PORTAL;
 assert.ok(portalIntact(w,p));assert.ok(findPortal(w,p.x,p.y));
 w.tiles[idx(p.x,p.y+2)]=B.STONE;assert.equal(portalIntact(w,p),false);
 w.tiles[idx(p.x,p.y+2)]=B.AIR;w.tiles[idx(p.x-1,p.y)]=B.AIR;
 assert.equal(portalIntact(w,p),false);
});
