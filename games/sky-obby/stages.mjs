// 16~100 스테이지 생성기. 스테이지마다 고정된 시드를 쓰므로 언제나 같은 코스가 만들어진다.
// 거리·높이 값은 core.test.mjs의 봇이 실제로 건너 본 범위 안에서만 고른다.
export const TOTAL_STAGES=100;
export const THEMES=[
 {name:'구름 들판',sky:'#8fd3ff',fog:'#b5e3ff'},
 {name:'새벽 하늘',sky:'#a5c8ff',fog:'#c9dcff'},
 {name:'노을 하늘',sky:'#ffb38a',fog:'#ffd0b0'},
 {name:'별빛 밤하늘',sky:'#23335e',fog:'#34487c'},
 {name:'오로라 빙하',sky:'#7fe0d0',fog:'#b0f0e6'},
 {name:'화산 하늘',sky:'#ff9a76',fog:'#ffb59c'},
 {name:'사탕 구름',sky:'#ffc2e2',fog:'#ffd9ee'},
 {name:'폭풍 구름',sky:'#7b8898',fog:'#98a4b2'},
 {name:'우주 정거장',sky:'#141833',fog:'#232a52'},
 {name:'무지개 정상',sky:'#b197fc',fog:'#d0bfff'},
];
const NAMES={hops:'징검다리 블록',lavaStones:'용암 징검다리',moversX:'흔들 발판',moversZ:'앞뒤 발판',elevator:'엘리베이터 발판',spinnerBridge:'회전 막대 다리',vanish:'사라지는 블록',padJump:'점프대',ice:'얼음길',conveyor:'컨베이어 벨트',spiral:'나선 계단',lavaMaze:'용암 미로',twinSpinners:'쌍둥이 막대',narrow:'좁은 다리'};
const ORDER=['hops','moversX','vanish','spinnerBridge','ice','padJump','lavaStones','conveyor','moversZ','narrow','elevator','lavaMaze','spiral','twinSpinners'];
const f2=v=>+v.toFixed(2);

function random(seed){let v=seed%2147483647||1;return ()=>(v=v*16807%2147483647)/2147483647;}

