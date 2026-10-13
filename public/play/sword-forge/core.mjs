export const MAX_LEVEL = 30;
const names = ['낡은 철검','견습생의 검','단련된 철검','강철 장검','기사의 검','은빛 서약','바람의 칼날','서리 송곳니','빙결의 서약','극야의 검','겨울 군주의 검','불꽃의 검','잿빛 맹세','홍련의 송곳니','화룡의 숨결','태양의 심판','번개의 검','폭풍의 맹세','창공의 지배자','천둥 군주의 검','뇌신의 심판','공허의 검','심연의 속삭임','달을 가르는 검','별을 삼킨 칼날','성운의 지배자','여명의 성검','천상의 서약','운명의 칼날','영원의 빛','창세의 검'];
export const TIERS = [
  {name:'강철',color:'#b7c4cc',dark:'#415566',label:'COMMON'},
  {name:'서리',color:'#80e0ff',dark:'#22588e',label:'RARE'},
  {name:'홍련',color:'#ff9a63',dark:'#a32d24',label:'EPIC'},
  {name:'뇌전',color:'#b5a2ff',dark:'#5931b3',label:'LEGENDARY'},
  {name:'공허',color:'#e78bff',dark:'#662174',label:'MYTHIC'},
  {name:'천상',color:'#ffe7a4',dark:'#b27c2d',label:'DIVINE'},
];
export const sword = level => ({level,name:names[level],power:Math.round(12*1.32**level),value:level ? Math.round(220*1.53**level) : 0,...TIERS[Math.min(5,Math.floor(level/5))]});
export const cost = level => level < MAX_LEVEL ? Math.round(80*1.38**level) : 0;
export const AREAS = [
  {name:'이끼 숲',enemy:'숲의 슬라임',icon:'slime',require:0,color:'#88bd82'},
  {name:'잊힌 광산',enemy:'암석 골렘',icon:'golem',require:4,color:'#c9ad80'},
  {name:'얼어붙은 성채',enemy:'서리 망령',icon:'ghost',require:9,color:'#8fd6f1'},
  {name:'잿불 협곡',enemy:'화염 드레이크',icon:'dragon',require:14,color:'#f7976b'},
  {name:'폭풍의 제단',enemy:'번개의 파수꾼',icon:'golem',require:20,color:'#bba8fa'},
  {name:'별의 심연',enemy:'공허의 군주',icon:'ghost',require:26,color:'#e2a3fb'},
].map((a,i)=>({...a,hp:Math.round(sword(a.require).power*5.2),damage:9+i*2,reward:Math.round(260*4.7**i)}));
export const MISSIONS = [
  {id:'first',name:'첫 번째 불꽃',text:'+3 강화 달성',goal:3,field:'best',gold:600,scroll:1},
  {id:'hunter',name:'숲의 수호자',text:'사냥 5회 완료',goal:5,field:'kills',gold:2500,scroll:2},
  {id:'merchant',name:'검의 가치',text:'검 3자루 판매',goal:3,field:'sales',gold:4000,scroll:2},
  {id:'rare',name:'차가운 서약',text:'+10 강화 달성',goal:10,field:'best',gold:15000,scroll:3},
  {id:'smith',name:'식지 않는 모루',text:'강화 50회 시도',goal:50,field:'attempts',gold:25000,scroll:3},
  {id:'legend',name:'전설을 두드리다',text:'+20 강화 달성',goal:20,field:'best',gold:200000,scroll:5},
  {id:'god',name:'신의 대장장이',text:'+30 창세의 검 완성',goal:30,field:'best',gold:2000000,scroll:10},
];
export function freshState() { return {version:1,gold:1500,level:0,best:0,attempts:0,successes:0,breaks:0,sales:0,kills:0,failures:0,protect:2,bless:2,luck:0,forge:0,found:[0],claimed:[],sound:true,log:[]}; }
const integer = (n,max=1e12) => typeof n === 'number' && Number.isFinite(n) && n>=0 ? Math.min(max,Math.floor(n)) : 0;
export function restoreState(raw) {
  const s=freshState(); if(!raw || typeof raw!=='object' || raw.version!==1) return s;
  for(const k of ['gold','attempts','successes','breaks','sales','kills','failures','protect','bless']) s[k]=integer(raw[k]);
  s.level=integer(raw.level,30); s.best=Math.max(s.level,integer(raw.best,30));
  s.luck=integer(raw.luck,5); s.forge=integer(raw.forge,5);
  s.found=[...new Set([0,s.level,...(Array.isArray(raw.found)?raw.found:[]).filter(n=>Number.isInteger(n)&&n>=0&&n<=30)])].sort((a,b)=>a-b);
  s.claimed=Array.isArray(raw.claimed)?raw.claimed.filter(id=>MISSIONS.some(m=>m.id===id)):[];
  s.sound=raw.sound!==false;
  s.log=Array.isArray(raw.log)?raw.log.filter(l=>l&&typeof l.text==='string'&&['success','fail','break','info'].includes(l.type)).slice(0,20).map(l=>({text:l.text.slice(0,130),type:l.type})):[];
  return s;
}
export function rates(s,bless=false) {
  if(s.level>=30) return {success:100,break:0,down:0};
  const base=s.level<3?100:Math.max(18,93-(s.level-3)*3.4);
  const success=Math.min(100,Math.round(base+s.luck*2+Math.min(80,s.failures*8)+(bless?15:0)));
  const br=s.level>=7?Math.round((100-success)*.35):0;
  const down=s.level>=4?100-success-br:0;
  return {success,break:br,down};
}
function record(s,text,type='info') {s.log.unshift({text,type});s.log=s.log.slice(0,20);}
export function enhance(s,{protect=false,bless=false}={},roll=Math.random()) {
  if(s.level>=30 || s.gold<cost(s.level) || (protect&&s.protect<1) || (bless&&s.bless<1)) return {ok:false};
  const r=rates(s,bless); const before=s.level;
  s.gold-=cost(s.level); s.attempts++; if(protect)s.protect--;if(bless)s.bless--;
  const n=Math.max(0,Math.min(.999999,Number.isFinite(roll)?roll:1))*100;
  let result;
  if(n<r.success){ s.level++;s.successes++;s.best=Math.max(s.best,s.level);s.failures=0;if(!s.found.includes(s.level))s.found.push(s.level);result='success'; }
  else {s.failures++;if(protect)result='protected';else if(n>=100-r.break){s.level=0;s.breaks++;s.protect++;result='break';}else if(s.level>=4){s.level--;result='down';}else result='fail';}
  const messages={success:`강화 성공! +${s.level} ${sword(s.level).name}`,protected:`+${before} 강화 실패 · 보호 주문서가 검을 지켰습니다`,break:`+${before} 검 파괴 · 새 철검과 보호 주문서 1장 지급`,down:`강화 실패 · +${before} → +${s.level}`,fail:'강화 실패 · 단계 유지'};
  record(s,messages[result],result==='success'?'success':result==='break'?'break':'fail');
  return {ok:true,result,before,after:s.level,rates:r};
}
export function sell(s) {
  if(s.level===0)return 0;
  const gold=sword(s.level).value;s.gold=Math.min(1e12,s.gold+gold);s.sales++;record(s,`+${s.level} ${sword(s.level).name} 판매 · ${gold.toLocaleString()} G`);s.level=0;s.failures=0;return gold;
}
export const upgradeCost = (s,id) => Math.round((id==='luck'?2400:1800)*3**s[id]);
export function buy(s,id) {
  if(!['protect','bless','luck','forge'].includes(id))return false;
  const prices={protect:1200,bless:900};
  if(id==='luck'||id==='forge') {if(s[id]>=5)return false;prices[id]=upgradeCost(s,id);}
  if(!(id in prices)||s.gold<prices[id])return false;
  s.gold-=prices[id];s[id]++;return true;
}
export function claim(s,id) { const m=MISSIONS.find(m=>m.id===id);if(!m||s.claimed.includes(id)||s[m.field]<m.goal)return false;s.claimed.push(id);s.gold=Math.min(1e12,s.gold+m.gold);s.protect+=m.scroll;return true; }
export function encounter(s,index) {
  const a=AREAS[index];if(!a||s.level<a.require)return null;
  return {index,hp:a.hp,maxHp:a.hp,playerHp:100,turn:0,potion:1,finished:false};
}
export function attack(s,b,action='attack',roll=Math.random()) {
  if(!b || b.finished || !['attack','skill','potion'].includes(action))return {ok:false};
  if(action==='skill'&&(b.turn===0||b.turn%3!==0))return {ok:false};
  if(action==='potion') {if(!b.potion||b.playerHp===100)return {ok:false};b.potion--;b.playerHp=Math.min(100,b.playerHp+45);return {ok:true,healed:true};}
  b.turn++;const critical=roll<.18;const damage=Math.round(sword(s.level).power*(action==='skill'?2.7:critical?1.8:1));b.hp=Math.max(0,b.hp-damage);
  if(b.hp===0){b.finished=true;s.kills++;const gold=Math.round(AREAS[b.index].reward*(1+s.forge*.25));s.gold=Math.min(1e12,s.gold+gold);if(s.kills%3===0)s.bless++;record(s,`${AREAS[b.index].enemy} 처치 · ${gold.toLocaleString()} G`);return {ok:true,win:true,damage,critical,gold,scroll:s.kills%3===0};}
  const retaliation=AREAS[b.index].damage;b.playerHp=Math.max(0,b.playerHp-retaliation);if(!b.playerHp)b.finished=true;
  return {ok:true,damage,critical,retaliation,lose:!b.playerHp};
}
