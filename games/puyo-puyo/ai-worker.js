// AI 생각을 화면과 따로 돌린다 (휴대폰에서 화면이 멈칫하지 않게)
import { think, AI_LEVELS } from './ai.mjs';

self.onmessage = e => {
  const { id, state, level } = e.data || {};
  try {
    const plan = think({ ...state, cells: Uint8Array.from(state.cells) }, AI_LEVELS[level] || AI_LEVELS[1], Math.random);
    self.postMessage({ id, plan });
  } catch (error) {
    self.postMessage({ id, error: String(error?.message || error) });
  }
};
