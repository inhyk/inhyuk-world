import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { toAppBrand, hasWebBrand, WEB_NAME, APP_NAME } from './brand.mjs';

test('앱에 넣는 빌드는 이름과 화면 글의 "뿌요"를 "젤리"로 바꾼다', () => {
  assert.equal(toAppBrand(WEB_NAME), APP_NAME);
  assert.equal(toAppBrand('<title>뿌요뿌요 타워 · PUYO PUYO TOWER</title>'), '<title>젤리 타워 · JELLY TOWER</title>');
  assert.equal(toAppBrand('<h1>뿌요뿌요<small>타워</small></h1>'), '<h1>젤리<small>타워</small></h1>');
  assert.equal(toAppBrand('방해 뿌요 3개, 꼬마 뿌요, 뿌요 이모티콘 좋아!'), '방해 젤리 3개, 꼬마 젤리, 젤리 이모티콘 좋아!');
  assert.equal(toAppBrand('말랑 젤리'), '말랑 젤리'); // 원래 젤리인 것은 그대로
  // 사이트와 앱이 같이 쓰는 영어 이름(저장 키, 서버 게임 이름, 기록 코드)은 건드리지 않는다
  const ids = "puyo-tower-v1 jelly-tower JELLY1.abc PUYO1.abc 'puyo-puyo' /play/puyo-puyo";
  assert.equal(toAppBrand(ids), ids);
});

test('남은 "뿌요"를 찾는다 (압축기가 바꿔 적은 것도)', () => {
  assert.equal(hasWebBrand('방해 뿌요'), true);
  assert.equal(hasWebBrand('"\\uBFCC\\uC694"'), true);
  assert.equal(hasWebBrand('PUYO PUYO TOWER'), true);
  assert.equal(hasWebBrand('방해 젤리, JELLY TOWER, puyo-tower-v1, PUYO1.'), false);
});

test('게임 코드를 앱 이름으로 바꾸면 "뿌요"가 하나도 남지 않는다', () => {
  const dir = fileURLToPath(new URL('.', import.meta.url));
  const shipped = readdirSync(dir).filter(f => /\.(mjs|js|html|css)$/.test(f) && !/(\.test\.mjs|-check\.mjs|browser-check\.mjs|\.fixture\.mjs|^brand\.mjs|^vite\.config\.js)$/.test(f));
  assert.ok(shipped.includes('main.js') && shipped.includes('index.html') && shipped.includes('shop.mjs'));
  let seen = 0;
  for (const file of shipped) {
    const text = readFileSync(dir + file, 'utf8');
    if (hasWebBrand(text)) seen++;
    assert.equal(hasWebBrand(toAppBrand(text)), false, file);
  }
  assert.ok(seen > 10, `사이트 이름("뿌요")을 쓰는 파일 ${seen}개`); // 코드는 사이트 이름으로 적혀 있다
});
