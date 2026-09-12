// 언더테일 팬 게임 · 게임 데이터 (몬스터, 아이템, 경험치표, 지역, 결말 텍스트)
// 원작 캐릭터: Toby Fox. 대사와 그래픽, 수치 밸런스는 이 게임을 위해 새로 작성했습니다.

// ---------- 경험치·스탯 ----------
// 원작의 LV별 필요 EXP (누적)를 그대로 채택했다. LV 20이 최대이며 HP 99가 된다.
export const EXP_TABLE = [0, 10, 30, 70, 120, 200, 300, 500, 800, 1200, 1700, 2500, 3500, 5000, 7000, 10000, 15000, 25000, 50000, 99999];
export function levelFor(exp) { let lv = 1; while (lv < 20 && exp >= EXP_TABLE[lv]) lv++; return lv; }
export function maxHpFor(lv) { return lv >= 20 ? 99 : 16 + 4 * lv; }
export function baseAttack(lv) { return 8 + 2 * lv; }
export function baseDefense(lv) { return 9 + Math.floor(lv / 4); }

// ---------- 아이템 ----------
export const ITEMS = {
  candy: { name: '몬스터 사탕', heal: 10, text: '리코리스 맛이 난다.' },
  donut: { name: '거미 도넛', heal: 12, text: '거미 사이다로 만든 도넛. 거미도 들어갔다.' },
  pie: { name: '버터스카치 파이', heal: 99, text: '토리엘이 구워 준 파이. 마음까지 따뜻해진다.' },
  snowman: { name: '눈사람 조각', heal: 45, text: '눈사람의 부탁이 담긴 조각. 멀리 가져가 달라고 했다.' },
  bunny: { name: '시나몬 토끼', heal: 22, text: '설원 상점의 명물. 달콤하고 폭신하다.' },
  icecream: { name: '나이스 크림', heal: 15, text: '포장지에 "넌 참 멋져!"라고 적혀 있다.' },
  noodles: { name: '즉석 라면', heal: 4, text: '끓일 시간이 없어서 그냥 먹었다. 4 회복.' },
  tem: { name: '템 플레이크', heal: 2, text: '색종이 조각… 인 것 같다. 템미가 만들었다.' },
  glamburger: { name: '글램버거', heal: 27, text: '반짝이와 접착제로 만든 햄버거. 의외로 맛있다.' },
  steak: { name: '아스고어 스테이크', heal: 60, text: '얼굴 모양 스테이크. 뭔가 미안한 기분.' },
  dream: { name: '꿈', heal: 99, text: '희미하게 반짝이는 기억. 잃어버린 친구들의 얼굴이 떠오른다.' },
  // 장비. 무기는 AT, 방어구는 DF를 더한다.
  stick: { name: '나뭇가지', weapon: 0, text: '길이가 딱 좋은 나뭇가지. 강아지가 좋아할 것 같다.' },
  toyknife: { name: '장난감 칼', weapon: 3, text: '플라스틱 칼. 폐허에서 주웠다.' },
  glove: { name: '터프 글러브', weapon: 5, text: '분홍색 가죽 장갑. 주먹에 힘이 실린다.' },
  shoes: { name: '발레 슈즈', weapon: 7, text: '발끝으로 서면 기분이 이상해진다.' },
  pan: { name: '탄 프라이팬', weapon: 10, text: '치명적인 무기라기엔 좀 그렇지만 상당히 무겁다.' },
  knife: { name: '진짜 칼', weapon: 99, text: '여기서 왔다. 이제 돌아갈 곳이다.' },
  bandage: { name: '반창고', armor: 0, text: '이미 여러 번 쓴 반창고.' },
  ribbon: { name: '빛바랜 리본', armor: 3, text: '귀엽게 보이면 몬스터들이 살살 때린다.' },
  bandanna: { name: '용감한 두건', armor: 7, text: '멋진 복근 그림이 그려진 두건.' },
  tutu: { name: '낡은 튀튀', armor: 10, text: '마침내 진정한 발레리나가 될 수 있다.' },
  apron: { name: '얼룩진 앞치마', armor: 11, text: '두 턴마다 HP를 1 회복한다.' },
  locket: { name: '로켓 목걸이', armor: 99, text: '"최고의 친구들에게". 안에는 사진이 들어 있다.' },
};

