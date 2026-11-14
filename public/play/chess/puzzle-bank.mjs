// Lichess 공개 퍼즐(CC0) 10만 개를 1,000개 묶음으로 필요한 만큼만 내려받는다.
// 퍼즐 화면과 퍼즐 러시가 같은 묶음을 같이 쓴다. 자료는 점수 낮은 것부터 높은 것 순서다.
import { Chess } from './vendor/chess.mjs';

export const themeKo = { mate: '메이트', mateIn1: '한 수 메이트', mateIn2: '두 수 메이트', fork: '포크', pin: '핀', skewer: '스큐어', discoveredAttack: '발견 공격', discoveredCheck: '발견 체크', doubleCheck: '양수 체크', promotion: '승격', underPromotion: '저승격', defensiveMove: '수비', deflection: '유인', attraction: '끌어내기', sacrifice: '희생', hangingPiece: '기물 잡기', trappedPiece: '갇힌 기물', interference: '차단', xRayAttack: 'X선 공격', endgame: '엔드게임', crushing: '결정적인 수', equality: '균형 잡기' };
const explanationKo = { fork: '한 기물로 두 기물을 동시에 공격하는 포크예요.', pin: '왕 뒤의 기물이 움직이지 못하도록 묶어 두었어요.', skewer: '앞 기물이 피하면 뒤의 기물을 잡을 수 있어요.', discoveredAttack: '기물을 움직여 뒤에 있던 공격선을 열었어요.', promotion: '폰을 끝까지 전진시켜 승격해요.', hangingPiece: '방어되지 않은 상대 기물을 잡아요.', trappedPiece: '도망갈 칸이 없는 상대 기물을 공격해요.', sacrifice: '기물을 내주고 더 큰 이득을 얻는 전술이에요.', mate: '왕의 탈출로를 모두 막아 메이트를 찾아요.' };

const uciMove = move => ({ from: move.slice(0, 2), to: move.slice(2, 4), ...(move[4] ? { promotion: move[4] } : {}) });

// 원본 FEN 은 상대 수 바로 전이라, 첫 수를 두어 내 차례 보드로 바꾼다.
export function parseRecord(record) {
  const [id, baseFen, uci, rating, themes] = record;
  const seq = uci.split(' '), g = new Chess(baseFen);
  g.move(uciMove(seq[0]));
  const fen = g.fen(), line = [];
  for (const move of seq.slice(1)) line.push(g.move(uciMove(move)).san);
  const tags = themes.split(' ');
  const motif = tags.find(t => themeKo[t] && t !== 'middlegame' && t !== 'endgame') || tags.find(t => themeKo[t]) || 'mate';
  const theme = tags.find(t => themeKo[t]) || motif;
  const name = themeKo[theme] || '전술';
  const level = rating < 1000 ? '입문' : rating < 1450 ? '쉬움' : rating < 1800 ? '보통' : '도전';
  return {
    id, fen, line, rating, level,
    goal: themes.includes('mate') ? 'mate' : 'line',
    theme: name,
    source: `https://lichess.org/training/${id}`,
    title: `${name} 퍼즐 · ${rating}`,
    hint: `${name} 전술을 쓸 방법을 찾아보세요. 공격하는 기물과 상대 왕의 안전을 살펴보세요.`,
    explanation: explanationKo[motif] || `정답 수순으로 ${tags.map(t => themeKo[t]).filter(Boolean).slice(0, 3).join(' · ') || '전술'} 전술을 완성했어요.`,
  };
}

// 점수에 가까운 퍼즐 번호(0부터)를 고른다. bands: manifest.ratingBands (같은 개수씩 나눈 점수 구간)
export function indexForRating(bands, rating, rand = Math.random) {
  const total = bands.reduce((sum, band) => sum + band.count, 0);
  let start = 0;
  for (let i = 0; i < bands.length; i++) {
    const band = bands[i];
    if (rating < band.max || i === bands.length - 1) {
      const f = Math.max(0, Math.min(1, (rating - band.min) / (band.max - band.min)));
      const spread = Math.min(300, band.count);
      const jitter = Math.floor(rand() * spread) - Math.floor(spread / 2);
      return Math.max(0, Math.min(total - 1, start + Math.floor(f * band.count) + jitter));
    }
    start += band.count;
  }
  return 0;
}

export class PuzzleBank {
  constructor(base = '/play/chess/data/', fetchFn = (...args) => fetch(...args)) {
    this.base = base; this.fetch = fetchFn; this.shards = new Map(); this.manifestPromise = null;
  }
  manifest() {
    this.manifestPromise ??= this.fetch(`${this.base}manifest.json`).then(r => { if (!r.ok) throw Error('manifest'); return r.json(); });
    this.manifestPromise.catch(() => { this.manifestPromise = null; });
    return this.manifestPromise;
  }
  // n: 0 .. count-1
  async record(n) {
    const manifest = await this.manifest();
    const chunk = Math.floor(n / manifest.shardSize);
    let promise = this.shards.get(chunk);
    if (!promise) {
      promise = this.fetch(`${this.base}${String(chunk).padStart(3, '0')}.json`).then(r => { if (!r.ok) throw Error('shard'); return r.json(); });
      this.shards.set(chunk, promise);
      promise.catch(() => this.shards.delete(chunk));
    }
    const record = (await promise)[n % manifest.shardSize];
    if (!record) throw Error('퍼즐을 찾을 수 없어요.');
    return parseRecord(record);
  }
  async near(rating, rand = Math.random) {
    const manifest = await this.manifest();
    const n = indexForRating(manifest.ratingBands, rating, rand);
    return { n, puzzle: await this.record(n) };
  }
}
