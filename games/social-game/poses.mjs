// 포즈 (인혁: "여러가지 포즈도 할 수 있게 해줘"): the list, and the small number friends receive.
// The character plays mode `pose:<id>` (src/props/character.js). Online the pose rides in the pose updates
// that go out anyway as a small number (online.mjs packPose), so no new message is sent.

/** loop: keeps moving (dance, clap...). low: the body is near the ground (the camera looks lower). */
export const POSES = [
  { id: 'wave', icon: '👋', name: '손 흔들기', loop: true },
  { id: 'vsign', icon: '✌️', name: '브이' },
  { id: 'heart', icon: '🫶', name: '하트' },
  { id: 'hooray', icon: '🙌', name: '만세' },
  { id: 'clap', icon: '👏', name: '박수', loop: true },
  { id: 'bow', icon: '🙇', name: '인사(꾸벅)', loop: true },
  { id: 'dance', icon: '💃', name: '춤추기', loop: true },
  { id: 'sit', icon: '🧘', name: '앉기', low: true },
  { id: 'lie', icon: '😴', name: '눕기', low: true },
  { id: 'jump', icon: '🤸', name: '점프', loop: true },
  { id: 'think', icon: '🤔', name: '생각하기' },
  { id: 'hero', icon: '🦸', name: '슈퍼히어로' },
  { id: 'salute', icon: '🫡', name: '경례' },
  { id: 'angry', icon: '😤', name: '화남', loop: true },
];

/** Pose id → its number (1, 2, ...), 0 for none or an unknown id. */
export function poseNum(id) { return POSES.findIndex((p) => p.id === id) + 1; }

/** Number → the pose, or null (0, unknown, not a whole number). */
export function poseAt(n) { return Number.isInteger(n) && n >= 1 && n <= POSES.length ? POSES[n - 1] : null; }

/** Pose id → the character's animation mode. */
export function poseMode(id) { return poseNum(id) ? `pose:${id}` : 'idle'; }

/** Number key in the open pose menu → pose id (1~9, then 0 for the 10th), or null. */
export function poseForKey(code) {
  const m = /^(?:Digit|Numpad)(\d)$/.exec(code ?? '');
  if (!m) return null;
  const n = m[1] === '0' ? 10 : Number(m[1]);
  return poseAt(n)?.id ?? null;
}
