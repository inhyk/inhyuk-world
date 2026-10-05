// 시험 도우미: HTTP 부르기, 가입, WebSocket 접속자
import { SELF } from 'cloudflare:test';

export const ORIGIN = 'https://seonn.dev';
export const BASE = 'https://net.test';

let counter = 0;
// 시험마다 겹치지 않는 닉네임과 IP (가입 횟수 제한에 걸리지 않게)
export const uniqueNick = (prefix = 'u') => `${prefix}${Date.now().toString(36).slice(-4)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 4)}`.slice(0, 10);
export const randomIp = () => `10.${(Math.random() * 255) | 0}.${(Math.random() * 255) | 0}.${(Math.random() * 255) | 0}`;

export async function api(path, { method = 'GET', body, token, origin = ORIGIN, ip, headers = {} } = {}) {
  const h = { Origin: origin, ...headers };
  if (body !== undefined) h['Content-Type'] = 'application/json';
  if (token) h.Authorization = `Bearer ${token}`;
  if (ip) h['CF-Connecting-IP'] = ip;
  const res = await SELF.fetch(`${BASE}${path}`, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  let data = null;
  try { data = await res.clone().json(); } catch { /* json 이 아님 */ }
  return { status: res.status, data, res };
}

export async function signup(nickname = uniqueNick(), password = 'pass1234') {
  const { status, data } = await api('/auth/signup', { method: 'POST', body: { nickname, password }, ip: randomIp() });
  if (status !== 201) throw Error(`signup ${status} ${JSON.stringify(data)}`);
  return { ...data.user, token: data.token, password };
}

export async function befriend(a, b) {
  await api('/friends/requests', { method: 'POST', token: a.token, body: { id: b.id } });
  const { data } = await api(`/friends/requests/${a.id}/accept`, { method: 'POST', token: b.token });
  if (data?.status !== 'friends') throw Error(`befriend ${JSON.stringify(data)}`);
}

export async function ticketFor(user) {
  const { status, data } = await api('/auth/ticket', { method: 'POST', token: user.token });
  if (status !== 200) throw Error(`ticket ${status}`);
  return data.ticket;
}

// 받은 메시지를 줄 세워 두고 하나씩 꺼내 보는 접속자
export async function connect(path, { origin = ORIGIN } = {}) {
  const res = await SELF.fetch(`${BASE}${path}`, { headers: { Upgrade: 'websocket', Origin: origin } });
  const ws = res.webSocket;
  if (!ws) return { res };
  const inbox = [], waiters = [];
  let closed = null;
  const push = item => { const w = waiters.shift(); if (w) w(item); else inbox.push(item); };
  ws.addEventListener('message', e => push(JSON.parse(e.data)));
  ws.addEventListener('close', e => { closed = { code: e.code }; push({ t: '__closed', code: e.code }); });
  ws.accept();
  const next = (ms = 2000) => inbox.length ? Promise.resolve(inbox.shift()) : new Promise((resolve, reject) => {
    const waiter = item => { clearTimeout(timer); resolve(item); };
    const timer = setTimeout(() => { waiters.splice(waiters.indexOf(waiter), 1); reject(new Error('no message')); }, ms);
    waiters.push(waiter);
  });
  const until = async (pred, ms = 2000) => { for (;;) { const m = await next(ms); if (pred(m)) return m; } };
  const quiet = async (ms = 150) => { try { return await next(ms); } catch { return null; } };
  return {
    res, ws, next, until, quiet, get closed() { return closed; }, inbox,
    send: obj => ws.send(typeof obj === 'string' ? obj : JSON.stringify(obj)),
    close: () => { try { ws.close(1000, 'bye'); } catch { /* 이미 닫힘 */ } },
  };
}

export async function live(user) {
  const c = await connect(`/live?ticket=${await ticketFor(user)}`);
  const hello = await c.next();
  if (hello.t !== 'hello') throw Error(`live ${JSON.stringify(hello)}`);
  c.hello = hello;
  return c;
}

export const sleep = ms => new Promise(r => setTimeout(r, ms));
