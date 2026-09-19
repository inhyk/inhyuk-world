// The same cycle drives roadside lights, traffic AI and violation detection.
export function signalPhase(seconds,axis){const t=((seconds%20)+20)%20;if(axis==='z')return t<8?'green':t<10?'yellow':'red';return t<10?'red':t<18?'green':'yellow';}
export function crossedRed(before,after,seconds,nearestRoad){
 const dx=after.x-before.x,dz=after.z-before.z;if(Math.hypot(dx,dz)<.001)return false;
 const axis=Math.abs(dz)>=Math.abs(dx)?'z':'x',side=axis==='z'?'x':'z',dir=Math.sign(after[axis]-before[axis]);
 if(signalPhase(seconds,axis)!=='red'||Math.abs(after[side]-nearestRoad(after[side]))>5.5)return false;
 const intersection=nearestRoad(after[axis]),stop=intersection-dir*8;
 return before[axis]*dir<stop*dir&&after[axis]*dir>=stop*dir;
}
export const jailSeconds=(save,now=Date.now())=>Math.max(0,Math.ceil((save.jailUntil-now)/1000));
export function arrest(save,now=Date.now()){if(jailSeconds(save,now)>0)return false;save.wanted=false;save.jailUntil=now+60000;return true;}
export function release(save,now=Date.now()){if(!save.jailUntil||now<save.jailUntil)return false;save.jailUntil=0;save.wanted=false;return true;}
