// 가방·제작대·화로·상자 화면과 아래쪽 손 줄(핫바), 체력·배고픔 표시
import { ITEMS, RECIPES, SMELT, SMELT_TIME, FUEL, maxStack, durabilityOf, I } from './data.mjs';
import { addItem, matchRecipe, canCraft, craftFromSlots, recipeNeeds, countItem } from './core.mjs';
import { iconUrl } from './textures.mjs';
import { sfx } from './audio.mjs';

export const UI = { open: null, ref: -1, cursor: null, grid: Array(9).fill(null), tab: 0, lastRender: 0 };
let G = null;
let api = null;
const $ = (id) => document.getElementById(id);

export function newStack(id, count = 1) {
  const s = { id, count };
  const d = durabilityOf(id);
  if (d) s.dur = d;
  return s;
}
const clone = (s, count = s.count) => {
  const c = { id: s.id, count };
  if (s.dur !== undefined) c.dur = s.dur;
  return c;
};

// ---- 작은 그림 (하트, 고기, 공기 방울) ----
const hudIcons = {};
function pix(rows, colors) {
  const c = document.createElement('canvas');
  c.width = rows[0].length;
  c.height = rows.length;
  const g = c.getContext('2d');
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (!colors[ch]) return;
    g.fillStyle = colors[ch];
    g.fillRect(x, y, 1, 1);
  }));
  return c.toDataURL();
}
function buildHudIcons() {
  const heart = ['.kk.kk.', 'kRRkRRk', 'kRwRRRk', 'kRRRRRk', '.kRRRk.', '..kRk..', '...k...'];
  const heartHalf = ['.kk.kk.', 'kRRkeek', 'kRweeek', 'kRReeek', '.kReek.', '..kek..', '...k...'];
  const food = ['....kk.', '...kbbk', '..kbbk.', '.kMMk..', 'kMLMk..', 'kMMMk..', '.kkk...'];
  const foodHalf = ['....kk.', '...kbbk', '..kbbk.', '.keek..', 'kMeek..', 'kMeek..', '.kkk...'];
  const bubble = ['.kkk.', 'kwBBk', 'kBBBk', 'kBBBk', '.kkk.'];
  hudIcons.heart = pix(heart, { k: '#1a0000', R: '#e81818', w: '#ffb0b0' });
  hudIcons.heartHalf = pix(heartHalf, { k: '#1a0000', R: '#e81818', w: '#ffb0b0', e: '#3a1414' });
  hudIcons.heartEmpty = pix(heart, { k: '#1a0000', R: '#3a1414', w: '#3a1414' });
  hudIcons.food = pix(food, { k: '#2a1408', b: '#f0ece0', M: '#b8642a', L: '#e09050' });
  hudIcons.foodHalf = pix(foodHalf, { k: '#2a1408', b: '#f0ece0', M: '#b8642a', e: '#3a2414' });
  hudIcons.foodEmpty = pix(food, { k: '#2a1408', b: '#5a4a3a', M: '#3a2414', L: '#3a2414' });
  hudIcons.bubble = pix(bubble, { k: '#1a3a8a', w: '#ffffff', B: '#7ab8ff' });
}

