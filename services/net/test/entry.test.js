// Worker 시작점(src/index.js)은 default 와 클래스만 내보내야 wrangler dev / deploy 가 뜬다.
import { it, expect } from 'vitest';
import * as entry from '../src/index.js';

it('src/index.js 는 default 와 Durable Object 클래스만 내보낸다', () => {
  const bad = Object.entries(entry).filter(([name, value]) => name !== 'default' && typeof value !== 'function').map(([name]) => name);
  expect(bad).toEqual([]);
  expect(Object.keys(entry).sort()).toEqual(['Lobby', 'Matchmaker', 'Room', 'default']);
});
