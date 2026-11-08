// 새 버전이 나오면 새로고침 버튼. 열어 둔 창은 예전 게임을 계속 쓰기 때문에 (예: 친구 창이 예전 버전이면
// 돈 주기를 받지 못한다), 몇 분마다와 창으로 돌아올 때 index.html 을 캐시 없이 다시 받아 들어 있는 게임 파일
// 이름(assets/index-해시.js)이 내 것과 다르면 버튼을 띄운다. 개발 서버에는 해시 파일이 없어서 아무 일도 없다.
// 사회적 게임 games/social-game/src/update.js 와 같은 방법.

export function entryOf(html) {
  const m = /assets\/index-[A-Za-z0-9_-]+\.js/.exec(html ?? '');
  return m ? m[0] : null;
}

export function startUpdateCheck({ save, every = 3 * 60 * 1000 } = {}) {
  const mine = entryOf([...document.scripts].map(s => s.getAttribute('src') ?? '').join(' '));
  if (!mine) return null;
  let shown = false, busy = false;
  const show = () => {
    if (shown) return;
    shown = true;
    const b = document.createElement('button');
    b.id = 'update-banner';
    b.textContent = '🔄 새 버전이 나왔어! 눌러서 새로고침';
    b.onclick = () => { try { save?.(); } catch { /* 저장은 할 수 있는 만큼 */ } setTimeout(() => location.reload(), 150); };
    document.body.appendChild(b);
  };
  const check = async () => {
    if (shown || busy) return;
    busy = true;
    try {
      const r = await fetch(`./index.html?v=${Date.now()}`, { cache: 'no-store' });
      if (r.ok) { const now = entryOf(await r.text()); if (now && now !== mine) show(); }
    } catch { /* 인터넷이 안 되면 나중에 */ }
    busy = false;
  };
  const timer = setInterval(check, every);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  addEventListener('focus', check);
  return { check, stop: () => clearInterval(timer), mine };
}
