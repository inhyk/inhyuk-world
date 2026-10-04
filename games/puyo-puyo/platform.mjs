// 웹사이트와 아이폰 앱(apps/jelly-tower, Capacitor)에서 다르게 해야 하는 것만 모은다.
// 앱 안에서는 Capacitor가 window.Capacitor를 넣어 주고, nativePromise로 진동·저장·시작 화면을 부른다.
// 웹에서는 모두 조용히 아무 일도 하지 않으므로 사이트 빌드에는 Capacitor 패키지가 필요 없다.

const cap = globalThis.Capacitor;
export const isApp = !!cap?.isNativePlatform?.();

function native(plugin, method, options = {}, wait = 1500) {
  if (!isApp || typeof cap.nativePromise !== 'function') return Promise.resolve(null);
  // 플러그인이 답하지 않아도 게임이 멈추지 않게 기다리는 시간을 정해 둔다
  const timeout = new Promise(resolve => setTimeout(() => resolve(null), wait));
  let call;
  try { call = cap.nativePromise(plugin, method, options).catch(() => null); } catch { call = Promise.resolve(null); }
  return Promise.race([call, timeout]);
}

// ---------- 진동 ----------
// kind: 'light' | 'medium' | 'heavy' (톡) 또는 'success' | 'warning' | 'error' (알림)
let lastBuzz = 0;
export function buzz(kind = 'light') {
  if (!isApp) return;
  const now = performance.now();
  if (now - lastBuzz < 45) return; // 연쇄가 겹쳐도 손이 간지럽지 않게
  lastBuzz = now;
  if (kind === 'success' || kind === 'warning' || kind === 'error') native('Haptics', 'notification', { type: kind.toUpperCase() });
  else native('Haptics', 'impact', { style: kind.toUpperCase() });
}

// ---------- 저장 ----------
// 게임은 그대로 localStorage에 저장한다. 앱에서는 기기 저장소(Preferences)에도 똑같이 적어 두고,
// 앱을 켰을 때 localStorage가 비어 있으면(아이폰이 웹 저장소를 비운 경우) 거기서 되살린다.
export async function restoreSaves(storage, keys) {
  if (!isApp || !storage) return;
  for (const key of keys) {
    try {
      if (storage.getItem(key) != null) continue;
      const saved = await native('Preferences', 'get', { key });
      if (typeof saved?.value === 'string' && saved.value) storage.setItem(key, saved.value);
    } catch { /* 되살리지 못하면 새로 시작한다 */ }
  }
}
export function mirrorSave(key, value) {
  if (isApp && typeof value === 'string') native('Preferences', 'set', { key, value });
}

// ---------- 시작 화면 ----------
// 앱은 첫 화면이 다 그려질 때까지 시작 그림을 띄워 두고, 준비되면 부드럽게 걷는다.
export function hideSplash() {
  if (isApp) native('SplashScreen', 'hide', { fadeOutDuration: 250 });
}
