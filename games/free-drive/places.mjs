export const PLACES=[
 {id:'city',name:'센트럴 시티',icon:'🏙️',description:'건물 사이 도로를 달리는 도시 드라이브',x:3,z:-15},
 {id:'forest',name:'파인 포레스트',icon:'🌲',description:'소나무와 전망대가 있는 숲길',x:3,z:92},
 {id:'beach',name:'선셋 비치',icon:'🏖️',description:'바다와 등대 옆 해안도로',x:73,z:24},
 {id:'school',name:'어린이 보호구역',icon:'🏫',description:'인혁초등학교 앞길 · 제한속도 30 km/h',x:3,z:-58},
];
export const SCHOOL_LIMIT=30/3.6;
export function schoolZoneAt(p,origin={x:0n,z:0n}){
 const x=p.x+Number(origin.x)*240,z=p.z+Number(origin.z)*240;
 return x>=-7&&x<=54&&z>=-64&&z<=-24;
}
