// 상점: 뿌요 스킨과 터질 때 나오는 효과 (인혁이 기획서 9번)
export const SKINS = [
  { id: 'classic', name: '기본 뿌요', price: 0, level: 1, desc: '말랑말랑 동그란 원조 뿌요.' },
  { id: 'symbol', name: '모양 뿌요', price: 200, level: 1, desc: '색마다 ♥ ◆ ● ★ ▲ 모양이 있어서 구별하기 쉬워요.' },
  { id: 'jelly', name: '말랑 젤리', price: 300, level: 2, desc: '속이 비치는 투명 젤리.' },
  { id: 'candy', name: '알사탕', price: 450, level: 3, desc: '빙글빙글 소용돌이 사탕.' },
  { id: 'cat', name: '고양이 뿌요', price: 650, level: 4, desc: '뾰족 귀와 수염이 달린 냥뿌요.' },
  { id: 'fruit', name: '과일 뿌요', price: 850, level: 5, desc: '딸기·사과·블루베리·레몬·포도.' },
  { id: 'gem', name: '보석 뿌요', price: 1100, level: 6, desc: '반짝이는 보석으로 깎았어요.' },
  { id: 'pixel', name: '픽셀 뿌요', price: 1300, level: 7, desc: '옛날 게임기 같은 네모 뿌요.' },
  { id: 'planet', name: '행성 뿌요', price: 1700, level: 9, desc: '고리를 두른 작은 행성들.' },
  { id: 'neon', name: '네온 뿌요', price: 2100, level: 11, desc: '어둠 속에서 빛나는 네온사인.' },
  { id: 'ghost', name: '유령 뿌요', price: 2600, level: 13, desc: '흐물흐물 꼬리가 달린 유령.' },
  { id: 'bunny', name: '토끼 뿌요', price: 700, level: 4, desc: '길쭉한 두 귀가 쫑긋!' },
  { id: 'bear', name: '곰돌이 뿌요', price: 900, level: 5, desc: '동그란 귀와 작은 코의 곰돌이.' },
  { id: 'robot', name: '로봇 뿌요', price: 1400, level: 7, desc: '안테나와 반짝이는 전자 눈.' },
  { id: 'donut', name: '도넛 뿌요', price: 1600, level: 8, desc: '알록달록 토핑을 올린 도넛.' },
  { id: 'flower', name: '꽃송이 뿌요', price: 1800, level: 9, desc: '다섯 가지 색으로 피어나는 꽃.' },
  { id: 'dragon', name: '꼬마 드래곤', price: 2400, level: 12, desc: '작은 뿔과 날개를 가진 용.' },
  { id: 'astronaut', name: '우주인 뿌요', price: 3000, level: 15, desc: '동그란 헬멧을 쓰고 별로 출발!' },
  // 업그레이드 3 (인혁이 기획서 2번 "스킨을 더 만들어줘")
  { id: 'chick', name: '병아리 뿌요', price: 600, level: 3, desc: '머리에 깃털이 쏙! 노란 부리의 병아리.' },
  { id: 'penguin', name: '펭귄 뿌요', price: 800, level: 5, desc: '하얀 배와 작은 날개로 뒤뚱뒤뚱.' },
  { id: 'cookie', name: '쿠키 뿌요', price: 1200, level: 6, desc: '초코칩이 콕콕 박힌 바삭한 쿠키.' },
  { id: 'ninja', name: '닌자 뿌요', price: 1500, level: 8, desc: '머리띠를 질끈 묶은 날쌘 닌자.' },
  { id: 'pumpkin', name: '호박 뿌요', price: 1900, level: 10, desc: '줄무늬 호박에 꼭지가 달렸어요.' },
  { id: 'octopus', name: '문어 뿌요', price: 2200, level: 12, desc: '꼬물꼬물 다리가 달린 문어.' },
  // 고난이도 레벨 스킨 (기획서 2번): 그 레벨이 되어야 코인으로 살 수 있고, 교환권으로는 받을 수 없다 (noTicket)
  { id: 'knight', name: '기사 뿌요', price: 5000, level: 30, noTicket: true, desc: '반짝이는 은빛 투구를 쓴 용감한 기사.' },
  { id: 'wizard', name: '마법사 뿌요', price: 7000, level: 40, noTicket: true, desc: '별무늬 고깔모자를 쓴 마법사.' },
  { id: 'phoenix', name: '불사조 뿌요', price: 10000, level: 50, noTicket: true, desc: '불꽃 날개가 활활 타오르는 불사조.' },
  { id: 'galaxy', name: '은하 뿌요', price: 13000, level: 60, noTicket: true, desc: '몸 안에 은하수가 빙글빙글 돌아요.' },
  { id: 'thunder', name: '번개 뿌요', price: 16000, level: 70, noTicket: true, desc: '찌릿찌릿 번개를 두른 뿌요.' },
  { id: 'legend', name: '전설의 뿌요', price: 30000, level: 99, noTicket: true, desc: '무지개 후광과 날개. 99레벨만 가질 수 있어요.' },
  // 업그레이드 6 (인혁이 기획서 2026-10-09 1번 "스킨을 더 만들어줘"): 코인 스킨 10가지와 레벨 스킨 2가지
  { id: 'frog', name: '개구리 뿌요', price: 700, level: 4, desc: '머리 위로 왕눈이 톡! 개굴개굴 웃는 개구리.' },
  { id: 'bee', name: '꿀벌 뿌요', price: 1000, level: 6, desc: '줄무늬 옷에 작은 날개가 붕붕.' },
  { id: 'icecream', name: '아이스크림 뿌요', price: 1300, level: 7, desc: '크림이 흘러내리고 체리가 쏙 올라갔어요.' },
  { id: 'panda', name: '판다 뿌요', price: 1500, level: 8, desc: '까만 귀와 눈가가 귀여운 판다.' },
  { id: 'mushroom', name: '버섯 뿌요', price: 1900, level: 10, desc: '물방울무늬 갓을 쓴 꼬마 버섯.' },
  { id: 'snowman', name: '눈사람 뿌요', price: 2000, level: 10, desc: '까만 모자에 당근 코를 단 눈사람.' },
  { id: 'pirate', name: '해적 뿌요', price: 2300, level: 11, desc: '두건을 묶고 안대를 한 꼬마 해적.' },
  { id: 'alien', name: '외계인 뿌요', price: 2600, level: 13, desc: '더듬이가 반짝이는 왕눈이 외계인.' },
  { id: 'shark', name: '상어 뿌요', price: 2900, level: 14, desc: '등지느러미와 뾰족한 이빨의 아기 상어.' },
  { id: 'unicorn', name: '유니콘 뿌요', price: 3400, level: 16, desc: '황금 뿔과 무지개 갈기를 가진 유니콘.' },
  { id: 'diamond', name: '다이아 뿌요', price: 20000, level: 80, noTicket: true, desc: '반짝반짝 깎아 만든 다이아몬드.' },
  { id: 'sun', name: '태양 뿌요', price: 25000, level: 90, noTicket: true, desc: '이글이글 햇살을 두른 태양.' },
  // 업그레이드 7 (2026-10-10 "스킨도 더 넣어줘"): 코인 스킨 10가지와 레벨 스킨 2가지
  { id: 'puppy', name: '강아지 뿌요', price: 750, level: 4, desc: '축 늘어진 귀에 혀를 쏙 내민 강아지.' },
  { id: 'pig', name: '돼지 뿌요', price: 900, level: 5, desc: '동글동글 코가 귀여운 꿀꿀 돼지.' },
  { id: 'fox', name: '여우 뿌요', price: 1200, level: 6, desc: '뾰족한 귀와 하얀 볼털의 여우.' },
  { id: 'koala', name: '코알라 뿌요', price: 1400, level: 7, desc: '커다란 귀와 까만 코의 느긋한 코알라.' },
  { id: 'ladybug', name: '무당벌레 뿌요', price: 1700, level: 9, desc: '까만 점무늬에 더듬이가 쫑긋.' },
  { id: 'watermelon', name: '수박 뿌요', price: 1900, level: 10, desc: '줄무늬 껍질에 까만 씨가 콕콕.' },
  { id: 'tiger', name: '호랑이 뿌요', price: 2300, level: 11, desc: '줄무늬가 멋진 아기 호랑이. 어흥!' },
  { id: 'cloud', name: '구름 뿌요', price: 2600, level: 13, desc: '몽실몽실 솜사탕 같은 구름.' },
  { id: 'devil', name: '꼬마 악마 뿌요', price: 3000, level: 15, desc: '뿔과 박쥐 날개를 단 장난꾸러기.' },
  { id: 'angel', name: '천사 뿌요', price: 3500, level: 17, desc: '금빛 고리와 하얀 날개의 천사.' },
  { id: 'lava', name: '용암 뿌요', price: 22000, level: 85, noTicket: true, desc: '머리 위로 불꽃이 타오르는 용암 바위.' },
  { id: 'blackhole', name: '블랙홀 뿌요', price: 28000, level: 95, noTicket: true, desc: '빛나는 고리를 두른 우주의 블랙홀.' },
  // 업그레이드 8 (인혁이 기획서 2026-10-11 1번, "스킨 많~~~이 넣어줘야"): 코인 스킨 28가지와 레벨 스킨 2가지
  { id: 'balloon', name: '풍선 뿌요', price: 600, level: 3, desc: '끈이 달린 반짝반짝 풍선.' },
  { id: 'hamster', name: '햄스터 뿌요', price: 650, level: 3, desc: '볼이 빵빵한 햄스터. 앞니가 쏙!' },
  { id: 'mouse', name: '생쥐 뿌요', price: 700, level: 4, desc: '커다란 귀와 수염이 달린 생쥐.' },
  { id: 'duck', name: '오리 뿌요', price: 750, level: 4, desc: '넓적한 부리로 꽥꽥!' },
  { id: 'glasses', name: '안경 뿌요', price: 900, level: 5, desc: '동그란 안경에 나비넥타이를 한 똑똑이.' },
  { id: 'chef', name: '요리사 뿌요', price: 950, level: 5, desc: '하얀 요리사 모자와 멋진 콧수염.' },
  { id: 'onigiri', name: '주먹밥 뿌요', price: 1050, level: 6, desc: '김을 두른 든든한 주먹밥.' },
  { id: 'owl', name: '부엉이 뿌요', price: 1100, level: 6, desc: '왕눈이 부엉이. 밤에도 잘 봐요.' },
  { id: 'monkey', name: '원숭이 뿌요', price: 1150, level: 6, desc: '양옆으로 귀가 쫑긋한 장난꾸러기.' },
  { id: 'cow', name: '젖소 뿌요', price: 1300, level: 7, desc: '얼룩무늬에 작은 뿔이 난 젖소.' },
  { id: 'sheep', name: '양 뿌요', price: 1350, level: 7, desc: '몽실몽실 하얀 털을 쓴 양.' },
  { id: 'cowboy', name: '카우보이 뿌요', price: 1500, level: 8, desc: '챙 넓은 모자에 별 배지를 단 보안관.' },
  { id: 'clown', name: '삐에로 뿌요', price: 1550, level: 8, desc: '빨간 코와 알록달록 머리의 삐에로.' },
  { id: 'lion', name: '사자 뿌요', price: 1700, level: 9, desc: '멋진 갈기를 두른 밀림의 왕.' },
  { id: 'elephant', name: '코끼리 뿌요', price: 1750, level: 9, desc: '펄럭이는 귀와 기다란 코.' },
  { id: 'present', name: '선물 상자 뿌요', price: 1800, level: 9, desc: '리본을 예쁘게 묶은 선물.' },
  { id: 'deer', name: '사슴 뿌요', price: 1900, level: 10, desc: '뿔이 멋진 사슴. 코가 빨개요!' },
  { id: 'princess', name: '공주 뿌요', price: 1950, level: 10, desc: '보석 왕관을 쓴 공주.' },
  { id: 'hedgehog', name: '고슴도치 뿌요', price: 2100, level: 11, desc: '뾰족뾰족 가시를 세운 고슴도치.' },
  { id: 'headphone', name: '헤드폰 뿌요', price: 2200, level: 11, desc: '헤드폰을 끼고 신나게 음악 듣는 중.' },
  { id: 'turtle', name: '거북이 뿌요', price: 2300, level: 12, desc: '단단한 등딱지의 느긋한 거북이.' },
  { id: 'santa', name: '산타 뿌요', price: 2400, level: 12, desc: '빨간 모자와 하얀 수염의 산타.' },
  { id: 'crab', name: '꽃게 뿌요', price: 2500, level: 13, desc: '집게발을 번쩍 든 꽃게.' },
  { id: 'vampire', name: '뱀파이어 뿌요', price: 2600, level: 13, desc: '망토 깃을 세운 꼬마 뱀파이어.' },
  { id: 'jellyfish', name: '해파리 뿌요', price: 2700, level: 14, desc: '하늘하늘 다리가 달린 해파리.' },
  { id: 'mummy', name: '미라 뿌요', price: 2800, level: 14, desc: '붕대를 둘둘 감은 미라.' },
  { id: 'hero', name: '히어로 뿌요', price: 3100, level: 15, desc: '가면과 망토를 두른 영웅.' },
  { id: 'dice', name: '주사위 뿌요', price: 3300, level: 16, desc: '네모난 주사위. 굴리면 뭐가 나올까?' },
  { id: 'ice', name: '얼음 뿌요', price: 8500, level: 45, noTicket: true, desc: '머리 위에 얼음 수정이 솟은 꽁꽁 얼음.' },
  { id: 'rainbow', name: '무지개 뿌요', price: 14500, level: 65, noTicket: true, desc: '구름 사이로 무지개를 두른 뿌요.' },
  { id: 'aurora', name: '오로라 갑옷', price: -1, level: 1, desc: '초신성 층 노바를 이기면 받는 별빛 갑옷.', reward: 'nova' },
  { id: 'crown', name: '황금 왕관 뿌요', price: -1, level: 1, desc: '타워 꼭대기를 깬 사람만 받는 왕관.', reward: 'tower' },
  // 기획서 6번: 온라인 랭킹 5등 안에 든 사람만 (제작자 모드로도 못 받는다)
  { id: 'champion', name: '챔피언 뿌요', price: -1, level: 1, desc: '온라인 랭킹 5등 안에 든 사람만 받는 금메달.', reward: 'ranking' },
];
export const RANK_SKIN = 'champion';

