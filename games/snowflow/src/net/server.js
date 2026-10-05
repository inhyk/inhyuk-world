// snowflow 가 쓰는 net 서버 주소.
// 보통은 기본값(wss://net.seonn.workers.dev). 개발과 테스트에서만 바꾼다:
//   - 주소 뒤에 ?net=http://127.0.0.1:8787 (내 컴퓨터 주소만 받는다)
//   - 빌드할 때 VITE_NET_SERVER=... 환경 변수
// 화면에는 바꾸는 단추가 없다.
import { DEFAULT_SERVER } from "../../../../packages/net/index.mjs";

const LOOPBACK = /^(https?|wss?):\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?\/?$/;

export function serverUrl(search = "", env = import.meta.env ?? {}) {
    let q = null;
    try { q = new URLSearchParams(search).get("net"); } catch { /* 주소가 이상하면 기본값 */ }
    if (q && LOOPBACK.test(q)) return q.replace(/\/+$/, "");
    if (typeof env.VITE_NET_SERVER === "string" && env.VITE_NET_SERVER) return env.VITE_NET_SERVER.replace(/\/+$/, "");
    return DEFAULT_SERVER;
}