export function initUI(game, hooks) {
  G = game;
  api = hooks;
  buildHudIcons();
  const panel = $('panel');
  // 눌러서 집고 다른 칸을 눌러 놓아도 되고, 꾹 누른 채 끌어다 놓아도 된다
  let drag = null;
  panel.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('[data-s]');
    if (el) {
      e.preventDefault();
      const carrying = !!UI.cursor;
      clickSlot(el.dataset.s, e.button === 2 ? 2 : 0, e.shiftKey);
      drag = !carrying && UI.cursor && !e.shiftKey ? { from: el.dataset.s, x: e.clientX, y: e.clientY } : null;
      sfx.click();
      renderPanel();
      return;
    }
    const tab = e.target.closest('[data-tab]');
    if (tab) {
      UI.tab = Number(tab.dataset.tab);
      renderPanel();
      return;
    }
    if (e.target.closest('[data-close]')) closePanel();
  });
  document.addEventListener('pointerup', (e) => {
    const d = drag;
    drag = null;
    if (!d || !UI.open || !UI.cursor) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8) return;
    // 터치는 누른 칸이 손을 뗄 때도 target 이라서, 손가락 아래 칸을 직접 찾는다
    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('#panel [data-s]');
    const to = target?.dataset.s;
    const backable = /^[igcf]:/.test(d.from);
    if (to && to !== d.from && !to.startsWith('rb:') && to !== 'o') {
      clickSlot(to, 0, false);
      // 다른 물건과 자리를 바꿨거나 다 못 들어갔으면 남은 건 원래 칸으로
      if (UI.cursor && backable) clickSlot(d.from, 0, false);
    } else if (backable) clickSlot(d.from, 0, false);
    else return;
    sfx.click();
    renderPanel();
  });
  panel.addEventListener('contextmenu', (e) => e.preventDefault());
  panel.addEventListener('pointermove', (e) => {
    const el = e.target.closest('[data-s]');
    showTip(el ? tipFor(el.dataset.s) : '', e.clientX, e.clientY);
  });
  panel.addEventListener('pointerleave', () => showTip(''));
  document.addEventListener('pointermove', (e) => {
    const c = $('cursorItem');
    c.style.transform = `translate(${e.clientX - 20}px, ${e.clientY - 20}px)`;
  });
  $('hotbar').addEventListener('pointerdown', (e) => {
    const el = e.target.closest('[data-hot]');
    if (!el) return;
    e.preventDefault();
    G.player.sel = Number(el.dataset.hot);
    api.onSelect();
  });
}

// ---- 칸 찾기 ----
function chestSlots() {
  return G.chests.get(UI.ref);
}
function furnace() {
  return G.furnaces.get(UI.ref);
}
function resolve(ref) {
  const [kind, n] = ref.split(':');
  const k = Number(n);
  if (kind === 'i') return { arr: G.player.inv, k, kind };
  if (kind === 'g') return { arr: UI.grid, k, kind };
  if (kind === 'c') return { arr: chestSlots(), k, kind };
  if (kind === 'f') return { arr: furnace().slots, k, kind: k === 2 ? 'fo' : k === 1 ? 'ff' : 'fi' };
  return null;
}
function accepts(kind, id) {
  if (kind === 'fo') return false;
  if (kind === 'ff') return FUEL[id] !== undefined;
  return true;
}
const gridSize = () => (UI.open === 'table' ? 3 : 2);
function gridIds() {
  const n = gridSize();
  const out = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) out.push(UI.grid[r * 3 + c]?.id ?? 0);
  return out;
}
function currentRecipe() {
  return matchRecipe(gridIds(), gridSize());
}

