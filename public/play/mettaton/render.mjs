import { ARENA, getPattern, roundDuration, clamp, strikePosition } from './core.mjs';
const C = { pink:'#ff429d', light:'#ff99d0', cyan:'#77eaf1', yellow:'#ffe58b', white:'#fff2fc', blue:'#61dffa', orange:'#ffaf63' };
const TAU = Math.PI * 2;
function rect(c,x,y,w,h,color) { c.fillStyle=color;c.fillRect(x,y,w,h); }
function text(c,value,x,y,size=12,color='#baa0c8',align='left',weight='400') { c.fillStyle=color;c.font=`${weight} ${size}px "Courier New", "Apple SD Gothic Neo", "Malgun Gothic", monospace`;c.textAlign=align;c.fillText(value,x,y); }
function line(c,x,y,x2,y2,color,width=1) { c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.strokeStyle=color;c.lineWidth=width;c.stroke(); }
function polygon(c,points,color) { c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill(); }
function glow(c,color,blur,fn) { c.save();c.shadowColor=color;c.shadowBlur=blur;fn();c.restore(); }
export function heart(c,x,y,size,color) {
  c.save();c.translate(Math.round(x),Math.round(y));c.scale(size/16,size/16);c.fillStyle=color;
  c.beginPath();c.moveTo(0,7);c.lineTo(-7,0);c.lineTo(-7,-4);c.lineTo(-4,-7);c.lineTo(-1,-7);c.lineTo(0,-4);c.lineTo(1,-7);c.lineTo(4,-7);c.lineTo(7,-4);c.lineTo(7,0);c.closePath();c.fill();c.restore();
}
function star(c,x,y,r,color,rotation=0) {
  c.save();c.translate(x,y);c.rotate(rotation);c.beginPath();
  for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,rr=i%2?r*.43:r;if(i)c.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);else c.moveTo(Math.cos(a)*rr,Math.sin(a)*rr);}
  c.closePath();c.fillStyle=color;c.fill();c.restore();
}
function sparkle(c,x,y,r,color) { polygon(c,[[x,y-r],[x+r*.24,y-r*.24],[x+r,y],[x+r*.24,y+r*.24],[x,y+r],[x-r*.24,y+r*.24],[x-r,y],[x-r*.24,y-r*.24]],color); }
function segment(c,x1,y1,x2,y2,width,color) { c.save();c.translate(x1,y1);c.rotate(Math.atan2(y2-y1,x2-x1));rect(c,0,-width/2,Math.hypot(x2-x1,y2-y1),width,color);rect(c,2,-width/2,Math.hypot(x2-x1,y2-y1)-4,3,'#ffffff28');c.restore(); }
function joint(c,x,y,r) { rect(c,x-r,y-r,r*2,r*2,'#272137');rect(c,x-r+2,y-r+2,r*2-4,r*2-4,'#a19aaa'); }
// An original articulated pixel-vector interpretation of Mettaton EX.
export function mettaton(c,x,y,scale,t,phase=1,pose='dance') {
  c.save();c.translate(x,y);c.scale(scale,scale);
  const beat=Math.sin(t*3.5),sway=Math.sin(t*1.75)*3,attack=pose==='attack';
  c.translate(sway,beat*2);
  // Long metallic legs, segmented knees and angular heels.
  const leftKnee={x:-26+Math.sin(t*2)*6,y:92},rightKnee={x:31+Math.cos(t*2)*6,y:91};
  segment(c,-17,48,leftKnee.x,leftKnee.y,16,'#484052');
  segment(c,17,48,rightKnee.x,rightKnee.y,16,'#b8adbd');
  joint(c,leftKnee.x,leftKnee.y,8);joint(c,rightKnee.x,rightKnee.y,8);
  const lf={x:-48+beat*9,y:145},rf={x:49-beat*7,y:143};
  segment(c,leftKnee.x,leftKnee.y,lf.x,lf.y,13,'#60546a');
  segment(c,rightKnee.x,rightKnee.y,rf.x,rf.y,13,'#d0c5d5');
  for(let i=1;i<5;i++){
    const q=i/5;
    line(c,leftKnee.x+(lf.x-leftKnee.x)*q-5,leftKnee.y+(lf.y-leftKnee.y)*q, leftKnee.x+(lf.x-leftKnee.x)*q+5,leftKnee.y+(lf.y-leftKnee.y)*q+2,'#252033',2);
    line(c,rightKnee.x+(rf.x-rightKnee.x)*q-5,rightKnee.y+(rf.y-rightKnee.y)*q,rightKnee.x+(rf.x-rightKnee.x)*q+5,rightKnee.y+(rf.y-rightKnee.y)*q-2,'#625466',2);
  }
  polygon(c,[[lf.x-8,139],[lf.x+8,143],[lf.x+3,158],[lf.x-24,158],[lf.x-24,151]],'#ed2d92');rect(c,lf.x+3,155,5,11,'#d92a86');
  polygon(c,[[rf.x-7,137],[rf.x+8,141],[rf.x+25,152],[rf.x+25,158],[rf.x-7,158]],'#ff6bbb');rect(c,rf.x-7,154,5,11,'#bc1b78');
  rect(c,lf.x-23,151,22,3,'#ff87c6');rect(c,rf.x+4,151,20,3,'#ffc0df');
  // Arms have independent, rhythmic choreography.
  const elbowL={x:-67-beat*6,y:attack?-28:-7+beat*12},handL={x:-92-beat*5,y:attack?-60:-35+beat*22};
  const elbowR={x:68+beat*5,y:-13-beat*10},handR={x:87+beat*8,y:-56-beat*15};
  segment(c,-37,-19,elbowL.x,elbowL.y,12,'#817488');joint(c,elbowL.x,elbowL.y,7);segment(c,elbowL.x,elbowL.y,handL.x,handL.y,10,'#c9bdce');
  segment(c,37,-19,elbowR.x,elbowR.y,12,'#ded2e1');joint(c,elbowR.x,elbowR.y,7);segment(c,elbowR.x,elbowR.y,handR.x,handR.y,10,'#ebe1eb');
  for(const [hand,side] of [[handL,-1],[handR,1]]) {
    rect(c,hand.x-7,hand.y-9,14,15,'#f7edf5');rect(c,hand.x-6,hand.y-15,4,10,'#f7edf5');rect(c,hand.x+1,hand.y-18,4,13,'#f7edf5');rect(c,hand.x+6*side,hand.y-3,7*side,4,'#f7edf5');
  }
  // High shoulders, magenta chest plate, speaker waist.
  polygon(c,[[-47,-34],[-29,-38],[-17,-20],[-30,-8],[-49,-14]],'#e63b9b');
  polygon(c,[[29,-38],[46,-34],[49,-14],[30,-8],[17,-20]],'#ff80c6');
  rect(c,-46,-33,15,5,'#ff9ccc');rect(c,31,-33,13,5,'#ffd1e9');
  polygon(c,[[-29,-31],[28,-31],[32,5],[22,35],[-23,35],[-32,5]],'#ef42a0');
  polygon(c,[[-29,-30],[-20,-30],[-20,28],[-25,15]],'#9c205e');
  polygon(c,[[21,-28],[28,-28],[29,5],[21,27]],'#ff99d0');
  rect(c,-21,-21,42,38,'#4a163a');rect(c,-17,-18,34,31,'#241324');
  glow(c,phase===3?C.yellow:C.pink,12,()=>heart(c,0,-1,25+beat*2,phase===3?C.yellow:'#ff74b9'));
  rect(c,-22,22,44,17,'#d3c4d6');rect(c,-20,24,40,3,'#fff2fc');
  for(let i=0;i<4;i++)rect(c,-18,29+i*3,36,1,'#615168');
  polygon(c,[[-23,39],[23,39],[19,56],[-18,56]],'#271a32');rect(c,-17,42,34,5,'#f958ad');
  // Neck, face, signature hair covering one eye, and a stage microphone.
  rect(c,-10,-48,20,17,'#a89cac');rect(c,-7,-47,14,5,'#f0e5ee');
  polygon(c,[[-25,-88],[22,-88],[28,-76],[25,-52],[9,-42],[-12,-45],[-26,-61]],'#f6edf5');
  polygon(c,[[18,-84],[28,-76],[25,-52],[9,-42],[8,-50],[19,-58]],'#b0a0ba');
  rect(c,2,-69,15,3,'#29152a');rect(c,11,-67,4,6,'#ff308f');rect(c,8,-67,3,2,'#ffffff');
  polygon(c,[[0,-53],[14,-54],[8,-48],[3,-49]],'#7d2953');line(c,3,-52,11,-52,'#fff5fc',2);
  polygon(c,[[-34,-75],[-28,-96],[-14,-104],[12,-102],[29,-92],[29,-78],[17,-84],[6,-80],[-1,-66],[-17,-50],[-27,-56],[-31,-65]],'#111019');
  polygon(c,[[-28,-88],[-16,-100],[10,-99],[24,-91],[8,-93],[-3,-86],[-13,-72],[-26,-61],[-23,-76]],'#302038');
  polygon(c,[[-17,-94],[-5,-97],[17,-93],[0,-91],[-14,-80]],'#694264');
  rect(c,-30,-70,3,10,'#ff60ad');rect(c,-30,-57,4,5,'#ffe58b');
  c.restore();
}
// NEO's flight frame: layered energy wings, heavy shoulder armour and an arm cannon.
export function mettatonNeo(c,x,y,scale,t,phase=1) {
  c.save();c.translate(x,y+Math.sin(t*2.8)*4);c.scale(scale,scale);
  const beat=Math.sin(t*3),energy=phase===3?C.yellow:C.cyan;
  for(const side of [-1,1]) {
    c.save();c.scale(side,1);
    const spread=Math.sin(t*1.8)*7;
    polygon(c,[[22,-22],[51,-60],[112,-122-spread],[179,-156-spread],[157,-90],[106,-56],[154,-69],[126,-17],[71,13],[40,13]],'#254b69');
    polygon(c,[[44,-27],[110,-116-spread],[168,-144-spread],[139,-93],[92,-55]],'#72eeec');
    polygon(c,[[57,-17],[124,-77],[145,-82],[113,-36],[75,-6]],'#a183ee');
    polygon(c,[[49,-9],[99,-36],[120,-36],[96,-8],[61,15]],'#fb8acf');
    line(c,61,-39,158,-130-spread,'#d6fffb',3);
    for(let i=0;i<4;i++)rect(c,89+i*15,-71-i*16-spread,6,6,energy);
    c.restore();
  }
  // Mechanical legs with reinforced boots.
  segment(c,-20,45,-35,105,22,'#816392');segment(c,20,45,40,103,22,'#d3bee4');
  joint(c,-35,105,10);joint(c,40,103,10);
  segment(c,-35,105,-47,149,17,'#7780aa');segment(c,40,103,49,149,17,'#b2c8df');
  polygon(c,[[-58,136],[-33,140],[-36,161],[-76,161],[-76,150]],'#b859bf');
  polygon(c,[[36,138],[59,136],[77,151],[77,161],[38,161]],'#d882e0');
  rect(c,-72,151,35,4,energy);rect(c,40,151,32,4,energy);
  // Broad chest and pointed pauldrons.
  polygon(c,[[-61,-40],[-35,-59],[-18,-26],[-42,-5],[-67,-17]],'#8060a0');
  polygon(c,[[35,-59],[64,-39],[67,-17],[43,-5],[18,-26]],'#d995e0');
  polygon(c,[[-46,-30],[38,-30],[45,13],[24,50],[-25,50],[-44,9]],'#be66be');
  polygon(c,[[-46,-30],[-27,-26],[-27,34],[-40,14]],'#6e3c87');
  polygon(c,[[27,-25],[38,-30],[45,13],[25,42]],'#f1abed');
  rect(c,-26,-19,52,44,'#26364b');rect(c,-20,-14,40,33,'#101c35');
  glow(c,energy,18,()=>heart(c,0,3,30+beat*2,energy));
  rect(c,-22,33,44,8,'#d5dcf3');rect(c,-17,44,34,7,'#584779');
  // Left gauntlet and right, unmistakably oversized arm cannon.
  segment(c,-49,-15,-73,21,20,'#ada3cf');segment(c,-73,21,-84,48,16,'#d9d7ec');
  polygon(c,[[-94,39],[-75,39],[-69,61],[-87,66],[-99,56]],'#aa72b9');
  rect(c,-96,44,5,12,energy);
  segment(c,48,-15,72,9,23,'#e4c8e8');
  c.save();c.translate(78,14);c.rotate(.4+beat*.06);
  rect(c,-13,-22,52,42,'#53668e');rect(c,-9,-17,45,31,'#b6c7e9');
  rect(c,6,-21,9,39,'#8a60b4');rect(c,29,-25,17,48,'#9acddf');
  rect(c,38,-18,11,32,'#193b54');glow(c,energy,14,()=>rect(c,42,-12,8,20,energy));
  rect(c,-8,-13,30,4,'#f1f2ff');c.restore();
  // EX face beneath NEO's high collar and swept hair.
  rect(c,-10,-48,20,20,'#d5c6de');
  polygon(c,[[-25,-90],[18,-92],[28,-78],[24,-53],[9,-44],[-15,-49],[-27,-65]],'#f4eaf8');
  polygon(c,[[17,-86],[28,-78],[24,-53],[9,-44],[11,-54],[20,-61]],'#a897c4');
  rect(c,3,-70,16,3,'#2c1b3b');rect(c,12,-67,4,7,energy);
  polygon(c,[[0,-55],[15,-56],[9,-49],[3,-50]],'#772666');
  polygon(c,[[-35,-78],[-30,-100],[-11,-111],[16,-103],[33,-91],[24,-80],[9,-85],[-3,-63],[-23,-51],[-31,-64]],'#171629');
  polygon(c,[[-27,-94],[-10,-107],[14,-100],[24,-91],[6,-95],[-9,-83],[-21,-64],[-26,-69]],'#583367');
  rect(c,-30,-69,4,14,energy);sparkle(c,0,3,6, '#ffffff');
  c.restore();
}

