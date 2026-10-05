// 채팅 글 거르개. 욕설, 전화번호, 링크(주소, 이메일), 메신저 아이디를 '*' 로 가린다.
// 서버가 대전 채팅(data.chat)과 1:1 대화를 남에게 보내기 전에 꼭 이걸 거친다.
import { BAD_WORDS, ALLOWED } from './badwords.js';

export const CHAT_MAX = 200;
export const DM_MAX = 300;

// 눈에 안 보이는 글자로 욕을 쪼개는 것을 막으려고 먼저 지운다.
const INVISIBLE = /[\u0000-\u0008\u000b-\u001f\u007f­ᅟᅠ᠎​-‏‪-‮⁠-⁤ㅤ﻿ﾠ]/g;
const INVISIBLE_ONE = new RegExp(INVISIBLE.source);
const LETTER = /\p{L}/u;
const SPACE = /\s/;
const HANGUL = /[\u3131-\u318e\uac00-\ud7a3]/;
const KOREAN_DIGITS = { 공: 1, 영: 1, 일: 1, 이: 1, 삼: 1, 사: 1, 오: 1, 육: 1, 륙: 1, 칠: 1, 팔: 1, 구: 1 };
// "공일공에 일이삼사에" 처럼 숫자 사이에 '에' 를 끼워도 이어진 번호로 본다.
const PHONE_SEPARATOR = /[\s\-.·_/()~ㅡ—,+에]/;
// 숫자 옆에 붙은 O, I, l 은 숫자로 본다 ("O1O-I234-5678").
const DIGIT_LOOKALIKE = { O: '0', o: '0', I: '1', l: '1', '|': '1' };
// NFKC 뒤에도 남는 마침표 모양 (。 ｡ ︒ ﹒)
const DOT_LIKE = /[\u3002\uff61\ufe12\ufe52]/g;

const TLD = '(?:com|net|org|kr|co|io|me|gg|ly|xyz|app|dev|tv|be|link|site|online|shop|info|biz|to|im|us|so|ai|jp|cn|cc|ws|fm|page|club|live|store)';
const DOT = '(?:\\s*(?:\\.|닷|dot|\\(dot\\)|\\[dot\\])\\s*)';
const PATTERNS = [
  ['link', /(?:https?:\/\/|www\.)[^\s]+/giu],
  ['link', new RegExp(`[a-z0-9._%+-]+\\s*(?:@|골뱅이|\\(at\\)|\\[at\\])\\s*[a-z0-9-]+(?:${DOT}[a-z0-9-]+)*`, 'giu')],
  ['link', new RegExp(`(?<![a-z0-9])[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:${DOT}[a-z0-9-]+)*${DOT}${TLD}(?![a-z0-9])(?:/[^\\s]*)?`, 'giu')],
  ['link', /[a-z0-9-]{2,}\s*(?:닷컴|닷넷|닷케이알|점컴|쩜컴)/giu],
  ['contact', /(?<![a-z0-9_])@[a-z0-9_.]{3,}/giu],
  ['contact', /[a-z0-9_.]{2,}#\d{4}(?!\d)/giu],
  ['contact', /(?:카톡|카카오톡?|카카오|kakao(?:talk)?|katalk|k-?talk|디코|디스코드|discord|인스타(?:그램)?|insta(?:gram)?|라인|텔레(?:그램)?|telegram|오픈\s*(?:채팅|톡|카톡)|오카|페북|페이스북|facebook|스냅챗|snapchat|틱톡|tiktok|트위터|twitter|아이디|아디|(?<![a-z])id|계정|친추)\s*(?:아이디|아디|id|계정|주소|친추|닉네임|닉|nick(?:name)?)?(?:\s*[:：=]\s*|\s*(?:은|는|이|가|로|으로)?\s+|\s*(?:은|는|이|가|로|으로)\s*)([a-z0-9_.-]{3,})/giu],
  // 한글 메신저 이름 바로 뒤에 붙여 쓴 아이디 ("카톡아이디abc123"). 영어 낱말(id, idea)은 붙여 써도 아이디로 보지 않는다.
  ['contact', /(?:카톡|카카오톡?|카카오|디코|디스코드|인스타(?:그램)?|라인|텔레(?:그램)?|오카|페북|페이스북|스냅챗|틱톡|트위터|아이디|아디|계정|친추)(?:아이디|아디|닉네임|닉|계정|주소)?[a-z0-9_.-]{3,}/giu],
];

function toSkeleton(text) {
  // 글자만 남긴다(띄어쓰기, 숫자, 기호는 건너뜀). 각 글자가 원래 어디에 있었는지와 몇 번째 낱말인지 기억한다.
  const letters = [];
  let seg = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (SPACE.test(ch)) { seg++; continue; }
    if (!LETTER.test(ch)) continue;
    // 한글 자모(ㅅ, ㅂ)는 NFKC 가 다른 글자로 바꿔 버리므로 그대로 둔다. 전각 영어(ｆｕｃｋ)만 펴 준다.
    const plain = HANGUL.test(ch) ? ch : ch.normalize('NFKC').toLowerCase();
    for (const c of plain) letters.push({ c, at: i, seg });
  }
  return { letters, text: letters.map(l => l.c).join('') };
}

