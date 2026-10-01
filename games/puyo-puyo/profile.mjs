// 로그인과 기록. 서버 없이 이 기기(브라우저)에 계정을 만든다.
// 닉네임 + 비밀번호(해시로 저장)로 들어가고, 계정마다 레벨·코인·상점·타워·미션이 따로 저장된다.
// 다른 기기로 옮기고 싶으면 "기록 코드"를 복사해서 붙여 넣는다.

export const STORE_KEY = 'puyo-tower-v1';
export const NAME_MAX = 10, PASS_MIN = 4, PASS_MAX = 16, LEVEL_MAX = 99;

export function newProgress() {
  return {
    level: 1, xp: 0, coins: 100,
    owned: { skin: ['classic'], effect: ['sparkle'] },
    equip: { skin: 'classic', effect: 'sparkle' },
    tower: { best: 0, cleared: false, comet: false, losses: {}, endings: 0, cometEndings: 0 },
    missions: {},
    daily: null,
    rewards: { dailyDate: '', dailyStreak: 0, spinDate: '', spinIndex: null, date: '', playSeconds: 0, claimedTime: [] },
    stats: {
      games: 0, wins: 0, losses: 0, maxChain: 0, maxScore: 0, popped: 0, allClears: 0, offsets: 0,
      garbageSent: 0, onlineGames: 0, onlineWins: 0, localGames: 0, endlessBest: 0, playSeconds: 0,
    },
    settings: { ghost: true, shake: true },
  };
}

// 저장된 기록에 빠진 칸이 있으면 채운다 (옛 버전 기록도 열리게)
export function sanitize(p) {
  const base = newProgress();
  const out = { ...base, ...(p && typeof p === 'object' ? p : {}) };
  out.level = clampInt(out.level, 1, LEVEL_MAX);
  out.xp = clampInt(out.xp, 0, 1e9);
  out.coins = clampInt(out.coins, 0, 1e9);
  out.owned = {
    skin: uniq(['classic', ...arr(out.owned?.skin)]),
    effect: uniq(['sparkle', ...arr(out.owned?.effect)]),
  };
  out.equip = {
    skin: out.owned.skin.includes(out.equip?.skin) ? out.equip.skin : 'classic',
    effect: out.owned.effect.includes(out.equip?.effect) ? out.equip.effect : 'sparkle',
  };
  out.tower = { ...base.tower, ...(out.tower || {}) };
  out.tower.best = clampInt(out.tower.best, 0, 6);
  out.stats = { ...base.stats, ...(out.stats || {}) };
  out.settings = { ...base.settings, ...(out.settings || {}) };
  out.missions = out.missions && typeof out.missions === 'object' ? out.missions : {};
  const r = out.rewards || {};
  const date = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '';
  out.rewards = {
    dailyDate: date(r.dailyDate), dailyStreak: clampInt(r.dailyStreak, 0, 1e6),
    spinDate: date(r.spinDate), spinIndex: Number.isInteger(r.spinIndex) && r.spinIndex >= 0 && r.spinIndex < 6 ? r.spinIndex : null,
    date: date(r.date), playSeconds: Math.max(0, Math.min(86400, Number(r.playSeconds) || 0)),
    claimedTime: uniq(arr(r.claimedTime).filter(id => ['5m', '15m', '30m'].includes(id))),
  };
  return out;
}
const arr = v => (Array.isArray(v) ? v.filter(x => typeof x === 'string') : []);
const uniq = v => [...new Set(v)];
function clampInt(v, lo, hi) { v = Math.floor(Number(v)); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : lo; }

// ---------- 레벨 ----------
export const xpToNext = level => 100 + (level - 1) * 40;
export const levelReward = level => 50 + level * 10;

// 경험치를 더하고, 오른 레벨들과 레벨업 보상 코인을 돌려준다
export function addXp(p, amount, coinMultiplier = 1) {
  const levels = [];
  let coins = 0;
  p.xp += Math.max(0, Math.round(amount));
  while (p.level < LEVEL_MAX && p.xp >= xpToNext(p.level)) {
    p.xp -= xpToNext(p.level);
    p.level++;
    levels.push(p.level);
    const bonus = levelReward(p.level) * coinMultiplier;
    coins += bonus;
    p.coins += bonus;
  }
  if (p.level >= LEVEL_MAX) p.xp = Math.min(p.xp, xpToNext(LEVEL_MAX));
  return { levels, coins };
}

// ---------- 계정 저장소 ----------
export function emptyStore() { return { v: 1, accounts: [], current: null }; }
export function loadStore(storage) {
  try {
    const raw = storage?.getItem(STORE_KEY);
    if (!raw) return emptyStore();
    const s = JSON.parse(raw);
    if (!s || !Array.isArray(s.accounts)) return emptyStore();
    s.accounts = s.accounts.filter(a => a && typeof a.id === 'string' && typeof a.name === 'string').map(a => ({ ...a, progress: sanitize(a.progress) }));
    if (!s.accounts.some(a => a.id === s.current)) s.current = null;
    return s;
  } catch {
    return emptyStore();
  }
}
export function saveStore(storage, store) {
  try { storage?.setItem(STORE_KEY, JSON.stringify(store)); return true; } catch { return false; }
}