const MODS={
 hops(c){
  const n=3+Math.floor(c.r()*2+c.d*1.5);
  for(let i=0;i<n;i++){const size=f2(Math.max(1.6,3-1.3*c.d-c.r()*.4));c.place('block',{x:f2((c.r()*2-1)*(1+c.d)),gap:f2(1.5+c.r()*(.8+1.1*c.d)),rise:c.r()<.45?.5:0,w:size,d:size});}
 },
 lavaStones(c){
  const n=4+Math.floor(c.d*2.5),size=f2(2-.5*c.d),start=c.z,top=c.top;
  for(let i=0;i<n;i++)c.place('block',{x:i%2?1.5:-1.5,gap:f2(1.5+.4*c.d),w:size,d:size});
  const end=c.z+1;c.add('lava',{x:0,top:top-.4,z:(start+end)/2,w:8,d:end-start,h:.6});
 },
 moversX(c){
  c.rest();const n=2+(c.d>.5?1:0),amp=f2(2.5+c.d),period=f2(4-1.2*c.d);
  for(let i=0;i<n;i++)c.place('mover',{axis:'x',amp,period,phase:i%2*.5,gap:i?3:2.5,w:3,d:3});
  c.place('block',{gap:2.5,w:3,d:3});
 },
 moversZ(c){
  c.rest();const F=c.z,top=c.top,period=f2(3-.5*c.d);
  c.hop(c.add('mover',{x:0,top,z:F+4.5,w:3,d:3,axis:'z',amp:2,period,phase:0}));
  c.hop(c.add('mover',{x:0,top,z:F+11.5,w:3,d:3,axis:'z',amp:2,period,phase:.5}));
  c.z=F+15.5;c.place('block',{gap:1.5,rise:1,w:4,d:4});
 },
 elevator(c){
  c.rest();const top=c.top;
  c.place('mover',{axis:'y',amp:1.2,period:f2(3.5-.8*c.d),phase:0,gap:1.5,w:3,d:3});c.top=top;
  c.place('block',{gap:1.5,rise:f2(.9+.5*c.d),w:3,d:3});
 },
 spinnerBridge(c){
  c.place('block',{gap:1.5,w:4,d:4});
  // 막대 두 개일 때는 사이에 2m 쉼터를 둔다.
  const cnt=1+(c.d>.35?1:0),L=cnt===1?12:18,start=c.z,at=cnt===1?[6]:[5,13];
  c.add('block',{x:0,top:c.top,z:start+L/2,w:f2(1.4-.3*c.d),d:L});
  at.forEach((z,k)=>c.add('spinner',{x:0,top:c.top,z:start+z,len:6,speed:f2((1.3+.5*c.d)*(k%2?-1:1)),phase:k*1.3}));
  c.z=start+L;c.edge('spinner');c.place('block',{gap:1.5,w:4,d:4});
 },
 vanish(c){
  const n=3+Math.floor(c.d*2.5),size=f2(2.5-.5*c.d);
  for(let i=0;i<n;i++)c.place('vanish',{x:i%2?1:-1,gap:f2(1.5+.8*c.d*c.r()),rise:c.r()<.3?.5:0,w:size,d:size});
  c.place('block',{gap:1.5,w:3,d:3});
 },
 padJump(c){
  const pad=c.place('pad',{gap:1.5,w:3,d:3});
  c.edge('pad');c.hop(c.add('block',{x:0,top:c.top+4,z:pad.z+8,w:5,d:5}));c.z=pad.z+10.5;c.top+=4;
  if(c.d>.45){const p2=c.place('pad',{gap:2,w:3,d:3});c.edge('pad');c.hop(c.add('block',{x:0,top:c.top+5,z:p2.z+9,w:6,d:6}));c.z=p2.z+12;c.top+=5;}
 },
 ice(c){
  const n=2+Math.floor(c.d*2),w=f2(2.5-.5*c.d);
  for(let i=0;i<n;i++)c.place('ice',{x:i%2?1:-1,gap:f2(1.5+.5*c.d),rise:i===n-1?.5:0,w,d:5});
 },
 conveyor(c){
  c.place('conveyor',{gap:1.5,w:3,d:f2(8+2*c.r()),dir:[0,-1],push:f2(3+2*c.d)});
  if(c.d>.3)c.place('conveyor',{gap:2,w:3,d:8,dir:[c.r()<.5?1:-1,0],push:f2(2.5+.7*c.d)});
 },
 spiral(c){
  const n=c.d>.5&&c.r()<.35?13:5,C=c.z+7,top=c.top;
  c.add('pillar',{x:0,top:top+n+1,z:C,w:2,d:2,h:n+6});
  for(let i=0;i<n;i++){const a=-Math.PI/2+i*Math.PI/4;c.hop(c.add('block',{x:+(5*Math.cos(a)).toFixed(3),top:top+1+i,z:+(C+5*Math.sin(a)).toFixed(3),w:2.6,d:2.6}));}
  c.z=C+6.3;c.top=top+n;
 },
 lavaMaze(c){
  const rows=6+Math.floor(c.d*5),X=k=>-3+k*2,near=c.z+1.5,top=c.top,D=5+rows*2+3;
  const floor=c.add('block',{x:0,top,z:near+D/2,w:8,d:D});
  let col=1+Math.floor(c.r()*2);const start={x:X(col),z:near+2},pts=[],safe=[];
  for(let r=0;r<rows;r++){
   const z=near+6+r*2;let nc=col;if(c.r()<.6)do nc=Math.floor(c.r()*4);while(nc===col);
   const row=new Set();for(let k=Math.min(col,nc);k<=Math.max(col,nc);k++)row.add(k);
   if(c.r()<.25)row.add(Math.floor(c.r()*4));
   safe.push(row);pts.push({x:X(col),z},{x:X(nc),z});col=nc;
  }
  safe.forEach((row,r)=>{for(let k=0;k<4;k++)if(!row.has(k))c.add('lava',{x:X(k),top:top+.1,z:near+6+r*2,w:2,d:2,h:.3});});
  const exit={x:X(col),z:near+D-1.5};
  c.hop(floor,start);c.edge('walk',[...pts,exit]);c.hop(floor,exit);c.z=near+D;
 },
 twinSpinners(c){
  const near=c.z+1.5,top=c.top,sp=1.3+.3*c.d;
  const floor=c.add('block',{x:0,top,z:near+13,w:6,d:26});
  c.add('spinner',{x:0,top,z:near+9,len:6.6,speed:f2(sp),phase:0});
  c.add('spinner',{x:0,top,z:near+19,len:6.6,speed:-f2(sp+.2),phase:1});
  c.hop(floor,{x:0,z:near+1.5});c.z=near+26;c.edge('spinner');c.place('block',{gap:1.5,w:4,d:4});
 },
 narrow(c){
  const n=3+Math.floor(c.d*2),w=f2(1.2-.25*c.d);
  for(let i=0;i<n;i++)c.place('block',{x:i%2?1.2:-1.2,gap:f2(1.5+.4*c.r()),w,d:5+Math.round(c.r())});
 },
};