export class Renderer {
  constructor(canvas) {
    this.canvas=canvas;this.c=canvas.getContext('2d',{alpha:false});
    this.reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.mobile=window.matchMedia('(max-width: 650px)').matches;
    this.resize=()=>{this.mobile=window.matchMedia('(max-width: 650px)').matches;const dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=1120*dpr;canvas.height=680*dpr;this.dpr=dpr;};
    this.resize();window.addEventListener('resize',this.resize);
  }
  draw(s) {
    const c=this.c,t=this.reduced?0:s.time,lobby=s.mode==='lobby';
    c.setTransform(this.dpr,0,0,this.dpr,0,0);c.imageSmoothingEnabled=false;
    rect(c,0,0,1120,680,'#0b0711');
    c.save();
    if(s.shake>0&&!this.reduced)c.translate(Math.sin(t*95)*s.shake*15,Math.cos(t*83)*s.shake*10);
    this.background(c,t,lobby,s.phase,s.boss === 'neo');
    if(lobby){
      const bx=this.mobile?655:829,by=this.mobile?299:263,scale=this.mobile?.84:1.38;
      this.halo(c,bx,by-15,this.mobile?115:172,t);
      this.platform(c,bx,by+scale*164,this.mobile?110:190,t);
      if(s.boss==='neo')mettatonNeo(c,bx,by,scale*.83,t);else mettaton(c,bx,by,scale,t);
      for(let i=0;i<10;i++){const x=bx+Math.sin(i*7.1)*160,y=by-140+(i*43)%370;sparkle(c,x,y,3+Math.sin(t*2+i)*2,i%3===0?C.yellow:'#b3458a');}
      text(c,'MTT',1072,57,13,'#5b3452','right','700');text(c,'REC',60,44,9,'#a67395');rect(c,45,37,5,5,C.pink);
      text(c,'SINCE 2015',1074,79,7,'#72536e','right');
    } else {
      this.platform(c,560,325,150,t);
      this.halo(c,560,175,121,t);
      if(s.boss==='neo')mettatonNeo(c,560,190,.80,t,s.phase);else mettaton(c,560,185,.87,t,s.phase,s.mode==='fight'?'attack':'dance');
      this.sideDecor(c,s,t);
      this.hud(c,s);
      this.arena(c,s,t);
      if(s.mode==='dodge')this.projectiles(c,s,t);
      if(s.mode==='fight')this.fight(c,s);
      if(s.mode==='menu'||s.mode==='dialogue')this.dialogue(c,s);
    }
    for(const p of s.particles){c.globalAlpha=clamp(p.life*1.6,0,1);rect(c,p.x,p.y,p.size,p.size,p.color);}c.globalAlpha=1;
    for(const f of s.floats){c.globalAlpha=clamp(f.life,0,1);text(c,f.text,f.x,f.y,16,f.color,'center','700');}c.globalAlpha=1;
    if(s.flash>0&&!this.reduced)rect(c,0,0,1120,680,`rgba(255,120,190,${s.flash*.65})`);
    c.restore();
    // Soft lens vignette.
    const v=c.createRadialGradient(560,290,200,560,340,680);v.addColorStop(0,'#08040a00');v.addColorStop(1,'#08040a85');c.fillStyle=v;c.fillRect(0,0,1120,680);
  }
  background(c,t,lobby,phase,neo=false) {
    const grad=c.createRadialGradient(lobby?810:560,230,20,650,250,610);grad.addColorStop(0,neo?'#103a45':phase===3?'#3a172d':'#2a1032');grad.addColorStop(.45,'#160b20');grad.addColorStop(1,'#0a0710');c.fillStyle=grad;c.fillRect(0,0,1120,680);
    // Curtain folds.
    for(let i=0;i<28;i++){const x=i*43;const g=c.createLinearGradient(x,0,x+43,0);g.addColorStop(0,'#00000025');g.addColorStop(.5,'#d5549c08');g.addColorStop(1,'#00000030');c.fillStyle=g;c.fillRect(x,0,43,430);}
    // Art deco stage arch and inset framing.
    c.strokeStyle='#77305036';c.lineWidth=1;c.beginPath();c.moveTo(23,569);c.lineTo(23,87);c.lineTo(99,18);c.lineTo(1021,18);c.lineTo(1097,87);c.lineTo(1097,569);c.stroke();
    line(c,37,565,37,96,'#8a3a5924');line(c,1083,565,1083,96,'#8a3a5924');
    // Slow moving volumetric spotlights.
    c.save();c.globalCompositeOperation='screen';
    for(let i=0;i<5;i++){
      const x=110+i*235,drift=Math.sin(t*.38+i*1.7)*115;
      const g=c.createLinearGradient(x,0,x+drift,530);g.addColorStop(0,neo?'#62f5e52b':'#ff90cd26');g.addColorStop(.5,i%2?'#bb60ff09':'#ff459911');g.addColorStop(1,'#ff409900');
      polygon(c,[[x-4,0],[x+4,0],[x+drift+150,570],[x+drift-140,570]],g);
      rect(c,x-13,0,26,8,'#996080');rect(c,x-7,8,14,3,'#ffd1ea');
    }c.restore();
    // Pinprick stars, kept clear of the title.
    for(let i=0;i<58;i++){
      const x=(i*137.31+37)%1080+20,y=(i*73.17)%470+32,alpha=.16+(Math.sin(t*.8+i*4)+1)*.16;
      c.globalAlpha=alpha;rect(c,x,y,i%8===0?2:1,i%8===0?2:1,'#ffc9e8');
    }c.globalAlpha=1;
    // Perspective runway.
    const floor=lobby?496:338;
    const fg=c.createLinearGradient(0,floor,0,680);fg.addColorStop(0,'#51163428');fg.addColorStop(1,'#180b20');c.fillStyle=fg;c.fillRect(0,floor,1120,680-floor);
    line(c,0,floor,1120,floor,'#9d3a7133');
    for(let i=-8;i<=8;i++)line(c,560+i*30,floor,560+i*135,680,'#a4407319');
    for(let i=0;i<8;i++){const y=floor+(680-floor)*Math.pow(i/8,2);line(c,0,y,1120,y,'#ab407a17');}
    for(let side=0;side<2;side++)for(let i=0;i<13;i++){
      const x=side?1070:50,y=140+i*26;
      rect(c,x,y,3,14,i%3===Math.floor(t*2)%3?'#ef70b477':'#58204455');
    }
  }
  halo(c,x,y,r,t) {
    c.save();c.translate(x,y);c.rotate(-.15);c.strokeStyle='#ec5cab28';c.lineWidth=1;
    c.beginPath();c.arc(0,0,r,0,TAU);c.stroke();c.beginPath();c.arc(0,0,r+11,.15,5.8);c.stroke();
    c.rotate(t*.035);for(let i=0;i<32;i++){const a=i*TAU/32;line(c,Math.cos(a)*(r+17),Math.sin(a)*(r+17),Math.cos(a)*(r+22),Math.sin(a)*(r+22),i%4?'#8c3c662b':'#ff83bd55',i%4?1:2);}
    c.restore();
  }
  platform(c,x,y,r,t) {
    const g=c.createRadialGradient(x,y,4,x,y,r);g.addColorStop(0,'#ff359f30');g.addColorStop(1,'#ff359f00');c.save();c.translate(x,y);c.scale(1,.22);c.fillStyle=g;
    // Gradient coordinates need to share the local platform coordinates.
    const local=c.createRadialGradient(0,0,0,0,0,r);local.addColorStop(0,'#ff42a548');local.addColorStop(1,'#ff429d00');c.fillStyle=local;c.beginPath();c.arc(0,0,r,0,TAU);c.fill();
    c.strokeStyle='#db39876b';c.lineWidth=2;c.beginPath();c.ellipse(0,0,r*.72,r*.72,0,0,TAU);c.stroke();c.strokeStyle='#ff70b728';c.beginPath();c.arc(0,0,r*.88,0,TAU);c.stroke();c.restore();
    for(let i=0;i<7;i++){const xx=x+(i-3)*r*.28;rect(c,xx-3,y+25+Math.abs(i-3)*2,6,3,Math.sin(t*3+i)>0?'#ff88c1':'#5c2347');}
  }
  sideDecor(c,s,t) {
    text(c,'METTATON',190,168,26,'#805174','center','700');text(c,s.boss==='neo'?'N E O':'E X',190,196,17,'#c071a4','center');text(c,'THE UNDERGROUND’S',190,225,8,'#634763','center');text(c,'BIGGEST STAR',190,240,8,'#634763','center');
    text(c,'ON AIR',930,154,10,C.pink,'center');
    // Audio spectrum in a tiny live-broadcast panel.
    for(let i=0;i<19;i++){const h=8+(Math.sin(t*4+i*1.3)+1)*22;rect(c,867+i*7,218-h,3,h,`rgba(255,96,178,${.2+(i%4)*.1})`);}
    text(c,'MTT EXCLUSIVE',930,243,8,'#8b557b','center');
    text(c,'LIVE RATINGS',185,435,9,'#986187','center');
    glow(c,C.pink,12,()=>text(c,s.ratings.toLocaleString('en-US'),185,473,36,'#ffa8d7','center','700'));
    text(c,`/ ${s.ratingGoal.toLocaleString()}`,185,492,10,'#79516f','center');
    rect(c,113,511,144,3,'#3f1e39');rect(c,113,511,144*clamp(s.ratings/s.ratingGoal,0,1),3,C.pink);
    text(c,s.ratings>=s.ratingGoal?'♥  자비를 선택하세요':'관객의 마음을 사로잡으세요',185,540,9,s.ratings>=s.ratingGoal?C.yellow:'#9c7295','center');
    text(c,'AUDIENCE REACTIONS',930,435,8,'#986187','center');
    const comments=s.ratings>7000?['♥ 이 방송 끝내지 마!','✦ 진짜 스타가 둘이야','♥ 달링, 사랑해요!']:s.ratings>2500?['✦ 방금 봤어?!','♥ 이건 전설이 될 거야','✦ 시청률 올라간다!']:['♥ 메타톤 사랑해요','✦ 오늘 게스트 누구야?','♥ 쇼타임!!'];
    for(let i=0;i<3;i++){rect(c,844,451+i*32,171,25,'#35132b66');text(c,comments[(i+Math.floor(t/6))%3],857,468+i*32,9,i===0?'#dda0c8':'#99718e');}
  }
  hud(c,s) {
    const x=ARENA.x;
    text(c,'YOU',x,351,10,'#e6c5df','left','700');heart(c,x+42,347,10,C.pink);
    rect(c,x+58,341,113,10,'#481d37');rect(c,x+58,341,113*s.hp/s.maxHp,10,s.hp<=s.maxHp*.25?'#ff426c':C.yellow);
    text(c,`${String(s.hp).padStart(2,'0')} / ${s.maxHp}`,x+185,350,11,s.hp<=s.maxHp*.25?'#ff648a':'#f6ddec');
    text(c,s.boss==='neo'?'NEO':'MTT EX',x+285,350,9,'#bd86a9');
    rect(c,x+339,342,101,7,'#371828');rect(c,x+339,342,101*s.bossHp/s.maxBossHp,7,C.pink);
    if(s.mode==='dodge'){
      const pattern=getPattern(s),duration=roundDuration(s),remaining=Math.max(0,duration-s.roundTime);
      text(c,pattern.name,x,378,10,pattern.yellow?C.yellow:'#d4a0c6','left','700');text(c,`${remaining.toFixed(1)}s`,x+440,378,11,'#b488ac','right');
    } else {text(c,`TURN ${String(s.turn+1).padStart(2,'0')}`,x,378,9,'#8c6285');text(c,s.ratings>=s.ratingGoal?'★ MERCY READY':'MAKE IT A GOOD SHOW',x+440,378,9,s.ratings>=s.ratingGoal?C.yellow:'#8c6285','right');}
    // Compact ratings in the battle view, also visible on portrait screens.
    text(c,`★ ${s.ratings.toLocaleString('en-US')} / ${s.ratingGoal.toLocaleString()}`,560,72,11,s.ratings>=s.ratingGoal?C.yellow:'#c997b8','center');
  }
  arena(c,s,t) {
    const a=ARENA,yellow=s.mode==='dodge'&&getPattern(s).yellow;
    rect(c,a.x-5,a.y-5,a.w+10,a.h+10,'#291628');rect(c,a.x,a.y,a.w,a.h,'#08060e');
    c.strokeStyle=yellow?'#e1b951':'#c58eaf';c.lineWidth=2;c.strokeRect(a.x,a.y,a.w,a.h);
    for(const [x,y] of [[a.x,a.y],[a.x+a.w,a.y],[a.x,a.y+a.h],[a.x+a.w,a.y+a.h]])rect(c,x-3,y-3,6,6,yellow?C.yellow:'#f4bbdf');
    c.save();c.beginPath();c.rect(a.x+1,a.y+1,a.w-2,a.h-2);c.clip();
    for(let x=a.x+22;x<a.x+a.w;x+=22)for(let y=a.y+16;y<a.y+a.h;y+=22)rect(c,x,y,1,1,'#382034');
    if(s.mode==='dodge'){
      const duration=roundDuration(s);
      rect(c,a.x,a.y+a.h-2,a.w*(1-s.roundTime/duration),2,yellow?'#ebbd6680':'#dc68a380');
      if(yellow&&getPattern(s).core){
        const target=s.target;
        line(c,560,a.y,target.x,target.y,'#95516d44',1);
        glow(c,C.pink,15,()=>heart(c,target.x,target.y,31+Math.sin(t*6)*2,'#ff61a7'));
        rect(c,target.x-24,target.y-2,7,3,C.yellow);rect(c,target.x+17,target.y-2,7,3,C.yellow);
      }
    }
    c.restore();
  }
  projectiles(c,s,t) {
    const a=ARENA;c.save();c.beginPath();c.rect(a.x+1,a.y+1,a.w-2,a.h-2);c.clip();
    for(const b of s.bullets){
      const color=C[b.color]||C.pink;
      if(b.kind==='laser'){
        if(b.age<b.delay){
          c.globalAlpha=.06+Math.sin(b.age*24)*.025;rect(c,b.x,b.y,b.w,b.h,color);c.globalAlpha=1;
          c.setLineDash([5,7]);if(b.w>b.h)line(c,b.x,b.y+b.h/2,b.x+b.w,b.y+b.h/2,color);else line(c,b.x+b.w/2,b.y,b.x+b.w/2,b.y+b.h,color);c.setLineDash([]);
          text(c,'!',b.x+b.w/2,b.y+17,15,color,'center','700');
          rect(c,b.x,b.y,b.w*(b.age/b.delay),3,color);
        }else{glow(c,color,16,()=>rect(c,b.x,b.y,b.w,b.h,color));rect(c,b.x+7,b.y,b.w-14,b.h,'#fff2fc');}
      }else if(b.kind==='bar'){
        glow(c,color,12,()=>rect(c,b.x,b.y,b.w,b.h,color));
        for(let y=b.y+12;y<b.y+b.h;y+=25)text(c,b.color==='blue'?'Ⅱ':'»',b.x+b.w/2,y,9,'#0b1422','center','700');
      }else if(b.kind==='mini'){
        rect(c,b.x-11,b.y-12,22,22,'#efdfed');rect(c,b.x-8,b.y-9,16,10,'#2b1629');rect(c,b.x-5,b.y-6,3,3,C.pink);rect(c,b.x+2,b.y-6,3,3,C.pink);rect(c,b.x-5,b.y+4,10,2,'#a43878');rect(c,b.x-16,b.y-3,5,6,'#b5a4b5');rect(c,b.x+11,b.y-3,5,6,'#b5a4b5');
      }else if(b.kind==='bomb'){
        const urgent=b.age>b.fuse-1,bc=urgent&&Math.sin(t*20)>0?C.pink:'#cab7cc';
        rect(c,b.x-10,b.y-9,20,20,bc);rect(c,b.x-7,b.y-12,14,26,bc);rect(c,b.x-7,b.y-7,14,14,'#331b35');text(c,String(Math.max(1,Math.ceil(b.fuse-b.age))),b.x,b.y+4,11,C.yellow,'center','700');line(c,b.x,b.y-13,b.x+5,b.y-20,'#aa879e',2);sparkle(c,b.x+5,b.y-20,4+Math.sin(t*20)*2,C.yellow);
      }else if(b.kind==='shard'){
        c.save();c.translate(b.x,b.y);c.rotate(Math.atan2(b.vy,b.vx));
        glow(c,color,8,()=>polygon(c,[[12,0],[-7,-5],[-3,0],[-7,5]],color));c.restore();
      }else if(b.kind==='note'){
        rect(c,b.x,b.y-10,3,14,color);rect(c,b.x+2,b.y-10,7,3,color);rect(c,b.x-5,b.y+1,7,6,color);
      }else{glow(c,color,6,()=>star(c,b.x,b.y,b.r+2,color,t*2+b.age));}
    }
    for(const shot of s.shots){glow(c,C.yellow,9,()=>rect(c,shot.x-2,shot.y-8,4,13,C.yellow));rect(c,shot.x-1,shot.y-7,2,5,'#fffde7');}
    const p=s.player,yellow=getPattern(s).yellow;
    if(p.invincible<=0||Math.floor(t*15)%2){
      glow(c,yellow?C.yellow:'#ff396f',15,()=>{
        if(yellow){c.save();c.translate(p.x,p.y);c.rotate(Math.PI);heart(c,0,0,17,C.yellow);c.restore();}
        else heart(c,p.x,p.y,17,'#ff396f');
      });
      rect(c,p.x-1,p.y-1,2,2,'#fff7ef');
    }
    c.restore();
  }
  dialogue(c,s) {
    const y=ARENA.y;
    if(s.mode==='dialogue'){
      text(c,s.boss==='neo'?'METTATON NEO':'METTATON EX',560,y+49,10,C.pink,'center','700');
      const revealed=s.dialogue.slice(0,Math.floor((s.dialogueDuration-s.dialogueTimer)*42));
      this.wrap(c,revealed||s.dialogue.slice(0,4),560,y+88,385,15,'#f1d9e9');
      text(c,s.next==='dodge'?'곧 공격이 시작됩니다…':'당신의 차례가 다가옵니다',560,y+165,10,'#85607f','center');
    }else{
      heart(c,560,y+41,13,'#f173ad');this.wrap(c,s.dialogue||'스포트라이트가 당신을 비춘다.',560,y+79,385,14,'#e5c3dc');
      text(c,`스타 파르페 ×${s.items}   ·   NO HIT ${s.perfects}   ·   GRAZE ${s.grazes}`,560,y+155,10,'#96718f','center');
    }
  }
  wrap(c,value,x,y,width,size,color) {
    c.font=`${size}px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
    const lines=[];let row='';for(const ch of value){if(c.measureText(row+ch).width>width){lines.push(row);row=ch;}else row+=ch;}if(row)lines.push(row);
    lines.forEach((v,i)=>{c.fillStyle=color;c.textAlign='center';c.fillText(v,x,y+i*25);});
  }
  fight(c,s) {
    const a=ARENA,x=a.x+34,w=a.w-68,cy=a.y+89;
    text(c,'가운데에 맞춰 Z 또는 SPACE!',560,a.y+35,13,'#e2b6d2','center');
    for(let i=0;i<31;i++){
      const q=i/30,dist=Math.abs(q-.5)*2,h=18+(1-dist)*41;
      rect(c,x+i*w/30-3,cy-h/2,6,h,dist<.13?C.yellow:dist<.38?'#ffac69':dist<.68?'#d4558c':'#683051');
    }
    const px=x+strikePosition(s)*w;
    glow(c,'#ffffff',12,()=>rect(c,px-2,cy-40,4,80,'#fff6fc'));
    text(c,'PERFECT',560,cy+55,9,'#aa815b','center');
  }
  dispose(){window.removeEventListener('resize',this.resize);}
}
