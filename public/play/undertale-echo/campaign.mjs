// A separate, original campaign. The original game and its saves are untouched.
import { ROOMS, ROOM_NAMES, SCRIPTS } from './world.mjs';
import { AREAS, ENDINGS, SHOPS } from './data.mjs';
import { DETAILS } from './details.mjs';
import { PALETTES } from './scenery.mjs';
const say=(who,lines)=>({type:'say',who,lines:Array.isArray(lines)?lines:[lines]});
const ask=(prompt,options)=>({type:'choice',prompt,options});
const fight=(id,music='boss')=>({type:'battle',enemies:[id],music});
const event=(script,once,x=8)=>({id:script,x,y:6,w:3,h:3,script,once});
const npc=(id,sprite,x,y,extra)=>({id,sprite,x,y,dir:'down',...extra});
for(const key of Object.keys(ROOMS)) delete ROOMS[key];
for(const key of Object.keys(ROOM_NAMES)) delete ROOM_NAMES[key];
DETAILS.length=0;
AREAS.ruins.name='1장 · 별가루 정원';
AREAS.snowdin.name='2장 · 눈 내리는 승강장';AREAS.waterfall.name='3장 · 메아리 저수지';AREAS.hotland.name='4장 · 자정의 방송국';AREAS.castle.name='5장 · 마지막 신호';
Object.assign(PALETTES.ruins,{floor:'#243b42',seam:'#1d3038',wall:'#08151e',edge:'#3c6a6b',accent:'#a5e6cf'});
Object.assign(PALETTES.castle,{floor:'#29374d',seam:'#212b40',wall:'#080e1d',edge:'#5c7292',accent:'#dfca97'});
SHOPS.snowdin.greeting='마지막 열차를 기다리니? 기다리는 동안 따뜻한 것을 먹으렴.';
SHOPS.hotland.items=[['glamburger',45],['noodles',12],['tutu',65]];
const specs=[
 ['echo_arrival','ruins','01 · 별이 떨어진 정원','garden'],
 ['echo_atrium','ruins','별가루 정원 · 신호의 문','puzzle'],
 ['echo_archive','ruins','별가루 정원 · 잠든 기록실','library'],
 ['echo_keeper','ruins','별가루 정원 · 첫 번째 신호','arena'],
 ['echo_snow','snowdin','02 · 눈 내리는 승강장','forest'],
 ['echo_cafe','snowdin','승강장 · 기다리는 사람들','village'],
 ['echo_tracks','snowdin','승강장 · 얼어붙은 선로','puzzle'],
 ['echo_conductor','snowdin','승강장 · 명예 차장','arena'],
 ['echo_reservoir','waterfall','03 · 메아리 저수지','bridge'],
 ['echo_ghost','waterfall','저수지 · 소리 없는 음악실','garden'],
 ['echo_tide','waterfall','저수지 · 수문의 약속','puzzle'],
 ['echo_guard','waterfall','저수지 · 마지막 순찰','arena'],
 ['echo_lab','hotland','04 · 자정의 방송국','library'],
 ['echo_market','hotland','방송국 · 심야 매점','village'],
 ['echo_circuit','hotland','방송국 · 끊어진 회로','puzzle'],
 ['echo_live','hotland','방송국 · 마지막 생방송','arena'],
 ['echo_hall','castle','05 · 별을 잇는 회랑','bridge'],
 ['echo_observatory','castle','마지막 신호 · 작은 천문대','garden'],
 ['echo_judgement','castle','마지막 신호 · 남겨진 발자국','arena'],
 ['echo_terminal','castle','종착역 · 새벽행 열차','terminal'],
];
function tiles(kind,index){
 const a=Array.from({length:15},(_,y)=>Array.from({length:20},(_,x)=>x===0||x===19||y===0||y>=13?'#':'.'));
 for(let y=6;y<=8;y++){a[y][0]='.';a[y][19]='.';}
 // A clear horizontal path always connects both exits.
 if(kind==='garden'){for(let y=2;y<12;y++)for(let x=3;x<17;x++)if((x+y)%4===0)a[y][x]=','; for(const [x,y] of [[3,3],[16,3],[3,11],[16,11]])a[y][x]='o';}
 if(kind==='forest'){for(const y of [2,4,10,12])for(let x=2;x<19;x+=3)a[y][x]='o';for(let x=2;x<18;x++)a[8][x]=',';}
 if(kind==='puzzle'){for(let y=1;y<13;y++)a[y][12]='^';a[10][4]='x';a[3][5]='B';for(let x=2;x<11;x++)a[6][x]=',';}
 if(kind==='bridge'){for(let y=2;y<12;y++)for(let x=2;x<18;x++)a[y][x]='~';for(let y=6;y<=8;y++)for(let x=1;x<19;x++)a[y][x]='=';for(let y=2;y<12;y++)for(let x=8;x<12;x++)a[y][x]='=';}
 if(kind==='library'){for(let x=2;x<18;x+=3){a[2][x]='o';a[3][x]='o';}for(let x=3;x<18;x++)a[10][x]=',';}
 if(kind==='village'){for(let x=2;x<18;x++)a[2][x]='#';for(const x of [3,7,12,16])a[3][x]='o';}
 if(kind==='arena'){for(const x of [3,16])for(const y of [2,4,10,12])a[y][x]='o';}
 if(kind==='terminal'){for(let x=1;x<19;x++)a[3][x]='#';a[3][9]='.';a[3][10]='.';}
 if(kind==='bridge')a[10][9]='S';else a[9][3]='S';
 return a.map(row=>row.join(''));
}
for(let i=0;i<specs.length;i++){
 const [id,area,name,kind]=specs[i];const r={id,area,tiles:tiles(kind,i),npcs:[],events:[],exits:{},spawn:{x:i===0?5:2,y:7},deco:kind==='garden'?'flowers':undefined};
 if(i>0)r.exits.left={room:specs[i-1][0],x:18,y:7};
 if(i<specs.length-1)r.exits.right={room:specs[i+1][0],x:1,y:7};
 else {r.tiles=r.tiles.map((row,y)=>y>=6&&y<=8?row.slice(0,19)+'#':row);}
 if(kind==='puzzle'){
  r.events.push({id:id+'_switch',x:4,y:10,w:1,h:1,script:'echo_switch',once:id+'_switch'});
  r.box={x:5,y:3,item:['ribbon','glove','tutu','pan'][Math.floor(i/4)],flag:id+'_box'};
 }
 if(['garden','forest','library','puzzle'].includes(kind)&&i!==0)r.encounter=7;
 ROOMS[id]=r;ROOM_NAMES[id]=name;
 const title=['한 장의 승차권','꺼지지 않은 신호','도착하지 않은 편지','누군가의 자리'][i%4];
 const lines=[
  ['* 낡은 승차권에 목적지가 적혀 있다. "아직 정하지 않음."','* 뒷면: "같이 갈 사람이 생기면, 그때 정해도 돼."'],
  ['* 안내판: 초록 스위치는 아래쪽에 있습니다.','* 작은 글씨: "누르는 데 힘은 필요 없습니다. 용기만 조금."'],
  ['* 보내지 못한 편지. "오늘도 역에서 기다렸어."','* "네가 늦어도 괜찮아. 돌아오기만 한다면."'],
  ['* 벤치 위에 누군가의 이름이 새겨져 있다.','* 빈자리 하나를 남겨 둔 건, 잊어서가 아니었다.'],
 ][i%4];
 DETAILS.push({id:'echo_memory_'+i,room:id,x:kind==='bridge'?9:6,y:4,kind:['sign','plaque','bookshelf','bench'][i%4],title,lines,repeat:['* 마음속 수첩에 이 장면이 남아 있다.'],solid:true});
}
ROOMS.echo_arrival.onEnter={script:'echo_intro',once:'echoIntro'};
ROOMS.echo_arrival.npcs=[npc('echo_toriel','toriel',10,5,{lines:['신호는 다섯 개란다. 먼저 오른쪽 문으로 가 보렴.','아래쪽 반짝이는 별에서 Z를 누르면 저장하고 회복할 수 있어.']})];
ROOMS.echo_keeper.npcs=[npc('echo_toriel_guard','toriel',11,5,{when:f=>!f.signal1})];
ROOMS.echo_keeper.events=[event('echo_keeper','echoKeeper')];
ROOMS.echo_snow.onEnter={script:'echo_sans',once:'echoSans'};
ROOMS.echo_snow.npcs=[npc('sans','sans',10,5,{lines:['형의 퍼즐은 아래쪽 스위치부터.','이건 스포일러가 아니라… 고객 서비스야.']})];
ROOMS.echo_cafe.npcs=[npc('rabbit','rabbit',12,5,{shop:'snowdin'}),npc('papyrus','papyrus',7,9,{script:'echo_spaghetti'})];
ROOMS.echo_conductor.npcs=[npc('papyrus','papyrus',11,5,{when:f=>!f.signal2})];
ROOMS.echo_conductor.events=[event('echo_conductor','echoConductor')];
ROOMS.echo_reservoir.onEnter={script:'echo_call',once:'echoCall'};
ROOMS.echo_ghost.npcs=[npc('blook','blook',10,5,{script:'echo_ghost'})];
ROOMS.echo_guard.npcs=[npc('undyne','undyne',11,5,{when:f=>!f.signal3})];
ROOMS.echo_guard.events=[event('echo_guard','echoGuard')];
ROOMS.echo_lab.onEnter={script:'echo_lab',once:'echoLab'};
ROOMS.echo_market.npcs=[npc('vending','vending',12,5,{shop:'hotland'}),npc('temmie','temmie',8,10,{shop:'tem'})];
ROOMS.echo_live.npcs=[npc('mettaton','mettaton',11,5,{when:f=>!f.signal4})];
ROOMS.echo_live.events=[event('echo_live','echoLive')];
ROOMS.echo_hall.onEnter={script:'echo_hall',once:'echoHall'};
ROOMS.echo_observatory.npcs=[npc('asgore','asgore',11,5,{script:'echo_king'})];
ROOMS.echo_judgement.events=[event('echo_judge','echoJudge')];
ROOMS.echo_terminal.npcs=[npc('flowey','flowey',10,5,{script:'echo_final'})];
SCRIPTS.echo_intro=function*(w){
 yield say(null,['* 빛이 꺼진 역. 머리 위로 별 하나가 떨어졌다.','* 손에는 목적지 없는 승차권이 쥐어져 있다.']);
 yield say('토리엘',['깨어났구나, 작은 여행자. 여기는 잊힌 별의 역이란다.','열차가 멈춘 뒤로, 모두 같은 밤에 머물러 있어.','정원, 승강장, 저수지, 방송국, 그리고 종착역. 다섯 신호가 잠들었지.','하지만 신호를 깨우는 방법이 꼭 싸움일 필요는 없단다.']);
 w.player.items=['candy','candy','pie'];w.player.gold=35;
 yield say(null,['* 사탕 두 개, 파이와 35G를 받았다.','* 방향키로 이동 · Z로 대화 · C로 아이템과 수첩.','* 오른쪽으로 가자. 반짝이는 별에서 Z를 누르면 저장할 수 있다.']);
};
SCRIPTS.echo_switch=function*(w){w.player.flags[w.room.id+'_switch']=true;yield {type:'sound',name:'switch'};yield say(null,['* 오래된 회로가 연결되었다. 가시가 내려간다.','* 오른쪽 길이 열렸다.']);};
SCRIPTS.echo_keeper=function*(w){
 yield say('토리엘',['첫 신호는 두려움을 기억하고 있어.','네가 다칠까 봐, 나도 문을 열지 못했단다.','부탁이야. 내 공격 너머에서도 네 마음을 잃지 말아 주렴.']);
 const r=yield fight('toriel');if(r.ended==='dead')return;
 w.player.flags.signal1=true;
 yield say(null,[r.ended==='kill'?'* 첫 신호가 붉게 켜졌다. 아무도 작별 인사를 하지 않았다.':'* 토리엘이 당신의 손에 작은 별을 올려놓았다. 첫 신호가 켜졌다.']);
 yield say('역내 방송',['첫 번째 신호 확인. 승강장으로 이동하십시오.']);
};
SCRIPTS.echo_sans=function*(){yield say('샌즈',['안녕. 넌 열차를 기다리는 쪽이야, 움직이게 하는 쪽이야?','난 기다리는 쪽. 근무 시간도 같이 멈추면 좋겠는데.','형이 명예 차장이 됐거든. 표 검사를 엄청 연습했어.','표보다 네 표정을 먼저 볼 거야. 그러니까… 웃어 줘.']);};
SCRIPTS.echo_spaghetti=function*(w){
 if(w.player.flags.echoDinner){yield say('파피루스',['아까의 시식 평가는 평생 소중히 보관하겠다!']);return;}
 yield say('파피루스',['승객 여러분! 정차 시간이 영원이라면, 저녁도 영원히 먹을 수 있지!','내 특제 별 모양 스파게티를 평가해 주겠나?']);
 const c=yield ask('접시에서 별 하나가 당신을 바라본다.',['한 입 먹는다','만든 마음을 칭찬한다']);
 w.player.flags.echoDinner=true;w.player.hp=w.player.maxHp;
 yield say('파피루스',c===0?['오오! 용감한 승객이다! HP가 전부 회복되었다!']:['요리의 핵심을 꿰뚫다니! 감동해서 회복 마법이 나왔다!']);
};
SCRIPTS.echo_conductor=function*(w){
 yield say('파피루스',['정지! 여기서는 용기 있는 승객만 통과할 수 있다!','파란 영혼이 되면 아래로 떨어진다. 위쪽 방향키로 점프해라!','그리고… 싸우기 싫다면 행동으로 알려 줘. 차장은 승객의 말을 듣지!']);
 const r=yield fight('papyrus');if(r.ended==='dead')return;
 w.player.flags.signal2=true;w.player.flags.papyrusFriend=r.ended!=='kill';
 yield say(null,[r.ended==='kill'?'* 차장의 모자가 선로에 남았다. 두 번째 신호가 켜졌다.':'* 파피루스가 승차권에 별 도장을 찍었다. 두 번째 신호가 켜졌다.']);
};
SCRIPTS.echo_call=function*(){yield {type:'sound',name:'ring'};yield say('알피스',['아, 연결됐다! 난 알피스야. 신호 복구를 보고 있었어.','저수지 신호는 누군가의 목소리를 기다리고 있어.','음악실의 유령에게 가 봐. 아주 작은 목소리라도 끝까지 들어 줘.']);};
SCRIPTS.echo_ghost=function*(w){
 if(w.player.flags.echoGhost){yield say('냅스타블룩',['...이번 노래는 네가 들어 준 밤에 대한 노래야.']);return;}
 yield say('냅스타블룩',['...기차 소리를 녹음하고 있었는데, 기차가 멈췄어.','이제 아무것도 녹음할 수 없는 줄 알았어.','...잠깐, 같이 조용히 있어 줄래?']);
 const c=yield ask('작은 녹음기의 불빛이 깜빡인다.',['끝까지 듣는다','지금은 떠난다']);
 if(c===0){yield {type:'music',name:'waterfall'};yield {type:'wait',s:2};yield say('냅스타블룩',['...들었어? 물소리. 발자국. 네 숨소리.','멈춘 건 열차였지, 세상은 아니었네.','...고마워. 이 소리를 마지막 신호에 보내 줄게.']);w.player.flags.echoGhost=true;w.player.items.length<8&&w.player.items.push('icecream');}
 else yield say('냅스타블룩',['...응. 난 여기 있을게. 언제든 돌아와도 돼.']);
};
SCRIPTS.echo_guard=function*(w){
 yield say('언다인',['인간! 신호가 켜지면 잠겨 있던 기억도 돌아온다.','누군가에게는 그게 다시 상처를 여는 일이야.','그 무게를 견딜 수 있는지 내가 확인하겠다!','초록 영혼에선 방향키로 방패를 돌려라. 화살이 오는 쪽을 바라봐!']);
 const r=yield fight('undyne');if(r.ended==='dead')return;
 w.player.flags.signal3=true;
 if(r.ended==='kill'){yield say(null,['* 세 번째 신호. 수면에는 아무것도 비치지 않는다.']);return;}
 yield say('언다인',['헉... 갑옷이 너무 뜨거워.','...내가 지키려던 건 문이 아니라, 문 뒤의 사람들이었는데.']);
 const c=yield ask('언다인이 무릎을 꿇었다.',['차가운 물을 건넨다','신호를 향해 간다']);
 w.player.flags.echoWater=c===0;
 yield say('언다인',c===0?['날 쓰러뜨리고도 도와주는 거냐.','좋아. 다음엔 열차의 제일 앞자리에 앉아! 내가 길을 지켜 줄게.']:['...가라. 아직 해야 할 일이 있잖아.']);
};
SCRIPTS.echo_lab=function*(){yield say('알피스',['네, 네 번째 신호는 방송국 안에 있어.','메타톤은 마지막 방송이 끝나면 모두 자기를 잊을까 봐 두려워해.','행동으로 시청률을 올려 봐. 누군가 보고 있다는 걸 알려 주면 돼.','파란 탄막은 멈추면 안전하고, 주황 탄막은 움직여야 안전해!']);};
SCRIPTS.echo_live=function*(w){
 yield say('메타톤',['OH YES! 멈춘 세계에서 유일하게 생방송 중인 스타!','오늘의 주제는 작별! 하지만 채널을 돌릴 수는 없어, 달링!','네가 날 기억한다는 걸 무대 위에서 증명해 줘!']);
 const r=yield fight('mettaton');if(r.ended==='dead')return;
 w.player.flags.signal4=true;
 yield say(null,[r.ended==='kill'?'* 화면에 신호 없음이라는 글자가 남았다. 네 번째 신호가 켜졌다.':'* 방송이 끝나고도 박수 소리는 남았다. 네 번째 신호가 켜졌다.']);
};
SCRIPTS.echo_hall=function*(w){
 const f=w.player.flags;yield say('역내 방송',[`복구된 신호: ${[f.signal1,f.signal2,f.signal3,f.signal4].filter(Boolean).length} / 4. 종착역 접근 중.`]);
 yield say(null,['* 천장의 별들은 빛이 아니라 작은 창이었다.','* 그 너머에는 아직 아침이 오지 않았다.']);
};
SCRIPTS.echo_king=function*(w){
 yield say('아스고어',['차를 한 잔 하겠니? 열차가 서 있는 동안 많이 끓였단다.','마지막 신호는 기억을 연료로 삼는다.','기억을 지우면 너 혼자 나갈 수 있다. 기억을 잇는다면… 모두가 아침을 맞을 수도 있지.','친구가 되어 준 차장, 누군가에게 건넨 물, 끝까지 들어 준 노래.','그 작은 일들이 없다면 신호는 방향을 잃는다.']);
 w.player.hp=w.player.maxHp;w.player.flags.echoKing=true;
 yield say(null,['* 따뜻한 차를 마셨다. HP가 완전히 회복되었다.','* 아직 할 일이 남았다면 왼쪽 길로 돌아갈 수 있다.']);
};
SCRIPTS.echo_judge=function*(w){
 const p=w.player;yield say('샌즈',[`여기까지 왔네. 네가 남긴 먼지는 ${p.kills}명분이야.`,p.kills===0?'넌 한 명도 죽이지 않았어. 그런 여행도 가능하다는 걸 보여 줬네.':'신호는 켜졌지만, 빈자리까지 채워 주진 못해.','마지막 선택을 하기 전에 돌아봐. 아직 돌아갈 길은 열려 있어.']);
 if(p.kills>=12&&['toriel','papyrus','undyne','mettaton'].every(id=>(p.bossFate[id] || (id==='undyne'?p.bossFate.undying:id==='mettaton'?p.bossFate.neo:null))==='killed')){
 yield say('샌즈',['하지만… 네가 모두의 자리를 지워 버렸다면.','이번 역에서는 내릴 시간이야.']);const r=yield fight('sans','sans');if(r.ended==='dead')return;w.player.flags.echoDark=true;
 }
};
SCRIPTS.echo_final=function*(w){
 const p=w.player,f=p.flags;
 if(![f.signal1,f.signal2,f.signal3,f.signal4].every(Boolean)){
 yield say('플라위',['신호가 모자라잖아! 다섯 신호라고 했지, 지름길 다섯 개가 아니라고.','정원, 승강장, 저수지, 방송국으로 돌아가. 그곳의 문지기를 만나!']);return;
 }
 yield say('플라위',['드디어 왔네. 난 이 밤이 끝나지 않았으면 좋겠어.','아침이 오면… 날 기억해 줄 사람이 없을 테니까.','자. 표를 보여 줘. 그리고 네가 원하는 아침을 골라.']);
 const c=yield ask('마지막 신호를 어떻게 켤까?',['모두의 기억을 잇는다','기억을 두고 혼자 떠난다']);
 if(f.echoDark){yield say(null,['* 손을 올렸지만 응답하는 목소리가 없었다.','* 열차는 빈 객차를 달고 어둠 속으로 사라졌다.']);yield {type:'ending',kind:'genocide'};return;}
 const friends=p.kills===0&&f.papyrusFriend&&f.echoWater&&f.echoGhost;
 if(c===0&&friends){
 yield say('플라위',['...왜 내 기억까지 가져가려는 거야?','그만둬. 나는…','...아스리엘. 그게 내가 잊으려던 이름이야.']);
 yield fight('asriel','asriel');
 yield say(null,['* 부서진 신호 사이로, 친구들의 목소리가 이어졌다.','* 다섯 번째 별은 처음부터 당신의 손에 있었다.']);
 yield {type:'ending',kind:'pacifist'};return;
 }
 if(c===0){
 yield say('플라위',['기억은 선을 잇는 것만으로 돌아오지 않아.','네가 놓친 목소리까지, 내가 전부 들려줄게!']);
 const r=yield fight('flowey','flowey_boss');if(r.ended==='dead')return;
 yield say(null,['* 신호가 희미하게 켜졌다. 모든 객차를 움직이기엔 빛이 부족했다.']);
 }
 yield {type:'ending',kind:'neutral',lines:c===1?['기억을 두고 열차에 올랐다.','아침 햇살이 빈 옆자리에 닿았다.','승차권 뒤에 작은 글씨가 나타났다.','"다음엔, 같이 갈 수 있을까."']:['마지막 신호가 잠깐 반짝였다.','당신의 객차만 지상으로 올라왔다.','끝까지 듣지 못한 목소리가 뒤에 남아 있다.','다음 여행에서는 누군가의 곁에 더 머물 수 있을까.']};
};
Object.assign(ENDINGS.pacifist,{title:'모두의 아침',subtitle:'ECHO / EVERYONE HOME',lines:['열차가 움직였다. 아주 천천히, 그러나 분명하게.','파피루스는 모든 승차권에 별을 찍었다.','언다인은 맨 앞에서, 유령은 작은 음악과 함께.','토리엘의 파이는 아직 따뜻했다.','플라위가 아닌 아스리엘도, 창밖의 아침을 보았다.','당신이 살려 둔 목소리들이, 마침내 하나의 노래가 되었다.']});
Object.assign(ENDINGS.neutral,{title:'빈 옆자리',subtitle:'ECHO / ONE WAY',lines:['혼자 탄 열차가 아침에 도착했다.']});
Object.assign(ENDINGS.genocide,{title:'종착역 없음',subtitle:'ECHO / NO ONE LEFT',lines:['모든 신호가 붉게 켜졌다.','열차에 탈 사람은 남지 않았다.','빈 승차권 한 장이 선로 위에서 흔들렸다.','밤은 끝났지만, 아무도 아침을 보지 못했다.']});
