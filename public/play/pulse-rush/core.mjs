export const SONGS = [
  ['첫 번째 빛','FIRST LIGHT',100,60,'#b6f36a',[0,4,7,11,7,4,2,4],[0,5,9,7],'CHILL POP'],
  ['솜사탕 구름','COTTON CLOUD',108,65,'#ff9bce',[0,2,4,7,9,7,4,2],[0,9,5,7],'DREAM POP'],
  ['파도 위로','OCEAN DRIVE',116,62,'#69dbed',[0,7,4,9,7,12,11,7],[0,7,9,5],'TROPICAL'],
  ['별빛 산책','STAR WALK',122,69,'#bda1ff',[0,3,7,10,12,10,7,3],[0,8,3,10],'LO-FI HOUSE'],
  ['네온 시티','NEON CITY',128,57,'#ffae66',[0,7,12,10,7,3,5,7],[0,8,5,10],'SYNTHWAVE'],
  ['픽셀 어드벤처','PIXEL QUEST',136,72,'#f4dc76',[0,4,7,12,11,7,9,4],[0,5,7,9],'CHIPTUNE'],
  ['달빛 질주','MOON RACER',142,58,'#7fa7ff',[0,3,7,12,10,7,5,3],[0,10,8,5],'FUTURE BASS'],
  ['슈가 러시','SUGAR RUSH',150,67,'#ff7c9c',[0,2,7,4,12,9,7,11],[0,9,5,7],'HAPPY HARDCORE'],
  ['전기 폭풍','ELECTRIC STORM',160,54,'#a4f3df',[0,3,6,7,12,7,6,3],[0,6,8,5],'DRUM & BASS'],
  ['마지막 초신성','SUPERNOVA',174,63,'#ec95ff',[0,7,3,10,12,15,14,7],[0,8,3,10],'GALACTIC RAVE'],
].map(([title,name,bpm,root,color,motif,chords,genre],id)=>({id,title,name,bpm,root,color,motif,chords,genre}));
export const WINDOWS = {PERFECT:.045,GREAT:.09,GOOD:.14,BAD:.2};
export const VALUES = {PERFECT:1000,GREAT:750,GOOD:450,BAD:100,MISS:0};
export function judge(delta) {for(const [name,limit] of Object.entries(WINDOWS))if(Math.abs(delta)<=limit+1e-9)return name;return 'MISS';}
export function compose(song) {
 const beat=60/song.bpm, events=[],notes=[];let serial=0;
 const add=(b,midi,duration,voice,velocity=.4)=>events.push({time:2+b*beat,midi,duration:duration*beat,voice,velocity});
 for(let bar=0;bar<24;bar++){
  const section=Math.floor(bar/6), chord=song.chords[Math.floor(bar/2)%4], minor=[3,4,6,8,9].includes(song.id), third=minor?3:4;
  for(const interval of [0,third,7])add(bar*4,song.root-12+chord+interval,3.7,'pad',.09);
  for(let b=0;b<4;b++){
   add(bar*4+b,song.root-24+chord,.65,'bass',.35);
   add(bar*4+b,36,.2,'kick',.7);
   if(b%2===1)add(bar*4+b,0,.15,'snare',.25);
   for(let h=0;h<2;h++)add(bar*4+b+h*.5,0,.05,'hat',.12);
  }
  const steps=section===0?4:section===3?8:(song.id<3?4:8);
  for(let step=0;step<steps;step++){
   if(section===2&&step%4===3)continue;
   const b=bar*4+step*(4/steps), pitch=song.motif[(step+bar%4*2+section)%8]+song.root+(section===3?12:0);
   add(b,pitch,.38,'lead',.28);
   const lane=(song.motif[(step+bar)%8]+bar+song.id+step)%4;
   notes.push({id:serial++,time:2+b*beat,lane,...(step===0&&bar%3===1?{endTime:2+(b+1.5)*beat}:{})});
   if(song.id>=5&&section===3&&step%4===0)notes.push({id:serial++,time:2+b*beat,lane:(lane+2)%4});
  }
 }
 const blocked=[-Infinity,-Infinity,-Infinity,-Infinity];
 const playable=notes.sort((a,b)=>a.time-b.time).filter(n=>{if(n.time<=blocked[n.lane])return false;if(n.endTime){blocked[n.lane]=n.endTime+.22;const lead=events.find(e=>e.voice==='lead'&&Math.abs(e.time-n.time)<1e-8);if(lead)lead.duration=n.endTime-n.time;}return true;});
 return {events:events.sort((a,b)=>a.time-b.time),notes:playable,duration:2+96*beat+1.5};
}
export function newRun(chart){return {notes:chart.notes.map(n=>({...n,judgment:null})),counts:{PERFECT:0,GREAT:0,GOOD:0,BAD:0,MISS:0},combo:0,maxCombo:0,score:0,total:chart.notes.length};}
export function record(run,note,result){if(note.judgment)return;note.judgment=result;run.counts[result]++;run.score+=VALUES[result];run.combo=['BAD','MISS'].includes(result)?0:run.combo+1;run.maxCombo=Math.max(run.maxCombo,run.combo);return result;}
export function hit(run,lane,time){
 if(run.notes.some(n=>n.lane===lane&&n.holding&&!n.judgment))return 'HOLD';
 const note=run.notes.find(n=>n.lane===lane&&!n.judgment&&Math.abs(n.time-time)<=WINDOWS.BAD+1e-9);
 if(!note)return null;
 if(note.endTime){note.holding=true;note.startJudgment=judge(time-note.time);return 'HOLD';}
 return record(run,note,judge(time-note.time));
}
export function releaseHold(run,lane,time){const note=run.notes.find(n=>n.lane===lane&&n.holding&&!n.judgment);if(!note)return null;note.holding=false;return record(run,note,time+1e-9>=note.endTime?note.startJudgment:'BAD');}
export function updateHolds(run,time,held){const results=[];for(const note of run.notes){if(!note.holding||note.judgment)continue;if(!held.has(note.lane)&&time<(note.resumeGrace??-Infinity))continue;if(!held.has(note.lane)||time+1e-9>=note.endTime){note.holding=false;results.push({lane:note.lane,result:record(run,note,held.has(note.lane)?note.startJudgment:'BAD')});}}return results;}

export function expire(run,time){let missed=false;for(const n of run.notes){if(n.time>=time-WINDOWS.BAD-1e-9)break;if(!n.judgment&&!n.holding){record(run,n,'MISS');missed=true;}}return missed;}
export function accuracy(run){return run.total?run.score/(run.total*1000)*100:0;}
