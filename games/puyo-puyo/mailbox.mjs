// 친구 우체통에 편지를 맡기고 받아 오는 쪽 (게임). 서버는 src/lib/jelly-mail/mailbox.mjs.
// 사이트에서는 같은 주소의 /api/jelly-mail, 아이폰 앱에서는 seonn.dev로 부른다.
// 우체통이 없거나(개발 서버, 저장소 미연결) 인터넷이 끊기면 { ok: false }를 돌려주고, 게임은 직접 연결 채팅만 쓴다.

export function mailBase(loc = globalThis.location) {
  const dev = new URLSearchParams(loc?.search || '').get('mail'); // 개발·검사용: ?mail=http://127.0.0.1:3000/api/jelly-mail
  if (dev && /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(dev)) return dev;
  if (loc?.protocol === 'capacitor:' || loc?.protocol === 'ionic:') return 'https://seonn.dev/api/jelly-mail';
  return '/api/jelly-mail';
}

export function createMailClient(base = mailBase(), fetchImpl = (...args) => globalThis.fetch(...args)) {
  async function call(body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    try {
      const res = await fetchImpl(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
      if (!(res.headers.get('content-type') || '').includes('application/json')) return { ok: false, error: 'off', status: res.status };
      return { ...(await res.json()), status: res.status };
    } catch {
      return { ok: false, error: 'network', status: 0 };
    } finally {
      clearTimeout(timer);
    }
  }
  return {
    hello: (code, key) => call({ action: 'hello', code, key }),
    send: (code, key, letter) => call({ action: 'send', code, key, ...letter }),
    inbox: (code, key, ack = 0) => call({ action: 'inbox', code, key, ack }),
    forget: (code, key) => call({ action: 'forget', code, key }),
  };
}

// 편지 아이디: 같은 편지를 우체통과 직접 연결로 두 번 받아도 한 번만 보이게
export const letterId = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), b => b.toString(16).padStart(2, '0')).join('');
