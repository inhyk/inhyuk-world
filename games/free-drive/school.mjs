// The campus is inside the original island and moves with its floating origin.
export function buildSchool({parent,box,cyl,sign,solids}){
 box('school campus',29,.08,-42,43,.1,40,'#e8d9b6',parent);
 box('school playground',29,.15,-28,31,.03,10,'#bfcf9a',parent);
 box('school building',30,3.3,-48,29,6.4,15,'#f7d99a',parent,true);
 box('school roof',30,6.6,-48,30,.3,16,'#cf856b',parent,true);
 solids.push({x:30,z:-48,w:29,d:15});
 for(const x of [19,25,35,41])for(const y of [2,4.6])box('classroom window',x,y,-40.46,3.3,1.6,.06,'#8abcc7',parent);
 box('school entrance',30,1.5,-40.4,3.4,2.8,.12,'#507a87',parent);
 const name=sign('인혁초등학교',30,7.9,-40.2,20);name.parent=parent;
 for(const x of [15,44]){cyl('school gate post',x,1,-26,.22,2,'#f2c84f',parent);}
 for(let z=-61;z<=-25;z+=4){cyl('yellow safety bollard',6.5,.7,z,.18,1.25,'#ffe174',parent);}
 for(const x of [12,18,40,46]){box('school bench',x,.6,-32,3,.25,.8,'#d18b65',parent);for(const dx of [-1,1])box('bench leg',x+dx,.3,-32,.13,.5,.65,'#607c73',parent);}
 // A red road surface, bright crosswalk and signs mark both approaches.
 box('school red road',0,.151,-44,10.6,.018,40,'#b96e58',parent);
 for(let z=-60;z<=-28;z+=8)box('school center line',0,.168,z,.16,.012,3.5,'#ffe18a',parent);
 for(const z of [-58,-30])for(let x=-4.5;x<=4.5;x+=1.5)box('school yellow crossing',x,.178,z,.8,.02,2.5,'#fff0a1',parent);
 for(const z of [-62,-25]){
  const text=sign('어린이 보호구역',-7,4.3,z,8);text.parent=parent;
  const limit=sign('30 km/h',-7,2.7,z,5);limit.parent=parent;
  cyl('school sign post',-7,2,z,.13,4,'#d9b74d',parent);
 }
 const roadMark=sign('30',2.8,.195,-44,4);roadMark.parent=parent;roadMark.rotation.x=Math.PI/2;
}
