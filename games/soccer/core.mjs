// 인혁이의 3D 축구 — 렌더링과 분리된 경기 규칙, 공 물리, AI.
// 좌표: x는 경기장 길이 방향(홈팀은 +x 골대를 공격), z는 폭 방향, y는 높이.
export const HALF_L=32,HALF_W=20,GOAL_W=7.2,GOAL_H=2.4,GOAL_D=2.2,BOX_L=10,BOX_W=20,AREA_L=4,AREA_W=11;
export const BALL_R=.3,PLAYER_R=.45,GRAVITY=18;
export const RUN=6.4,SPRINT=8.8,DRIBBLE=.9,LUNGE=11;
export const MATCH_LEN=180,TEAM_SIZE=5;
export const TEAMS=[{name:'인혁 FC',color:'#1c7ed6'},{name:'',color:'#e03131'}];
export const DIFFICULTY={
 easy:{name:'쉬움',team:'동네 친구들',speed:.78,think:.55,keeper:.42,tackle:.25,defend:.72,steal:.25,lunge:.2,dodge:.15,press:1,vision:.35,shootRange:15,error:1.7,carry:.92},
 normal:{name:'보통',team:'번개 유나이티드',speed:.86,think:.4,keeper:.54,tackle:.35,defend:.68,steal:.55,lunge:.32,dodge:.2,press:1,vision:.45,shootRange:15,error:1.4,carry:.93},
 hard:{name:'어려움',team:'월드 스타즈',speed:.94,think:.28,keeper:.66,tackle:.48,defend:.56,steal:1.1,lunge:.45,dodge:.32,press:1,vision:.6,shootRange:16,error:1.15},
};
// 공격 방향 기준 포메이션 (u: 자기 골대 -HALF_L → 상대 골대 +HALF_L)
export const FORM=[{role:'GK',num:1,u:-30.6,z:0},{role:'DF',num:4,u:-19,z:-8},{role:'DF',num:5,u:-19,z:8},{role:'MF',num:8,u:-10,z:0},{role:'FW',num:10,u:-3,z:-2}];
const HOME_AI={speed:.95,think:.24,keeper:.72,steal:1.2,lunge:.5,dodge:.35,press:2,vision:.7,shootRange:16,error:1};
const OUT_NAMES={throw:'스로인',corner:'코너킥',goalkick:'골킥'};

