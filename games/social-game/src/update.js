// "새 버전이 나왔어요" (인혁이 계획 6-3: an old open tab still showed the old emoji movie after the real
// 햄찌 영화 was published). The built game loads one hashed entry script (assets/index-XXXX.js). Every few
// minutes, and when the tab comes back into view, we fetch index.html again without the cache and compare
// its entry script with ours; when they differ a button asks to save and reload. The dev server has no
// hashed entry, so nothing happens there.

/** The hashed entry script named in an index.html text (or null). */
export function entryOf(html) {
  const m = /assets\/index-[A-Za-z0-9_-]+\.js/.exec(html ?? '');
  return m ? m[0] : null;
}

export function startUpdateCheck({ save, every = 3 * 60 * 1000 } = {}) {
  const mine = entryOf([...document.scripts].map((s) => s.getAttribute('src') ?? '').join(' '));
  if (!mine) return null; // dev server
  let shown = false, busy = false;
  const show = () => {
    if (shown) return;
    shown = true;
    const b = document.createElement('button');
    b.id = 'update-banner';
    b.textContent = '🔄 새 버전이 나왔어요! 눌러서 새로고침';
    b.onclick = () => { try { save?.(); } catch { /* saving is best effort */ } setTimeout(() => location.reload(), 150); };
    document.body.appendChild(b);
  };
  const check = async () => {
    if (shown || busy) return;
    busy = true;
    try {
      const r = await fetch(`./index.html?v=${Date.now()}`, { cache: 'no-store' });
      if (r.ok) {
        const now = entryOf(await r.text());
        if (now && now !== mine) show();
      }
    } catch { /* offline: try again later */ }
    busy = false;
  };
  const timer = setInterval(check, every);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  window.addEventListener('focus', check);
  return { check, stop: () => clearInterval(timer), mine };
}