export function cleanName(name) {
  return String(name ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, NAME_MAX);
}
export function checkName(store, name) {
  const n = cleanName(name);
  if (!n) return '닉네임을 적어 줘.';
  if (store.accounts.some(a => a.name.toLowerCase() === n.toLowerCase())) return '이미 이 기기에 있는 닉네임이야. 로그인하거나 다른 이름을 써 줘.';
  return '';
}
export function checkPassword(password) {
  const p = String(password ?? '');
  if (p.length < PASS_MIN) return `비밀번호는 ${PASS_MIN}글자 이상으로 해 줘.`;
  if (p.length > PASS_MAX) return `비밀번호는 ${PASS_MAX}글자까지야.`;
  return '';
}

function randomHex(bytes = 8) {
  const a = new Uint8Array(bytes);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(a);
  else a.forEach((_, i) => { a[i] = Math.random() * 256; });
  return [...a].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password, salt) {
  const text = `puyo-tower:${salt}:${password}`;
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    try {
      const digest = await subtle.digest('SHA-256', new TextEncoder().encode(text));
      return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
    } catch { /* 아래 방법으로 */ }
  }
  // 보안 연결이 아닌 곳에서 쓰는 대체 해시
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let round = 0; round < 64; round++) {
    for (let i = 0; i < text.length; i++) {
      h1 = Math.imul(h1 ^ text.charCodeAt(i), 16777619) >>> 0;
      h2 = Math.imul(h2 + text.charCodeAt(i) + round, 2246822519) >>> 0;
    }
  }
  return `x${h1.toString(16)}${h2.toString(16)}`;
}

export async function createAccount(store, name, password) {
  const error = checkName(store, name) || checkPassword(password);
  if (error) return { ok: false, error };
  const salt = randomHex(8);
  const account = { id: randomHex(6), name: cleanName(name), salt, hash: await hashPassword(password, salt), created: Date.now(), last: Date.now(), progress: newProgress() };
  store.accounts.push(account);
  store.current = account.id;
  return { ok: true, account };
}

export async function login(store, name, password) {
  const n = cleanName(name).toLowerCase();
  const account = store.accounts.find(a => a.name.toLowerCase() === n);
  if (!account) return { ok: false, error: '그 닉네임의 계정이 이 기기에 없어. 새로 만들거나 기록 코드로 가져와 줘.' };
  if ((await hashPassword(String(password ?? ''), account.salt)) !== account.hash) return { ok: false, error: '비밀번호가 달라. 다시 해 봐!' };
  account.last = Date.now();
  store.current = account.id;
  return { ok: true, account };
}

export function logout(store) { store.current = null; }
export function currentAccount(store) { return store.accounts.find(a => a.id === store.current) || null; }
export function removeAccount(store, id) {
  store.accounts = store.accounts.filter(a => a.id !== id);
  if (store.current === id) store.current = null;
}

// ---------- 기록 코드 (다른 기기로 옮기기) ----------
function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromBase64(text) {
  const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
}
function checksum(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = (Math.imul(h, 33) ^ text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
export function exportCode(account) {
  const body = toBase64(JSON.stringify({ n: account.name, s: account.salt, h: account.hash, c: account.created, p: account.progress }));
  return `PUYO1.${body}.${checksum(body)}`;
}
export function importCode(store, code) {
  const text = String(code ?? '').replace(/\s+/g, '');
  const parts = text.split('.');
  if (parts.length !== 3 || parts[0] !== 'PUYO1') return { ok: false, error: '기록 코드 모양이 이상해. 처음부터 끝까지 다 복사했는지 확인해 줘.' };
  if (checksum(parts[1]) !== parts[2]) return { ok: false, error: '기록 코드가 중간에 잘렸거나 바뀌었어.' };
  let data;
  try { data = JSON.parse(fromBase64(parts[1])); } catch { return { ok: false, error: '기록 코드를 읽을 수 없어.' }; }
  const name = cleanName(data.n);
  if (!name || typeof data.s !== 'string' || typeof data.h !== 'string') return { ok: false, error: '기록 코드에 계정 정보가 없어.' };
  let account = store.accounts.find(a => a.name.toLowerCase() === name.toLowerCase());
  if (account) {
    Object.assign(account, { salt: data.s, hash: data.h, progress: sanitize(data.p) });
  } else {
    account = { id: randomHex(6), name, salt: data.s, hash: data.h, created: Number(data.c) || Date.now(), last: Date.now(), progress: sanitize(data.p) };
    store.accounts.push(account);
  }
  return { ok: true, account };
}