export function rand(s){s.seed=(s.seed+0x6D2B79F5)|0;let t=s.seed;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dirOf=team=>team?-1:1;
export const skill=(s,team)=>team?DIFFICULTY[s.difficulty]:HOME_AI;

export function create({difficulty='normal',seed=1,length=MATCH_LEN}={}){
 const s={difficulty:DIFFICULTY[difficulty]?difficulty:'normal',seed:(seed|0)||1,length,time:length,clock:0,
  score:[0,0],shots:[0,0],poss:[0,0],goals:[],players:[],
  ball:{x:0,y:BALL_R,z:0,vx:0,vy:0,vz:0,owner:null,lastTeam:0,lastKicker:null,saveTried:false,shot:false},
  human:4,stamina:1,tired:false,charge:0,charging:false,prevShoot:false,phase:'play',pause:0,message:'',over:false,passTarget:null,passTimer:0,lastGoal:null};
 for(let team=0;team<2;team++)FORM.forEach((f,k)=>s.players.push({id:team*TEAM_SIZE+k,team,role:f.role,num:f.num,hu:f.u,hz:f.z,
  x:0,z:0,vx:0,vz:0,face:0,stun:0,lunge:0,dodge:0,cool:0,tcool:0,think:0,hold:0,dive:0,mode:'pos',tx:0,tz:0,sprint:false,run:0}));
 kickoff(s,0);
 return s;
}
export const teamName=(s,team)=>team?DIFFICULTY[s.difficulty].team:TEAMS[0].name;
export const keeperOf=(s,team)=>s.players[team*TEAM_SIZE];
export const ownGoalX=team=>-dirOf(team)*HALF_L;

export function kickoff(s,team){
 for(const p of s.players){
  const d=dirOf(p.team);let u=Math.min(p.hu,p.team===team?-1.5:-6);
  Object.assign(p,{x:u*d,z:p.hz,vx:0,vz:0,face:p.team?Math.PI:0,stun:0,lunge:0,cool:0,hold:0,dive:0,mode:'pos',think:0});
 }
 const k=s.players[team*TEAM_SIZE+4];k.x=-dirOf(team)*.72;k.z=0;
 Object.assign(s.ball,{x:0,y:BALL_R,z:0,vx:0,vy:0,vz:0,owner:k.id,lastTeam:team,lastKicker:null,saveTried:false,shot:false});
 s.human=4;s.charging=false;s.charge=0;s.passTarget=null;
 s.phase='kickoff';s.pause=1.2;s.message='킥오프';
}

function attach(s){
 const b=s.ball,p=s.players[b.owner];
 b.x=p.x+Math.cos(p.face)*.72;b.z=p.z+Math.sin(p.face)*.72;b.y=BALL_R;b.vx=p.vx;b.vz=p.vz;b.vy=0;
}
function release(s,p,vx,vy,vz,kind){
 const b=s.ball;attach(s);
 Object.assign(b,{owner:null,vx,vy,vz,lastTeam:p.team,lastKicker:p.id,saveTried:false,shot:kind==='shot'});
 p.cool=.35;p.hold=0;
}

// 슛: charge 0~1, aimZ는 노리는 골대 안쪽 z (null이면 골키퍼 반대쪽)
export function shoot(s,p,charge,aimZ,ev){
 const b=s.ball,d=dirOf(p.team),gx=d*(HALF_L+.4),k=keeperOf(s,1-p.team);
 if(aimZ==null)aimZ=k.z>0?-(GOAL_W/2-.8):GOAL_W/2-.8;
 p.face=Math.atan2(aimZ-p.z,gx-p.x);attach(s);
 const dist=Math.hypot(gx-b.x,aimZ-b.z);
 const err=(.45+dist*.045+(charge>.85?(charge-.85)*5:0))*(p.team?DIFFICULTY[s.difficulty].error:1);
 const tz=clamp(aimZ,-(GOAL_W/2-.4),GOAL_W/2-.4)+(rand(s)-.5)*2*err;
 const speed=16+13*charge,hx=gx-b.x,hz=tz-b.z,hd=Math.hypot(hx,hz)||1,t=hd/speed;
 const ty=.35+charge*1.5+(charge>.9?(charge-.9)*9:0)+(rand(s)-.5)*.4;
 const vy=clamp((ty-BALL_R+.5*GRAVITY*t*t)/t,0,13);
 release(s,p,hx/hd*speed,vy,hz/hd*speed,'shot');
 s.shots[p.team]++;s.charging=false;s.charge=0;ev.push('shoot');
}

export function chooseMate(s,p,ax,az){
 if(!ax&&!az){ax=Math.cos(p.face);az=Math.sin(p.face);}
 const m=Math.hypot(ax,az);ax/=m;az/=m;
 let best=null,bestScore=-1e9;
 for(const q of s.players){
  if(q.team!==p.team||q===p)continue;
  const dx=q.x-p.x,dz=q.z-p.z,dd=Math.hypot(dx,dz)||1;
  let open=6;for(const o of s.players)if(o.team!==p.team)open=Math.min(open,Math.hypot(o.x-q.x,o.z-q.z));
  const score=(dx*ax+dz*az)/dd*2+open*.25-dd*.03-(q.role==='GK'?2.5:0)-(dd<3?2:0)-(dd>34?3:0);
  if(score>bestScore){bestScore=score;best=q;}
 }
 return best;
}
export function pass(s,p,ax,az,ev,mate=chooseMate(s,p,ax,az)){
 p.face=Math.atan2(mate.z-p.z,mate.x-p.x);attach(s); // 차는 방향으로 몸을 돌려서 찬다
 const b=s.ball,tx=mate.x+mate.vx*.5,tz=mate.z+mate.vz*.5,dx=tx-b.x,dz=tz-b.z,d=Math.hypot(dx,dz)||1;
 if(d<20){const v=passSpeed(d);release(s,p,dx/d*v,.4,dz/d*v,'pass');}
 else{const vy=9,v=d*.8;release(s,p,dx/d*v,vy,dz/d*v,'pass');}
 s.passTarget=mate.id;s.passTimer=1.8;
 if(p.team===0&&mate.role!=='GK')s.human=mate.id;
 s.charging=false;s.charge=0;ev.push('pass');
}

function setRestart(s,type,team,x,z,ev){
 const b=s.ball;let taker;
 if(type==='goalkick')taker=keeperOf(s,team);
 else{let bd=1e9;for(const p of s.players)if(p.team===team&&p.role!=='GK'){const dd=Math.hypot(p.x-x,p.z-z);if(dd<bd){bd=dd;taker=p;}}}
 // 경기장 안쪽을 보도록 선다
 const face=type==='throw'?Math.atan2(-Math.sign(z),0):type==='corner'?Math.atan2(-z,-Math.sign(x)*6):team?Math.PI:0;
 for(const p of s.players){p.vx=p.vz=0;p.lunge=0;p.stun=0;p.dive=0;}
 taker.face=face;taker.x=x-Math.cos(face)*.72;taker.z=z-Math.sin(face)*.72;taker.hold=type==='goalkick'?.4:0;
 Object.assign(b,{x,y:BALL_R,z,vx:0,vy:0,vz:0,owner:taker.id,lastTeam:team,saveTried:false,shot:false});
 // 상대 선수는 4m 밖으로
 for(const p of s.players)if(p.team!==team){const dx=p.x-x,dz=p.z-z,dd=Math.hypot(dx,dz);if(dd<4){const k=dd?4/dd:1;p.x=x+(dd?dx*k:0);p.z=z+(dd?dz*k:4*-Math.sign(z||1));}}
 if(team===0&&taker.role!=='GK')s.human=taker.id;
 s.passTarget=null;s.charging=false;s.charge=0;
 s.phase='restart';s.pause=1;s.message=OUT_NAMES[type];ev.push('out');
}

function scoreGoal(s,team,ev){
 const b=s.ball,kicker=b.lastKicker!=null?s.players[b.lastKicker]:null;
 const own=!!kicker&&kicker.team!==team;
 s.score[team]++;
 s.lastGoal={team,num:kicker?.num??null,own,minute:elapsedMinute(s)};s.goals.push(s.lastGoal);
 s.phase='goal';s.pause=3;s.message=own?'자책골':'골';s.passTarget=null;s.charging=false;s.charge=0;
 b.owner=null;
 ev.push(team===0?'goal:home':'goal:away');
}
export const elapsedMinute=s=>Math.min(90,Math.floor((s.length-s.time)/s.length*90)+1);

// 골대 기둥과 크로스바, 골 그물
function goalFrame(s,ev){
 const b=s.ball,pr=.1;
 for(const sx of [-1,1]){
  const gx=sx*HALF_L;
  if(Math.abs(b.x-gx)>2.6)continue;
  for(const pz of [-GOAL_W/2,GOAL_W/2]){
   const dx=b.x-gx,dz=b.z-pz,dd=Math.hypot(dx,dz);
   if(dd<BALL_R+pr&&b.y<GOAL_H+BALL_R&&dd>0){
    const nx=dx/dd,nz=dz/dd,vn=b.vx*nx+b.vz*nz;
    b.x=gx+nx*(BALL_R+pr);b.z=pz+nz*(BALL_R+pr);
    if(vn<0){b.vx-=1.7*vn*nx;b.vz-=1.7*vn*nz;if(vn<-4)ev.push('post');}
   }
  }
  if(Math.abs(b.z)<GOAL_W/2){
   const dx=b.x-gx,dy=b.y-GOAL_H,dd=Math.hypot(dx,dy);
   if(dd<BALL_R+pr&&dd>0){
    const nx=dx/dd,ny=dy/dd,vn=b.vx*nx+b.vy*ny;
    b.x=gx+nx*(BALL_R+pr);b.y=GOAL_H+ny*(BALL_R+pr);
    if(vn<0){b.vx-=1.7*vn*nx;b.vy-=1.7*vn*ny;if(vn<-4)ev.push('post');}
   }
  }
  // 골대 안: 뒤, 옆, 위 그물
  if(sx*b.x>HALF_L&&Math.abs(b.z)<GOAL_W/2+BALL_R&&b.y<GOAL_H+BALL_R&&s.phase==='goal'){
   const back=HALF_L+GOAL_D-BALL_R;
   if(sx*b.x>back){b.x=sx*back;if(sx*b.vx>0)b.vx*=-.15;}
   const side=GOAL_W/2-BALL_R;
   if(Math.abs(b.z)>side){b.z=Math.sign(b.z)*side;b.vz*=-.2;}
   if(b.y>GOAL_H-BALL_R){b.y=GOAL_H-BALL_R;if(b.vy>0)b.vy*=-.2;}
  }
 }
}

export function ballPhysics(s,dt,ev){
 const b=s.ball;
 b.vy-=GRAVITY*dt;
 const air=1-.06*dt;b.vx*=air;b.vz*=air;
 b.x+=b.vx*dt;b.y+=b.vy*dt;b.z+=b.vz*dt;
 if(b.y<=BALL_R){
  b.y=BALL_R;
  if(b.vy<-2){b.vy=-b.vy*.55;if(b.vy>3)ev.push('bounce');}else b.vy=0;
 }
 if(b.y<=BALL_R+1e-6&&b.vy===0){
  const sp=Math.hypot(b.vx,b.vz);
  if(sp>0){const k=Math.max(0,sp-(2.6+.3*sp)*dt)/sp;b.vx*=k;b.vz*=k;}
 }
 goalFrame(s,ev);
}

function checkLines(s,ev){
 const b=s.ball;
 if(Math.abs(b.x)>HALF_L+BALL_R){
  const sx=Math.sign(b.x),attacker=sx>0?0:1;
  if(Math.abs(b.z)<GOAL_W/2-BALL_R*.5&&b.y<GOAL_H){scoreGoal(s,attacker,ev);return true;}
  const defender=1-attacker;
  if(b.lastTeam===defender)setRestart(s,'corner',attacker,sx*(HALF_L-.4),Math.sign(b.z||1)*(HALF_W-.4),ev);
  else setRestart(s,'goalkick',defender,sx*(HALF_L-5),0,ev);
  return true;
 }
 if(Math.abs(b.z)>HALF_W+BALL_R){
  setRestart(s,'throw',1-b.lastTeam,clamp(b.x,-HALF_L+1,HALF_L-1),Math.sign(b.z)*(HALF_W-.35),ev);return true;
 }
 return false;
}

// ---------- AI ----------
// 공까지 걸리는 시간으로 누가 먼저 닿는지 본다
function ballAt(s,t){
 const b=s.ball;if(b.owner!=null){const o=s.players[b.owner];return [b.x+o.vx*t,b.z+o.vz*t];}
 const sp=Math.hypot(b.vx,b.vz);if(sp<.01)return [b.x,b.z];
 const dec=2.6+.3*sp,tt=Math.min(t,sp/dec),dist=sp*tt-.5*dec*tt*tt;return [b.x+b.vx/sp*dist,b.z+b.vz/sp*dist];
}
function intercept(s,p,speed){
 for(let t=0;t<=2.4;t+=.1){const [x,z]=ballAt(s,t);if(Math.hypot(x-p.x,z-p.z)<=speed*t+.6)return {t,x,z};}
 const [x,z]=ballAt(s,2.4);return {t:3+Math.hypot(x-p.x,z-p.z)/speed,x,z};
}
// 선분 a→b 근처(폭 w)에 상대가 있으면 위험도가 올라간다
function laneRisk(s,team,ax,az,bx,bz,w=1.6,keeper=true){
 const dx=bx-ax,dz=bz-az,L2=dx*dx+dz*dz||1;let risk=0;
 for(const o of s.players){if(o.team===team)continue;
  const t=clamp(((o.x-ax)*dx+(o.z-az)*dz)/L2,0,1),d=Math.hypot(ax+dx*t-o.x,az+dz*t-o.z);
  if(d<w&&t>.05&&(keeper||o.role!=='GK'))risk+=(w-d)/w;}
 return risk;
}
// 상대가 달려와서 패스를 끊을 수 있는지: 공이 각 지점에 닿는 시간과 상대가 닿는 시간을 비교
export const passSpeed=d=>clamp(6+d*.8,10,24);
function passRisk(s,team,ax,az,bx,bz){
 const dist=Math.hypot(bx-ax,bz-az),v=passSpeed(dist)*.85;let risk=0;
 for(const o of s.players){
  if(o.team===team||o.role==='GK')continue;let worst=0;
  for(let k=1;k<=8;k++){const f=k/8,px=ax+(bx-ax)*f,pz=az+(bz-az)*f,tb=dist*f/v,reach=SPRINT*.9*Math.max(0,tb-.15)+.9,d=Math.hypot(o.x-px,o.z-pz);
   if(d<reach)worst=Math.max(worst,(reach-d)/reach);}
  risk+=worst;
 }
 return risk;
}
function nearestOpp(s,p){let best=null,bd=1e9;for(const o of s.players)if(o.team!==p.team){const d=Math.hypot(o.x-p.x,o.z-p.z);if(d<bd){bd=d;best=o;}}return [best,bd];}
function openness(s,q){let open=8;for(const o of s.players)if(o.team!==q.team)open=Math.min(open,Math.hypot(o.x-q.x,o.z-q.z));return open;}
function chaserOf(s,team){
 const b=s.ball;let best=null,bd=1e9;
 for(const p of s.players)if(p.team===team&&p.role!=='GK'&&p.stun<=0){const d=Math.hypot(p.x-b.x,p.z-b.z);if(d<bd){bd=d;best=p;}}
 return [best,bd];
}
// 가장 뒤에 있는 수비수 위치(공격 방향 기준 u)
function lastLine(s,team){const d=dirOf(team);let u=-HALF_L;for(const o of s.players)if(o.team!==team&&o.role!=='GK')u=Math.max(u,o.x*d);return u;}

function bestPass(s,p,forward=true){
 const d=dirOf(p.team);let best=null,bestScore=-1e9;
 for(const q of s.players){
  if(q.team!==p.team||q===p||q.role==='GK')continue;
  const lead=.5,tx=q.x+q.vx*lead,tz=q.z+q.vz*lead,dist=Math.hypot(tx-p.x,tz-p.z);
  if(dist<4||dist>30)continue;
  const gain=(tx-p.x)*d,risk=dist>20?laneRisk(s,p.team,p.x,p.z,tx,tz,1.3):passRisk(s,p.team,p.x,p.z,tx,tz),open=openness(s,q);
  const score=(forward?gain*.25:0)+open*.55-(open<2.5?2:0)-risk*2.8-dist*.03-Math.abs(tz)/HALF_W*.5;
  if(score>bestScore){bestScore=score;best=q;best.gain=gain;}
 }
 return [best,bestScore];
}
function carrierThink(s,p,ev){
 const d=dirOf(p.team),gx=d*HALF_L,sk=skill(s,p.team),k=keeperOf(s,1-p.team);
 const dGoal=Math.hypot(gx-p.x,p.z),[opp,od]=nearestOpp(s,p);
 const u=p.x*d;
 // 슛: 가까우면 바로, 조금 멀면 골대까지 길이 열려 있을 때
 if(dGoal<sk.shootRange&&Math.abs(p.z)<GOAL_W/2+9){
  const aim=k.z>0?-(GOAL_W/2-.7):GOAL_W/2-.7,risk=laneRisk(s,p.team,p.x,p.z,gx,aim,1,false);
  if(dGoal<10||risk<.5||(od<2&&dGoal<sk.shootRange*.85)){shoot(s,p,clamp(.4+dGoal/40+rand(s)*.2,.45,.85),aim,ev);return;}
 }
 // 수비가 촘촘해도 가끔은 먼 거리 슛, 페널티 박스 근처에서 막히면 그냥 때린다
 if(dGoal<sk.shootRange+7&&Math.abs(p.z)<GOAL_W/2+7){
  const aim=k.z>0?-(GOAL_W/2-.7):GOAL_W/2-.7,risk=laneRisk(s,p.team,p.x,p.z,gx,aim,.9,false);
  if((risk<.3&&rand(s)<.3)||(dGoal<sk.shootRange+2&&rand(s)<.25)){shoot(s,p,.75+rand(s)*.15,aim,ev);return;}
 }
 const [mate,score]=bestPass(s,p);
 // 앞을 막혔을 때만 패스, 되도록 앞쪽으로. 뒤에서 쫓아오면 그대로 치고 나간다
 const pressed=od<2.4&&opp&&(opp.x-p.x)*d>-.5;
 if(mate&&pressed&&score>-.5&&(mate.gain>-3||od<1.3)&&rand(s)<.8){pass(s,p,0,0,ev,mate);return;}
 if(mate&&score>1.6&&rand(s)<sk.vision*.45){pass(s,p,0,0,ev,mate);return;}
 // 측면 깊숙하면 크로스
 if((gx-p.x)*d<9&&Math.abs(p.z)>7&&mate&&rand(s)<.5){pass(s,p,0,0,ev,mate);return;}
 // 드리블: 골대 쪽으로 가되 가까운 상대를 밀어내듯 피한다
 let vx=gx-p.x,vz=-p.z*.5;const m=Math.hypot(vx,vz)||1;vx/=m;vz/=m;
 for(const o of s.players){if(o.team===p.team)continue;const dx=p.x-o.x,dz=p.z-o.z,dd=Math.hypot(dx,dz);
  if(dd<7&&dd>.01){const ahead=(o.x-p.x)*d>-1.5?1:.35,w=ahead*(7-dd)/7*2.2/dd;vx+=dx*w*(Math.abs(dz)<.5?.3:1);vz+=dz*w+(Math.abs(dz)<.5?(p.z>0?-1:1)*w*dd*.6:0);}}
 const vm=Math.hypot(vx,vz)||1;
 if((gx-p.x)*d<9&&Math.abs(p.z)>7){vx=0;vz=-Math.sign(p.z);}
 p.mode='carry';p.tx=p.x+vx/vm*8;p.tz=clamp(p.z+vz/vm*8,-HALF_W+1.5,HALF_W-1.5);p.sprint=od>3.5&&u<HALF_L-8;
}

function defendTarget(s,p,human){
 // 수비: 1명 압박, 1명 골대 쪽 커버, 나머지는 상대 공격수를 골대 쪽에서 따라붙기
 const team=p.team,d=dirOf(team),b=s.ball,gx=-d*HALF_L,sk=skill(s,team);
 const mine=s.players.filter(q=>q.team===team&&q.role!=='GK'&&q.stun<=0);
 const speed=SPRINT*sk.speed;
 const times=mine.map(q=>({q,t:q===human?intercept(s,q,SPRINT).t-.6:intercept(s,q,speed).t}));
 times.sort((a,c)=>a.t-c.t);
 const order=times.map(o=>o.q),rank=order.indexOf(p);
 const humanFirst=human&&order[0]===human;
 const pressers=sk.press;
 if(rank>=0&&rank<pressers&&!(human&&rank===0&&humanFirst)){
  // 사람이 가장 가까우면 AI 동료는 커버만
  if(!(human&&humanFirst&&rank===1)||!human){
   const it=intercept(s,p,speed);let tx=it.x,tz=it.z;
   if(b.owner!=null){const gdx=gx-tx,gdz=-tz,gm=Math.hypot(gdx,gdz)||1,off=rank===0?.6:3.5;tx+=gdx/gm*off;tz+=gdz/gm*off;}
   return {mode:rank===0?'press':'cover',tx,tz,sprint:true};
  }
 }
 if(rank===pressers||(human&&humanFirst&&rank===1)){
  const gdx=gx-b.x,gdz=-b.z,gm=Math.hypot(gdx,gdz)||1,off=Math.min(5,gm*.4);
  return {mode:'cover',tx:b.x+gdx/gm*off,tz:b.z+gdz/gm*off,sprint:true};
 }
 // 마크: 공과 가까운 순서로 상대 공격수에게 붙는다
 const markers=order.slice(pressers+1).filter(q=>q!==human),threats=s.players.filter(o=>o.team!==team&&o.role!=='GK'&&o.id!==b.owner)
  .sort((a,c)=>(a.x*d)-(c.x*d));
 const i=markers.indexOf(p),o=threats[i];
 if(o){const gdx=gx-o.x,gdz=-o.z,gm=Math.hypot(gdx,gdz)||1,off=1.8;
  let tx=o.x+gdx/gm*off+(b.x-o.x)*.12,tz=o.z+gdz/gm*off+(b.z-o.z)*.12;
  // 너무 멀리 나가지 않도록 공보다 약간 앞까지만
  const cap=b.x*d+6;if(tx*d>cap)tx=cap*d;
  return {mode:'mark',tx,tz,sprint:Math.hypot(tx-p.x,tz-p.z)>3};}
 const [tx,tz]=formationTarget(s,p,false);return {mode:'pos',tx,tz,sprint:false};
}
function formationTarget(s,p,attacking){
 const d=dirOf(p.team),b=s.ball,bu=b.x*d;
 let u=p.hu+bu*(attacking?.55:.45)+(attacking?(p.role==='DF'?4:8):-2);
 u=clamp(u,-HALF_L+3,p.role==='FW'?HALF_L-6:HALF_L-9);
 const z=clamp(p.hz*(attacking?1.3:.9)+b.z*.35,-HALF_W+2,HALF_W-2);
 return [u*d,z];
}
function supportTarget(s,p){
 // 공격: 공격수는 수비 뒤 빈 곳으로, 미드필더는 패스 받을 각도, 수비수는 뒤를 지킨다
 const d=dirOf(p.team),b=s.ball,bu=b.x*d,line=lastLine(s,p.team),side=b.z>0?-1:1;
 let u,z;
 if(p.role==='FW'){u=clamp(Math.max(bu+5,line+.5),-5,HALF_L-5);z=side*clamp(6+Math.sin(s.clock*.7+p.id)*3,3,10);}
 else if(p.role==='MF'){u=clamp(bu-3,-HALF_L+8,HALF_L-9);z=clamp(b.z+side*9,-HALF_W+3,HALF_W-3);}
 else{u=clamp(bu-14,-HALF_L+5,4);z=p.hz*1.4;}
 // 상대가 붙어 있으면 옆으로 빠진다
 const [o,od]=nearestOpp(s,p);if(o&&od<3){z+=Math.sign(p.z-o.z||1)*3;}
 return [u*d,clamp(z,-HALF_W+2,HALF_W-2)];
}
function fieldThink(s,p,human,ev){
 const b=s.ball,own=b.owner!=null?s.players[b.owner]:null,sk=skill(s,p.team);
 if(own===p){carrierThink(s,p,ev);return;}
 if(s.passTarget===p.id&&b.owner==null){p.mode='chase';p.sprint=true;return;}
 const attacking=own?own.team===p.team:(b.lastTeam===p.team&&b.shot===false&&s.passTarget!=null);
 if(own&&own.team===p.team){const [tx,tz]=supportTarget(s,p);p.mode='pos';p.tx=tx;p.tz=tz;p.sprint=Math.hypot(tx-p.x,tz-p.z)>4;return;}
 if(own?.role==='GK'){const [tx,tz]=formationTarget(s,p,false);p.mode='pos';p.tx=tx;p.tz=tz;p.sprint=false;return;}
 const t=defendTarget(s,p,human);
 p.mode=t.mode==='press'?'press':'pos';p.tx=t.tx;p.tz=t.tz;p.sprint=t.sprint;
 if(t.mode==='press'&&own&&p.tcool<=0){
  const dd=Math.hypot(b.x-p.x,b.z-p.z);
  if(dd<2&&rand(s)<sk.lunge)lunge(p,b.x-p.x,b.z-p.z);
 }
 void attacking;
}
function lunge(p,dx,dz){p.face=Math.atan2(dz,dx);p.lunge=.28;p.tcool=.9;}

function keeperStep(s,p,dt,ev){
 const b=s.ball,d=dirOf(p.team),gx=-d*HALF_L,sk=skill(s,p.team);
 if(b.owner===p.id){
  p.vx=p.vz=0;p.hold-=dt;
  if(p.hold<=0){const [m,sc]=bestPass(s,p,false);if(m&&sc>-1)pass(s,p,0,0,ev,m);else pass(s,p,d,0,ev);}
  return null;
 }
 // 기본 위치: 골대 가운데와 공을 잇는 선 위, 공이 가까울수록 앞으로 나와 각도를 좁힌다
 const bdx=b.x-gx,bdz=b.z,bd=Math.hypot(bdx,bdz)||1,out=clamp(bd*.12,.9,2.6);
 let tx=gx+bdx/bd*out,tz=clamp(bdz/bd*out,-GOAL_W/2+.4,GOAL_W/2-.4),speed=RUN*1.05;
 const inBox=(b.x*d)<-HALF_L+BOX_L&&Math.abs(b.z)<BOX_W/2;
 const toward=-b.vx*d;
 if(b.owner==null&&toward>5&&b.lastTeam!==p.team){
  const t=(p.x-b.x)/b.vx;
  if(t>-.05&&t<1.2){const pz=b.z+b.vz*Math.max(0,t);if(Math.abs(pz)<GOAL_W/2+1.5){tx=p.x;tz=clamp(pz,-GOAL_W/2-.3,GOAL_W/2+.3);speed=9.5;if(t<.6&&Math.abs(pz-p.z)>.7&&p.dive<=0)p.dive=.6;}}
 }else if(inBox&&b.owner==null&&Math.hypot(b.vx,b.vz)<9){
  const [c,cd]=chaserOf(s,1-p.team),kd=Math.hypot(b.x-p.x,b.z-p.z);
  if(!c||kd<cd+2){tx=b.x;tz=b.z;speed=SPRINT;}
 }else if(inBox&&b.owner!=null&&s.players[b.owner].team!==p.team&&Math.hypot(b.x-p.x,b.z-p.z)<5.5){tx=b.x;tz=b.z;speed=SPRINT*.9;}
 // 막기: 빠른 공이 손에 닿으면 한 번만 판정
 if(b.owner==null&&!b.saveTried&&b.lastTeam!==p.team){
  const reach=p.dive>0?1.9:1.25,sp=Math.hypot(b.vx,b.vy,b.vz),hd=Math.hypot(b.x-p.x,b.z-p.z);
  if(hd<reach&&b.y<2.7&&sp>7){
   b.saveTried=true;s.lastSave=p.team;
   // 몸 정면으로 온 공은 거의 다 막고, 멀리 뻗어야 하는 공, 빠른 공, 높은 공은 어렵다
   const central=hd<.7?.25:0,high=b.y>1.9?.15:0;
   const chance=clamp(sk.keeper+central-high-(sp-18)*.012-(hd>1.25?.12:0),.1,.97);
   if(rand(s)<chance){
    if(sp<20||central){b.owner=p.id;p.hold=1;b.lastTeam=p.team;ev.push('save');ev.push('catch');}
    else{b.vx=Math.abs(b.vx)*.35*d;b.vz=(rand(s)-.5)*12;b.vy=4;b.lastTeam=p.team;b.shot=false;p.cool=.4;ev.push('save');}
   }
  }
 }
 if(p.dive>0)speed=11;
 p.mode='keeper';p.tx=clamp(tx,Math.min(gx+d*.2,gx+d*(BOX_L-1)),Math.max(gx+d*.2,gx+d*(BOX_L-1)));p.tz=clamp(tz,-BOX_W/2,BOX_W/2);
 return speed;
}

// ---------- 한 프레임 ----------
// input: {x,z,sprint,shoot(누르고 있는지),pass(누른 순간)} 또는 null(전부 AI)
export function step(s,input,dt){
 const ev=[];
 if(s.over)return ev;
 s.clock+=dt;
 if(s.pause>0){
  s.pause-=dt;
  if(s.phase==='goal'){ballPhysics(s,dt,ev);for(const p of s.players){p.vx*=.9;p.vz*=.9;}}
  if(s.pause<=0){
   if(s.phase==='goal'){kickoff(s,1-s.lastGoal.team);ev.push('whistle');}
   else{s.phase='play';s.message='';if(s.time<=0)endMatch(s,ev);}
  }
  return ev;
 }
 s.time-=dt;
 if(s.time<=0){s.time=0;endMatch(s,ev);return ev;}
 const b=s.ball,P=s.players;
 if(s.passTimer>0&&(s.passTimer-=dt)<=0)s.passTarget=null;
 const human=input?P[s.human]:null;

 // 사람 입력
 if(human){
  const shootEdge=input.shoot&&!s.prevShoot,release_=!input.shoot&&s.prevShoot;s.prevShoot=!!input.shoot;
  if(b.owner===human.id){
   if(shootEdge){s.charging=true;s.charge=0;}
   if(s.charging&&input.shoot)s.charge=Math.min(1,s.charge+dt/.9);
   if(s.charging&&release_){const aim=input.z>.3?GOAL_W/2-.9:input.z<-.3?-(GOAL_W/2-.9):(rand(s)-.5)*2;shoot(s,human,s.charge,aim,ev);}
   else if(input.pass)pass(s,human,input.x,input.z,ev);
  }else{
   s.charging=false;s.charge=0;
   if(shootEdge&&human.tcool<=0&&human.stun<=0){const m=Math.hypot(input.x,input.z);lunge(human,m?input.x:Math.cos(human.face),m?input.z:Math.sin(human.face));ev.push('lunge');}
   if(input.pass&&b.owner!==human.id){
    let best=null,bd=1e9;
    for(const p of P)if(p.team===0&&p.role!=='GK'&&p!==human){const d=Math.hypot(p.x-b.x,p.z-b.z);if(d<bd){bd=d;best=p;}}
    if(best){s.human=best.id;ev.push('switch');}
   }
  }
 }else s.prevShoot=false;
 const me=input?P[s.human]:null;

 // AI 판단
 for(const p of P){
  if(p===me||p.role==='GK'||p.stun>0)continue;
  if((p.think-=dt)<=0){p.think=skill(s,p.team).think*(.8+rand(s)*.4);fieldThink(s,p,input?P[s.human]:null,ev);if(b.owner==null&&p.mode==='carry')p.mode='pos';}
 }

 // 이동
 for(const p of P){
  p.cool=Math.max(0,p.cool-dt);p.tcool=Math.max(0,p.tcool-dt);p.dive=Math.max(0,p.dive-dt);
  if(p.stun>0){p.stun-=dt;p.vx*=1-Math.min(1,6*dt);p.vz*=1-Math.min(1,6*dt);}
  else if(p.lunge>0){p.lunge-=dt;p.vx=Math.cos(p.face)*LUNGE;p.vz=Math.sin(p.face)*LUNGE;}
  else if(p.dodge>0){p.dodge-=dt;const f=Math.cos(p.face)*3,g=Math.sin(p.face)*3;p.vx=p.dodgeX*8+f;p.vz=p.dodgeZ*8+g;}
  else{
   let dvx=0,dvz=0;const has=b.owner===p.id,sk=skill(s,p.team);
   if(p===me){
    // 달리기는 체력을 쓴다. 공을 몰고 전력 질주하면 조금 느려진다
    const m=Math.min(1,Math.hypot(input.x,input.z)),dash=!!input.sprint&&!s.tired&&m>.05;
    s.stamina=dash?Math.max(0,s.stamina-dt*.2):Math.min(1,s.stamina+dt*(m>.05?.18:.32));
    if(s.stamina<=0)s.tired=true;else if(s.tired&&s.stamina>.35)s.tired=false;
    const sp=(dash?SPRINT:RUN)*(has?(dash?.86:DRIBBLE):1);
    if(m>.05){const k=sp*m/Math.hypot(input.x,input.z);dvx=input.x*k;dvz=input.z*k;}
    else if(s.passTarget===p.id&&b.owner==null){const dx=b.x-p.x,dz=b.z-p.z,dd=Math.hypot(dx,dz);if(dd>.3){dvx=dx/dd*RUN;dvz=dz/dd*RUN;}} // 패스 받을 때는 저절로 공 쪽으로
   }else{
    let speed=(p.sprint?SPRINT:RUN)*(has?Math.max(sk.speed,sk.carry??0):sk.speed)*(has?(p.sprint?.86:DRIBBLE):1),tx=p.tx,tz=p.tz; // 쉬운 팀도 공을 몰 때는 너무 느리지 않게
    if(p.role==='GK'){const ks=keeperStep(s,p,dt,ev);if(ks==null){speed=0;}else speed=ks;tx=p.tx;tz=p.tz;}
    else if(p.mode==='chase'||(p.mode==='carry'&&!has)){tx=b.x+b.vx*.3;tz=b.z+b.vz*.3;}
    else if(p.mode==='press'){ // 공을 가진 상대가 갈 곳을 예측해 골대 쪽에서 막아선다
     const it=intercept(s,p,speed);tx=it.x;tz=it.z;
     if(b.owner!=null&&Math.hypot(b.x-p.x,b.z-p.z)>1.2){const gx=ownGoalX(p.team),gdx=gx-tx,gdz=-tz,gm=Math.hypot(gdx,gdz)||1;tx+=gdx/gm*.6;tz+=gdz/gm*.6;}
    }
    const dx=tx-p.x,dz=tz-p.z,dd=Math.hypot(dx,dz);
    if(dd>.25&&speed>0){const k=Math.min(speed,dd*4)/dd;dvx=dx*k;dvz=dz*k;}
   }
   const a=Math.min(1,(p===me?12:9)*dt);p.vx+=(dvx-p.vx)*a;p.vz+=(dvz-p.vz)*a;
  }
  p.x+=p.vx*dt;p.z+=p.vz*dt;
  const sp=Math.hypot(p.vx,p.vz);
  if(sp>.6&&p.lunge<=0&&p.stun<=0){
   const want=Math.atan2(p.vz,p.vx);let df=((want-p.face+Math.PI*3)%(Math.PI*2))-Math.PI;
   const rate=(b.owner===p.id?9:14)*dt;p.face+=clamp(df,-rate,rate);
  }
  p.run+=sp*dt;
  p.x=clamp(p.x,-HALF_L-1.5,HALF_L+1.5);p.z=clamp(p.z,-HALF_W-1.5,HALF_W+1.5);
 }
 // 선수끼리 겹치지 않게
 for(let i=0;i<P.length;i++)for(let j=i+1;j<P.length;j++){
  const a=P[i],c=P[j],dx=c.x-a.x,dz=c.z-a.z,dd=Math.hypot(dx,dz),min=PLAYER_R*2;
  if(dd<min&&dd>1e-6){const push=(min-dd)/2/dd;a.x-=dx*push;a.z-=dz*push;c.x+=dx*push;c.z+=dz*push;}
 }

 // AI는 달려드는 태클을 옆으로 피할 수 있다
 if(b.owner!=null){
  const o=P[b.owner];
  if(o!==me&&o.role!=='GK'&&o.stun<=0)for(const p of P){
   if(p.team===o.team||p.lunge<=0||p.dodgeRolled)continue;
   if(Math.hypot(p.x-o.x,p.z-o.z)>3.2)continue;
   p.dodgeRolled=true;
   if(rand(s)<skill(s,o.team).dodge){
    const side=(Math.cos(p.face)*(o.z-p.z)-Math.sin(p.face)*(o.x-p.x))>=0?1:-1;
    o.dodge=.3;o.dodgeX=-Math.sin(p.face)*side;o.dodgeZ=Math.cos(p.face)*side;ev.push('dodge');
   }
  }
 }
 for(const p of P)if(p.lunge<=0)p.dodgeRolled=false;
 // 바짝 붙은 수비는 조금씩 공을 빼앗을 수 있다 (골키퍼가 잡은 공 제외)
 if(b.owner!=null&&P[b.owner].role!=='GK'){
  const o=P[b.owner];
  for(const p of P){
   if(p.team===o.team||p.stun>0||p.lunge>0)continue;
   if(Math.hypot(b.x-p.x,b.z-p.z)>.95)continue;
   const rate=(p===me?.9:skill(s,p.team).steal)*(p.role==='GK'?2:1)*(o===me&&input.sprint&&!s.tired?1.3:1);
   if(rand(s)<rate*dt){
    Object.assign(b,{owner:p.id,lastTeam:p.team,lastKicker:p.id,shot:false});o.stun=.35;
    if(p.role==='GK')p.hold=.9;if(o===me)s.charging=false;
    if(p.team===0&&input&&p.role!=='GK')s.human=p.id;
    s.passTarget=null;ev.push('steal');break;
   }
  }
 }
 // 태클 (뒤에서 하는 태클은 잘 안 된다)
 for(const p of P){
  if(p.lunge<=0||b.owner==null)continue;
  const o=P[b.owner];
  if(o.team===p.team||o.role==='GK')continue;
  if(Math.hypot(b.x-p.x,b.z-p.z)<1.15||Math.hypot(o.x-p.x,o.z-p.z)<1.1){
   const behind=(Math.cos(o.face)*(p.x-o.x)+Math.sin(o.face)*(p.z-o.z))<-.3;
   const chance=(p.team===0?DIFFICULTY[s.difficulty].defend:o.team===0?DIFFICULTY[s.difficulty].tackle:.5)*(behind?.6:1);
   p.lunge=0;
   if(rand(s)<chance){
    b.owner=null;b.vx=Math.cos(p.face)*4+o.vx*.2;b.vz=Math.sin(p.face)*4+o.vz*.2;b.vy=1.5;b.lastTeam=p.team;b.lastKicker=p.id;b.shot=false;
    o.stun=.7;p.cool=0;if(o.id===s.human)s.charging=false;ev.push('tackle');
   }else{p.stun=.45;ev.push('miss');}
  }
 }

 // 공
 if(b.owner!=null){attach(s);s.poss[P[b.owner].team]+=dt;}
 else{
  ballPhysics(s,dt,ev);
  let taker=null,td=1e9;
  const sp=Math.hypot(b.vx,b.vy,b.vz);
  for(const p of P){
   if(p.stun>0||p.cool>0)continue;
   const gk=p.role==='GK',inBox=(p.x*dirOf(p.team))<-HALF_L+BOX_L&&Math.abs(p.z)<BOX_W/2;
   if(gk&&b.shot&&b.lastTeam!==p.team&&sp>7)continue; // 빠른 슛은 골키퍼 막기 판정으로
   // 빠르게 굴러가는 공은 발 가까이 와야 멈출 수 있다
   const r=gk&&inBox?1.25:.95-clamp((sp-9)*.035,0,.45),h=gk&&inBox?2.4:1.15,dd=Math.hypot(b.x-p.x,b.z-p.z);
   if(dd<r&&b.y<h&&dd<td){td=dd;taker=p;}
  }
  if(taker){
   if(sp>22&&taker.role!=='GK'){ // 너무 빠른 공은 몸에 맞고 튕긴다
    const dx=b.x-taker.x,dz=b.z-taker.z,dd=Math.hypot(dx,dz)||1;b.vx=dx/dd*sp*.3;b.vz=dz/dd*sp*.3;b.vy=2;b.lastTeam=taker.team;b.lastKicker=taker.id;b.shot=false;taker.cool=.3;ev.push('block');
   }else{
    b.owner=taker.id;b.lastTeam=taker.team;b.shot=false;b.saveTried=false;
    if(taker.role==='GK'&&taker.hold<=0)taker.hold=.9;
    if(s.passTarget!=null)s.passTarget=null;
    if(taker.team===0&&taker.role!=='GK'&&input){if(s.human!==taker.id)ev.push('switch');s.human=taker.id;}
    ev.push('control');
   }
  }
 }
 checkLines(s,ev);
 return ev;
}

function endMatch(s,ev){s.over=true;s.phase='end';s.message='경기 종료';s.charging=false;ev.push('end');}
export const result=s=>s.score[0]>s.score[1]?'win':s.score[0]<s.score[1]?'loss':'draw';
export function possession(s){const t=s.poss[0]+s.poss[1];return t?Math.round(s.poss[0]/t*100):50;}
export function formatClock(sec){sec=Math.max(0,Math.ceil(sec));return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;}

// ---------- 기록 ----------
export function newRecords(){return {version:1,played:0,wins:0,draws:0,losses:0,goalsFor:0,goalsAgainst:0,bestWin:0,sound:true,difficulty:'normal'};}
export function restoreRecords(raw){
 const r=newRecords();
 try{const o=typeof raw==='string'?JSON.parse(raw):raw;
  if(o&&o.version===1){for(const k of ['played','wins','draws','losses','goalsFor','goalsAgainst','bestWin'])if(Number.isFinite(o[k])&&o[k]>=0)r[k]=Math.floor(o[k]);
   if(typeof o.sound==='boolean')r.sound=o.sound;if(DIFFICULTY[o.difficulty])r.difficulty=o.difficulty;}}catch{}
 return r;
}
export function applyResult(r,s){
 const res=result(s);r.played++;r[res==='win'?'wins':res==='loss'?'losses':'draws']++;
 r.goalsFor+=s.score[0];r.goalsAgainst+=s.score[1];
 const margin=s.score[0]-s.score[1],newBest=margin>0&&margin>r.bestWin;if(newBest)r.bestWin=margin;
 return {res,newBest};
}