export const EFFECTS = [
  { id: 'sparkle', name: '기본 반짝', price: 0, level: 1, desc: '반짝반짝 작은 빛.' },
  { id: 'star', name: '별가루', price: 150, level: 1, desc: '별이 빙글빙글 튀어요.' },
  { id: 'heart', name: '하트', price: 250, level: 2, desc: '하트가 둥실둥실.' },
  { id: 'bubble', name: '비눗방울', price: 400, level: 3, desc: '방울이 떠올라 톡!' },
  { id: 'petal', name: '꽃잎', price: 600, level: 4, desc: '꽃잎이 살랑살랑.' },
  { id: 'note', name: '음표', price: 800, level: 5, desc: '연쇄할 때마다 음표가 춤춰요.' },
  { id: 'snow', name: '눈꽃', price: 1000, level: 6, desc: '차가운 눈꽃 결정.' },
  { id: 'pixel', name: '픽셀 폭발', price: 1200, level: 7, desc: '네모 조각이 와르르.' },
  { id: 'firework', name: '불꽃놀이', price: 1500, level: 8, desc: '펑! 하늘의 불꽃놀이.' },
  { id: 'lightning', name: '번개', price: 1900, level: 10, desc: '찌릿찌릿 번개가 쳐요.' },
  { id: 'rainbow', name: '무지개 링', price: 2300, level: 12, desc: '무지개 고리가 퍼져요.' },
  { id: 'blackhole', name: '블랙홀', price: 3000, level: 15, desc: '빨려 들어갔다가 펑!' },
  { id: 'butterfly', name: '나비 정원', price: 900, level: 5, desc: '색색의 나비들이 날갯짓해요.' },
  { id: 'confetti', name: '축하 폭죽', price: 1300, level: 7, desc: '알록달록 종이 꽃가루가 펑!' },
  { id: 'flame', name: '드래곤 불꽃', price: 1800, level: 9, desc: '금빛 불씨가 뜨겁게 솟아올라요.' },
  { id: 'musicbox', name: '별빛 오르골', price: 2200, level: 11, desc: '별과 음표가 함께 춤을 춰요.' },
  { id: 'portal', name: '차원 문', price: 2700, level: 14, desc: '보라와 민트색 문이 열려요.' },
  // 고난이도 레벨 효과 (기획서 2번 "그런 타입들도"): 교환권으로 받을 수 없다
  { id: 'meteor', name: '유성우', price: 6000, level: 30, noTicket: true, desc: '별똥별이 우수수 쏟아져요.' },
  { id: 'storm', name: '무지개 폭풍', price: 12000, level: 50, noTicket: true, desc: '무지개 회오리가 휘몰아쳐요.' },
  // 2026-10-11 요청 "터짐 효과를 더 많이 엄청 많이 더 만들어줘" — 코인 효과 40가지와 레벨 효과 6가지 (그림은 effects.mjs)
  { id: 'ripple', name: '물결', price: 200, level: 1, desc: '잔잔한 물결이 동글동글 퍼져요.' },
  { id: 'leaf', name: '나뭇잎', price: 300, level: 2, desc: '초록 잎과 단풍잎이 팔랑팔랑.' },
  { id: 'drop', name: '물방울', price: 350, level: 2, desc: '물방울이 첨벙! 튀어 올라요.' },
  { id: 'clover', name: '네잎클로버', price: 450, level: 3, desc: '행운의 네잎클로버가 퐁퐁.' },
  { id: 'laugh', name: 'ㅋㅋㅋ', price: 500, level: 3, desc: 'ㅋㅋㅋ 웃음이 팡팡 터져요.' },
  { id: 'candy', name: '사탕', price: 600, level: 4, desc: '알록달록 사탕이 톡톡 튀어요.' },
  { id: 'balloon', name: '풍선', price: 650, level: 4, desc: '풍선이 둥실둥실 날아올라요.' },
  { id: 'coin', name: '금화', price: 800, level: 5, desc: '금화가 짤랑짤랑 쏟아져요.' },
  { id: 'paw', name: '발자국', price: 850, level: 5, desc: '고양이 발자국이 콩콩콩.' },
  { id: 'gem', name: '보석 조각', price: 1000, level: 6, desc: '반짝이는 보석이 튀어요.' },
  { id: 'feather', name: '깃털', price: 1050, level: 6, desc: '하얀 깃털이 살랑살랑 내려와요.' },
  { id: 'popcorn', name: '팝콘', price: 1100, level: 6, desc: '팝콘이 팡팡 튀어 올라요.' },
  { id: 'ice', name: '얼음 조각', price: 1250, level: 7, desc: '얼음이 쨍그랑 깨져요.' },
  { id: 'cloud', name: '뭉게구름', price: 1300, level: 7, desc: '하얀 구름이 퐁 하고 피어나요.' },
  { id: 'smile', name: '스마일', price: 1350, level: 7, desc: '방긋 웃는 얼굴이 통통 튀어요.' },
  { id: 'moon', name: '달과 별', price: 1500, level: 8, desc: '초승달과 작은 별이 떠올라요.' },
  { id: 'sun', name: '햇살', price: 1550, level: 8, desc: '햇살이 사방으로 쫙!' },
  { id: 'soccer', name: '축구공', price: 1600, level: 8, desc: '축구공이 통통 튀어요. 슛!' },
  { id: 'shuriken', name: '수리검', price: 1700, level: 9, desc: '닌자 수리검이 쌩쌩 날아가요.' },
  { id: 'ghost', name: '꼬마 유령', price: 1750, level: 9, desc: '꼬마 유령이 까꿍!' },
  { id: 'paint', name: '물감', price: 1800, level: 9, desc: '물감이 철퍼덕! 알록달록 얼룩.' },
  { id: 'fish', name: '물고기 떼', price: 1900, level: 10, desc: '작은 물고기들이 헤엄쳐요.' },
  { id: 'firefly', name: '반딧불이', price: 1950, level: 10, desc: '반딧불이가 깜빡깜빡 날아요.' },
  { id: 'comic', name: '만화 펑!', price: 2000, level: 10, desc: '펑! 팡! 뿅! 만화 글자가 튀어나와요.' },
  { id: 'shock', name: '충격파', price: 2200, level: 11, desc: '쿵! 충격파가 퍼져요.' },
  { id: 'bomb', name: '폭탄', price: 2250, level: 11, desc: '쾅! 까만 연기와 불똥.' },
  { id: 'bat', name: '박쥐 떼', price: 2300, level: 11, desc: '까만 박쥐들이 파닥파닥.' },
  { id: 'laser', name: '레이저', price: 2400, level: 12, desc: '빨강 파랑 레이저가 슝슝!' },
  { id: 'gold', name: '금가루', price: 2500, level: 12, desc: '황금 가루가 반짝반짝 흩날려요.' },
  { id: 'volcano', name: '화산', price: 2600, level: 13, desc: '용암이 솟구쳐 올라요.' },
  { id: 'tornado', name: '회오리바람', price: 2700, level: 13, desc: '회오리가 빙글빙글 올라가요.' },
  { id: 'aurora', name: '오로라', price: 2900, level: 14, desc: '초록빛 보랏빛 오로라가 일렁여요.' },
  { id: 'disco', name: '디스코', price: 3000, level: 14, desc: '빙글빙글 디스코 조명!' },
  { id: 'constellation', name: '별자리', price: 3100, level: 15, desc: '별들이 선으로 이어져요.' },
  { id: 'rocket', name: '로켓', price: 3200, level: 15, desc: '작은 로켓이 슝 날아올라요.' },
  { id: 'crown', name: '왕관', price: 3400, level: 16, desc: '황금 왕관이 번쩍!' },
  { id: 'glitch', name: '지지직', price: 3600, level: 16, desc: '화면이 지지직! 고장 난 것 같아요.' },
  { id: 'galaxy', name: '은하수', price: 3700, level: 17, desc: '작은 별들이 소용돌이쳐요.' },
  { id: 'code', name: '숫자 비', price: 3800, level: 17, desc: '초록 숫자가 주르륵 흘러내려요.' },
  { id: 'slash', name: '칼바람', price: 4000, level: 18, desc: '쓱싹! 검기가 번쩍 지나가요.' },
  { id: 'blizzard', name: '눈보라', price: 8500, level: 40, noTicket: true, desc: '눈보라가 휘몰아쳐요.' },
  { id: 'thunderstorm', name: '천둥 구름', price: 14000, level: 60, noTicket: true, desc: '먹구름에서 번개와 비가 쏟아져요.' },
  { id: 'bigbang', name: '빅뱅', price: 17000, level: 70, noTicket: true, desc: '우주가 태어나는 대폭발!' },
  { id: 'phoenix', name: '불사조 날개', price: 21000, level: 80, noTicket: true, desc: '불꽃 날개가 활짝 펴져요.' },
  { id: 'treasure', name: '보물 폭발', price: 26000, level: 90, noTicket: true, desc: '금화, 보석, 왕관이 한꺼번에 쏟아져요.' },
  { id: 'legend', name: '전설의 빛', price: 32000, level: 99, noTicket: true, desc: '무지개 빛기둥이 도는 99레벨의 빛.' },
  { id: 'nova', name: '초신성 폭발', price: -1, level: 1, desc: '노바를 이기면 얻는 별빛 대폭발.', reward: 'nova' },
  { id: 'comet', name: '혜성 꼬리', price: -1, level: 1, desc: '비밀의 혜성 층을 깨면 받아요.', reward: 'comet' },
];

