import { cleanTowerProgress } from './towers.mjs';
export const SAVE_KEY = 'blocktopia-v1';
export const PALETTE = ['#86ad72','#f4bd68','#df8e90','#8bb7cb','#a59aca','#f4ecd4'];
export function cleanSave(raw) {
  const n = (v, max) => Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0;
  return { towers:cleanTowerProgress(raw?.towers), coins:n(raw?.coins,99999), collected:Array.isArray(raw?.collected) ? [...new Set(raw.collected.filter(x=>Number.isInteger(x)&&x>=0&&x<60))] : [],
    checkpoint:n(raw?.checkpoint,12), won:raw?.won===true, outfit:n(raw?.outfit,5),
    owned:Array.isArray(raw?.owned) ? [...new Set([0,...raw.owned.filter(x=>Number.isInteger(x)&&x>=0&&x<6)])] : [0],
    blocks:Array.isArray(raw?.blocks) ? raw.blocks.filter(b=>b&&Number.isInteger(b.x)&&b.x>=-32&&b.x<=-16&&Number.isInteger(b.z)&&b.z>=-27&&b.z<=-13&&Number.isInteger(b.y)&&b.y>=0&&b.y<8&&Number.isInteger(b.color)&&b.color>=0&&b.color<6).slice(0,100) : [] };
}
export function stepBody(p, dx, dz, dt, solids, jump) {
  const radius=.38, height=2.35;
  if(jump&&p.grounded){p.vy=10.5;p.grounded=false;}
  for(const axis of ['x','z']) {
    p[axis]+=axis==='x'?dx:dz;
    for(const b of solids) {
      if(p.y>=b.top-.04||p.y+height<=b.bottom+.03)continue;
      if(Math.abs(p.x-b.x)<b.w/2+radius&&Math.abs(p.z-b.z)<b.d/2+radius) {
        const delta=axis==='x'?dx:dz;
        if(delta)p[axis]=b[axis]+Math.sign(delta)*-((axis==='x'?b.w:b.d)/2+radius);
      }
    }
  }
  const old=p.y;p.vy-=25*dt;p.y+=p.vy*dt;p.grounded=false;
  let landing=-Infinity;
  for(const b of solids) {
    if(Math.abs(p.x-b.x)>=b.w/2+radius*.7||Math.abs(p.z-b.z)>=b.d/2+radius*.7)continue;
    if(p.vy<=0&&old>=b.top-.06&&p.y<=b.top)landing=Math.max(landing,b.top);
    if(p.vy>0&&old+height<=b.bottom+.04&&p.y+height>=b.bottom){p.y=b.bottom-height;p.vy=0;}
  }
  if(landing>-Infinity){p.y=landing;p.vy=0;p.grounded=true;}
  return p;
}
