import test from 'node:test';
import assert from 'node:assert/strict';
import { createMailbox, memoryStore, upstashStore, blobStore, BOX_MAX, BOX_TTL, LIMITS } from '../../src/lib/jelly-mail/mailbox.mjs';
import { makeMailKey, STICKERS } from './chat.mjs';

const tick = () => new Promise(resolve => setImmediate(resolve));

// @vercel/blob 흉내: 비공개 파일, ETag 조건부 쓰기·지우기, 작업 횟수 세기 (진짜와 같은 오류 문구)
function fakeBlobApi({ now }) {
  class BlobPreconditionFailedError extends Error { constructor() { super('Vercel Blob: Precondition failed: ETag mismatch.'); } }
  class BlobNotFoundError extends Error { constructor() { super('Vercel Blob: The requested blob does not exist'); } }
  const files = new Map(), ops = { advanced: 0, simple: 0, free: 0 };
  let etags = 0;
  const pathOf = p => String(p).replace(/^https:\/\/fake\.blob\//, '');
  return {
    BlobPreconditionFailedError, BlobNotFoundError, files, ops,
    async put(pathname, body, o) {
      ops.advanced++;
      await tick();
      const cur = files.get(pathname);
      if (o.ifMatch !== undefined) { if (!cur || cur.etag !== o.ifMatch) throw new BlobPreconditionFailedError(); }
      else if (cur && !o.allowOverwrite) throw new Error('Vercel Blob: This blob already exists, use `allowOverwrite: true` if you want to overwrite it.');
      assert.equal(o.access, 'private'); assert.equal(o.addRandomSuffix, false);
      const file = { body: String(body), etag: `"e${++etags}"`, uploadedAt: new Date(now()) };
      files.set(pathname, file);
      return { url: `https://fake.blob/${pathname}`, pathname, etag: file.etag };
    },
    async get(pathname, o) {
      ops.simple++;
      assert.equal(o.access, 'private'); assert.equal(o.useCache, false);
      await tick();
      const f = files.get(pathOf(pathname));
      if (!f) return null;
      return { statusCode: 200, stream: new Response(f.body).body, headers: new Headers(), blob: { etag: f.etag, uploadedAt: f.uploadedAt, pathname } };
    },
    async head(pathname) {
      ops.simple++;
      const f = files.get(pathOf(pathname));
      if (!f) throw new BlobNotFoundError();
      return { etag: f.etag, uploadedAt: f.uploadedAt };
    },
    async del(target, o = {}) {
      ops.free++;
      await tick();
      const list = Array.isArray(target) ? target : [target];
      if (o.ifMatch !== undefined) {
        const f = files.get(pathOf(list[0]));
        if (!f) throw new BlobNotFoundError();
        if (f.etag !== o.ifMatch) throw new BlobPreconditionFailedError();
      }
      for (const p of list) files.delete(pathOf(p));
    },
    async list({ prefix = '', cursor, limit = 1000 } = {}) {
      ops.advanced++;
      const all = [...files].filter(([p]) => p.startsWith(prefix)).map(([p, f]) => ({ url: `https://fake.blob/${p}`, pathname: p, uploadedAt: f.uploadedAt }));
      const start = Number(cursor || 0);
      return { blobs: all.slice(start, start + limit), hasMore: start + limit < all.length, cursor: String(start + limit) };
    },
  };
}

function setup(kind = 'redis') {
  const clock = { t: Date.UTC(2026, 9, 5, 3, 0, 0) };
  const now = () => clock.t;
  const api = kind === 'blob' ? fakeBlobApi({ now }) : null;
  const store = kind === 'blob' ? blobStore(api, { now }) : memoryStore({ now });
  const mail = createMailbox(store, { now });
  const call = (body, ip = '1.2.3.4') => mail.handle(body, { ip });
  return { clock, store, call, api, mail };
}
const A = { code: 'AAAAAA', key: makeMailKey() }, B = { code: 'BBBBBB', key: makeMailKey() }, C = { code: 'CCCCCC', key: makeMailKey() };

for (const kind of ['redis', 'blob']) {
  test(`[${kind}] 우체통 열쇠: 처음 온 열쇠로 코드를 맡고, 다른 열쇠는 거절`, async () => {
    const { call, store } = setup(kind);
    const first = await call({ action: 'hello', ...A });
    assert.equal(first.body.ok, true); assert.equal(first.body.created, true);
    assert.deepEqual(first.body.pace, store.pace); // 게임이 우체통을 얼마나 자주 열지 알려 준다
    assert.equal((await call({ action: 'hello', ...A })).body.created, undefined); // 같은 열쇠는 언제든
    const other = await call({ action: 'hello', code: A.code, key: makeMailKey() });
    assert.equal(other.status, 409); assert.equal(other.body.error, 'taken');
    assert.equal((await call({ action: 'hello', code: 'AAAAA0', key: A.key })).status, 400); // 0은 친구 코드에 없음
    assert.equal((await call({ action: 'hello', code: A.code, key: 'short' })).status, 400);
    assert.equal((await call({ action: 'nope' })).status, 400);
  });

  test(`[${kind}] 친구가 없을 때 보낸 편지·젤리 이모티콘·친구 신청이 쌓였다가, 받아 가면 지워진다`, async () => {
    const { clock, call } = setup(kind);
    await call({ action: 'hello', ...A }); await call({ action: 'hello', ...B });
    assert.equal((await call({ action: 'send', ...A, to: B.code, kind: 'fr', name: '지우', level: 7 })).status, 200);
    clock.t += 1000;
    const sent = await call({ action: 'send', ...A, to: B.code, kind: 'msg', text: '안녕 씨발 😂', name: '지우', level: 7, id: 'abc12345' });
    assert.equal(sent.status, 200); assert.equal(sent.body.id, 'abc12345');
    clock.t += 1000;
    assert.equal((await call({ action: 'send', ...A, to: B.code, kind: 'st', sticker: STICKERS.length - 1, name: '지우', level: 7 })).status, 200);
    const box = await call({ action: 'inbox', ...B });
    assert.equal(box.status, 200);
    assert.deepEqual(box.body.letters.map(l => [l.from, l.kind, l.text ?? l.sticker ?? null]), [
      ['AAAAAA', 'fr', null], ['AAAAAA', 'msg', '안녕 ♡♡ 😂'], ['AAAAAA', 'st', STICKERS.length - 1],
    ]);
    assert.equal(box.body.letters[0].name, '지우'); assert.equal(box.body.letters[0].level, 7);
    const after = await call({ action: 'inbox', ...B, ack: box.body.letters[1].t }); // 두 번째까지 받았다
    assert.deepEqual(after.body.letters.map(l => l.kind), ['st']);
    assert.deepEqual((await call({ action: 'inbox', ...B, ack: box.body.letters[2].t })).body.letters, []);
    assert.deepEqual((await call({ action: 'inbox', ...A })).body.letters, []); // 보낸 사람 우체통은 그대로 비어 있다
  });

  test(`[${kind}] 열쇠가 틀리면 보내지도 열지도 못하고, 다른 사람인 척할 수 없다`, async () => {
    const { call } = setup(kind);
    await call({ action: 'hello', ...A }); await call({ action: 'hello', ...B });
    await call({ action: 'send', ...A, to: B.code, kind: 'msg', text: '비밀', name: '지우', level: 1 });
    assert.equal((await call({ action: 'inbox', code: B.code, key: A.key })).status, 401); // 남의 우체통
    assert.equal((await call({ action: 'send', code: A.code, key: B.key, to: B.code, kind: 'msg', text: '가짜', name: '지우', level: 1 })).status, 401);
    assert.equal((await call({ action: 'send', code: 'CCCCCC', key: makeMailKey(), to: B.code, kind: 'msg', text: '누구게', name: '?', level: 1 })).status, 401);
    assert.equal((await call({ action: 'inbox', ...B })).body.letters.length, 1);
  });

  test(`[${kind}] 보내는 내용 검사: 개인정보·빈 글·없는 이모티콘·나에게·이상한 종류는 거절`, async () => {
    const { call } = setup(kind);
    await call({ action: 'hello', ...A });
    const base = { action: 'send', ...A, to: B.code, name: '지우', level: 1 };
    assert.equal((await call({ ...base, kind: 'msg', text: '내 번호 010-1234-5678' })).body.error, 'personal');
    assert.equal((await call({ ...base, kind: 'msg', text: 'me@example.com' })).body.error, 'personal');
    assert.equal((await call({ ...base, kind: 'msg', text: '   ' })).body.error, 'empty');
    assert.equal((await call({ ...base, kind: 'st', sticker: STICKERS.length })).body.error, 'sticker');
    assert.equal((await call({ ...base, kind: 'st', sticker: 'x' })).body.error, 'sticker');
    assert.equal((await call({ ...base, to: A.code, kind: 'msg', text: '나야' })).body.error, 'to');
    assert.equal((await call({ ...base, kind: 'inv', text: 'ROOMAB' })).body.error, 'kind');
    assert.equal((await call({ ...base, kind: 'msg', text: '가'.repeat(200) })).status, 200);
  });

  test(`[${kind}] 너무 많이 보내면 막고(1분 20개), 1분이 지나면 다시 된다`, async () => {
    const { clock, call } = setup(kind);
    await call({ action: 'hello', ...A });
    const base = { action: 'send', ...A, to: B.code, kind: 'msg', text: '도배', name: '지우', level: 1 };
    for (let i = 0; i < LIMITS.perMinute; i++) assert.equal((await call(base)).status, 200, `${i}`);
    assert.equal((await call(base)).status, 429);
    clock.t += 61000;
    assert.equal((await call(base)).status, 200);
  });

  test(`[${kind}] 우체통에는 최근 100통만, 7일이 지난 편지는 사라진다`, async () => {
    const { clock, call } = setup(kind);
    await call({ action: 'hello', ...A }); await call({ action: 'hello', ...B });
    for (let i = 0; i < BOX_MAX + 15; i++) {
      clock.t += 61000;
      await call({ action: 'send', ...A, to: B.code, kind: 'msg', text: `편지 ${i}`, name: '지우', level: 1 });
    }
    const box = (await call({ action: 'inbox', ...B })).body.letters;
    assert.equal(box.length, BOX_MAX);
    assert.equal(box[0].text, '편지 15'); assert.equal(box.at(-1).text, `편지 ${BOX_MAX + 14}`);
    clock.t += BOX_TTL * 1000 + 1000;
    assert.deepEqual((await call({ action: 'inbox', ...B })).body.letters, []);
  });

  test(`[${kind}] 친구 신청은 그 코드가 있는지 알려 주고, 계정을 지우면 열쇠·우체통도 사라진다`, async () => {
    const { call } = setup(kind);
    await call({ action: 'hello', ...A });
    assert.equal((await call({ action: 'send', ...A, to: B.code, kind: 'fr', name: '지우', level: 1 })).body.known, false);
    await call({ action: 'hello', ...B });
    assert.equal((await call({ action: 'send', ...A, to: B.code, kind: 'fr', name: '지우', level: 1 })).body.known, true);
    assert.equal((await call({ action: 'send', ...A, to: B.code, kind: 'msg', text: '안녕', name: '지우', level: 1 })).body.known, undefined);
    assert.equal((await call({ action: 'forget', code: B.code, key: A.key })).status, 401);
    assert.equal((await call({ action: 'forget', ...B })).status, 200);
    assert.equal((await call({ action: 'inbox', ...B })).status, 401);
    assert.equal((await call({ action: 'hello', ...B })).body.created, true);
    assert.deepEqual((await call({ action: 'inbox', ...B })).body.letters, []);
  });

  test(`[${kind}] 여럿이 동시에 보내고, 받는 사이에 새 편지가 와도 하나도 잃어버리지 않는다`, async () => {
    const { clock, call } = setup(kind);
    for (const P of [A, B, C]) await call({ action: 'hello', ...P });
    await Promise.all([
      call({ action: 'send', ...A, to: B.code, kind: 'msg', text: '하나', name: '지우', level: 1 }),
      call({ action: 'send', ...C, to: B.code, kind: 'msg', text: '둘', name: '하준', level: 1 }),
      call({ action: 'send', ...A, to: B.code, kind: 'st', sticker: 0, name: '지우', level: 1 }),
    ]);
    const first = (await call({ action: 'inbox', ...B })).body.letters;
    assert.equal(first.length, 3);
    clock.t += 1000;
    // 받은 것을 지우는 순간에 새 편지가 온다
    await Promise.all([
      call({ action: 'inbox', ...B, ack: Math.max(...first.map(l => l.t)) }),
      call({ action: 'send', ...C, to: B.code, kind: 'msg', text: '셋', name: '하준', level: 1 }),
    ]);
    assert.deepEqual((await call({ action: 'inbox', ...B })).body.letters.map(l => l.text), ['셋']);
  });
}

test('[blob] 무료 한도를 아낀다: 편지 하나는 저장 1번, 빈 우체통 열기는 읽기 1번, 다 받으면 지우기는 공짜', async () => {
  const { call, api } = setup('blob');
  await call({ action: 'hello', ...A }); await call({ action: 'hello', ...B });
  const count = async fn => { const before = { ...api.ops }; await fn(); return { advanced: api.ops.advanced - before.advanced, simple: api.ops.simple - before.simple, free: api.ops.free - before.free }; };
  assert.deepEqual(await count(() => call({ action: 'inbox', ...B })), { advanced: 0, simple: 1, free: 0 }); // 열쇠 확인은 기억해 둔 것
  assert.deepEqual(await count(() => call({ action: 'send', ...A, to: B.code, kind: 'msg', text: '안녕', name: '지우', level: 1 })), { advanced: 1, simple: 1, free: 0 });
  const box = (await call({ action: 'inbox', ...B })).body.letters;
  assert.deepEqual(await count(() => call({ action: 'inbox', ...B, ack: box[0].t })), { advanced: 0, simple: 2, free: 1 });
  assert.equal(api.files.has('jelly-mail/box/BBBBBB.json'), false); // 다 받은 우체통 파일은 지워졌다
  assert.ok([...api.files.keys()].every(p => p.startsWith('jelly-mail/')));
});

test('[blob] 하루 한 번 청소: 7일 넘게 그대로인 우체통만 지운다', async () => {
  const { clock, call, api, mail } = setup('blob');
  for (const P of [A, B, C]) await call({ action: 'hello', ...P });
  await call({ action: 'send', ...A, to: B.code, kind: 'msg', text: '오래된 편지', name: '지우', level: 1 });
  clock.t += BOX_TTL * 1000 - 3600000;
  await call({ action: 'send', ...A, to: C.code, kind: 'msg', text: '새 편지', name: '지우', level: 1 });
  clock.t += 2 * 3600000; // B 편지는 7일이 지났고, C 편지는 아직
  assert.equal(await mail.cleanup(), 1);
  assert.equal(api.files.has('jelly-mail/box/BBBBBB.json'), false);
  assert.equal(api.files.has('jelly-mail/box/CCCCCC.json'), true);
  assert.equal(api.files.has('jelly-mail/key/BBBBBB.json'), true); // 열쇠는 그대로
});

test('[redis] 메모리 저장소의 청소는 할 일이 없다 (Redis는 스스로 만료)', async () => {
  const { mail } = setup('redis');
  assert.equal(await mail.cleanup(), 0);
});

test('Upstash 저장소: 명령을 한 번에 묶어 보내고 오류는 알린다', async () => {
  const calls = [];
  const fakeFetch = async (url, init) => {
    calls.push({ url, init });
    const commands = JSON.parse(init.body);
    return { ok: true, json: async () => commands.map(c => (c[0] === 'GET' ? { result: null } : c[0] === 'BAD' ? { error: 'ERR boom' } : { result: 'OK' })) };
  };
  const store = upstashStore('https://example.upstash.io/', 'secret-token', fakeFetch);
  assert.deepEqual(await store.run([['SET', 'k', 1, 'NX'], ['GET', 'k']]), ['OK', null]);
  assert.equal(calls[0].url, 'https://example.upstash.io/pipeline');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer secret-token');
  assert.deepEqual(JSON.parse(calls[0].init.body), [['SET', 'k', '1', 'NX'], ['GET', 'k']]);
  await assert.rejects(store.run([['BAD']]), /boom/);
  const down = upstashStore('https://x', 't', async () => ({ ok: false, status: 503 }));
  await assert.rejects(down.run([['GET', 'k']]), /503/);
});