// ---------- 몬스터 ----------
// act: ACT 메뉴 항목. spare: 조건이 만족되면 자비로 살려보낼 수 있다.
// flavor: 전투 시작/대기 문구. 죽였을 때와 살려보냈을 때 각각 다른 문구가 나온다.
export const MONSTERS = {
  dummy: { name: '훈련용 인형', area: 'ruins', hp: 30, at: 0, df: 0, exp: 0, gold: 0, boss: false, dummy: true,
    flavor: ['* 훈련용 인형이 조용히 서 있다.'],
    acts: [{ id: 'talk', name: '말 걸기', text: '* 인형에게 말을 걸었다. 대답은 없지만 토리엘이 흐뭇해 보인다.', spare: true }],
    spareText: '* 인형은 처음부터 싸울 마음이 없었다.', patterns: ['none'] },
  froggit: { name: '프로깃', area: 'ruins', hp: 30, at: 4, df: 4, exp: 10, gold: 2,
    flavor: ['* 프로깃이 폴짝거린다.', '* 프로깃은 당신이 뭘 원하는지 이해하지 못한다.', '* 프로깃이 진지하게 개굴거린다.'],
    acts: [{ id: 'compliment', name: '칭찬하기', text: '* 프로깃은 칭찬을 이해하지 못했지만 어쨌든 얼굴이 빨개졌다.', spare: true },
      { id: 'threat', name: '위협하기', text: '* 프로깃은 위협을 이해하지 못했지만 어쨌든 도망친다.', flee: true }],
    spareText: '* 프로깃은 당신이 더 이상 싸우고 싶지 않다는 걸 알았다.', patterns: ['flyRing', 'hopWave'] },
  whimsun: { name: '윔선', area: 'ruins', hp: 10, at: 5, df: 0, exp: 2, gold: 2,
    flavor: ['* 윔선이 눈에 띄지 않으려고 애쓴다.', '* 윔선이 사과의 말을 중얼거린다.'],
    acts: [{ id: 'console', name: '위로하기', text: '* 윔선은 너무 감동해서 날아가 버렸다.', spare: true },
      { id: 'terrorize', name: '겁주기', text: '* 윔선은 그 자리에서 기절할 뻔했다.', spare: true }],
    spareText: '* 윔선이 훌쩍이며 떠났다.', patterns: ['mothDrift'] },
  moldsmal: { name: '몰드스몰', area: 'ruins', hp: 50, at: 6, df: 0, exp: 3, gold: 3,
    flavor: ['* 몰드스몰이 천천히 출렁인다.', '* 젤리 냄새가 난다.'],
    acts: [{ id: 'wiggle', name: '꿈틀거리기', text: '* 당신도 같이 엉덩이를 흔들었다. 몰드스몰이 감동했다.', spare: true },
      { id: 'flirt', name: '추파 던지기', text: '* 몰드스몰이 슬며시 흔들린다. 통한 것 같다.', spare: true }],
    spareText: '* 몰드스몰은 흡족하게 출렁인다.', patterns: ['jellyFountain'] },
  snowdrake: { name: '스노우드레이크', area: 'snowdin', hp: 74, at: 6, df: 2, exp: 12, gold: 10,
    flavor: ['* 스노우드레이크가 아재개그를 준비한다.', '* "얼음 처럼… 쿨하게 봐줘!"'],
    acts: [{ id: 'laugh', name: '웃어주기', text: '* 억지로 웃어 줬다. 스노우드레이크가 인생 최고의 순간이라고 외친다.', spare: true },
      { id: 'heckle', name: '야유하기', text: '* 스노우드레이크가 상처받았다. 공격이 강해진다.', angry: true }],
    spareText: '* 스노우드레이크는 아버지에게 자랑하러 갔다.', patterns: ['crescentFan', 'snowSpiral'] },
  icecap: { name: '아이스캡', area: 'snowdin', hp: 48, at: 5, df: 0, exp: 11, gold: 15,
    flavor: ['* 아이스캡이 자기 모자를 자랑한다.', '* "내 모자 좀 봐 줘! 제발!"'],
    acts: [{ id: 'ignore', name: '무시하기', text: '* 모자를 무시했다. 아이스캡은 필사적으로 관심을 끌려 한다.', stage: 1 },
      { id: 'steal', name: '모자 벗기기', text: '* 모자를 벗겨 버렸다. 그저 작은 얼음 덩어리다. 편안해 보인다.', needStage: 1, spare: true },
      { id: 'compliment', name: '모자 칭찬', text: '* "그… 그렇지? 내 모자 멋지지?" 아이스캡이 우쭐해한다.' }],
    spareText: '* 아이스캡이 조용히 녹아내리듯 떠났다.', patterns: ['icicleRain'] },
  lesserdog: { name: '레서독', area: 'snowdin', hp: 60, at: 6, df: 4, exp: 18, gold: 30,
    flavor: ['* 레서독이 꼬리를 흔든다.', '* 목이 조금 길어졌다.', '* 목이 화면 밖으로 나갔다.'],
    acts: [{ id: 'pet', name: '쓰다듬기', text: '* 쓰다듬었다. 레서독의 목이 길어진다. 흥분이 가라앉지 않는다.', spare: true, stackable: true },
      { id: 'play', name: '놀아주기', text: '* 나뭇가지를 던졌다. 레서독이 물어 오고 또 물어 온다.', spare: true }],
    spareText: '* 레서독은 만족스럽게 짖으며 떠났다.', patterns: ['dogSpears'] },
  aaron: { name: '아론', area: 'waterfall', hp: 98, at: 8, df: 4, exp: 24, gold: 25,
    flavor: ['* 아론이 근육을 뽐낸다. ;)', '* 아론의 윙크에 물결이 인다.'],
    acts: [{ id: 'flex', name: '플렉스', text: '* 당신도 근육을 뽐냈다. 아론이 더 세게 뽐낸다. ;)', stage: 1, stackable: true, spareAt: 3 },
      { id: 'shoo', name: '쫓아내기', text: '* 아론은 근육 얘기가 아니면 듣지 않는다.' }],
    spareText: '* 아론은 너무 세게 플렉스해서 방 밖으로 날아갔다.', patterns: ['muscleWave'] },
  woshua: { name: '워슈아', area: 'waterfall', hp: 70, at: 8, df: 3, exp: 20, gold: 20,
    flavor: ['* 워슈아가 당신의 옷에 묻은 얼룩을 노려본다.', '* "깨끗하게… 깨끗하게…"'],
    acts: [{ id: 'clean', name: '씻겨달라기', text: '* 워슈아가 신나서 당신을 씻긴다. 깨끗해졌다!', spare: true },
      { id: 'joke', name: '더러운 농담', text: '* 워슈아가 충격을 받고 물을 더 세게 뿌린다.', angry: true }],
    spareText: '* 워슈아가 흡족하게 거품을 내며 떠났다.', patterns: ['soapBubbles'] },
  temmie: { name: '템미', area: 'waterfall', hp: 5, at: 0, df: 0, exp: 0, gold: 1,
    flavor: ['* 템미가 진동한다. "안녕!! 나는 템미!!!"', '* "템 대학 가고 싶어…"'],
    acts: [{ id: 'talk', name: '말 걸기', text: '* 템미가 너무 좋아서 얼굴이 길어졌다. "학비 좀…"', spare: true },
      { id: 'flex', name: '플렉스', text: '* 템미가 당신의 근육에 알레르기 반응을 일으켰다.', spare: true }],
    spareText: '* 템미는 템 마을로 돌아갔다.', patterns: ['temFlakes'] },
  vulkin: { name: '벌킨', area: 'hotland', hp: 20, at: 9, df: 8, exp: 30, gold: 45,
    flavor: ['* 벌킨이 당신을 도와주려고 용암을 내뿜는다.', '* "더워? 내가 데워 줄게!"'],
    acts: [{ id: 'encourage', name: '격려하기', text: '* "고마워!!" 벌킨이 행복하게 폭발할 뻔했다.', spare: true },
      { id: 'criticize', name: '비판하기', text: '* 벌킨이 슬퍼한다. 공격이 더 뜨거워진다.', angry: true }],
    spareText: '* 벌킨은 다른 사람을 도우러 갔다.', patterns: ['lavaSpit'] },
  tsunderplane: { name: '츤데플레인', area: 'hotland', hp: 12, at: 5, df: 3, exp: 40, gold: 90,
    flavor: ['* 츤데플레인이 다가온다. "너 때문에 온 거 아니거든!"', '* 츤데플레인이 새침하게 선회한다.'],
    acts: [{ id: 'approach', name: '다가가기', text: '* 조금 다가갔다. "가까이 오지 마… 아니 가도 돼."', stage: 1 },
      { id: 'flirt', name: '추파 던지기', text: '* 츤데플레인이 새빨개져서 어디론가 날아갔다.', needStage: 1, spare: true }],
    spareText: '* 츤데플레인은 아무렇지 않은 척 떠났다.', patterns: ['planeStrafe'] },
  pyrope: { name: '파이로프', area: 'hotland', hp: 40, at: 5, df: 8, exp: 32, gold: 45,
    flavor: ['* 파이로프가 열기에 몸을 흔든다.', '* "더 뜨겁게! 더 뜨겁게!"'],
    acts: [{ id: 'heat', name: '불 붙이기', text: '* 파이로프를 부추겼다. 너무 뜨거워져서 스스로 만족했다.', spare: true },
      { id: 'cool', name: '식히기', text: '* 파이로프가 몸서리친다. "차가운 건 질색이야!"', angry: true }],
    spareText: '* 파이로프가 불꽃놀이처럼 날아갔다.', patterns: ['ropeSwing'] },
  // ---------- 보스 ----------
  toriel: { name: '토리엘', area: 'ruins', hp: 440, at: 8, df: 1, exp: 200, gold: 0, boss: true, exec: true,
    flavor: ['* 토리엘이 슬픈 눈으로 당신을 바라본다.', '* 토리엘이 아무 말 없이 불꽃을 준비한다.', '* 토리엘이 살짝 시선을 피한다.'],
    acts: [{ id: 'talk', name: '말 걸기', text: '* 무언가 말하려 했지만 토리엘은 듣지 않는다.' }],
    // 자비를 여러 번 선택해야 마음이 흔들린다.
    mercyTurns: 7,
    mercyLines: ['* 토리엘이 살짝 시선을 피한다.', '* 토리엘이 무슨 말을 하려다 만다.', '* "…네가 정말 폐허를 떠나고 싶다면, 내가 막을 수 없겠구나."', '* "밖은 위험해. 아스고어가 너를 죽일 거야."', '* "하지만 넌 강하구나… 아니, 다정한 아이구나."', '* "가렴, 나의 아이. 그리고 부디 다시는 돌아오지 말아 주렴."'],
    lowHpLine: '* 토리엘의 공격이 일부러 당신을 피해 간다.',
    patterns: ['fireRain', 'fireSweep', 'fireHands', 'fireLowHp'] },
  papyrus: { name: '파피루스', area: 'snowdin', hp: 400, at: 8, df: 2, exp: 200, gold: 0, boss: true, exec: true,
    flavor: ['* 파피루스가 위대한 포즈를 취한다.', '* 파피루스가 스파게티 생각을 한다.', '* 파피루스는 당신이 뼈를 좋아하는지 궁금해한다.'],
    acts: [{ id: 'check', name: '조사', text: '* 파피루스 - AT 8 DF 2. 뼈만 남을 때까지 근성.' },
      { id: 'flirt', name: '추파 던지기', text: '* "뭐라고?! 데이트?! 네 나쁜 계략에 넘어가지 않겠다… 전투가 끝난 뒤에 보자!"' },
      { id: 'insult', name: '놀리기', text: '* "너 같은 인간에게 놀림받다니… 오히려 자신감이 생기는군!"' }],
    mercyTurns: 8, // 이 턴 수만큼 그의 공격을 견디면 그가 스스로 포기한다.
    mercyLines: ['* "네가 얼마나 버티는지 보자!"', '* "흠, 제법인데!"', '* "위대한 파피루스의 파란 공격이다!"', '* "네가… 그렇게 강한가?"', '* "특별 공격을 준비해야겠어!"', '* "이건… 내 특별 공격이다!!!"', '* "…끝났다. 내가 졌군. 너를 붙잡을 수가 없어."'],
    genocideMercy: true,
    patterns: ['bonesLow', 'bonesGap', 'blueBones', 'bonesJump', 'bonesTall', 'bonesRush', 'special'] },
  undyne: { name: '언다인', area: 'waterfall', hp: 900, at: 9, df: 3, exp: 500, gold: 0, boss: true,
    flavor: ['* 언다인이 창을 겨눈다.', '* "어서 덤벼! 인간!"', '* 언다인이 숨을 고른다.'],
    acts: [{ id: 'check', name: '조사', text: '* 언다인 - AT 9 DF 3. 왕실 근위대장. 물러설 줄 모른다.' },
      { id: 'plead', name: '애원하기', text: '* 언다인은 애원을 듣지 않는다. "너는 인류 최후의 희망이 될 수 없어!"' },
      { id: 'flee', name: '도망치기', text: '* 도망칠 기회를 엿본다.', fleeCount: 1 }],
    fleeTurns: 6, // 이 턴 수만큼 도망 행동을 하면 열지대로 도망칠 수 있다.
    lines: ['* "움직이지 마! 초록 영혼으론 도망 못 쳐!"', '* "방패로 화살을 막아 봐라!"', '* "빠르게 온다!"', '* "너… 왜 반격하지 않는 거지?"', '* "젠장! 왜 이렇게 끈질긴 거야!"'],
    patterns: ['arrows1', 'arrows2', 'arrowsFast', 'spearRain', 'arrows3'] },
  undying: { name: '언다인 더 언다잉', area: 'waterfall', hp: 1000, at: 12, df: 6, exp: 1500, gold: 0, boss: true,
    flavor: ['* 언다인의 몸이 결의로 떨린다.', '* "널 여기서 멈추게 하겠어!"', '* "이건 모두의 희망이야!"'],
    acts: [{ id: 'check', name: '조사', text: '* 언다인 더 언다잉 - 몬스터 세계의 영웅. 절대 물러서지 않는다.' }],
    lines: ['* "널 이 세상에서 지워 주겠어!"', '* "몬스터의 미래를 위해!"', '* "아직이야… 아직 무너지지 않아!"'],
    patterns: ['arrowsFast', 'arrows3', 'spearRain', 'arrowStorm', 'spearWall'] },
  mettaton: { name: '메타톤 EX', area: 'hotland', hp: 900, at: 8, df: 4, exp: 800, gold: 0, boss: true,
    flavor: ['* 메타톤 EX가 무대에 등장한다. "OH YES!"', '* 시청률이 오르고 있다.', '* 조명이 당신을 비춘다.'],
    acts: [{ id: 'pose', name: '포즈', text: '* 극적인 포즈를 취했다! 시청자들이 열광한다! (+900)', ratings: 900 },
      { id: 'boast', name: '자랑', text: '* 자신만만하게 자랑했다. (+500)', ratings: 500 },
      { id: 'dance', name: '춤추기', text: '* 메타톤과 함께 춤췄다. HP를 조금 회복했다. (+400)', ratings: 400, heal: 6 }],
    ratingsGoal: 4000, spareText: '* 메타톤: "시청률 최고 기록이야, 달링! 오늘 쇼는 여기까지!"',
    lines: ['* "시청률이 좀 오르는군, 달링!"', '* "다리를 봐! 이 다리를!"', '* "폭탄이야, 달링!"', '* "이제 피날레야!"'],
    patterns: ['legs', 'discoBall', 'bombs', 'hearts'] },
  neo: { name: '메타톤 NEO', area: 'hotland', hp: 1000, at: 12, df: 0, exp: 1000, gold: 0, boss: true,
    flavor: ['* 메타톤 NEO가 팔 캐논을 겨눈다.', '* "지하 세계를 지켜야 해."'],
    acts: [{ id: 'check', name: '조사', text: '* 메타톤 NEO - 화력은 최대지만 장갑은… 없다.' }],
    patterns: ['neoBeam'] },
  asgore: { name: '아스고어', area: 'castle', hp: 1000, at: 10, df: 5, exp: 0, gold: 0, boss: true, noMercy: true,
    flavor: ['* 아스고어가 슬픈 눈으로 삼지창을 든다.', '* 아스고어가 당신의 눈을 보지 못한다.', '* "…미안하구나."'],
    acts: [{ id: 'check', name: '조사', text: '* 아스고어 - 왕. 그의 눈은 한 번도 당신을 똑바로 본 적이 없다.' },
      { id: 'talk', name: '말 걸기', text: '* 아스고어는 대답하지 않는다. 그럴 자격이 없다고 생각하는 듯하다.' }],
    lines: ['* 아스고어의 삼지창이 흔들린다.', '* "인간이여… 이것이 내 의무다."', '* 아스고어가 이를 악문다.', '* "…빨리 끝내자꾸나."'],
    patterns: ['tridentSweep', 'fireCircle', 'fireWaves', 'tridentBounce'] },
  flowey: { name: '플라위', area: 'castle', hp: 1200, at: 14, df: 2, exp: 0, gold: 0, boss: true,
    flavor: ['* 플라위가 여섯 영혼의 힘으로 낄낄댄다.', '* "이 세계에서는 죽이거나 죽거나야!"', '* "네 세이브는 이제 내 거야."'],
    acts: [{ id: 'check', name: '조사', text: '* 플라위 - 여섯 영혼의 힘. 완전히 미쳐 있다.' },
      { id: 'call', name: '도움 요청', text: '* 영혼들에게 호소했다… 누군가 듣고 있는 것 같다.', soulHelp: true }],
    lines: ['* "이제 어떻게 할 거야? 세이브도 못 하는데!"', '* "친구들이 널 구해 줄 것 같아? 하하하!"', '* "왜 아직 살아 있는 거야?!"', '* 여섯 영혼이 흔들린다.'],
    patterns: ['pelletSpray', 'fingerGuns', 'flameThrower', 'bombDrop', 'soulBreak'] },
  asriel: { name: '아스리엘 드리무르', area: 'castle', hp: 99999, at: 15, df: 10, exp: 0, gold: 0, boss: true, immortal: true,
    flavor: ['* 아스리엘이 세계를 뒤흔든다.', '* "지지 마! 아직은!"', '* 별빛이 당신 안에서 반짝인다.'],
    acts: [{ id: 'check', name: '조사', text: '* 아스리엘 드리무르 - 절대신. 하지만 아직 어린아이다.' },
      { id: 'hope', name: '희망', text: '* 희망을 품었다. 두려움이 조금 가라앉는다.', heal: 99 },
      { id: 'dream', name: '꿈', text: '* 잃어버린 친구들을 떠올렸다.', heal: 99 },
      { id: 'save', name: '구하기', text: '* 누군가의 마음에 닿았다.', save: true }],
    lostSouls: [['언다인', '알피스'], ['파피루스', '샌즈'], ['토리엘', '아스고어']],
    lines: ['* "너를 이길 거야, 그리고 이 세계를 되돌릴 거야."', '* "왜… 왜 아직도 서 있는 거야?"', '* 잃어버린 영혼들이 당신 곁에 나타난다.', '* "…그만 해 줘."'],
    patterns: ['starBlazing', 'chaosSaber', 'shockerBreaker', 'hyperGoner'] },
  sans: { name: '샌즈', area: 'castle', hp: 1, at: 1, df: 1, exp: 0, gold: 0, boss: true, karma: true, dodges: true,
    flavor: ['* 샌즈가 웃고 있다.', '* 샌즈가 땀을 흘리고 있다.', '* 최악의 시간을 보내고 있다.'],
    acts: [{ id: 'check', name: '조사', text: '* 샌즈 - AT 1 DF 1. 가장 쉬운 적. 상대할 수 있는 건 겨우 1 HP…' }],
    dodgeTurns: 14, // 이 턴 수만큼 피하면 특별 공격 뒤 잠든다.
    lines: ['* "좋은 날이지? 새들이 지저귀고, 꽃이 피고… 이런 날엔 너 같은 애들은…"', '* "…지옥에서 불타야 해."', '* "뭐, 그런 눈으로 보지 마."', '* "이런 전투 처음이지? 최악의 시간을 보내게 해 줄게."', '* "우리 서로 지치니까 그냥 여기서 그만할래?"', '* "…농담이야. 여기서 끝낼 순 없지."', '* "네가 몇 번이나 죽었는지 알아. 난 다 기억해."', '* "파피루스는… 널 믿었어."', '* "내 형은 널 좋아했어. 그리고 넌…"', '* "…미안하지만, 지겹네."', '* "특별 공격이다. 준비해."', '* "…"', '* "사실 특별 공격은 이거야: 아무것도 안 하기. 네 차례가 영원히 안 온다면?"', '* 샌즈가 졸고 있다…'],
    patterns: ['bonesSlam', 'blasterCross', 'bonePlatforms', 'blasterSpin', 'boneWalls', 'gravityFlip', 'blasterRain', 'boneRain', 'finalBarrage', 'nothing'] },
};

