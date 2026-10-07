// 친구에게 선물하기 (인혁이 기획서 「뿌요뿌요 (업그레이드)」 7번, "코인, 스킨, 터짐 효과를 선물할 수 있게").
// 온라인 계정 친구끼리만 한다. 서버를 바꾸지 않으려고 친구와의 1:1 대화에 정해진 모양의 글로 보낸다
// (뿌요 이모티콘의 [[st:번호]] 와 같은 방법). 받는 쪽 게임이 그 글을 선물로 바꿔서 기록에 넣는다.
// - 코인: 내 코인에서 그만큼 빠지고 친구가 받는다.
// - 스킨, 터짐 효과: 내 코인으로 사서 친구에게 준다 (내 것은 그대로). 교환권으로 받을 수 있는 판매 상품만.
//   친구가 이미 가진 것이면 친구는 그 값만큼 코인으로 받는다.
// - 서버가 메시지마다 붙이는 번호(id)로 같은 선물을 두 번 받지 않는다 (친구마다 마지막으로 받은 번호를 적어 둔다).
// - 선물 글은 선물하기 단추로만 보낸다 (직접 써서 보내는 글에서는 막는다). 게임을 고쳐 쓰는 사람은 코인을 내지 않고도
//   보낼 수 있어서, 하루에 선물로 받는 코인에 한도를 둔다.
import { findItem, grant } from './shop.mjs';
import { todayKey } from './calendar.mjs';

export const GIFT_COINS = [100, 500, 1000, 5000];
export const GIFT_DAILY_COINS = 30000; // 하루에 선물로 받을 수 있는 코인 (스킨 대신 받는 코인 포함)
const KINDS = { c: 'coins', s: 'skin', e: 'effect' };
const LETTER = { coins: 'c', skin: 's', effect: 'e' };
const BODY = /^\[\[gift:([cse]):([a-z0-9]{1,20})\]\]$/;

// 선물할 수 있는 상품: 코인으로 파는 것 가운데 고난이도 레벨 상품(noTicket)과 보스·랭킹 보상을 뺀 것
export const giftable = (kind, id) => {
  const item = (kind === 'skin' || kind === 'effect') ? findItem(kind, id) : null;
  return !!item && item.price > 0 && !item.noTicket;
};
export function validGift(gift) {
  if (gift?.kind === 'coins') return GIFT_COINS.includes(gift.amount);
  return giftable(gift?.kind, gift?.id);
}
export const giftCost = gift => (gift.kind === 'coins' ? gift.amount : findItem(gift.kind, gift.id).price);
export const giftBody = gift => `[[gift:${LETTER[gift.kind]}:${gift.kind === 'coins' ? gift.amount : gift.id}]]`;
// 선물 글이면 { kind: 'coins', amount } 또는 { kind: 'skin' | 'effect', id }, 아니면 null
export function parseGift(body) {
  const m = BODY.exec(String(body ?? '').trim());
  if (!m) return null;
  const kind = KINDS[m[1]];
  const gift = kind === 'coins' ? { kind, amount: /^\d{1,6}$/.test(m[2]) ? Number(m[2]) : 0 } : { kind, id: m[2] };
  return validGift(gift) ? gift : null;
}
// 직접 쓴 글에 선물 글 모양이 들어 있나 (보내기 전에 막는다)
export const looksLikeGift = text => /\[\[\s*gift\s*:/i.test(String(text ?? ''));

export function giftText(gift) {
  if (gift.kind === 'coins') return `코인 ${gift.amount.toLocaleString('ko-KR')}개`;
  const item = findItem(gift.kind, gift.id);
  return `${gift.kind === 'skin' ? '스킨' : '터짐 효과'} 「${item?.name ?? gift.id}」`;
}

// 보낼 수 있나: 'ok' | 'coins'(코인이 모자람) | 'none'(선물할 수 없는 것)
export function canSend(progress, gift) {
  if (!validGift(gift)) return 'none';
  return progress.coins >= giftCost(gift) ? 'ok' : 'coins';
}
// 보내기 전에 값을 치른다. 서버에 보내지 못했으면 refund 로 되돌린다.
export function paySend(progress, gift) {
  if (canSend(progress, gift) !== 'ok') return false;
  progress.coins -= giftCost(gift);
  progress.gifts.sent = (progress.gifts.sent || 0) + 1;
  return true;
}
export function refundSend(progress, gift) {
  progress.coins += giftCost(gift);
  progress.gifts.sent = Math.max(0, (progress.gifts.sent || 0) - 1);
}

// 받은 선물을 기록에 넣는다. from: 보낸 친구 번호, id: 서버가 붙인 메시지 번호.
// 돌려주는 값: null(이미 받았거나 잘못된 선물) 또는 { gift, coins: 받은 코인, item: 받은 상품, converted: 이미 가진 상품이라 코인으로, capped: 한도 때문에 덜 받음 }
export function receiveGift(progress, gift, { from, id, now = new Date() } = {}) {
  if (!validGift(gift) || !Number.isInteger(from) || from <= 0 || !Number.isInteger(id) || id <= 0) return null;
  const g = progress.gifts, key = String(from);
  if (id <= (g.seen[key] || 0)) return null;
  g.seen[key] = id;
  const day = todayKey(now);
  if (g.day !== day) { g.day = day; g.dayCoins = 0; }
  let coins = 0, item = null, converted = false;
  if (gift.kind === 'coins') coins = gift.amount;
  else if (progress.owned[gift.kind].includes(gift.id)) { coins = findItem(gift.kind, gift.id).price; converted = true; }
  else { grant(progress, gift.kind, gift.id); item = findItem(gift.kind, gift.id); }
  const room = Math.max(0, GIFT_DAILY_COINS - g.dayCoins), got = Math.min(coins, room);
  g.dayCoins += got;
  progress.coins += got;
  g.got = (g.got || 0) + 1;
  return { gift, coins: got, item, converted, capped: got < coins };
}
