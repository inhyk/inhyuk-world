// 컴퓨터 캐릭터 7명. 이름, 얼굴, 말은 그린 체스에서 새로 만든 것이다.
// engine 값은 fast-engine.mjs 의 chooseMove 옵션이다 (약할수록 흔들림과 아무 수 확률이 크다).

const face = (bg, body) => `<svg viewBox="0 0 64 64" aria-hidden="true" class="bot-face"><rect width="64" height="64" rx="14" fill="${bg}"/>${body}</svg>`;
const eyes = (y = 32, gap = 9, r = 3.2, color = '#1d2419') => `<circle cx="${32 - gap}" cy="${y}" r="${r}" fill="${color}"/><circle cx="${32 + gap}" cy="${y}" r="${r}" fill="${color}"/>`;
const smile = (y = 41, w = 7, color = '#1d2419') => `<path d="M${32 - w} ${y}q${w} ${w * 0.8} ${w * 2} 0" fill="none" stroke="${color}" stroke-width="2.6" stroke-linecap="round"/>`;

export const BOTS = [
  {
    id: 'sprout', name: '새싹이', rating: 250, title: '이제 막 체스를 배운 새싹',
    face: face('#cfe8a8', `<path d="M32 21c-2-8-9-11-15-10 1 7 7 11 15 10zM32 21c2-8 9-11 15-10-1 7-7 11-15 10z" fill="#5f9b3a"/><circle cx="32" cy="38" r="17" fill="#8cc35a"/>${eyes(36, 7)}${smile(42, 5)}<circle cx="20" cy="42" r="3" fill="#f2a7a0" opacity=".7"/><circle cx="44" cy="42" r="3" fill="#f2a7a0" opacity=".7"/>`),
    engine: { depth: 1, quiet: false, noise: 350, blunder: 0.3 },
    lines: {
      greet: '안녕! 나 말은 다 외웠어. 아마도…', win: '어? 내가 이겼어? 신난다!', lose: '우와, 너 진짜 잘한다. 나도 쑥쑥 클게!',
      draw: '비겼다! 사이좋게 반반!', capture: '앗, 그거 내 말이었는데…',
    },
  },
  {
    id: 'acorn', name: '도토리 다람', rating: 500, title: '도토리처럼 기물을 모으는 다람쥐',
    face: face('#f1d3a3', `<circle cx="18" cy="18" r="7" fill="#a8693a"/><circle cx="46" cy="18" r="7" fill="#a8693a"/><circle cx="32" cy="36" r="19" fill="#c47f45"/><ellipse cx="32" cy="43" rx="10" ry="8" fill="#f3dcc0"/>${eyes(33, 8)}<circle cx="32" cy="39" r="2.4" fill="#3b2614"/>${smile(43, 4, '#3b2614')}`),
    engine: { depth: 1, quiet: true, noise: 220, blunder: 0.15 },
    lines: {
      greet: '기물을 하나씩 모아 볼까? 도토리처럼!', win: '오늘 도토리 수확 대성공!', lose: '내 도토리 다 뺏겼다… 다음엔 꼭!',
      draw: '도토리를 반씩 나눠 가졌네.', capture: '그 말은 내가 아껴 둔 건데!',
    },
  },
  {
    id: 'pumpkin', name: '호박 기사', rating: 800, title: '투구를 쓴 씩씩한 호박',
    face: face('#f6c48c', `<rect x="29" y="9" width="6" height="9" rx="2" fill="#5d7b2e"/><ellipse cx="32" cy="38" rx="21" ry="18" fill="#e88a2c"/><path d="M22 23c-3 8-3 22 0 30M42 23c3 8 3 22 0 30M32 21v34" stroke="#c96c18" stroke-width="2" fill="none"/>${eyes(35, 9, 3.4)}<path d="M23 44l4 3 5-3 5 3 4-3" fill="none" stroke="#1d2419" stroke-width="2.4" stroke-linejoin="round"/>`),
    engine: { depth: 2, quiet: true, noise: 120, blunder: 0.07 },
    lines: {
      greet: '호박 기사, 출동! 정정당당하게 겨루자.', win: '호박 기사의 승리다! 하하!', lose: '훌륭한 승부였다. 너는 진짜 기사야!',
      draw: '오늘은 무승부로 하자, 친구여.', capture: '으윽, 내 부하가!',
    },
  },
  {
    id: 'owl', name: '부엉 박사', rating: 1100, title: '밤새 기보를 읽는 부엉이',
    face: face('#c9d6e8', `<path d="M14 16l8 9M50 16l-8 9" stroke="#5b4a3a" stroke-width="4" stroke-linecap="round"/><ellipse cx="32" cy="37" rx="20" ry="19" fill="#8a7158"/><circle cx="23" cy="33" r="8" fill="#f6efe2" stroke="#2f3a4a" stroke-width="2.4"/><circle cx="41" cy="33" r="8" fill="#f6efe2" stroke="#2f3a4a" stroke-width="2.4"/><path d="M31 33h2" stroke="#2f3a4a" stroke-width="2.4"/><circle cx="23" cy="33" r="3" fill="#1d2419"/><circle cx="41" cy="33" r="3" fill="#1d2419"/><path d="M29 41l3 5 3-5z" fill="#e5a33a"/>`),
    engine: { depth: 2, quiet: true, noise: 60, blunder: 0.03 },
    lines: {
      greet: '흠흠, 중앙을 먼저 차지하는 게 기본이란다.', win: '공부한 보람이 있구나. 너도 기보를 읽어 보렴.', lose: '놀랍군! 오늘은 내가 한 수 배웠어.',
      draw: '균형이 딱 맞았구나. 아주 좋은 판이었어.', capture: '호오, 그 수는 계산에 없었는데.',
    },
  },
  {
    id: 'turtle', name: '바위 거북', rating: 1400, title: '느리지만 절대 서두르지 않는 거북',
    face: face('#b9dcc9', `<ellipse cx="32" cy="46" rx="22" ry="12" fill="#5e8c5a"/><path d="M18 46h28M24 38l-4 14M40 38l4 14M32 35v19" stroke="#3d6640" stroke-width="2" fill="none"/><circle cx="32" cy="27" r="13" fill="#9cc48a"/>${eyes(25, 5, 2.6)}${smile(30, 4)}`),
    engine: { depth: 3, quiet: true, noise: 30, blunder: 0.01 },
    lines: {
      greet: '천천히… 단단하게… 시작해 볼까.', win: '느려도 끝까지 가면 이긴다네.', lose: '빠르구나… 내 등딱지가 뚫렸어.',
      draw: '바위처럼 버텼다. 무승부야.', capture: '음… 그건 좀 아프군.',
    },
  },
  {
    id: 'fox', name: '번개 여우', rating: 1700, title: '빠른 전술로 몰아치는 여우',
    face: face('#f7d9b5', `<path d="M12 12l12 14M52 12L40 26" stroke="#d9652b" stroke-width="7" stroke-linecap="round"/><path d="M32 54c-14 0-21-12-21-22 7-4 14-5 21-5s14 1 21 5c0 10-7 22-21 22z" fill="#e87734"/><path d="M32 54c-6 0-11-5-12-11 4 2 8 3 12 3s8-1 12-3c-1 6-6 11-12 11z" fill="#fbeadb"/><path d="M20 35l7 2M44 35l-7 2" stroke="#1d2419" stroke-width="3" stroke-linecap="round"/><circle cx="32" cy="45" r="2.6" fill="#1d2419"/>`),
    engine: { depth: 4, quiet: true, noise: 10, blunder: 0, timeMs: 1200 },
    lines: {
      greet: '번쩍! 눈 깜짝할 새에 끝내 줄게.', win: '번개처럼 끝! 다음엔 더 빨리 와 봐.', lose: '내 번개를 피하다니… 대단한걸?',
      draw: '번개도 쉬어 가는 날이 있지.', capture: '쳇, 꼬리를 밟혔네.',
    },
  },
  {
    id: 'dragon', name: '숲의 용', rating: 2000, title: '그린 체스 숲을 지키는 용',
    face: face('#a9d18e', `<path d="M17 14l7 12M47 14l-7 12" stroke="#f4e3a1" stroke-width="5" stroke-linecap="round"/><path d="M32 22c13 0 20 9 20 18 0 9-8 15-20 15s-20-6-20-15c0-9 7-18 20-18z" fill="#3f8a4a"/><ellipse cx="32" cy="46" rx="12" ry="7" fill="#7fbf6a"/><path d="M20 36l8-2M44 36l-8-2" stroke="#f4e3a1" stroke-width="2.4" stroke-linecap="round"/><circle cx="24" cy="38" r="2.6" fill="#f9d23c"/><circle cx="40" cy="38" r="2.6" fill="#f9d23c"/><circle cx="28" cy="46" r="1.6" fill="#1d2419"/><circle cx="36" cy="46" r="1.6" fill="#1d2419"/>`),
    engine: { depth: 8, quiet: true, noise: 0, blunder: 0, timeMs: 2200 },
    lines: {
      greet: '숲에 온 걸 환영한다. 최선을 다해 보아라.', win: '용의 숲은 아직 높구나. 다시 도전하라.', lose: '…놀랍다. 너는 숲의 새 주인이 될 자격이 있다.',
      draw: '용과 비기다니, 자랑해도 좋다.', capture: '크르릉… 제법이군.',
    },
  },
];

export const botById = id => BOTS.find(b => b.id === id) ?? BOTS[2];