// api: add(type,o) 오브젝트 추가, setStage(n) 이후 추가될 오브젝트의 스테이지, start {obj,z,top}
export function generateStages(api,start){
 const names=[],routes=[];let prevCp=start.obj;const cur={z:start.z,top:start.top};
 for(let st=15;st<TOTAL_STAGES;st++){
  api.setStage(st);
  const r=random(9001+st*7919),d=(st-15)/(TOTAL_STAGES-16);
  const count=st<40?2:st<75?3:4,primary=ORDER[(st-15)%ORDER.length],mods=[primary];
  while(mods.length<count){const m=ORDER[Math.floor(r()*ORDER.length)];if(!mods.includes(m))mods.push(m);}
  const route={nodes:[{obj:prevCp}],edges:[]};let pending=null,lastType='checkpoint';
  const c={r,d,get z(){return cur.z;},set z(v){cur.z=v;},get top(){return cur.top;},set top(v){cur.top=v;},
   add:(type,o)=>api.add(type,o),
   hop(obj,at){route.edges.push(pending||{kind:'hop'});route.nodes.push(at?{obj,at}:{obj});pending=null;lastType=obj.type;return obj;},
   edge(kind,path){pending={kind,path};},
   place(type,{x=0,gap,rise=0,w,d,h,...extra}){const top=cur.top+rise,z=cur.z+gap+d/2;const o=api.add(type,{x,top,z,w,d,...(h?{h}:{}),...extra});c.hop(o);cur.z=z+d/2;cur.top=top;return o;},
   // 움직이는 장치 앞에는 멈춰 서서 타이밍을 볼 수 있는 고정 발판을 둔다.
   rest(){if(lastType!=='block'&&lastType!=='checkpoint')c.place('block',{gap:1.5,w:3,d:3});},
  };
  for(const m of mods)MODS[m](c);
  const last=st===TOTAL_STAGES-1;
  api.setStage(last?st:st+1);
  const gap=f2(1.5+r()*.5),w=last?8:6,top=cur.top+(r()<.4?.5:0);
  const end=api.add(last?'goal':'checkpoint',{...(last?{}:{cp:st+1}),x:0,top,z:cur.z+gap+w/2,w,d:w});
  c.hop(end);cur.z+=gap+w;cur.top=top;prevCp=end;
  names.push(last?`${THEMES[9].name} · 마지막 도전`:`${THEMES[Math.floor(st/10)].name} · ${NAMES[primary]}`);
  routes[st]=route;
 }
 return {names,routes};
}
