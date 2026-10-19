// Shared game accounts use @inhyuk/net. Worlds stay in this browser, separated by account ID.
import { Account, DEFAULT_SERVER } from './net-client/index.mjs';
export const account = { user: null };
export const saveKey = slot => account.user ? `pixelcraft.account.${account.user.id}.slot${slot}` : `pixelcraft.v1.slot${slot}`;

export async function initAccount(refresh) {
  const $ = id => document.getElementById(id);
  const form = $('accountForm');
  let mode = 'login';
  const query = new URLSearchParams(location.search).get('net');
  const server = query && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?\/?$/.test(query) ? query.replace(/\/+$/, '') : DEFAULT_SERVER;
  const suffix = server === DEFAULT_SERVER ? '' : `@${server}`;
  const storage = {
    getItem: key => { try { return localStorage.getItem(key + suffix); } catch { return null; } },
    setItem: (key, value) => { try { localStorage.setItem(key + suffix, value); } catch {} },
    removeItem: key => { try { localStorage.removeItem(key + suffix); } catch {} },
  };
  const client = new Account({ server, storage, fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(8000) }) });
  const publicUser = user => user ? { id: user.id, name: user.nickname } : null;
  async function request(body) {
    if (!body) {
      const user = client.loggedIn ? await client.me() : null;
      return { user: publicUser(user) };
    }
    if (body.action === 'logout') { await client.logout(); return { user: null }; }
    const user = body.action === 'register' ? await client.signup(body.name, body.password) : await client.login(body.name, body.password);
    return { user: publicUser(user) };
  }
  function update() {
    $('accountName').textContent = account.user ? `${account.user.name} 님` : '손님으로 플레이 중';
    $('accountNote').textContent = `세계는 이 브라우저에 ${account.user ? '계정별로 ' : ''}저장돼요.`;
    $('btnAccount').hidden = !!account.user;
    $('btnLogout').hidden = !account.user;
    $('btnAccount').disabled = false;
  }
  function setMode(next) {
    mode = next;
    $('accountHeading').textContent = mode === 'register' ? '계정 만들기' : '로그인';
    $('accountSubmit').textContent = mode === 'register' ? '가입하고 시작' : '로그인';
    $('accountSwitch').textContent = mode === 'register' ? '이미 계정이 있어요' : '처음 왔어요 · 계정 만들기';
    $('accountPassword').autocomplete = mode === 'register' ? 'new-password' : 'current-password';
    $('accountConfirmRow').hidden = mode !== 'register';
    $('accountConfirm').required = mode === 'register';
    $('accountError').textContent = '';
  }
  function close() { $('accountDialog').hidden = true; form.reset(); $('btnAccount').focus(); }
  $('btnAccount').onclick = () => { setMode('login'); $('accountDialog').hidden = false; $('accountUsername').focus(); };
  $('accountCancel').onclick = close;
  $('accountSwitch').onclick = () => setMode(mode === 'login' ? 'register' : 'login');
  $('accountDialog').addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Escape' && !$('accountSubmit').disabled) close();
    if (e.key === 'Tab') {
      const focusable = [...form.querySelectorAll('input, button')].filter(el => !el.disabled && el.getClientRects().length);
      const first = focusable[0], last = focusable.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  form.onsubmit = async e => {
    e.preventDefault();
    if (mode === 'register' && $('accountPassword').value !== $('accountConfirm').value) { $('accountError').textContent = '두 비밀번호가 서로 달라요.'; return; }
    const controls = [...form.querySelectorAll('button, input')];
    controls.forEach(el => { el.disabled = true; });
    $('accountError').textContent = '연결하고 있어요…';
    try {
      const result = await request({ action: mode, name: $('accountUsername').value, password: $('accountPassword').value });
      account.user = result.user; update(); refresh(); close();
    } catch (error) { $('accountError').textContent = error.message; }
    finally { controls.forEach(el => { el.disabled = false; }); }
  };
  $('btnLogout').onclick = async () => {
    $('btnLogout').disabled = true;
    try { await request({ action: 'logout' }); account.user = null; update(); refresh(); }
    catch (error) { account.user = null; update(); refresh(); $('accountNote').textContent = error.message; }
    finally { $('btnLogout').disabled = false; }
  };
  // Avoid choosing a guest slot while a previous session is being restored.
  $('slots').inert = true;
  try {
    const result = await request();
    account.user = result.user;
    update(); refresh();
  } catch (error) {
    account.user = null;
    update();
    $('accountNote').textContent = error.message + ' 손님으로도 플레이할 수 있어요.';
  } finally { $('slots').inert = false; }
}
