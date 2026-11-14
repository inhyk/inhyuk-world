// 생각하는 일은 화면이 멈추지 않게 여기서 한다.
// bot, hint: 빠른 엔진(fast-engine.mjs). review: 수별 리뷰(engine.mjs).
import { Chess } from './vendor/chess.mjs';
import { reviewMove } from './engine.mjs';
import { chooseMove } from './fast-engine.mjs';

self.onmessage = ({ data }) => {
  try {
    if (data.type === 'review') {
      const game = new Chess();
      for (let i = 0; i < data.moves.length; i++) {
        const row = reviewMove(game.fen(), data.moves[i]);
        game.move(data.moves[i]);
        self.postMessage({ type: 'reviewRow', id: data.id, index: i, row });
      }
      self.postMessage({ type: 'reviewDone', id: data.id });
    } else if (data.type === 'bot') {
      const pick = chooseMove(data.fen, { ...data.engine, history: data.history || [] });
      self.postMessage({ type: 'bot', id: data.id, uci: pick?.uci || null });
    } else if (data.type === 'hint') {
      const pick = chooseMove(data.fen, { depth: 8, timeMs: 900, history: data.history || [] });
      self.postMessage({ type: 'hint', id: data.id, uci: pick?.uci || null });
    }
  } catch (error) {
    self.postMessage({ type: 'error', id: data.id, message: error.message });
  }
};
