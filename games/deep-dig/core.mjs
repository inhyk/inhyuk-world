export const GOAL = 10_000_000_000;
export const ORES = [
  {name:'돌', depth:1, price:10, color:'#a5b5b2', icon:'◆'},
  {name:'큰 돌', depth:10, price:50, color:'#c9d0c9', icon:'⬟'},
  {name:'석탄', depth:50, price:100, color:'#545b68', icon:'⬢'},
  {name:'철', depth:75, price:1000, color:'#dab4a4', icon:'◆'},
  {name:'구리', depth:100, price:10000, color:'#ec985b', icon:'⬟'},
  {name:'은', depth:150, price:100_000_000, color:'#dbe5f4', icon:'✦'},
  {name:'플래티넘', depth:300, price:500_000_000, color:'#c0b6ff', icon:'✧'},
  {name:'다이아몬드', depth:500, price:1_000_000_000, color:'#70efd9', icon:'♦'},
];
export const initial = () => ({version:2, money:0, earned:0, depth:1, levels:{shovel:0,speed:0,bag:0,strength:0}, bag:Array(8).fill(0), found:Array(8).fill(0), dug:[], damage:Array(9).fill(0), won:false});
export const capacity = s => 20 + s.levels.bag*20;
export const count = s => s.bag.reduce((a,b)=>a+b,0);
export const cost = (s,key) => Math.round(({shovel:100,speed:60,bag:80,strength:100}[key])*5**s.levels[key]);
export const interval = s => Math.max(85, 420-s.levels.speed*55);
export const width = s => 1 + s.levels.shovel*2;
export function oreAt(depth,col) {
  const top = ORES.findLastIndex(o => depth>=o.depth);
  const roll = ((depth*73856093 ^ col*19349663)>>>0)%100;
  return roll<38 ? top : Math.max(0,top-1-(roll%3));
}
export const power = s => [20,28,39,55,77][s.levels.strength];
export const hardness = (s,col) => 100 + oreAt(s.depth,col)*25;
export function targets(s,col) {
  if(!Number.isInteger(col)||col<0||col>8)return [];
  // Nearest neighbours on the 3 × 3 surface; the largest shovel covers all nine.
  return Array.from({length:9},(_,i)=>i)
    .sort((a,b)=>(a%3-col%3)**2+(Math.floor(a/3)-Math.floor(col/3))**2-((b%3-col%3)**2+(Math.floor(b/3)-Math.floor(col/3))**2)||a-b)
    .slice(0,width(s)).filter(c=>!s.dug.includes(c));
}
// One completed swing. Only a fully fractured block becomes inventory.
export function strike(s,col) {
  const impacts=[];
  for(const c of targets(s,col)) {
    if(count(s)>=capacity(s))break;
    s.damage[c]=Math.min(hardness(s,c),s.damage[c]+power(s));
    const ore=oreAt(s.depth,c), broken=s.damage[c]>=hardness(s,c);
    if(broken){s.bag[ore]++;s.found[ore]++;s.dug.push(c);}
    impacts.push({col:c,ore,broken,progress:s.damage[c]/hardness(s,c)});
  }
  return impacts;
}
export function descend(s) { if(!s.dug.length||s.depth>=1000000) return false; s.depth++; s.dug=[]; s.damage.fill(0); return true; }
export function sell(s) { const value=s.bag.reduce((v,n,i)=>v+n*ORES[i].price,0); s.money+=value; s.earned+=value; s.bag.fill(0); s.won=s.earned>=GOAL; return value; }
export function upgrade(s,key) { if(!Object.hasOwn(s.levels,key)||s.levels[key]>=4||s.money<cost(s,key)) return false; s.money-=cost(s,key);s.levels[key]++;return true; }
export function restore(raw) {
  try { const s=JSON.parse(raw); const num=n=>Number.isSafeInteger(n)&&n>=0;
    if(!s||![1,2].includes(s.version)||!num(s.money)||!num(s.earned)||!num(s.depth)||s.depth<1||s.depth>1000000) return initial();
    if(s.version===1&&s.levels){s.levels.strength=0;s.damage=Array(9).fill(0);s.version=2;}
    if(!s.levels||!['shovel','speed','bag','strength'].every(k=>num(s.levels[k])&&s.levels[k]<=4)) return initial();
    if(![s.bag,s.found].every(a=>Array.isArray(a)&&a.length===8&&a.every(num)))return initial();
    if(!Array.isArray(s.dug)||s.dug.some(n=>!num(n)||n>8)||new Set(s.dug).size!==s.dug.length||count(s)>capacity(s))return initial();
    if(!Array.isArray(s.damage)||s.damage.length!==9||s.damage.some((n,c)=>!num(n)||n>hardness(s,c)||(!s.dug.includes(c)&&n>=hardness(s,c))))return initial();
    s.won=s.earned>=GOAL;return s;
  } catch {return initial();}
}
export function money(n) {return n>=100000000?`${+(n/100000000).toFixed(2)}억 원`:n>=10000?`${+(n/10000).toFixed(2)}만 원`:`${n.toLocaleString('ko-KR')}원`;}
