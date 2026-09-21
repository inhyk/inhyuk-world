export const ORES = [
  ['갈색','흔함','흙빛 돌','#996044',-100,3,40],
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
].map(([colorName,rank,name,color,price,weight,chance],id)=>({id,colorName,rank,name,color,price,weight,chance}));
export const MAX_STRENGTH=30;
export const CAPACITY=5;
export const weightTotal=items=>Math.round(items.reduce((n,o)=>n+o.weight,0)*10)/10;
export const rankIndex=id=>ORES.filter(o=>o.price<ORES[id].price).length;
export const money=n=>`${BigInt(n).toLocaleString('ko-KR')}원`;
export const balance=s=>BigInt(s.money);
function setBalance(s,value){s.money=value<=BigInt(Number.MAX_SAFE_INTEGER)&&value>=BigInt(Number.MIN_SAFE_INTEGER)?Number(value):value.toString();}
export const GIFT_CODE='135707531113570';
export const GIFT_AMOUNT=100000000000000000000000000000000n;
export function redeem(s,code){if(code.trim()!==GIFT_CODE)return false;setBalance(s,balance(s)+GIFT_AMOUNT);return true;}
export const initial=()=>({playSeconds:0,money:0,strength:0,speed:0,sold:0,earned:0,found:Array(ORES.length).fill(0)});
export const power=s=>Math.floor(12*1.4**s.strength);
export const speed=s=>22+s.speed*4;
export const cost=(s,key)=>key==='strength'?Math.round(100*2.1**s.strength):Math.round(100*2**s.speed);
export function pick(random=Math.random){let v=random()*100;for(const ore of ORES){v-=ore.chance;if(v<0)return ore.id;}return ORES.length-1;}
export function makeOre(id,random=Math.random){const o=ORES[id];return {id,weight:Math.round(o.weight*(1+random()*.25)*10)/10};}
export const radius=o=>1.25+Math.cbrt(o.weight)*.23;
export const canLift=(s,o,items=[])=>items.length<CAPACITY&&power(s)>=Math.round((weightTotal(items)+o.weight)*10)/10;
export function buy(s,key){if(!['strength','speed'].includes(key)||s[key]>=(key==='strength'?MAX_STRENGTH:10)||balance(s)<BigInt(cost(s,key)))return false;setBalance(s,balance(s)-BigInt(cost(s,key)));s[key]++;return true;}
export function sell(s,o){if(!o)return false;setBalance(s,balance(s)+BigInt(ORES[o.id].price));s.earned+=Math.max(0,ORES[o.id].price);s.sold++;return true;}
export function restore(raw){const s=initial();try{const v=JSON.parse(raw);if(Number.isFinite(v.playSeconds)&&v.playSeconds>=0)s.playSeconds=v.playSeconds;if(typeof v.money==='string'&&/^-?\d{1,200}$/.test(v.money))setBalance(s,BigInt(v.money));for(const k of ['money','sold','earned'])if(Number.isSafeInteger(v[k])&&v[k]>= (k==='money'?-1000000:0))s[k]=v[k];for(const k of ['strength','speed'])if(Number.isInteger(v[k])&&v[k]>=0&&v[k]<=(k==='strength'?MAX_STRENGTH:10))s[k]=v[k];if(Array.isArray(v.found)&&[10,ORES.length].includes(v.found.length))s.found=s.found.map((_,i)=>Number.isSafeInteger(v.found[i])&&v.found[i]>=0?v.found[i]:0);}catch{}return s;}