function clickSlot(ref, button, shift) {
  if (ref === 'o') return takeOutput(shift);
  if (ref === 'trash') {
    UI.cursor = null;
    return;
  }
  if (ref.startsWith('cr:')) {
    const id = Number(ref.slice(3));
    if (UI.cursor) {
      UI.cursor = null;
      return;
    }
    if (shift) addItem(G.player.inv, id, maxStack(id), durabilityOf(id) || undefined);
    else UI.cursor = newStack(id, button === 2 ? 1 : maxStack(id));
    return;
  }
  if (ref.startsWith('rb:')) return craftFromBook(Number(ref.slice(3)), shift);
  const slot = resolve(ref);
  if (!slot || !slot.arr) return;
  const { arr, k, kind } = slot;
  const s = arr[k];
  const c = UI.cursor;
  if (shift && s) return quickMove(slot);
  if (kind === 'fo') {
    if (!s) return;
    if (!c) { UI.cursor = s; arr[k] = null; }
    else if (c.id === s.id && c.count + s.count <= maxStack(c.id)) { c.count += s.count; arr[k] = null; }
    return;
  }
  const cap = c ? maxStack(c.id) : 64;
  if (button === 0) {
    if (!c) { UI.cursor = s; arr[k] = null; }
    else if (!s) { if (accepts(kind, c.id)) { arr[k] = c; UI.cursor = null; } }
    else if (s.id === c.id && cap > 1) {
      const n = Math.min(cap - s.count, c.count);
      s.count += n;
      c.count -= n;
      if (c.count <= 0) UI.cursor = null;
    } else if (accepts(kind, c.id)) { arr[k] = c; UI.cursor = s; }
  } else {
    if (!c) {
      if (!s) return;
      const half = Math.ceil(s.count / 2);
      UI.cursor = clone(s, half);
      s.count -= half;
      if (s.count <= 0) arr[k] = null;
    } else if (!s) {
      if (!accepts(kind, c.id)) return;
      arr[k] = clone(c, 1);
      c.count--;
    } else if (s.id === c.id && s.count < cap) {
      s.count++;
      c.count--;
    }
    if (UI.cursor && UI.cursor.count <= 0) UI.cursor = null;
  }
}
function quickMove({ arr, k, kind }) {
  const s = arr[k];
  const inv = G.player.inv;
  let left = s.count;
  if (kind === 'i') {
    if (UI.open === 'chest') left = addItem(chestSlots(), s.id, s.count, s.dur);
    else if (UI.open === 'furnace') {
      const f = furnace().slots;
      const target = SMELT[s.id] !== undefined ? 0 : FUEL[s.id] !== undefined ? 1 : -1;
      if (target >= 0) {
        if (!f[target]) { f[target] = s; left = 0; }
        else if (f[target].id === s.id) {
          const n = Math.min(maxStack(s.id) - f[target].count, s.count);
          f[target].count += n;
          left = s.count - n;
        }
      }
    } else left = k < 9 ? addItem(inv, s.id, s.count, s.dur, 9, 36) : addItem(inv, s.id, s.count, s.dur, 0, 9);
  } else left = addItem(inv, s.id, s.count, s.dur);
  if (left <= 0) arr[k] = null;
  else s.count = left;
}
function consumeGrid() {
  const n = gridSize();
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const s = UI.grid[r * 3 + c];
    if (!s) continue;
    s.count--;
    if (s.count <= 0) UI.grid[r * 3 + c] = null;
  }
}
function takeOutput(shift) {
  let rec = currentRecipe();
  if (!rec) return;
  const [id, n] = rec.out;
  if (shift) {
    let guard = 64;
    while (rec && guard-- > 0) {
      const left = addItem(G.player.inv, id, n, durabilityOf(id) || undefined);
      if (left > 0) api.drop(id, left);
      consumeGrid();
      rec = currentRecipe();
      if (rec && rec.out[0] !== id) break;
    }
  } else {
    const c = UI.cursor;
    if (!c) UI.cursor = newStack(id, n);
    else if (c.id === id && c.count + n <= maxStack(id)) c.count += n;
    else return;
    consumeGrid();
  }
  sfx.craft();
  api.onCraft(id);
}
function bookList() {
  const table = UI.open === 'table';
  const list = RECIPES.map((r) => ({ r, ok: canCraft(G.player.inv, r) && (!r.table || table) }));
  // 만들 수 있는 것 먼저
  return list.sort((a, b) => Number(b.ok) - Number(a.ok) || a.r.index - b.r.index);
}
function craftFromBook(index, shift) {
  const rec = RECIPES[index];
  if (!rec || (rec.table && UI.open !== 'table')) return;
  let times = shift ? 64 : 1;
  let made = 0;
  while (times-- > 0 && craftFromSlots(G.player.inv, rec)) {
    const [id, n] = rec.out;
    const left = addItem(G.player.inv, id, n, durabilityOf(id) || undefined);
    if (left > 0) api.drop(id, left);
    made++;
    if (maxStack(id) === 1 && shift) break;
  }
  if (made) {
    sfx.craft();
    api.onCraft(rec.out[0]);
  }
}

