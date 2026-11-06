// 영화관 진짜 영화: the movie table adds up to 13분 31초 and the videos come from the right place.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOVIE, clockText, videoBase } from './src/cinema.js';

test('햄찌 영화 is 13분 31초: opening + 1~10화 + 극장판 특별편', () => {
  assert.equal(MOVIE.title, '햄찌 영화');
  assert.equal(MOVIE.total, 811);
  assert.equal(clockText(MOVIE.total), '13:31');
  assert.equal(MOVIE.parts.length, 12);
  assert.equal(MOVIE.parts[0].file, 'movie-open.mp4');
  assert.deepEqual(MOVIE.parts.slice(1, 11).map((p) => p.file), Array.from({ length: 10 }, (_, i) => `ep${i + 1}.mp4`));
  assert.equal(MOVIE.parts[11].file, 'movie-special.mp4');
});

test('countdown text', () => {
  assert.equal(clockText(811 - 0.4), '13:31');
  assert.equal(clockText(60), '1:00');
  assert.equal(clockText(59.2), '1:00');
  assert.equal(clockText(0), '0:00');
  assert.equal(clockText(-3), '0:00');
});

test('videos: same origin on the site, the live site from the dev server, ?movies= to test', () => {
  const at = (href) => { const u = new URL(href); return { search: u.search, pathname: u.pathname, origin: u.origin }; };
  assert.equal(videoBase(at('https://seonn.dev/play/social-game/index.html')), 'https://seonn.dev/play/kongtteok/videos/');
  assert.equal(videoBase(at('http://localhost:3000/play/social-game/')), 'http://localhost:3000/play/kongtteok/videos/');
  assert.equal(videoBase(at('http://127.0.0.1:5272/')), 'https://seonn.dev/play/kongtteok/videos/');
  assert.equal(videoBase(at('http://127.0.0.1:5272/?movies=http://127.0.0.1:9000')), 'http://127.0.0.1:9000/');
});