export const itemList = kind => (kind === 'skin' ? SKINS : EFFECTS);
export const findItem = (kind, id) => itemList(kind).find(i => i.id === id);

// 살 수 있는지: 'owned' | 'reward' | 'level' | 'coins' | 'ok'
export function canBuy(progress, kind, id) {
  const item = findItem(kind, id);
  if (!item) return 'none';
  if (progress.owned[kind].includes(id)) return 'owned';
  if (item.price < 0) return 'reward';
  if (progress.level < item.level) return 'level';
  if (progress.coins < item.price) return 'coins';
  return 'ok';
}

export function buy(progress, kind, id) {
  const state = canBuy(progress, kind, id);
  if (state !== 'ok') return state;
  const item = findItem(kind, id);
  progress.coins -= item.price;
  progress.owned[kind].push(id);
  progress.equip[kind] = id;
  return 'bought';
}

export function equip(progress, kind, id) {
  if (!progress.owned[kind].includes(id)) return false;
  progress.equip[kind] = id;
  return true;
}

export function grant(progress, kind, id) {
  if (!progress.owned[kind].includes(id)) progress.owned[kind].push(id);
}

// 교환권은 코인/레벨 없이 원하는 판매 상품을 하나 고를 수 있다. 보스 전용 보상과 고난이도 레벨 상품(noTicket)은 제외.
export function canRedeem(progress, kind, id) {
  const item = findItem(kind, id);
  return !!item && item.price > 0 && !item.noTicket && !progress.owned[kind].includes(id) && (progress.tickets?.[kind] || 0) > 0;
}
export function redeem(progress, kind, id) {
  if (!canRedeem(progress, kind, id)) return false;
  progress.tickets[kind]--;
  grant(progress, kind, id);
  equip(progress, kind, id);
  return true;
}
