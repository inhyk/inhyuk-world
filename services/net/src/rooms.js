// 방 코드와 방 만들기 (Worker, Lobby, Matchmaker 가 같이 쓴다)
export const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;
export const GAME_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;
export const CODE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4,8}$/;
export const DEFAULT_PLAYERS = 2;
export const MAX_PLAYERS = 8;
export const MAX_MESSAGE_BYTES = 16 * 1024;
export const PING = '{"t":"ping"}';
export const PONG = '{"t":"pong"}';
export const CHAT_LINES = 50; // 방마다 기억하는 거른 채팅 줄 수

export function clampPlayers(value) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_PLAYERS;
  return Math.min(MAX_PLAYERS, Math.max(2, n));
}

export function randomCode() {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return [...bytes].map(n => ALPHABET[n % ALPHABET.length]).join('');
}

export const roomStub = (env, game, code) => env.ROOMS.get(env.ROOMS.idFromName(`${game}:${code}`));

// 비어 있는 새 방 코드를 잡는다. members(사용자 번호 목록)를 주면 그 사람들만 들어올 수 있는 방이 된다.
export async function createRoom(env, game, { maxPlayers = DEFAULT_PLAYERS, members = null } = {}) {
  for (let tries = 0; tries < 5; tries++) {
    const code = randomCode();
    if (await roomStub(env, game, code).reserve(maxPlayers, members, `${game}:${code}`)) return code;
  }
  return '';
}