// ---- 열고 닫기 ----
export function openPanel(kind, ref = -1) {
  UI.open = kind;
  UI.ref = ref;
  $('panel').hidden = false;
  renderPanel();
}
export function closePanel() {
  if (!UI.open) return;
  const inv = G.player.inv;
  for (let k = 0; k < 9; k++) {
    const s = UI.grid[k];
    if (!s) continue;
    const left = addItem(inv, s.id, s.count, s.dur);
    if (left > 0) api.drop(s.id, left, s.dur);
    UI.grid[k] = null;
  }
  if (UI.cursor) {
    const s = UI.cursor;
    const left = addItem(inv, s.id, s.count, s.dur);
    if (left > 0) api.drop(s.id, left, s.dur);
    UI.cursor = null;
  }
  UI.open = null;
  $('panel').hidden = true;
  showTip('');
  renderCursor();
}

// ---- 그리기 ----
function slotHtml(ref, s, extra = '') {
  let inner = '';
  if (s && iconUrl[s.id]) {
    inner += `<img src="${iconUrl[s.id]}" alt="">`;
    if (s.count > 1) inner += `<b>${s.count}</b>`;
    const max = durabilityOf(s.id);
    if (max && s.dur !== undefined && s.dur < max) {
      const r = s.dur / max;
      inner += `<i style="width:${Math.round(r * 100)}%;background:hsl(${Math.round(r * 120)},90%,45%)"></i>`;
    }
  }
  return `<div class="slot ${extra}" data-s="${ref}">${inner}</div>`;
}
function invHtml() {
  const inv = G.player.inv;
  let main = '';
  for (let k = 9; k < 36; k++) main += slotHtml(`i:${k}`, inv[k]);
  let hot = '';
  for (let k = 0; k < 9; k++) hot += slotHtml(`i:${k}`, inv[k], k === G.player.sel ? 'sel' : '');
  return `<div class="label">가방</div><div class="grid9">${main}</div><div class="grid9 hot">${hot}</div>`;
}
function craftHtml() {
  const n = gridSize();
  let cells = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) cells += slotHtml(`g:${r * 3 + c}`, UI.grid[r * 3 + c]);
  const rec = currentRecipe();
  const out = rec ? newStack(rec.out[0], rec.out[1]) : null;
  return `<div class="craft"><div class="label">${n === 3 ? '제작대' : '조합'}</div><div class="cgrid n${n}">${cells}</div><div class="arrow">➜</div>${slotHtml('o', out, 'big')}</div>`;
}
function bookHtml() {
  const items = bookList().map(({ r, ok }) => {
    const [id, n] = r.out;
    return `<div class="slot book ${ok ? 'ok' : 'no'}" data-s="rb:${r.index}"><img src="${iconUrl[id]}" alt="">${n > 1 ? `<b>${n}</b>` : ''}</div>`;
  }).join('');
  return `<div class="book-wrap"><div class="label">만들 수 있는 것 <small>누르면 바로 만들어 (Shift: 많이)</small></div><div class="bookgrid">${items}</div></div>`;
}
const CREATIVE_TABS = ['블록', '도구', '재료·음식'];
function creativeIds(tab) {
  const ids = ITEMS.filter(Boolean).map((it) => it.id);
  if (tab === 0) return ids.filter((id) => id < 100);
  if (tab === 1) return ids.filter((id) => ITEMS[id].tool || [I.FLINT_STEEL, I.BUCKET, I.WATER_BUCKET, I.LAVA_BUCKET, I.BOW, I.ARROW, I.COMPASS, I.CLOCK, I.DOOR, I.BED].includes(id));
  return ids.filter((id) => id >= 100 && !ITEMS[id].tool && ![I.FLINT_STEEL, I.BUCKET, I.WATER_BUCKET, I.LAVA_BUCKET, I.BOW, I.ARROW, I.COMPASS, I.CLOCK, I.DOOR, I.BED].includes(id));
}
function creativeHtml() {
  const tabs = CREATIVE_TABS.map((t, k) => `<button class="tab ${k === UI.tab ? 'on' : ''}" data-tab="${k}">${t}</button>`).join('');
  const items = creativeIds(UI.tab).map((id) => `<div class="slot" data-s="cr:${id}"><img src="${iconUrl[id]}" alt=""></div>`).join('');
  return `<div class="tabs">${tabs}<div class="slot trash" data-s="trash" title="버리기">🗑</div></div><div class="crgrid">${items}</div>`;
}
function furnaceHtml() {
  const f = furnace();
  const burn = f.burnMax ? f.burn / f.burnMax : 0;
  const cook = f.cook / SMELT_TIME;
  return `<div class="furnace"><div class="label">화로</div>
    <div class="fcol">${slotHtml('f:0', f.slots[0])}<div class="flame"><span style="height:${Math.round(burn * 100)}%"></span></div>${slotHtml('f:1', f.slots[1])}</div>
    <div class="farrow"><span style="width:${Math.round(Math.min(1, cook) * 100)}%"></span></div>${slotHtml('f:2', f.slots[2], 'big')}
    <p class="hint">위: 구울 것 · 아래: 연료(석탄, 나무)</p></div>`;
}
function chestHtml() {
  const c = chestSlots();
  let cells = '';
  for (let k = 0; k < 27; k++) cells += slotHtml(`c:${k}`, c[k]);
  return `<div class="label">상자</div><div class="grid9">${cells}</div>`;
}