function occurrences(haystack, needle) {
  const found = [];
  for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, at + 1)) found.push(at);
  return found;
}

function profanityRanges(text) {
  const { letters, text: skeleton } = toSkeleton(text);
  const safe = [];
  for (const word of ALLOWED) for (const at of occurrences(skeleton, word)) safe.push([at, at + word.length]);
  const ranges = [];
  for (const word of BAD_WORDS) {
    for (const a of occurrences(skeleton, word)) {
      const b = a + word.length;
      if (safe.some(([s, e]) => s <= a && b <= e)) continue;
      const first = letters[a].seg, last = letters[b - 1].seg;
      // "다시 발로" 처럼 두 낱말에 걸친 것은 낱말 조각이 통째로 욕 안에 들어갈 때만 욕으로 본다 ("시 발" 은 걸림).
      if (first !== last && ((a > 0 && letters[a - 1].seg === first) || (b < letters.length && letters[b].seg === last))) continue;
      ranges.push([letters[a].at, letters[b - 1].at + 1]);
    }
  }
  return ranges;
}

// 숫자 8개 이상이면 전화번호로 본다. 7개는 "123-4567" 처럼 나뉘어 있을 때만. min 을 주면 그 개수 이상만.
function phoneRanges(text, min = 0) {
  const ranges = [];
  const isDigit = ch => /[0-9]/.test(ch) || KOREAN_DIGITS[ch];
  let i = 0;
  while (i < text.length) {
    if (!isDigit(text[i]) && !(text[i] === '+' && isDigit(text[i + 1] ?? ''))) { i++; continue; }
    const start = i;
    let digits = 0, last = i, gap = 0, groups = 1;
    for (; i < text.length; i++) {
      const ch = text[i];
      if (isDigit(ch)) { if (gap && digits) groups++; digits++; last = i; gap = 0; continue; }
      if (PHONE_SEPARATOR.test(ch) && gap < 3) { gap++; continue; }
      break;
    }
    if (min ? digits >= min : digits >= 8 || (digits === 7 && groups >= 2)) ranges.push([start, last + 1]);
    i = last + 1;
  }
  return ranges;
}

// 찾기용 사본: 글자마다 NFKC 로 펴고(전각 ｅｘａｍｐｌｅ．ｃｏｍ, ｈｔｔｐｓ), 마침표 모양은 '.' 로, 안 보이는 글자는 뺀다.
// map[k] 는 사본의 k 번째 글자가 원래 글의 몇 번째 글자였는지. 찾은 자리를 원래 글에서 가리는 데 쓴다.
function detectionCopy(text) {
  let out = '';
  const map = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (INVISIBLE_ONE.test(ch)) continue;
    const plain = (HANGUL.test(ch) ? ch : ch.normalize('NFKC')).replace(DOT_LIKE, '.');
    for (let k = 0; k < plain.length; k++) { out += plain[k]; map.push(i); }
  }
  return { text: out, map };
}

// 전화번호 찾기용: 숫자 바로 옆의 O, I, l 을 숫자로 바꾼다 (길이는 그대로).
function phoneCopy(text) {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const swap = DIGIT_LOOKALIKE[text[i]];
    out += swap && (/[0-9]/.test(text[i - 1] ?? '') || /[0-9]/.test(text[i + 1] ?? '')) ? swap : text[i];
  }
  return out;
}

