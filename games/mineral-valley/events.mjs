// 보이는 플레이 시간 기준으로 시간당 여섯 번 희귀 광맥이 터지고, 그 주기가 매시간 반복된다.
export const BASE_ORE_COUNT=1600;
export const EVENT_ORE_COUNT=240;
export const EVENT_INTERVAL=600;
export const EVENT_DURATION=60;
export const EVENT_CHANCES=[0,0,0,35.8981,20,12,7,2,1,.4,16,3.5,2,.1,.05,.03,.015,.004,.001,.0008,.0005,.0003,.0002,.0001];
export function eventStatus(seconds){
 const cycle=Math.floor(seconds/EVENT_INTERVAL);
 const elapsed=seconds-cycle*EVENT_INTERVAL;
 const active=cycle>0&&elapsed<EVENT_DURATION;
 return {cycle,active,stage:cycle?((cycle-1)%6)+1:0,remaining:active?EVENT_DURATION-elapsed:EVENT_INTERVAL-elapsed};
}
export function pickEvent(random=Math.random){let v=random()*100;for(let id=0;id<EVENT_CHANCES.length;id++){v-=EVENT_CHANCES[id];if(v<0)return id;}return EVENT_CHANCES.length-1;}
export const timeLabel=seconds=>{const n=Math.ceil(Math.max(0,seconds));return `${Math.floor(n/60).toString().padStart(2,'0')}:${(n%60).toString().padStart(2,'0')}`;};
// 하루는 아침 10분 · 낮 10분 · 밤 10분으로 30분이며 이벤트와 같은 플레이 시간 위에서 흐른다.
export const PHASE_DURATION=600;
export const PHASES=[
 {key:'morning',name:'아침',icon:'🌄',hint:'안개가 걷히는 서늘한 빛'},
 {key:'day',name:'낮',icon:'☀️',hint:'가장 밝고 멀리 보이는 시간'},
 {key:'night',name:'밤',icon:'🌙',hint:'광물이 스스로 빛나는 시간'},
];
export const DAY_LENGTH=PHASE_DURATION*PHASES.length;
export function dayPhase(seconds){
 const t=Math.max(0,seconds)%DAY_LENGTH;
 const index=Math.floor(t/PHASE_DURATION);
 const elapsed=t-index*PHASE_DURATION;
 return {...PHASES[index],index,day:Math.floor(Math.max(0,seconds)/DAY_LENGTH)+1,elapsed,remaining:PHASE_DURATION-elapsed,progress:elapsed/PHASE_DURATION};
}
// 풍선은 30,000m 계곡에 언제나 딱 하나. 터뜨리면 20초 뒤 다른 곳에 다시 뜬다.
export const BALLOON_RESPAWN=20;
// 5분마다 한 번씩 안내가 지나간다.
export const AD_INTERVAL=300;
export const AD_TEXT='seonn.dev 를 플레이 하세요!';
// 몬스터는 밤에만 나온다.
export const MONSTER_MAX=14;
export const MONSTER_HP=3;
export const MONSTER_REWARD=40000;
