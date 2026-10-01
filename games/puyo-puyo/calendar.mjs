// 한국 시간으로 생일·출석·공휴일을 함께 판정한다.
// 공휴일/대체공휴일 기준 (2026-10 확인):
// https://www.law.go.kr/lsInfoP.do?lsId=002404
// https://www.mpm.go.kr/mpm/comm/newsPress/newsPressRelease/?searchKeyword=공휴일
const DAY = 86400000;
const KST = 9 * 3600000;
export function todayKey(now = new Date()) {
  return new Date(new Date(now).getTime() + KST).toISOString().slice(0, 10);
}
export function shiftDay(key, days) {
  return new Date(Date.parse(`${key}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}
const weekday = key => new Date(`${key}T00:00:00Z`).getUTCDay();
const lunar = new Intl.DateTimeFormat('en-u-ca-dangi', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric' });
const cache = new Map();
// 임시공휴일과 선거일은 발표된 날짜를 명시한다. 새 지정일은 여기에 추가한다.
const EXTRA = {
  '2025-01-27': '임시공휴일', '2025-06-03': '대통령 선거일',
  '2026-06-03': '전국동시지방선거일',
};
export function holidaysFor(year) {
  if (cache.has(year)) return cache.get(year);
  const days = new Map(), groups = [];
  function add(name, keys, substitute = 'weekend') {
    groups.push({ name, keys, substitute });
    for (const key of keys) days.set(key, [...(days.get(key) || []), name]);
  }
  for (const [md, name, rule] of [
    ['01-01', '새해 첫날', 'none'], ['03-01', '삼일절'], ['05-05', '어린이날'],
    ['06-06', '현충일', 'none'], ['08-15', '광복절'], ['10-03', '개천절'],
    ['10-09', '한글날'], ['12-25', '성탄절'],
    ...(year >= 2026 ? [['05-01', '노동절'], ['07-17', '제헌절']] : []),
  ]) add(name, [`${year}-${md}`], rule);
  // Dangi는 한국 음력이다. 윤달(예: "4bis")에는 명절을 중복 생성하지 않는다.
  for (let key = `${year}-01-01`; key.startsWith(`${year}-`); key = shiftDay(key, 1)) {
    const parts = Object.fromEntries(lunar.formatToParts(new Date(`${key}T03:00:00Z`)).map(p => [p.type, p.value]));
    if (parts.month === '1' && parts.day === '1') add('설날', [-1, 0, 1].map(d => shiftDay(key, d)), 'sunday');
    if (parts.month === '4' && parts.day === '8') add('부처님 오신 날', [key]);
    if (parts.month === '8' && parts.day === '15') add('추석', [-1, 0, 1].map(d => shiftDay(key, d)), 'sunday');
  }
  for (const [key, name] of Object.entries(EXTRA)) if (key.startsWith(`${year}-`)) days.set(key, [name]);
  // 같은 명절의 3일은 한 묶음. 겹친 서로 다른 공휴일의 대체일은 순서대로 배정한다.
  groups.sort((a, b) => a.keys[0].localeCompare(b.keys[0]));
  const handledOverlap = new Set();
  for (const { name, keys, substitute } of groups) {
    if (substitute === 'none') continue;
    const overlaps = keys.filter(key => weekday(key) !== 0 && weekday(key) !== 6 && days.get(key).length > 1);
    const needs = keys.some(key => weekday(key) === 0 || (substitute === 'weekend' && weekday(key) === 6))
      || overlaps.some(key => !handledOverlap.has(key));
    if (!needs) continue;
    overlaps.forEach(key => handledOverlap.add(key));
    let next = shiftDay(keys.at(-1), 1);
    while (days.has(next) || weekday(next) === 0 || weekday(next) === 6) next = shiftDay(next, 1);
    days.set(next, [`${name} 대체공휴일`]);
  }
  cache.set(year, days);
  return days;
}
export function calendarBonus(now = new Date()) {
  const date = todayKey(now);
  const holidays = holidaysFor(Number(date.slice(0, 4))).get(date) || (weekday(date) === 0 ? ['일요일'] : []);
  const birthday = date.slice(5) === '05-12';
  return { date, birthday, holidays, coinMultiplier: birthday ? 10 : 1, xpMultiplier: holidays.length ? 2 : 1 };
}