// ---------- 지역 ----------
// genocideQuota: 몰살 루트에서 이 수만큼 죽여야 "아무도 오지 않았다"가 뜬다.
export const AREAS = {
  ruins: { name: '폐허', encounters: ['froggit', 'whimsun', 'moldsmal'], genocideQuota: 6, boss: 'toriel', theme: 'ruins' },
  snowdin: { name: '설원', encounters: ['snowdrake', 'icecap', 'lesserdog'], genocideQuota: 6, boss: 'papyrus', theme: 'snowdin' },
  waterfall: { name: '폭포', encounters: ['aaron', 'woshua', 'temmie'], genocideQuota: 6, boss: 'undyne', theme: 'waterfall' },
  hotland: { name: '열지대', encounters: ['vulkin', 'tsunderplane', 'pyrope'], genocideQuota: 6, boss: 'mettaton', theme: 'hotland' },
  castle: { name: '새 집', encounters: [], genocideQuota: 0, boss: 'asgore', theme: 'castle' },
};
export const AREA_ORDER = ['ruins', 'snowdin', 'waterfall', 'hotland', 'castle'];

// ---------- 상점 ----------
export const SHOPS = {
  snowdin: { name: '설원 상점', keeper: '토끼 아주머니', greeting: '어서 오렴, 여행자. 설원은 처음이지?', items: [['bunny', 25], ['glove', 50], ['bandanna', 50]] },
  tem: { name: '템 상점', keeper: '템미', greeting: '어서 와!!! 템 상점!!! 템 플레이크 사!!!', items: [['tem', 3], ['icecream', 15], ['shoes', 70]] },
  hotland: { name: 'MTT 자판기', keeper: '자판기', greeting: '삐빅. 메타톤 브랜드 상품을 고르세요.', items: [['glamburger', 120], ['noodles', 25], ['tutu', 100]] },
};

// ---------- 결말 텍스트 ----------
export const ENDINGS = {
  pacifist: { title: '불살 결말', subtitle: 'TRUE PACIFIST', lines: [
    '결계가 무너졌다.', '몬스터들은 오랜만에 진짜 하늘을 보았다.', '토리엘은 당신에게 함께 살자고 말했다.', '파피루스는 인간들에게 스파게티를 대접할 계획을 세운다.', '언다인과 알피스는 바다를 보러 갔다.', '샌즈는… 여전히 농담을 한다.', '아스고어는 정원을 가꾸기로 했다.', '그리고 당신은, 해가 뜨는 곳에서 친구들과 함께 서 있다.'] },
  neutral: { title: '중립 결말', subtitle: 'NEUTRAL', lines: ['결계 너머로 나왔지만, 지하 세계는 그대로 남아 있다.', '전화가 울린다.'] },
  genocide: { title: '몰살 결말', subtitle: 'GENOCIDE', lines: ['아무도 남지 않았다.', '바람 소리만이 들린다.'] },
};
