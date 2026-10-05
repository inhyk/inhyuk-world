// 이 기기에만 있던 계정(profile.mjs)을 온라인 계정으로 옮긴다.
// 기기 계정에는 비밀번호 해시만 있으므로 화면에서 비밀번호를 다시 받아 checkLocalPassword 로 먼저 확인한다.
// 그다음 같은 닉네임으로 서버에 가입한다. 닉네임이 이미 있으면(409) 그게 내 온라인 계정일 때 로그인하거나 새 닉네임을 고른다.
// 서버 가입(또는 로그인)과 첫 저장 올리기가 모두 끝날 때까지 기기 계정은 건드리지 않는다.
// 첫 저장은 기기 계정마다 정해진 importId 로 올라가서, 다시 시도해도 두 번 쓰지 않는다.
import { hashPassword } from './profile.mjs';

export const MIGRATING_KEY = 'jelly-migrating';
export const importIdFor = local => `jelly-${String(local.id).replace(/[^A-Za-z0-9_-]/g, '')}`.slice(0, 64);

export async function checkLocalPassword(local, password) {
  return !!local && (await hashPassword(String(password ?? ''), local.salt)) === local.hash;
}

const sameName = (a, b) => !!a && !!b && String(a).toLowerCase() === String(b).toLowerCase();

// 기기 비밀번호를 확인한 뒤에 부른다.
//   mode 'signup': nickname + password 로 가입, 'login': 이미 있는 온라인 계정으로 로그인
//   account: @inhyuk/net Account (signup, login, loggedIn, user)
//   upload(progress, importId): 첫 저장 (실패하면 던진다)
//   marker: 가입은 됐는데 첫 저장 전에 앱이 꺼져도 다음에 이어 올릴 수 있게 적어 두는 곳 (migrationMarker)
// 결과: { ok: true, user } 또는 { ok: false, step: 'auth'|'upload', code, message }
//   code: 'nickname-taken', 'bad-nickname', 'bad-nickname-word', 'bad-password', 'wrong-login', 'rate', 'network' ... (서버 오류 코드 그대로)
export async function migrateLocal({ local, nickname = local.name, password, mode = 'signup', account, upload, marker }) {
  // 같은 닉네임으로 이미 로그인돼 있으면 (앞에서 가입은 됐는데 올리기만 실패한 경우) 가입을 건너뛴다.
  const already = account.loggedIn && sameName(account.user?.nickname, nickname);
  if (!already) {
    try {
      if (mode === 'login') await account.login(nickname, password);
      else await account.signup(nickname, password);
    } catch (error) {
      return { ok: false, step: 'auth', code: error.code ?? 'network', message: error.message };
    }
  }
  marker?.set({ localId: local.id, nickname: account.user?.nickname ?? nickname });
  try {
    await upload(local.progress, importIdFor(local));
  } catch (error) {
    return { ok: false, step: 'upload', code: error.code ?? 'network', message: '기록을 올리지 못했어. 인터넷을 확인하고 다시 해 줘.' };
  }
  marker?.clear();
  return { ok: true, user: account.user };
}

// 옮긴 뒤 기기 계정은 지우지 않고 표시만 한다(이 기기 계정 목록에서 숨김).
export function markMigrated(store, localId, nickname) {
  const a = store.accounts.find(x => x.id === localId);
  if (a) a.migratedTo = nickname;
  if (store.current === localId) store.current = null;
}

export function migrationMarker(storage) {
  return {
    get() { try { return JSON.parse(storage?.getItem(MIGRATING_KEY) || 'null'); } catch { return null; } },
    set(v) { try { storage?.setItem(MIGRATING_KEY, JSON.stringify(v)); } catch { /* 저장 안 됨 */ } },
    clear() { try { storage?.removeItem(MIGRATING_KEY); } catch { /* 저장 안 됨 */ } },
  };
}
