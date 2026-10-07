// 뿌요 타워. 인혁이 기획서: "AI랑 하는데 타워를 깨는 형식, 1번 이길 때마다 한 층씩,
// 순서는 방해뿌요 작은·큰·운석·별·달·왕관" + 올라갈수록 AI가 세지고, 꼭대기를 깨면 엔딩.
// 엔딩을 본 사람에게만 탑 너머 비밀의 혜성 층이 열린다.

export const FLOORS = [
  {
    floor: 1, icon: 'small', name: '작은 뿌요 층', boss: '꼬마 뿌요', char: 'poyo', ai: 1, theme: 'meadow',
    coins: 100, xp: 60,
    intro: '안녕! 나는 1층을 지키는 꼬마 뿌요야. 작다고 얕보지 마!',
    win: '으앙, 졌다… 2층의 왕방울 형은 나보다 훨씬 커!',
    lose: '헤헤, 내가 이겼다! 같은 색 4개를 붙여 봐!',
  },
  {
    floor: 2, icon: 'big', name: '큰 뿌요 층', boss: '왕방울', char: 'bubble', ai: 2, theme: 'sky',
    coins: 150, xp: 90,
    intro: '출렁출렁~ 큰 뿌요의 힘을 보여 주지!',
    win: '출렁… 3층 운석 층은 뜨거우니까 조심해!',
    lose: '출렁출렁! 떨어진 뿌요가 또 터지면 연쇄야~',
  },
  {
    floor: 3, icon: 'rock', name: '운석 층', boss: '운석 골렘 쿵쿵', char: 'golem', ai: 3, theme: 'crater',
    coins: 250, xp: 130,
    intro: '쿵! 쿵! 하늘에서 떨어진 운석의 힘을 받아라!',
    win: '쿵… 네 연쇄, 운석보다 단단하구나.',
    lose: '쿵쿵! 방해 뿌요가 오면 연쇄로 상쇄해 봐라!',
  },
  {
    floor: 4, icon: 'star', name: '별 층', boss: '별빛 마법사 반짝이', char: 'wizard', ai: 4, theme: 'starry',
    coins: 400, xp: 180,
    intro: '반짝반짝~ 별빛 연쇄 마법을 받아 봐!',
    win: '내 마법이 깨지다니… 5층의 루나는 정말 빨라.',
    lose: '반짝! 별이 너무 눈부셨나 봐?',
  },
  {
    floor: 5, icon: 'moon', name: '달 층', boss: '달토끼 루나', char: 'luna', ai: 5, theme: 'moon',
    coins: 600, xp: 240,
    intro: '달빛 아래에서는 내가 제일 빨라. 따라올 수 있겠어?',
    win: '깡충… 이제 꼭대기의 뿌요 대왕님만 남았어!',
    lose: '깡충깡충~ 3번째 줄은 비워 두는 게 좋아!',
  },
  {
    floor: 6, icon: 'crown', name: '왕관 층', boss: '뿌요 대왕', char: 'king', ai: 6, theme: 'palace',
    coins: 1000, xp: 400,
    intro: '여기까지 오다니 대단하구나! 하지만 이 왕관은 쉽게 줄 수 없다!',
    win: '훌륭하다…! 이 왕관은 이제 너의 것이다!',
    lose: '와하하! 왕관의 무게를 견디기엔 아직 이르다!',
  },
  {
    floor: 7, icon: 'comet', name: '혜성 층', boss: '혜성 드래곤 코멧', char: 'comet', ai: 7, theme: 'space', secret: true,
    coins: 2000, xp: 800,
    intro: '왕관을 쓴 자여… 탑 너머 우주에서 기다렸다. 혜성처럼 빠른 연쇄를 막아 봐라!',
    win: '크르릉… 너야말로 진짜 뿌요 챔피언이다!',
    lose: '크아앙! 혜성은 멈추지 않는다!',
  },
  {
    floor: 8, icon: 'nova', name: '초신성 층', boss: '별의 수호자 노바', char: 'nova', ai: 8, theme: 'nova', secret: true,
    coins: 3500, xp: 1200,
    intro: '코멧과 함께 별의 문을 열었구나. 나는 노바! 우주의 가장 빛나는 연쇄를 보여 줘!',
    win: '눈부셔… 네 용기와 코멧의 우정이 별들을 지켰어! 이 오로라 갑옷을 받아 줘.',
    lose: '별은 한 번에 태어나지 않아. 다시 도전해 봐! 나는 여기서 기다릴게.',
  },
];

export const TOP_FLOOR = 6;

// 어느 층까지 열렸는지
export function floorState(tower, floor) {
  const info = FLOORS[floor - 1];
  if (!info) return 'none';
  if (floor === 8) return !tower.comet ? 'hidden' : tower.nova ? 'cleared' : 'open';
  if (floor === 7) return !tower.cleared ? 'hidden' : tower.comet ? 'cleared' : 'open';
  if (floor <= tower.best) return 'cleared';
  if (info.secret ? tower.cleared : floor === tower.best + 1) return 'open';
  return 'locked';
}

export function currentFloor(tower) {
  if (tower.best < TOP_FLOOR) return tower.best + 1;
  if (!tower.comet) return 7;
  return 8;
}

// 같은 층에서 여러 번 지면 AI 손이 조금씩 느려진다 (최대 4단계)
export function helpLevel(tower, floor) {
  return Math.min(4, tower.losses?.[floor] || 0);
}

// 이긴 뒤 보상. 처음 깬 층은 크게, 다시 깨면 조금.
export function floorReward(tower, floor) {
  const info = FLOORS[floor - 1];
  const first = floor === 8 ? !tower.nova : floor === 7 ? !tower.comet : floor > tower.best;
  return first ? { coins: info.coins, xp: info.xp, first } : { coins: Math.round(info.coins / 5), xp: Math.round(info.xp / 3), first };
}

// 이겼을 때 기록 갱신. 엔딩을 봐야 하면 true
export function clearFloor(tower, floor) {
  tower.losses = tower.losses || {};
  delete tower.losses[floor];
  if (floor === 8) { const first = !tower.nova; tower.nova = true; return { ending: false, novaFirst: first }; }
  if (floor === 7) { const first = !tower.comet; tower.comet = true; return { ending: false, secretFirst: first, cometEnding: true }; }
  tower.best = Math.max(tower.best, floor);
  if (floor === TOP_FLOOR && !tower.cleared) { tower.cleared = true; return { ending: true }; }
  return { ending: false };
}

export function loseFloor(tower, floor) {
  tower.losses = tower.losses || {};
  tower.losses[floor] = (tower.losses[floor] || 0) + 1;
}
