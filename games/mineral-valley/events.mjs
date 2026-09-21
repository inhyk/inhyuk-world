// Six scheduled surges per hour of visible play; the hourly cycle repeats.
export const BASE_ORE_COUNT=1600;
export const EVENT_ORE_COUNT=240;
export const EVENT_INTERVAL=600;
export const EVENT_DURATION=120;
export const EVENT_CHANCES=[0,0,0,36,20,12,7,2,1,.4,16,3.5,2,.1];
export function eventStatus(seconds){
 const cycle=Math.floor(seconds/EVENT_INTERVAL);
 const elapsed=seconds-cycle*EVENT_INTERVAL;
 const active=cycle>0&&elapsed<EVENT_DURATION;
 return {cycle,active,stage:cycle?((cycle-1)%6)+1:0,remaining:active?EVENT_DURATION-elapsed:EVENT_INTERVAL-elapsed};
}
export function pickEvent(random=Math.random){let v=random()*100;for(let id=0;id<EVENT_CHANCES.length;id++){v-=EVENT_CHANCES[id];if(v<0)return id;}return EVENT_CHANCES.length-1;}
export const timeLabel=seconds=>{const n=Math.ceil(Math.max(0,seconds));return `${Math.floor(n/60).toString().padStart(2,'0')}:${(n%60).toString().padStart(2,'0')}`;};
