// 대전 화면의 하늘 (인혁이 기획서 「뿌요뿌요 (업그레이드)」 2026-10-10 1번):
// "대전화면에서 밤이면 밤하늘 아침이면 아침 하늘 이런 것도 해줘."
// 지금 시각(이 기기의 시계)에 맞춰 아침 · 낮 · 저녁 · 밤 하늘을 고른다. 그림은 render.mjs 의 같은 이름 배경.
export const SKIES = [
  { id: 'morning', from: 5, name: '아침 하늘', when: '아침', emoji: '🌅' },
  { id: 'noon', from: 11, name: '낮 하늘', when: '낮', emoji: '☀️' },
  { id: 'evening', from: 17, name: '저녁 하늘', when: '저녁', emoji: '🌇' },
  { id: 'night', from: 20, name: '밤하늘', when: '밤', emoji: '🌙' },
];
export const SKY_IDS = SKIES.map(s => s.id);
export const getSky = id => SKIES.find(s => s.id === id) || null;

// 몇 시인지로 하늘을 고른다: 5시부터 아침, 11시부터 낮, 17시부터 저녁, 20시부터 다음 날 5시 전까지 밤
export function skyAtHour(hour) {
  const h = ((Math.floor(Number(hour)) % 24) + 24) % 24;
  let sky = SKIES[SKIES.length - 1];
  for (const s of SKIES) if (h >= s.from) sky = s;
  return sky;
}
export const skyAt = (date = new Date()) => skyAtHour(date.getHours());
// 대전을 시작할 때 알려 주는 말
export const skyText = sky => `${sky.emoji} 지금은 ${sky.when}이라 ${sky.name}이야!`;