// 링크 찾기용: 한 글자씩 띄어 쓴 것("n a v e r . c o m")을 붙인다. 띄어쓰기 앞뒤가 영어, 숫자, '.' 이고
// 앞이나 뒤 낱말이 한 글자일 때만 지운다.
function collapseSpaced({ text, map }) {
  let out = '';
  const outMap = [];
  const wordLength = (from, step) => { let n = 0; for (let k = from; k >= 0 && k < text.length && !SPACE.test(text[k]); k += step) n++; return n; };
  for (let i = 0; i < text.length; i++) {
    if (SPACE.test(text[i])) {
      let end = i;
      while (end < text.length && SPACE.test(text[end])) end++;
      const ascii = ch => /[a-z0-9./:]/i.test(ch ?? '');
      if (i > 0 && end < text.length && ascii(text[i - 1]) && ascii(text[end]) && (wordLength(i - 1, -1) === 1 || wordLength(end, 1) === 1)) { i = end - 1; continue; }
    }
    out += text[i];
    outMap.push(map[i]);
  }
  return { text: out, map: outMap };
}

const back = (map, a, b) => [map[a], map[b - 1] + 1];

// 가릴 자리(원래 글 기준)와 종류
function detect(text) {
  const kinds = new Set(), ranges = [];
  const add = (kind, list) => { if (list.length) { kinds.add(kind); ranges.push(...list); } };
  add('profanity', profanityRanges(text));
  const copy = detectionCopy(text);
  add('phone', phoneRanges(phoneCopy(copy.text)).map(([a, b]) => back(copy.map, a, b)));
  const spaced = collapseSpaced(copy);
  for (const [kind, re] of PATTERNS) {
    const list = [];
    for (const m of copy.text.matchAll(re)) list.push(back(copy.map, m.index, m.index + m[0].length));
    if (kind === 'link') for (const m of spaced.text.matchAll(re)) list.push(back(spaced.map, m.index, m.index + m[0].length));
    add(kind, list);
  }
  return { ranges, kinds: [...kinds] };
}

function mask(text, ranges) {
  if (!ranges.length) return text;
  const hide = new Uint8Array(text.length);
  for (const [a, b] of ranges) hide.fill(1, a, b);
  let out = '';
  for (let i = 0; i < text.length; i++) out += hide[i] && !SPACE.test(text[i]) ? '*' : text[i];
  return out;
}

// 글을 거른다. { text: 가린 글, kinds: ['profanity'|'phone'|'link'|'contact', ...] }
export function filterText(input, { max = CHAT_MAX } = {}) {
  let text = String(input ?? '').normalize('NFC').replace(INVISIBLE, '').replace(/\s*[\r\n\t]+\s*/g, ' ').trim();
  if ([...text].length > max) text = [...text].slice(0, max).join('');
  const { ranges, kinds } = detect(text);
  return { text: mask(text, ranges), kinds };
}

// 게임 데이터 속 글자열용: 띄어쓰기, 길이, 안 보이는 글자는 그대로 두고 가릴 것만 '*' 로 바꾼다.
export function maskText(input) {
  let text = String(input ?? '');
  if (text.length < 2) return text;
  const nfc = text.normalize('NFC');
  if (nfc !== text) text = nfc;
  const { ranges } = detect(text);
  return mask(text, ranges);
}

// 한 사람이 전화번호를 여러 줄로 나눠 보내는 것("010" / "1234" / "5678")을 막는다.
// previous: 그 사람이 방금(30초 안에) 보낸 줄들. 앞줄에서 시작해 이번 줄까지 이어지는 숫자가 9개 이상이면
// 이번 줄에 들어 있는 부분만 가린다. 이미 보낸 줄은 고치지 않는다.
export function maskSplitPhone(previous, current) {
  if (!previous.length || !current) return current;
  const joined = [...previous, current].join(' ');
  const offset = joined.length - current.length;
  const copy = detectionCopy(joined);
  const ranges = phoneRanges(phoneCopy(copy.text), 9)
    .map(([a, b]) => back(copy.map, a, b))
    .filter(([a, b]) => a < offset && b > offset)
    .map(([, b]) => [0, b - offset]);
  return mask(current, ranges);
}

export function hasProfanity(text) {
  return profanityRanges(String(text ?? '').normalize('NFC').replace(INVISIBLE, '')).length > 0;
}
