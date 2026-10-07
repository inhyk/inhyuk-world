// 뿌요뿌요 타워가 쓰는 net 서버 주소와 저장소.
// 서버 주소는 보통 기본값(wss://net.seonn.workers.dev). 개발과 테스트에서만 바꾼다:
//   - 주소 뒤에 ?net=http://127.0.0.1:8787 (내 컴퓨터 주소만 받는다. 남의 서버로 비밀번호가 가지 않게)
//   - 빌드할 때 VITE_NET_SERVER=... 환경 변수
// 화면에는 바꾸는 단추가 없다.
import { DEFAULT_SERVER } from '../../packages/net/index.mjs';

export const NET_GAME = 'jelly-tower';
const LOOPBACK = /^(https?|wss?):\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?\/?$/;

export function serverUrl(search = '', env = {}) {
  let q = null;
  try { q = new URLSearchParams(search).get('net'); } catch { /* 주소가 이상하면 기본값 */ }
  if (q && LOOPBACK.test(q)) return q.replace(/\/+$/, '');
  if (typeof env.VITE_NET_SERVER === 'string' && env.VITE_NET_SERVER) return env.VITE_NET_SERVER.replace(/\/+$/, '');
  return DEFAULT_SERVER;
}

// 기본 서버가 아니면 저장 이름 뒤에 서버를 붙여, 로컬 서버의 로그인 토큰이 진짜 서버로 가지 않게 한다.
// mirror(key, value): 앱에서는 기기 저장소에도 적는다 (platform.mjs mirrorSave)
export function scopedStorage(storage, server, mirror) {
  const suffix = server === DEFAULT_SERVER ? '' : `@${server}`;
  const k = key => `${key}${suffix}`;
  return {
    key: k,
    getItem: key => { try { return storage?.getItem(k(key)) ?? null; } catch { return null; } },
    // 저장에 실패하면(저장 공간이 꽉 참 등) 던지지 않고 false 를 돌려준다. 성공하면 true.
    setItem: (key, value) => { if (!storage) return false; try { storage.setItem(k(key), value); mirror?.(k(key), String(value)); return true; } catch { return false; } },
    removeItem: key => { if (!storage) return false; try { storage.removeItem(k(key)); mirror?.(k(key), ''); return true; } catch { return false; } },
  };
}
