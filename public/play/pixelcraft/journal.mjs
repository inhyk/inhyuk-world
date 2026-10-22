import { B,I } from './data.mjs';
import { countItem } from './core.mjs';
import { END_TREASURES } from './expedition-world.mjs';
export const BOOK_IDS=[I.OVERWORLD_BOOK,I.NETHER_BOOK,I.END_BOOK];
export function bookForDimension(kind){return kind==='nether'?I.NETHER_BOOK:kind==='end'?I.END_BOOK:I.OVERWORLD_BOOK;}
export function journalTasks(G,id){
 const a=G.adventure,has=ids=>countItem(G.player.inv,ids)>0,visited=k=>a.dimension===k||a.visited?.includes(k);
 if(id===I.NETHER_BOOK)return [
 ['nether-enter','붉은 포탈 안으로 걸어 들어가 네더 탐험하기',visited('nether')],
 ['nether-stone','곡괭이로 네더랙을 캐서 가져오기',has([B.NETHERRACK])],
 ['nether-gold','금 방어구를 입고 피글린 만나기 · 금괴 4개로 엔더의 눈 교환',G.player.armor?.some(s=>s&&s.id>=I.GOLD_HELMET&&s.id<=I.GOLD_BOOTS)],
 ['nether-fortress','도착 지점 동쪽의 검은 요새 찾아가기',a.dimension==='nether'&&Math.abs(G.player.x-676)<18],
 ['nether-blaze','블레이즈를 잡고 블레이즈 막대 얻기',has([I.BLAZE_ROD])],
 ['nether-eye','엔더의 눈 준비하기 · 다이아몬드와 블레이즈 막대로도 제작 가능',has([I.ENDER_EYE])],
 ['nether-home','가방을 챙겨 귀환 포탈로 오버월드에 돌아오기',a.dimension==='overworld'&&visited('nether')]];
 if(id===I.END_BOOK)return [
 ['end-enter','초록 엔드 틀에 엔더의 눈을 사용하거나 열린 포탈로 들어가기',visited('end')],
 ['end-stone','떠 있는 섬에서 엔드 돌 캐 보기 · 공허로 떨어지지 않도록 조심',has([B.END_STONE])],
 ...END_TREASURES.map((p,i)=>[`end-tower-${i}`,`${i===2?'서쪽':'동쪽'} ${i===1?'먼 바깥 섬':'탐험 섬'}의 탑과 보물 상자 찾기`,a.dimension==='end'&&Math.hypot(G.player.x-p.x,G.player.y-p.y)<10]),
 ['end-home','보물을 챙겨 중앙 포탈로 돌아오기',a.dimension==='overworld'&&visited('end')]];
 return [
 ['wood','나무를 캐고 판자·막대기 만들기',has([B.OAK_LOG,B.BIRCH_LOG,B.SPRUCE_LOG,B.PLANKS,I.STICK])],
 ['craft','판자 4개로 제작대를 만들고 땅에 놓기',G.placedTable||a.achievements?.includes('craft')],
 ['iron','돌 도구로 철을 찾고 화로에서 철괴 굽기',has([I.IRON_INGOT,I.IRON_PICK,I.IRON_SWORD])],
 ['sleep','집과 침대를 준비하고 밤에 침대 옆 R로 자기',a.slept],
 ['sea','서쪽 바다 해변과 작은 물웅덩이 탐험하기',a.dimension==='overworld'&&G.player.x>=95&&G.player.x<=235],
 ['moon','시작 지점 서쪽 우주선 옆에서 R · 달에서 네모난 지구 보기',visited('moon')],
 ['nether','네더 책을 읽고 네더로 떠나기',visited('nether')],
 ['end','엔드 책을 읽고 엔드 섬 탐험하기',visited('end')],
 ['boss','50일째 소환사 좀비를 이기고 황금 포탈 열기',a.bossDefeated],
 ['day100','100일째 아주 강한 스켈레톤 소환사에게 도전하기',a.skeletonDefeated],
 ['school','황금 포탈 안으로 들어가 학교 세계로 돌아가기',visited('school')]];
}
export function updateJournal(G){
 const a=G.adventure;if(!a||G.jump)return;
 a.journal??=[];
 for(const book of BOOK_IDS)for(const [id,,done]of journalTasks(G,book))if(done&&!a.journal.includes(id))a.journal.push(id);
}
export function bookPages(G,id){
 updateJournal(G);const tasks=journalTasks(G,id),done=tasks.filter(([key])=>G.adventure.journal.includes(key)).length;
 return [`모험 기록 ${done} / ${tasks.length} · 달성한 일은 저장 후에도 남아.`,...tasks.map(([key,text])=>`${G.adventure.journal.includes(key)?'◆ 완료':'◇ 할 일'} · ${text}`)];
}
