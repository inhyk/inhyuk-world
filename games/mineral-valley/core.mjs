// 가격이 등급을 정한다. 비쌀수록 더 무겁고, 더 크고, 더 드물다.
export const ORES = [
  ['갈색','흔함','흙빛 돌','#996044',-100,3,39.998383],
  ['초록','일반','녹빛 원석','#64e9a0',100,6,26],
  ['파랑','고급','푸른 원석','#469dff',1000,18,16],
  ['보라','에픽','자수정 원석','#b373f5',5000,48,8],
  ['빨강','전설','홍옥 원석','#ff5368',100000,125,3],
  ['주황','신화','태양 원석','#ffad45',500000,320,1.5],
  ['하늘','초월','하늘 원석','#7cecff',1000000,850,.8],
  ['연보라','불멸','별빛 원석','#dfbdff',100000000,2200,.07],
  ['회색','천상','달빛 원석','#becad3',500000000,5700,.02],
  ['검정','절대','공허 원석','#292734',1000000000,14500,.009],
  ['분홍','유니크','장미 수정','#ff91c7',25000,80,4],
  ['금빛','찬란','황금 결정','#ffe06a',2500000,1200,.4],
  ['흰색','성운','백야 수정','#f5f8ff',10000000,1600,.2],
  ['무지개','태초','오로라 결정','#a4ffe8',5000000000,32000,.001],
  ['심해','심연','심연의 결정','#2a6bff',40000000000,42000,.0008],
  ['벽옥','태고','태고의 눈','#37f0bb',300000000000,56000,.0004],
  ['진홍','창세','창세의 핵','#ff3d6e',2500000000000,76000,.0002],
  ['은하','우주','은하수 성단','#9d7bff',20000000000000,104000,.0001],
  ['서광','영원','영원의 서광','#fff4c4',200000000000000,145000,.00005],
  ['잿빛불','종말','종말의 불씨','#ff7a3d',2000000000000000,200000,.00003],
  ['물빛','기원','기원의 샘','#5ff2ff',20000000000000000,280000,.00002],
  ['백금','무한','무한의 고리','#ffeeb0',200000000000000000,400000,.00001],
  ['흑요','초월공허','공허 너머','#5b4b8a',2000000000000000000,560000,.000005],
  ['새벽빛','창조','창조의 알','#ffd9f2',20000000000000000000,800000,.000002],
].map(([colorName,rank,name,color,price,weight,chance],id)=>({id,colorName,rank,name,color,price,weight,chance}));
export const MAX_STRENGTH=44;
export const MAX_SPEED=10;
// 운반 칸은 Lv.1(1개)에서 시작해 아홉 번 강화하면 Lv.10(10개)가 된다.
export const MAX_CARGO=9;
export const MAX_CAPACITY=1+MAX_CARGO;
export const capacity=s=>1+Math.min(MAX_CARGO,Math.max(0,s.cargo|0));
export const weightTotal=items=>Math.round(items.reduce((n,o)=>n+o.weight,0)*10)/10;
export const rankIndex=id=>ORES.filter(o=>o.price<ORES[id].price).length;
export const money=n=>`${BigInt(n).toLocaleString('ko-KR')}원`;
export const balance=s=>BigInt(s.money);
function setBalance(s,value){s.money=value<=BigInt(Number.MAX_SAFE_INTEGER)&&value>=BigInt(Number.MIN_SAFE_INTEGER)?Number(value):value.toString();}
export const GIFT_CODE='1357013570';
export const GIFT_AMOUNT=100000000000000000000000000000000n;
export function redeem(s,code){if(code.trim()!==GIFT_CODE)return false;setBalance(s,balance(s)+GIFT_AMOUNT);return true;}
export const initial=()=>({playSeconds:0,money:0,strength:0,speed:0,cargo:0,sold:0,earned:0,found:Array(ORES.length).fill(0)});
export const power=s=>Math.floor(12*1.4**s.strength);
export const speed=s=>22+s.speed*4;
export const LIMITS={strength:MAX_STRENGTH,speed:MAX_SPEED,cargo:MAX_CARGO};
const COSTS={strength:s=>Math.round(100*2.1**s.strength),speed:s=>Math.round(100*2**s.speed),cargo:s=>Math.round(4000*3.4**s.cargo)};
export const cost=(s,key)=>Object.hasOwn(COSTS,key)?COSTS[key](s):0;
// 캠프에서 1,000m 밖으로 나가야 고급 광물이 제대로 나온다. 멀어질수록 최대 18배까지 잘 나온다.
export const RARE_DISTANCE=1000;
export const RARE_MAX_BOOST=18;
export const rareBoost=(distance=RARE_DISTANCE)=>distance<RARE_DISTANCE?.25:Math.min(RARE_MAX_BOOST,1+(distance-RARE_DISTANCE)/900);
export const fieldChance=(id,distance=RARE_DISTANCE)=>ORES[id].chance*(rankIndex(id)<3?1:rareBoost(distance));
export function pick(random=Math.random,distance=RARE_DISTANCE){
 const table=ORES.map((o,id)=>fieldChance(id,distance));
 let v=random()*table.reduce((a,b)=>a+b,0);
 for(let id=0;id<table.length;id++){v-=table[id];if(v<0)return id;}
 return ORES.length-1;
}
// 0.1% 초대형 광물. 0.4995–0.5005 구간만 쓰므로 고정 난수(0·1)로 최소·최대 무게를 그대로 검사할 수 있다.
export const GIANT_CHANCE=.1;
export const GIANT_WEIGHT=25;
export const GIANT_PRICE=80;
export const isGiantRoll=v=>v>=.5-GIANT_CHANCE/200&&v<.5+GIANT_CHANCE/200;
export function makeOre(id,random=Math.random){
 const o=ORES[id],giant=isGiantRoll(random());
 const weight=Math.round(o.weight*(1+random()*.25)*(giant?GIANT_WEIGHT:1)*10)/10;
 return giant?{id,weight,giant:true}:{id,weight};
}
// 가격은 기본가 × 실제 무게 비율. 초대형은 그 위에 80배 프리미엄이 더 붙는다(손해 광석은 제외).
export function orePrice(o){const def=ORES[o.id],size=o.weight?o.weight/def.weight:1;return Math.round(def.price*size*(o.giant&&def.price>0?GIANT_PRICE:1));}
// 풍선에서 나오는 광물. 흔한 돌은 빼고 뽑으며 무게 제한 없이 그대로 받는다.
export function balloonOre(random=Math.random){
 const table=ORES.map(o=>o.id<3?0:o.chance**.45);
 let v=random()*table.reduce((a,b)=>a+b,0);
 for(let id=0;id<table.length;id++){v-=table[id];if(v<0)return id;}
 return ORES.length-1;
}
export const radius=o=>(.95+Math.log10(1+o.weight)*1.55)*(o.giant?2.2:1);
export const canLift=(s,o,items=[])=>items.length<capacity(s)&&power(s)>=Math.round((weightTotal(items)+o.weight)*10)/10;
export function buy(s,key){if(!Object.hasOwn(LIMITS,key)||s[key]>=LIMITS[key]||balance(s)<BigInt(cost(s,key)))return false;setBalance(s,balance(s)-BigInt(cost(s,key)));s[key]++;return true;}
export function sell(s,o){if(!o)return false;const paid=orePrice(o);setBalance(s,balance(s)+BigInt(paid));s.earned=Math.min(Number.MAX_SAFE_INTEGER,s.earned+Math.max(0,paid));s.sold++;return true;}
// 몬스터 처치·보너스처럼 광물 판매가 아닌 수입.
export function reward(s,amount){const paid=BigInt(Math.max(0,Math.round(amount)));setBalance(s,balance(s)+paid);s.earned=Math.min(Number.MAX_SAFE_INTEGER,s.earned+Number(paid));return Number(paid);}
export function restore(raw){const s=initial();try{const v=JSON.parse(raw);if(Number.isFinite(v.playSeconds)&&v.playSeconds>=0)s.playSeconds=v.playSeconds;if(typeof v.money==='string'&&/^-?\d{1,200}$/.test(v.money))setBalance(s,BigInt(v.money));for(const k of ['money','sold','earned'])if(Number.isSafeInteger(v[k])&&v[k]>= (k==='money'?-1000000:0))s[k]=v[k];for(const k of Object.keys(LIMITS))if(Number.isInteger(v[k])&&v[k]>=0&&v[k]<=LIMITS[k])s[k]=v[k];if(Array.isArray(v.found))s.found=s.found.map((_,i)=>Number.isSafeInteger(v.found[i])&&v.found[i]>=0?v.found[i]:0);}catch{}return s;}
// 30,000 × 30,000m 계곡. 좌표는 -15,000 ~ 15,000이고 미니맵 표기는 0 ~ 30,000이다.
export const MAP_SIZE=30000;
export const MAP_HALF=MAP_SIZE/2;
export const PLAY_LIMIT=MAP_HALF-40;
export const clampMap=v=>Math.max(-PLAY_LIMIT,Math.min(PLAY_LIMIT,v));
