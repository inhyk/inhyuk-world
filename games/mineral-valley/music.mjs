// 파일 없이 WebAudio로 직접 연주하는 배경음악과 효과음.
// 하루 시간대에 따라 조성과 빠르기가 바뀐다.
const MOODS={
 morning:{root:293.66,steps:[0,2,4,7,9,12],beat:.5,pad:.045,lead:.05,wave:'triangle'},
 day:{root:349.23,steps:[0,2,4,7,11,12],beat:.43,pad:.042,lead:.055,wave:'triangle'},
 night:{root:220,steps:[0,3,5,7,10,12],beat:.72,pad:.06,lead:.04,wave:'sine'},
};
const CHORDS=[[0,4,7],[-3,0,4],[-5,-1,2],[-7,-3,0]];
const semitone=n=>2**(n/12);
export function createMusic(){
 let audio=null,master=null,timer=null,ahead=0,beat=0,mood=MOODS.morning,playing=false;
 function ensure(){
  if(audio)return audio;
  audio=new (window.AudioContext||window.webkitAudioContext)();
  master=audio.createGain();master.gain.value=.5;master.connect(audio.destination);
  return audio;
 }
 function voice(freq,at,length,gain,wave='sine',glide=0){
  const osc=audio.createOscillator(),env=audio.createGain();
  osc.type=wave;osc.frequency.setValueAtTime(freq,at);
  if(glide)osc.frequency.exponentialRampToValueAtTime(freq*glide,at+length);
  env.gain.setValueAtTime(.0001,at);
  env.gain.exponentialRampToValueAtTime(gain,at+Math.min(.09,length*.3));
  env.gain.exponentialRampToValueAtTime(.0001,at+length);
  osc.connect(env);env.connect(master);osc.start(at);osc.stop(at+length+.05);
 }
 // 한 박자씩 앞서 예약해 둔다. 탭이 느려져도 끊기지 않는다.
 function schedule(){
  if(!playing||!audio)return;
  const now=audio.currentTime;
  if(ahead<now)ahead=now+.08;
  while(ahead<now+.7){
   const bar=Math.floor(beat/8)%CHORDS.length,step=beat%8;
   const chord=CHORDS[bar];
   if(step===0){
    voice(mood.root*semitone(chord[0]-24),ahead,mood.beat*7,mood.pad*1.5,'sine');
    for(const n of chord)voice(mood.root*semitone(n-12),ahead,mood.beat*7,mood.pad,mood.wave);
   }
   if(step%2===0||Math.random()<.45){
    const note=mood.steps[(step*3+bar)%mood.steps.length]+chord[0];
    voice(mood.root*semitone(note),ahead,mood.beat*(step%4===0?1.6:.9),mood.lead,mood.wave,1.001);
   }
   ahead+=mood.beat;beat++;
  }
 }
 return {
  get playing(){return playing;},
  setPhase(key){const next=MOODS[key]||MOODS.morning;if(next!==mood){mood=next;}},
  start(){
   ensure();audio.resume();
   if(playing)return;
   playing=true;ahead=audio.currentTime+.1;
   timer=setInterval(schedule,180);schedule();
  },
  stop(){
   playing=false;clearInterval(timer);timer=null;
   if(master){master.gain.setTargetAtTime(0,audio.currentTime,.1);setTimeout(()=>{if(!playing&&master)master.gain.value=.5;},400);}
  },
  // 효과음은 음악이 꺼져 있어도 직접 울린다.
  blip(kind='pick'){
   ensure();audio.resume();
   const at=audio.currentTime+.01;
   if(kind==='pick')voice(520,at,.22,.09,'sine',1.6);
   else if(kind==='sell'){voice(660,at,.16,.08,'triangle',1.2);voice(990,at+.08,.24,.06,'triangle',1.15);}
   else if(kind==='hit'){voice(180,at,.14,.11,'square',.6);voice(90,at+.02,.2,.08,'sawtooth',.5);}
   else if(kind==='slay'){voice(140,at,.3,.12,'sawtooth',.35);voice(420,at+.1,.3,.07,'triangle',1.4);}
   else if(kind==='pop'){voice(880,at,.1,.12,'square',.4);voice(1320,at+.05,.3,.07,'triangle',1.6);}
   else if(kind==='event')for(let i=0;i<3;i++)voice(523.25*semitone(i*4),at+i*.09,.3,.07,'triangle',1.2);
  },
 };
}