export function renderPanel() {
  if (!UI.open) return;
  const panel = $('panel');
  let top = '';
  let side = '';
  if (UI.open === 'inv' && G.mode === 'creative') top = creativeHtml();
  else if (UI.open === 'inv' || UI.open === 'table') {
    top = craftHtml();
    side = bookHtml();
  } else if (UI.open === 'furnace') top = furnaceHtml();
  else if (UI.open === 'chest') top = chestHtml();
  panel.innerHTML = `<div class="mc-wrap"><div class="mc-panel"><button class="close" data-close aria-label="닫기">✕</button>${top}${invHtml()}</div>${side ? `<div class="mc-panel side">${side}</div>` : ''}</div>`;
  UI.lastRender = performance.now();
  renderCursor();
}
function renderCursor() {
  const el = $('cursorItem');
  const c = UI.cursor;
  if (!c) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.innerHTML = `<img src="${iconUrl[c.id]}" alt="">${c.count > 1 ? `<b>${c.count}</b>` : ''}`;
}
function tipFor(ref) {
  if (ref.startsWith('rb:')) {
    const r = RECIPES[Number(ref.slice(3))];
    const need = recipeNeeds(r).map((g) => {
      const have = countItem(G.player.inv, g.ids);
      return `<span class="${have >= g.n ? 'have' : 'miss'}">${ITEMS[g.ids[0]].name} ${g.n}</span>`;
    }).join(' · ');
    return `<b>${ITEMS[r.out[0]].name}${r.out[1] > 1 ? ` ×${r.out[1]}` : ''}</b><br>${need}${r.table ? `<br><em>${UI.open === 'table' ? '제작대에서 만드는 중' : '제작대가 필요해'}</em>` : ''}`;
  }
  if (ref.startsWith('cr:')) return `<b>${ITEMS[Number(ref.slice(3))].name}</b>`;
  if (ref === 'trash') return '<b>버리기</b> (들고 있는 걸 여기 놓아)';
  let s = null;
  if (ref === 'o') {
    const rec = currentRecipe();
    s = rec ? newStack(rec.out[0], rec.out[1]) : null;
  } else {
    const slot = resolve(ref);
    s = slot?.arr?.[slot.k];
  }
  if (!s) return '';
  const it = ITEMS[s.id];
  let extra = '';
  if (it.tool) extra = `<br>공격력 ${it.tool.dmg}${s.dur !== undefined ? ` · 내구도 ${s.dur}/${durabilityOf(s.id)}` : ''}`;
  else if (it.food) extra = `<br>배고픔 +${it.food}`;
  else if (FUEL[s.id]) extra = `<br>연료 (${Math.round(FUEL[s.id] / SMELT_TIME)}개 굽기)`;
  return `<b>${it.name}</b>${extra}`;
}
function showTip(html, x = 0, y = 0) {
  const tip = $('tip');
  if (!html) {
    tip.hidden = true;
    return;
  }
  tip.hidden = false;
  tip.innerHTML = html;
  const r = tip.getBoundingClientRect();
  tip.style.left = `${Math.min(window.innerWidth - r.width - 8, x + 16)}px`;
  tip.style.top = `${Math.max(8, y - r.height - 8)}px`;
}

