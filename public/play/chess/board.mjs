// 체스판 그리기. 대전, 퍼즐, 퍼즐 러시, 홈 화면이 같이 쓴다.
import { pieceSVG } from './pieces.mjs';

export const NAMES = { p: '폰', n: '나이트', b: '비숍', r: '룩', q: '퀸', k: '킹' };

// g: chess.js 게임. legal: 고른 기물이 갈 수 있는 수들(verbose). last: 마지막 수 {from,to}
export function boardHTML(g, { flipped = false, selected = null, legal = [], last = null, hints = [], interactive = true, coords = true } = {}) {
  const files = flipped ? 'hgfedcba' : 'abcdefgh', ranks = flipped ? '12345678' : '87654321';
  const tag = interactive ? 'button' : 'div';
  let html = '';
  for (let ri = 0; ri < 8; ri++) {
    for (let ci = 0; ci < 8; ci++) {
      const file = files[ci], rank = ranks[ri], sq = file + rank, p = g.get(sq);
      const dark = (file.charCodeAt(0) - 97 + Number(rank)) % 2 === 0;
      const allowed = legal.some(m => m.to === sq);
      const check = p?.type === 'k' && p.color === g.turn() && g.isCheck();
      const cls = ['square', dark ? 'dark' : 'light', last && (last.from === sq || last.to === sq) ? 'last' : '', selected === sq ? 'selected' : '', check ? 'check' : '', hints.includes(sq) ? 'hint-square' : ''].filter(Boolean).join(' ');
      const label = `${sq}${p ? ` ${p.color === 'w' ? '백' : '흑'} ${NAMES[p.type]}` : ''}${allowed ? ' 이동 가능' : ''}`;
      html += `<${tag} class="${cls}" data-square="${sq}" aria-label="${label}">`
        + (coords && ri === 7 ? `<span class="file">${file}</span>` : '')
        + (coords && ci === 0 ? `<span class="rank">${rank}</span>` : '')
        + (p ? pieceSVG(p.type, p.color) : '')
        + (allowed ? `<span class="${p ? 'capture-ring' : 'move-dot'}"></span>` : '')
        + `</${tag}>`;
    }
  }
  return html;
}

export function promotionHTML(color) {
  return ['q', 'r', 'b', 'n'].map(p => `<button data-promote="${p}" aria-label="${NAMES[p]} 승격">${pieceSVG(p, color)}</button>`).join('');
}

export const uciOf = m => m.from + m.to + (m.promotion || '');
export const parseUci = uci => ({ from: uci.slice(0, 2), to: uci.slice(2, 4), ...(uci[4] ? { promotion: uci[4] } : {}) });
// 반복 확인용 위치 이름 (FEN 앞 네 칸)
export const positionKey = fen => fen.split(' ').slice(0, 4).join(' ');
