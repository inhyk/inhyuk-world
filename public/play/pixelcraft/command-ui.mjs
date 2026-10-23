import { runCommand } from './commands.mjs';
export function createCommandConsole(api) {
  const $ = id => document.getElementById(id), dialog = $('commandDialog'), input = $('commandInput'), log = $('commandLog');
  let history = [], cursor = 0, draft = '';
  const isOpen = () => !dialog.hidden;
  function print(text, error = false) {
    const line = document.createElement('p'); line.textContent = text; line.classList.toggle('command-error', error); log.append(line);
    while (log.children.length > 40) log.firstChild.remove();
    log.scrollTop = log.scrollHeight;
  }
  function close() {
    if (!isOpen()) return;
    dialog.hidden = true; input.blur();
    const G = api.get(); if (G) G.paused = false;
    api.clearInput(); document.getElementById('game').focus({ preventScroll: true });
  }
  function open() {
    const G = api.get(); if (!G || G.remoteReplica || G.dead || G.paused || isOpen()) return;
    api.closePanel(); api.clearInput();
    G.paused = true; dialog.hidden = false; input.value = '/'; cursor = history.length; draft = '/'; input.focus();
    if (!log.children.length) print('명령어를 입력하고 실행! /help로 목록 보기. ↑↓로 이전 명령어. Esc로 닫기.');
  }
  $('commandForm').onsubmit = e => {
    e.preventDefault(); const G = api.get(), text = input.value.trim();
    if (!text || text === '/') return;
    print(`> ${text}`); const result = runCommand(G, text);
    if (result.changed) { if (G.jump) G.jump.assisted = true; api.changed(); api.save(); }
    print(result.text, !result.ok);
    if (history.at(-1) !== text) history.push(text);
    history = history.slice(-30); cursor = history.length; input.value = '/'; draft = '/'; input.focus();
  };
  dialog.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.isComposing) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    if (e.target === input && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault(); if (cursor === history.length) draft = input.value;
      cursor = Math.max(0, Math.min(history.length, cursor + (e.key === 'ArrowUp' ? -1 : 1)));
      input.value = history[cursor] ?? draft; input.setSelectionRange(input.value.length, input.value.length);
    }
    if (e.key === 'Tab') {
      const controls = [...dialog.querySelectorAll('input, button')].filter(el => !el.disabled && el.getClientRects().length);
      if (e.shiftKey && document.activeElement === controls[0]) { e.preventDefault(); controls.at(-1).focus(); }
      else if (!e.shiftKey && document.activeElement === controls.at(-1)) { e.preventDefault(); controls[0].focus(); }
    }
  });
  for (const button of dialog.querySelectorAll('[data-command]')) button.onclick = () => { input.value = button.dataset.command; input.focus(); };
  $('commandClose').onclick = close; $('commandButton').onclick = open;
  return { open, close, isOpen, reset() { close(); log.replaceChildren(); history = []; cursor = 0; } };
}
