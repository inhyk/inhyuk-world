// 완료한 대전 5번마다 한 번. 엔딩/경기 중에는 호출하지 않고 결과창에서만 사용한다.
export function consumePromo(progress) {
  const games = Number(progress.stats.games);
  progress.promo ||= { lastGame: 0 };
  if (!Number.isInteger(games) || games <= 0 || games % 5 !== 0 || progress.promo.lastGame >= games) return false;
  progress.promo.lastGame = games;
  return true;
}
