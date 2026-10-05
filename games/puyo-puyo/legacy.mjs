// 예전 친구(친구 코드) 기록. 이 기기 계정의 progress.social 에 있다 (chat.mjs).
// 온라인 계정으로 옮기면 친구 코드 친구는 서버 계정과 이어지지 않는다 (닉네임으로 다시 친구 신청해야 한다).
// 그래서 옮기기 전에 친구 우체통에 남은 편지를 한 번 받아서 기록에 넣어 두고(drainMailbox),
// 온라인 계정에서는 "기존 친구(친구 코드)" 화면에서 그 기록을 볼 수 있게 한다 (기기에만 있다).
import { validFriendCode, validMailKey, validSticker, cleanChat, cleanName, addFriend, pushChat, REQUEST_MAX } from './chat.mjs';

// 우체통 편지 하나를 기록에 넣는다 (화면, 소리, 답장 없이). 넣었으면 true
export function storeLetter(social, l) {
  const code = l?.from;
  if (!validFriendCode(code) || code === social.code || social.blocked.includes(code)) return false;
  const friend = social.friends.some(f => f.code === code);
  const time = Number(l.t) || 0, info = { code, name: l.name, level: l.level };
  if (l.kind === 'msg' || l.kind === 'st') {
    if (!friend) return false;
    const text = l.kind === 'msg' ? cleanChat(l.text) : '';
    const entry = l.kind === 'st' ? (validSticker(Number(l.sticker)) ? { me: false, sticker: Number(l.sticker), time } : null) : text ? { me: false, text, time } : null;
    if (!entry) return false;
    pushChat(social, code, entry);
    return true;
  }
  if (l.kind === 'fr') {
    if (friend) return false;
    if (social.sent.some(r => r.code === code)) return addFriend(social, info, time); // 서로 신청했으면 친구
    if (social.requests.some(r => r.code === code) || social.requests.length >= REQUEST_MAX) return false;
    social.requests.push({ code, name: cleanName(l.name), level: Math.max(1, Number(l.level) | 0), time });
    return true;
  }
  if (l.kind === 'fa') return (friend || social.sent.some(r => r.code === code)) && addFriend(social, info, time);
  if (l.kind === 'fx') {
    const before = social.sent.length;
    social.sent = social.sent.filter(r => r.code !== code);
    return social.sent.length !== before;
  }
  return false;
}

// 우체통을 비울 때까지 받아서 기록에 넣는다. 받은 편지는 다음 요청의 ack 로 우체통에서 지운다.
// mail: mailbox.mjs createMailClient(). 결과 { ok, count, error }
export async function drainMailbox(social, mail, { rounds = 6 } = {}) {
  if (!social || !validFriendCode(social.code) || !validMailKey(social.key)) return { ok: true, count: 0 };
  let count = 0, acked = 0;
  for (let i = 0; i < rounds; i++) {
    const ack = social.lastMail > acked ? social.lastMail : 0;
    const r = await mail.inbox(social.code, social.key, ack);
    if (!r?.ok) return { ok: false, count, error: r?.error || 'network' };
    if (ack) acked = ack;
    const letters = (r.letters || []).filter(l => l && Number(l.t) > social.lastMail).sort((a, b) => a.t - b.t);
    if (!letters.length) {
      if (social.lastMail > acked) continue; // 마지막으로 받은 것까지 지우라고 한 번 더 알린다
      return { ok: true, count };
    }
    for (const l of letters) if (storeLetter(social, l)) count++;
    social.lastMail = Math.max(social.lastMail, ...letters.map(l => Number(l.t)));
  }
  return { ok: true, count };
}

// 예전 친구 기록이 있는지 (보여 줄 것이 있는지)
export const hasLegacy = social => !!social && (social.friends.length > 0 || social.requests.length > 0 || social.sent.length > 0 || Object.values(social.chats).some(c => c.length));