// ---- 핫바와 상태 ----
let hudKey = '';
export function renderHUD() {
  const p = G.player;
  const inv = p.inv;
  const parts = [p.sel, G.mode, Math.ceil(p.hp), Math.ceil(p.food), Math.ceil(p.air)];
  for (let k = 0; k < 9; k++) parts.push(inv[k] ? `${inv[k].id}x${inv[k].count}d${inv[k].dur ?? ''}` : '-');
  const key = parts.join('|');
  if (key === hudKey) return;
  hudKey = key;
  let hot = '';
  for (let k = 0; k < 9; k++) {
    const s = inv[k];
    let inner = `<span class="num">${k + 1}</span>`;
    if (s && iconUrl[s.id]) {
      inner += `<img src="${iconUrl[s.id]}" alt="">`;
      if (s.count > 1) inner += `<b>${s.count}</b>`;
      const max = durabilityOf(s.id);
      if (max && s.dur !== undefined && s.dur < max) inner += `<i style="width:${Math.round((s.dur / max) * 100)}%;background:hsl(${Math.round((s.dur / max) * 120)},90%,45%)"></i>`;
    }
    hot += `<div class="slot ${k === p.sel ? 'sel' : ''}" data-hot="${k}">${inner}</div>`;
  }
  $('hotbar').innerHTML = hot;
  const bars = $('bars');
  if (G.mode === 'creative') {
    bars.innerHTML = '<span class="creative-tag">크리에이티브 · F 날기</span>';
    return;
  }
  const row = (v, full, half, empty) => {
    let h = '';
    for (let k = 0; k < 10; k++) {
      const src = v >= k * 2 + 2 ? full : v >= k * 2 + 1 ? half : empty;
      h += `<img src="${src}" alt="">`;
    }
    return h;
  };
  let air = '';
  if (p.air < 10) for (let k = 0; k < Math.ceil(p.air); k++) air += `<img src="${hudIcons.bubble}" alt="">`;
  bars.innerHTML = `<div class="row air">${air}</div><div class="hb"><div class="row hearts ${p.hp <= 6 ? 'low' : ''}">${row(Math.ceil(p.hp), hudIcons.heart, hudIcons.heartHalf, hudIcons.heartEmpty)}</div><div class="row food">${row(Math.ceil(p.food), hudIcons.food, hudIcons.foodHalf, hudIcons.foodEmpty)}</div></div>`;
}
export function hudDirty() {
  hudKey = '';
}
// 화로가 열려 있으면 불 게이지를 자주 다시 그린다
export function tickPanel() {
  if (UI.open === 'furnace' && performance.now() - UI.lastRender > 200) renderPanel();
}
