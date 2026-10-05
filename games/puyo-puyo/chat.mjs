// 채팅과 친구에 쓰는 순수 규칙: 나쁜 말 가리기, 개인정보 막기, 너무 빨리 보내기 막기, 친구 코드.
// 화면·네트워크와 상관없어서 테스트에서 그대로 쓴다. 보낼 때도, 받을 때도 같은 규칙을 거친다.

export const CHAT_MAX = 60;       // 한 번에 보낼 수 있는 글자
export const CHAT_KEEP = 50;      // 친구마다 기기에 남기는 대화 수
export const FRIEND_MAX = 30;     // 친구는 30명까지
export const FRIEND_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// 게임 중에 빠르게 누르는 말 (글자를 치지 않아도 되고, 나쁜 말이 섞일 수 없다)
export const QUICK = ['👋 안녕!', '👍 잘한다!', '😮 와!', '🔥 간다!', '😅 아깝다~', '🙏 봐줘~', '🎉 GG!', '💪 한 판 더!'];

// 젤리 이모티콘: 게임 캐릭터를 그려서 보여 주는 스티커. 번호로만 주고받아서 나쁜 말이 섞일 수 없다.
export const STICKERS = [
  { char: 'hero', mood: 'happy', text: '좋아!' },
  { char: 'poyo', mood: 'happy', text: '고마워' },
  { char: 'luna', mood: 'happy', text: '안녕~' },
  { char: 'bubble', mood: 'happy', text: 'ㅋㅋㅋ' },
  { char: 'comet', mood: 'happy', text: '최고!' },
  { char: 'nova', mood: 'idle', text: '반짝반짝' },
  { char: 'poyo', mood: 'sad', text: '흑흑' },
  { char: 'hero', mood: 'sad', text: '미안해' },
  { char: 'golem', mood: 'sad', text: '졌다…' },
  { char: 'king', mood: 'attack', text: '덤벼라!' },
  { char: 'wizard', mood: 'attack', text: '연쇄 간다' },
  { char: 'comet', mood: 'attack', text: '한 판 더!' },
];
export const validSticker = n => Number.isInteger(n) && n >= 0 && n < STICKERS.length;
// 이모지 고르기 판 (글자처럼 메시지에 넣는다)
export const EMOJIS = [
  '😀', '😂', '🥰', '😎', '🤩', '😮', '😭', '😡', '🤔', '😴', '🥳', '😇',
  '👍', '👏', '🙌', '🙏', '💪', '👋', '✌️', '🤝', '❤️', '💛', '💚', '💙',
  '💜', '🔥', '✨', '⭐', '🌈', '🎉', '🎁', '🏆', '👑', '🎮', '🍓', '🍩',
  '🐶', '🐱', '🐰', '🐻',
];

// 글자 수는 눈에 보이는 글자(이모지 하나 = 한 글자)로 센다. 그래야 이모지가 반으로 잘리지 않는다.
const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('ko', { granularity: 'grapheme' }) : null;
export const graphemes = text => (segmenter ? Array.from(segmenter.segment(String(text ?? '')), x => x.segment) : Array.from(String(text ?? '')));
// 이모지만 1~3개 보낸 메시지는 크게 보여 준다
const EMOJI_ONLY = /^[\p{Extended_Pictographic}\p{Emoji_Modifier}\u200d\ufe0f\u20e3\s]+$/u;
export function bigEmoji(text) {
  const s = String(text ?? '').trim();
  if (!s || !EMOJI_ONLY.test(s)) return false;
  const count = graphemes(s.replace(/\s+/g, '')).length;
  return count >= 1 && count <= 3;
}

