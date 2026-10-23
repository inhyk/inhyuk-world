// Original procedural 16px material art; no Minecraft texture files are bundled.
const COLORS={white:'#e5e4df',orange:'#d87924',magenta:'#b341b9',light_blue:'#64acd5',yellow:'#e3c541',lime:'#8dbb29',pink:'#e391ae',gray:'#474d51',light_gray:'#a4a49a',cyan:'#218e95',purple:'#7941ae',blue:'#3945a3',brown:'#795036',green:'#557333',red:'#af3931',black:'#292a30'};
const WOODS={oak:'#ad8551',spruce:'#775436',birch:'#d8c28d',jungle:'#b28062',acacia:'#b96944',dark_oak:'#4b3324',mangrove:'#803d39',cherry:'#e8b8b2',bamboo:'#b8aa4b',crimson:'#79354e',warped:'#347d77',pale_oak:'#d0c9b2'};
export function blockGroup(name=''){
 if(/nether|basalt|blackstone|soul|crimson|warped|end_|purpur|chorus|ancient|respawn|shroomlight/.test(name))return '차원';
 if(/glass|ice/.test(name))return '유리·얼음';
 if(Object.keys(COLORS).some(c=>name.startsWith(c+'_')))return '색깔';
 if(/wood|log|planks|bamboo|stem|hyphae/.test(name))return '나무';
 if(/flower|grass|bush|sapling|leaves|vine|fern|tulip|coral|mushroom|roots|petals|lily|cactus|crop|wheat|moss|kelp/.test(name))return '식물';
 if(/stone|brick|slab|stairs|wall|deepslate|tuff|andesite|granite|diorite|quartz/.test(name))return '건축';
 if(/ore|dirt|sand|gravel|snow|mud|clay|calcite|dripstone/.test(name))return '자연';
 return '기능·장식';
}
export function catalogArt(p,b){
 const n=b.mcName??'',color=Object.entries(COLORS).sort((a,b)=>b[0].length-a[0].length).find(([key])=>n.startsWith(key+'_'))?.[1];
 const wood=Object.entries(WOODS).sort((a,b)=>b[0].length-a[0].length).find(([key])=>n.includes(key))?.[1];
 let base=color??wood??(/granite/.test(n)?'#ac7e6c':/diorite/.test(n)?'#c9c7bd':/tuff/.test(n)?'#73796e':/basalt/.test(n)?'#535259':/prismarine/.test(n)?'#559e8e':/terracotta/.test(n)?'#ae7257':/clay/.test(n)?'#929da9':/sculk/.test(n)?'#173e46':/sponge/.test(n)?'#c8bc59':/honey/.test(n)?'#d49627':/slime/.test(n)?'#83ba5b':/dripstone/.test(n)?'#9b8170':/copper/.test(n)?(/oxidized/.test(n)?'#438e78':/weathered/.test(n)?'#6f9980':/exposed/.test(n)?'#b38462':'#bb714d'):/gold/.test(n)?'#e6c346':/diamond/.test(n)?'#5adbd3':/emerald/.test(n)?'#38b76f':/lapis/.test(n)?'#3859b0':/amethyst/.test(n)?'#a27bce':/quartz|calcite/.test(n)?'#dfd9c9':/snow/.test(n)?'#e7f1f5':/netherite|ancient|blackstone|deepslate/.test(n)?'#41404c':/nether|crimson/.test(n)?'#853e42':/end_stone/.test(n)?'#d7d4a0':/purpur/.test(n)?'#ad80b0':/sand/.test(n)?'#d4bd88':/mud|dirt/.test(n)?'#80634e':/moss|leaves|grass/.test(n)?'#5a914b':'#8d9294');
 const shade=(delta)=>{let v=base.slice(1);return '#'+[0,2,4].map(k=>Math.max(0,Math.min(255,parseInt(v.slice(k,k+2),16)+delta)).toString(16).padStart(2,'0')).join('');};
 for(let y=0;y<16;y++)for(let x=0;x<16;x++)p.px(x,y,shade(Math.floor(p.r()*23)-11));
 if(/planks|wood|hyphae|stem|log/.test(n)){
  for(let y=3;y<16;y+=4){p.rect(0,y,16,1,shade(-30));for(let x=(y%8)*2;x<16;x+=8)p.rect(x,y-3,1,3,shade(-20));}
  if(/log|wood|stem|hyphae/.test(n)){for(let x=2;x<16;x+=4)p.rect(x,0,1,16,shade(-28));}
 }
 if(/bricks|tiles|quartz|purpur/.test(n))for(let y=3;y<16;y+=4){p.rect(0,y,16,1,shade(-35));for(let x=(y%8)*2;x<16;x+=8)p.rect(x,y-3,1,3,shade(-28));}
 if(/_block$|concrete/.test(n)){p.rect(1,1,14,1,shade(30));p.rect(1,1,1,14,shade(20));p.rect(14,2,1,13,shade(-25));p.rect(2,14,12,1,shade(-25));}
 if(/ore/.test(n)){for(let k=0;k<13;k++){const x=Math.floor(p.r()*14),y=Math.floor(p.r()*14);p.rect(x,y,2,2,/lapis/.test(n)?'#4168e1':/emerald/.test(n)?'#2ae393':/copper/.test(n)?'#df9162':/diamond/.test(n)?'#5ffbf3':'#d1ac7a');}}
 if(/glass|ice/.test(n)){p.g.clearRect(0,0,16,16);p.g.globalAlpha=.3;p.rect(0,0,16,16,base);p.g.globalAlpha=1;p.rect(0,0,16,1,shade(45));p.rect(0,0,1,16,shade(45));p.rect(15,0,1,16,shade(-20));p.rect(0,15,16,1,shade(-20));p.line(3,8,8,3,'#e9faff');p.line(7,12,12,7,'#cbeaf2');}
 if(/bookshelf/.test(n)){p.rect(0,0,16,16,'#826340');for(let y of[2,9]){p.rect(1,y,14,5,'#3b332b');for(let x=2;x<15;x+=3){p.rect(x,y,2,5,['#577d9a','#98616f','#d2b65b','#618e71'][Math.floor(p.r()*4)]);p.rect(x,y+1,1,1,'#e6cdb0');}}}
 if(/leaves|coral/.test(n)){for(let k=0;k<40;k++)p.rect(Math.floor(p.r()*15),Math.floor(p.r()*15),2,2,p.r()<.4?'#284c35':shade(24));}
 if(/torch|lantern|glow|light|froglight/.test(n)){p.rect(4,3,8,10,'#e5ad4e');p.rect(6,4,4,7,'#fff1a6');}
 if(!b.solid&&/flower|bush|sapling|roots|fern|tulip|grass|lily|petals/.test(n)){p.g.clearRect(0,0,16,16);p.rect(7,5,2,11,'#487c37');p.line(8,12,3,8,'#73a14d');p.line(8,10,12,6,'#5d993e');p.rect(4,2,8,5,color??(/rose|poppy/.test(n)?'#d64a60':'#eccba5'));p.rect(7,3,2,2,'#f5df73');}
 if(/slab/.test(n)){p.rect(0,7,16,2,shade(-40));p.rect(0,9,16,1,shade(30));}
 if(/stairs/.test(n)){p.line(1,12,6,12,shade(-45));p.line(6,12,6,7,shade(-45));p.line(6,7,12,7,shade(-45));p.line(12,7,12,2,shade(-45));}
 if(/door|trapdoor/.test(n)){p.rect(1,1,14,14,shade(-24));p.rect(3,3,10,9,shade(20));p.rect(11,10,2,1,'#e2c97a');}
 if(/fence|wall|bars/.test(n)){p.rect(0,6,16,3,shade(-25));p.rect(2,1,3,14,shade(25));p.rect(11,1,3,14,shade(25));}
 if(/button|pressure_plate|lever/.test(n)){p.rect(2,9,12,4,shade(-35));p.rect(4,7,8,3,shade(35));}
 if(/redstone|repeater|comparator|observer/.test(n)){p.line(2,8,13,8,'#b52224');p.rect(3,4,2,3,'#f24b42');p.rect(11,4,2,3,'#f24b42');}
 if(/wool|carpet/.test(n)){for(let y=1;y<16;y+=3)for(let x=y%2;x<16;x+=3)p.px(x,y,shade(23));}
 if(/terracotta/.test(n)){p.rect(3,3,10,10,shade(-20));p.rect(5,5,6,6,shade(25));p.rect(7,7,3,3,shade(-35));}
 if(/sculk/.test(n))for(let k=0;k<18;k++)p.px(Math.floor(p.r()*16),Math.floor(p.r()*16),'#48b2ac');
 if(/sponge/.test(n))for(let k=0;k<18;k++)p.rect(Math.floor(p.r()*15),Math.floor(p.r()*15),2,2,shade(-35));
 if(/rail/.test(n)){p.g.clearRect(0,0,16,16);for(let y=2;y<16;y+=4)p.rect(1,y,14,2,'#876747');p.rect(3,0,2,16,'#c2c5bd');p.rect(11,0,2,16,'#c2c5bd');if(/powered|detector|activator/.test(n))p.rect(7,0,2,16,'#b43932');}
 if(/banner/.test(n)){p.g.clearRect(0,0,16,16);p.rect(7,0,2,16,'#725638');p.rect(3,1,11,11,base);p.rect(4,2,1,9,shade(30));p.rect(3,11,11,1,shade(-25));}
 if(/_bed$/.test(n)){p.rect(0,0,16,16,'#71533e');p.rect(1,2,14,12,base);p.rect(2,3,12,4,'#eee7d7');p.rect(2,8,12,1,shade(-30));}
 if(/sign/.test(n)){p.g.clearRect(0,0,16,16);p.rect(7,10,2,6,'#765a3b');p.rect(1,1,14,10,wood??'#ad8551');p.rect(3,4,10,1,'#594931');p.rect(3,7,8,1,'#594931');}
 if(/barrel/.test(n)){p.rect(0,0,16,16,wood??'#92734c');p.rect(1,3,14,2,'#575a57');p.rect(1,11,14,2,'#575a57');p.rect(6,6,4,4,'#45392c');}
 if(/piston/.test(n)){p.rect(0,0,16,4,'#b49a6a');p.rect(0,4,3,12,'#c0c0b1');p.rect(13,4,3,12,'#c0c0b1');p.rect(3,5,10,10,'#555a56');p.rect(6,5,4,9,'#bca879');if(/sticky/.test(n))p.rect(1,0,14,3,'#7cad5d');}
 if(/furnace|smoker|dispenser|dropper|observer/.test(n)){p.rect(1,1,14,14,shade(-15));p.rect(3,3,3,2,'#242b2c');p.rect(10,3,3,2,'#242b2c');p.rect(4,8,8,5,'#202729');p.rect(5,8,6,1,'#bbc0ba');}
 if(/hopper/.test(n)){p.g.clearRect(0,0,16,16);p.rect(0,1,16,3,'#737c7a');p.rect(2,4,12,3,'#485252');p.rect(4,7,8,3,'#485252');p.rect(6,10,4,5,'#354142');}
 if(/anvil/.test(n)){p.g.clearRect(0,0,16,16);p.rect(0,1,16,4,'#777b7b');p.rect(4,5,8,6,'#444c50');p.rect(2,11,12,4,'#666c6e');p.rect(1,1,14,1,'#a2a8a6');}
 if(/spawner|vault/.test(n)){p.rect(0,0,16,16,'#27393c');for(let x=0;x<16;x+=5)p.rect(x,0,1,16,'#82908a');for(let y=0;y<16;y+=5)p.rect(0,y,16,1,'#82908a');p.rect(6,6,4,4,'#df9d48');}
 if(/skull|head/.test(n)&&!n.includes('piston')){p.rect(2,2,12,12,base);p.rect(4,6,3,3,'#25232d');p.rect(10,6,3,3,'#25232d');p.rect(6,11,5,1,'#35303c');}
 if(/^(fire|soul_fire|campfire|soul_campfire)$/.test(n)){p.g.clearRect(0,0,16,16);if(/campfire/.test(n)){p.rect(1,12,14,3,'#765039');p.rect(3,10,10,2,'#9b7145');}for(let x=2;x<15;x+=3){const y=2+Math.floor(p.r()*6);p.rect(x,y,3,13-y,/soul/.test(n)?'#39c4cf':'#e87d24');p.rect(x+1,y+3,1,10-y,'#ffe88b');}}
 if(/candle/.test(n)){p.g.clearRect(0,0,16,16);p.rect(6,7,5,8,color??'#d5be89');p.rect(8,3,1,4,'#665542');p.px(8,2,'#f3bc46');}
 if(/amethyst|cluster/.test(n)){for(let x=1;x<15;x+=4){const y=2+Math.floor(p.r()*6);p.rect(x,y,3,14-y,'#9465c1');p.rect(x,y,1,12-y,'#d1a8ef');}}
 if(n==='enchanting_table'){p.rect(0,0,16,16,'#282439');p.rect(1,2,14,3,'#8f2b47');p.rect(1,12,3,3,'#48c9cd');p.rect(12,12,3,3,'#48c9cd');p.rect(3,3,10,7,'#7b4939');p.rect(4,2,4,6,'#f3dfaf');p.rect(8,3,4,6,'#ded1a1');p.rect(7,2,1,7,'#aa8454');}
 if(/^(cave_air|void_air)$/.test(n)){p.g.clearRect(0,0,16,16);p.g.strokeStyle='#83b8cf';p.g.strokeRect(1,1,14,14);}
 return p.c;
}
