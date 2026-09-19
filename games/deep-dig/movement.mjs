export const spawnPlayer=()=>({x:0,y:-.26,z:-3.02,facing:Math.PI,moving:false});
export const blockPosition=col=>({x:(col%3-1)*1.53,z:(Math.floor(col/3)-1)*1.53});
export const blockDistance=(player,col)=>{const b=blockPosition(col);return Math.hypot(b.x-player.x,b.z-player.z);};
export function nearestBlock(s,player){
 const available=Array.from({length:9},(_,i)=>i).filter(i=>!s.dug.includes(i));
 return available.sort((a,b)=>blockDistance(player,a)-blockDistance(player,b))[0]??null;
}
export function movePlayer(player,dx,dz,dt,s){
 const length=Math.hypot(dx,dz),step=2.6*Math.min(.1,Math.max(0,dt));
 const oldX=player.x,oldZ=player.z;
 if(length){player.x=Math.max(-2.06,Math.min(2.06,player.x+dx/length*step));player.z=Math.max(-3.12,Math.min(2.06,player.z+dz/length*step));player.facing=Math.atan2(-dx,-dz);}
 player.moving=Math.hypot(player.x-oldX,player.z-oldZ)>.0001;
 let floor=-.26;
 if(player.z>-2.3){const col=Math.max(0,Math.min(2,Math.round(player.x/1.53)+1))+Math.max(0,Math.min(2,Math.round(player.z/1.53)+1))*3;floor=s.dug.includes(col)?-.7:.7;}
 player.y+=(floor-player.y)*Math.min(1,dt*12);
 return player;
}