// 가릴 말. 글자 사이에 띄어쓰기·점·별표를 넣어도 찾는다.
const BAD = [
  '씨발', '시발', '씨바', '시바', '씹', 'ㅅㅂ', 'ㅆㅂ', '병신', '븅신', 'ㅂㅅ', '개새', '새끼', 'ㅅㄲ', '좆', '존나', '졸라', 'ㅈㄴ',
  '지랄', 'ㅈㄹ', '염병', '엠창', '꺼져', '닥쳐', '미친놈', '미친년', '애미', '느금', '니미', '죽을래',
  'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'damn',
];
const GAP = "[\\s.,_*~!?·'\"`^-]*";
const BAD_RE = BAD.map(word => new RegExp([...word.replace(/\s/g, '')].map(ch => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join(GAP), 'gi'));

// 보낼 수 있는 모양으로 다듬고, 나쁜 말은 ♡로 바꾼다
export function cleanChat(text) {
  let s = String(text ?? '')
    .replace(/\s+/g, ' ')                          // 줄바꿈·탭도 띄어쓰기 하나로
    .replace(/[\u0000-\u001f\u007f-\u009f<>]/g, '')  // 남은 조종 문자와 꺾쇠는 지운다
    .trim();
  s = graphemes(s).slice(0, CHAT_MAX).join('');
  for (const re of BAD_RE) s = s.replace(re, m => '♡'.repeat(Math.min(4, [...m.replace(/[\s.,_*~!?·'"`^-]/g, '')].length)));
  return s;
}

// 전화번호·이메일처럼 보이면 보내지 않는다 (어린이 안전)
export function personalInfo(text) {
  const s = String(text ?? '');
  const digits = s.replace(/[\s.\-()]/g, '');
  if (/01[016789]\d{7,8}/.test(digits) || /\d{9,}/.test(digits)) return '전화번호';
  if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(s)) return '이메일';
  return '';
}

// 너무 빨리 많이 보내면 막는다: windowMs 동안 max개까지
export function rateLimiter(max = 5, windowMs = 5000) {
  const times = [];
  return (now = Date.now()) => {
    while (times.length && now - times[0] > windowMs) times.shift();
    if (times.length >= max) return false;
    times.push(now);
    return true;
  };
}

// 친구 코드: 여섯 글자 (헷갈리는 0·O·1·I는 빼고)
export const normaliseFriendCode = value => String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
export const validFriendCode = code => typeof code === 'string' && code.length === 6 && [...code].every(ch => FRIEND_ALPHABET.includes(ch));
export function makeFriendCode(random = () => crypto.getRandomValues(new Uint8Array(1))[0] / 256) {
  let code = '';
  for (let i = 0; i < 6; i++) code += FRIEND_ALPHABET[Math.floor(random() * FRIEND_ALPHABET.length) % FRIEND_ALPHABET.length];
  return code;
}
export const cleanName = name => String(name ?? '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 10) || '친구';
// 우체통 열쇠: 친구 코드의 주인만 자기 우체통을 열 수 있게 하는 비밀 값 (32글자, 기기에만 저장)
export const validMailKey = key => typeof key === 'string' && /^[0-9a-f]{32}$/.test(key);
export function makeMailKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
export const REQUEST_MAX = 20;   // 받은 친구 신청은 20개까지 기억
// 대화 한 줄 (글자 또는 젤리 이모티콘). 이상한 값은 null
export function cleanEntry(m) {
  if (!m || typeof m !== 'object') return null;
  const time = Number(m.time) || 0, me = m.me === true;
  if (validSticker(m.sticker)) return { me, sticker: m.sticker, time };
  if (typeof m.text !== 'string') return null;
  const text = cleanChat(m.text);
  if (!text) return null;
  return { me, text, time, ...(m.invite ? { invite: String(m.invite).slice(0, 6) } : {}) };
}

// ---------- 계정에 저장하는 친구 정보 ----------
// code·key: 내 친구 코드와 우체통 열쇠, requests: 받은 친구 신청, sent: 내가 보낸 친구 신청,
// lastMail: 우체통에서 마지막으로 받은 시각 (같은 편지를 두 번 받지 않게)
export function emptySocial() { return { code: '', key: '', friends: [], blocked: [], chats: {}, requests: [], sent: [], lastMail: 0 }; }
export function sanitizeSocial(s) {
  const out = emptySocial();
  if (!s || typeof s !== 'object') return out;
  if (validFriendCode(s.code)) out.code = s.code;
  if (out.code && validMailKey(s.key)) out.key = s.key;
  out.lastMail = Math.max(0, Number(s.lastMail) || 0);
  const seen = new Set([out.code]);
  for (const f of Array.isArray(s.friends) ? s.friends : []) {
    if (!f || !validFriendCode(f.code) || seen.has(f.code) || out.friends.length >= FRIEND_MAX) continue;
    seen.add(f.code);
    out.friends.push({ code: f.code, name: cleanName(f.name), level: Math.max(1, Math.min(999, Number(f.level) | 0)), since: Number(f.since) || 0 });
  }
  out.blocked = [...new Set((Array.isArray(s.blocked) ? s.blocked : []).filter(validFriendCode))].slice(0, 200);
  for (const f of out.friends) {
    const log = Array.isArray(s.chats?.[f.code]) ? s.chats[f.code] : [];
    out.chats[f.code] = log.map(cleanEntry).filter(Boolean).slice(-CHAT_KEEP);
  }
  const blocked = new Set(out.blocked), asked = new Set();
  for (const r of Array.isArray(s.requests) ? s.requests : []) {
    if (!r || !validFriendCode(r.code) || seen.has(r.code) || blocked.has(r.code) || asked.has(r.code) || out.requests.length >= REQUEST_MAX) continue;
    asked.add(r.code);
    out.requests.push({ code: r.code, name: cleanName(r.name), level: Math.max(1, Math.min(999, Number(r.level) | 0)), time: Number(r.time) || 0 });
  }
  const sentSeen = new Set();
  for (const r of Array.isArray(s.sent) ? s.sent : []) {
    const code = typeof r === 'string' ? r : r?.code;
    if (!validFriendCode(code) || seen.has(code) || sentSeen.has(code) || out.sent.length >= FRIEND_MAX) continue;
    sentSeen.add(code);
    out.sent.push({ code, time: Number(r?.time) || 0 });
  }
  return out;
}
export function addFriend(social, { code, name, level }, now = Date.now()) {
  if (!validFriendCode(code) || code === social.code) return false;
  social.blocked = social.blocked.filter(c => c !== code);
  social.requests = (social.requests || []).filter(r => r.code !== code);
  social.sent = (social.sent || []).filter(r => r.code !== code);
  const found = social.friends.find(f => f.code === code);
  if (found) { found.name = cleanName(name); found.level = Math.max(1, Number(level) | 0); return true; }
  if (social.friends.length >= FRIEND_MAX) return false;
  social.friends.push({ code, name: cleanName(name), level: Math.max(1, Number(level) | 0), since: now });
  social.chats[code] ||= [];
  return true;
}
export function removeFriend(social, code, { block = false } = {}) {
  social.friends = social.friends.filter(f => f.code !== code);
  social.requests = (social.requests || []).filter(r => r.code !== code);
  social.sent = (social.sent || []).filter(r => r.code !== code);
  delete social.chats[code];
  if (block && !social.blocked.includes(code)) social.blocked.push(code);
}
export function pushChat(social, code, message) {
  const log = (social.chats[code] ||= []);
  log.push(message);
  if (log.length > CHAT_KEEP) log.splice(0, log.length - CHAT_KEEP);
  return log;
}
