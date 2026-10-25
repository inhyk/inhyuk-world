import { ENCHANTMENTS,enchantLevel,enchantLines,experienceLevel,bookshelfPower,applyEnchant } from './enchantments.mjs';
import { BLOCK_VERSION,VANILLA_BLOCKS } from './block-catalog.mjs';
import { blockGroup } from './catalog-art.mjs';
import { ARMOR_SLOTS, armorPoints } from './armor.mjs';
// 가방·제작대·화로·상자 화면과 아래쪽 손 줄(핫바), 체력·배고픔 표시
import { BLOCKS, ITEMS, RECIPES, SMELT, SMELT_TIME, FUEL, maxStack, durabilityOf, I,B } from './data.mjs';
import { addItem, matchRecipe, canCraft, craftFromSlots, recipeNeeds, countItem,W } from './core.mjs';
import { iconUrl } from './textures.mjs';
import { sfx } from './audio.mjs';

export const UI = { open: null, ref: -1, cursor: null, grid: Array(9).fill(null), tab: 0, search:'',category:'전체',page:0,enchantTarget:null,message:'',lastRender: 0 };
let G = null;
let api = null;
let bound=false;
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
  if(s.enchants)c.enchants={...s.enchants};
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
  if(bound)return;bound=true;
  buildHudIcons();
  const panel = $('panel');
  // 눌러서 집고 다른 칸을 눌러 놓아도 되고, 꾹 누른 채 끌어다 놓아도 된다
  let drag = null;
  panel.addEventListener('pointerdown', (e) => {
    const target=e.target.closest('[data-enchant-target]');if(target){if(api.onlineAction?.({op:'target',ref:target.dataset.enchantTarget}))return;UI.enchantTarget=target.dataset.enchantTarget;UI.message='';renderPanel();return;}
    const enchant=e.target.closest('[data-enchant]');if(enchant){if(api.onlineAction?.({op:'enchant',key:enchant.dataset.enchant,level:Number(enchant.dataset.level)}))return;const slot=resolve(UI.enchantTarget??'i:0'),stack=slot?.arr?.[slot.k];const r=applyEnchant(G,stack,enchant.dataset.enchant,Number(enchant.dataset.level),{x:UI.ref>=0?UI.ref%W:Math.floor(G.player.x),y:UI.ref>=0?Math.floor(UI.ref/W):Math.floor(G.player.y)});UI.message=r.text;api.onCraft();api.save?.();renderPanel();return;}
    const pager=e.target.closest('[data-page]');if(pager){UI.page=Number(pager.dataset.page);renderPanel();return;}
    const el = e.target.closest('[data-s]');
    if (el) {
      e.preventDefault();
      if(api.onlineAction?.({op:'slot',ref:el.dataset.s,button:e.button===2?2:0,shift:e.shiftKey}))return;
      const carrying = !!UI.cursor;
      clickSlot(el.dataset.s, e.button === 2 ? 2 : 0, e.shiftKey);
      drag = !carrying && UI.cursor && !e.shiftKey ? { from: el.dataset.s, x: e.clientX, y: e.clientY } : null;
      sfx.click();
      renderPanel();
      return;
    }
    const tab = e.target.closest('[data-tab]');
    if (tab) {
      UI.tab = Number(tab.dataset.tab);UI.page=0;
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
    const backable = /^[aigcf]:/.test(d.from);
    if (to && to !== d.from && !to.startsWith('rb:') && to !== 'o') {
      clickSlot(to, 0, false);
      // 다른 물건과 자리를 바꿨거나 다 못 들어갔으면 남은 건 원래 칸으로
      if (UI.cursor && backable) clickSlot(d.from, 0, false);
    } else if (backable) clickSlot(d.from, 0, false);
    else return;
    sfx.click();
    renderPanel();
  });
  panel.oninput=e=>{if(e.target.id!=='catalogSearch')return;UI.search=e.target.value;UI.page=0;const pos=e.target.selectionStart;renderPanel();const input=$('catalogSearch');input.focus();input.setSelectionRange(pos,pos);};
  panel.onchange=e=>{if(e.target.id==='catalogCategory'){UI.category=e.target.value;UI.page=0;renderPanel();}};
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
  $('offhandHUD').onclick=()=>api.swapHands();
  $('hotbar').addEventListener('pointerdown', (e) => {
    const el = e.target.closest('[data-hot]');
    if (!el) return;
    e.preventDefault();
    G.player.sel = Number(el.dataset.hot);
    api.onlineAction?.({op:'select',slot:G.player.sel});
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
  if (kind === 'a') { const player = k >= 4 ? G.companion : G.player; player.armor ??= Array(4).fill(null); return { arr: player.armor, k: k % 4, kind: `a${k % 4}` }; }
  if(kind==='h'){const player=k===1?G.companion:G.player;player.offhand??=[null];return {arr:player.offhand,k:0,kind};}
  if (kind === 'i') return { arr: G.player.inv, k, kind };
  if (kind === 'g') return { arr: UI.grid, k, kind };
  if (kind === 'c') return { arr: chestSlots(), k, kind };
  if (kind === 'f') return { arr: furnace().slots, k, kind: k === 2 ? 'fo' : k === 1 ? 'ff' : 'fi' };
  return null;
}
function accepts(kind, id) {
  if (kind.startsWith('a')) return ITEMS[id]?.armor?.slot === Number(kind.slice(1));
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
    if(G.mode!=='creative'){api.toast?.('야생에서는 재료를 모아 제작해 줘. 크리에이티브에서 도감의 블록을 받을 수 있어.');return;}
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
    const armor = ITEMS[s.id]?.armor;
    if (armor && !G.player.armor?.[armor.slot] && ['inv', 'table'].includes(UI.open)) { G.player.armor ??= Array(4).fill(null); G.player.armor[armor.slot] = s; arr[k] = null; return; }
    if (UI.open === 'chest') left = addItem(chestSlots(), s.id, s.count, s.dur,0,chestSlots().length,s);
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
    } else left = k < 9 ? addItem(inv, s.id, s.count, s.dur, 9, 36,s) : addItem(inv, s.id, s.count, s.dur, 0, 9,s);
  } else left = addItem(inv, s.id, s.count, s.dur,0,inv.length,s);
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
  if(!UI.silent&&api?.onlineAction?.({op:'open',kind,ref}))return;
  UI.open = kind;
  UI.ref = ref;UI.message='';if(kind==='enchant')UI.enchantTarget=`i:${G.player.sel}`;
  if(UI.silent){if(kind==='enchant'){const eligible=s=>s&&(ITEMS[s.id]?.tool||ITEMS[s.id]?.armor||s.id===I.BOW);if(!eligible(G.player.inv[G.player.sel])){const i=G.player.inv.findIndex(eligible),a=G.player.armor.findIndex(eligible);UI.enchantTarget=i>=0?`i:${i}`:a>=0?`a:${a}`:null;}}return;}
  $('panel').hidden = false;
  renderPanel();
}
export function closePanel() {
  if(!UI.silent&&api?.onlineAction?.({op:'close'}))return;
  if (!UI.open) return;
  const inv = G.player.inv;
  for (let k = 0; k < 9; k++) {
    const s = UI.grid[k];
    if (!s) continue;
    const left = addItem(inv, s.id, s.count, s.dur,0,inv.length,s);
    if (left > 0) api.drop(s.id, left, s.dur,s.enchants);
    UI.grid[k] = null;
  }
  if (UI.cursor) {
    const s = UI.cursor;
    const left = addItem(inv, s.id, s.count, s.dur,0,inv.length,s);
    if (left > 0) api.drop(s.id, left, s.dur,s.enchants);
    UI.cursor = null;
  }
  UI.open = null;
  if(UI.silent)return;
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
  return `<div class="slot ${extra} ${s?.enchants?'enchanted':''}" data-s="${ref}">${inner}</div>`;
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
const CREATIVE_TABS = ['블록', '도구·방어구', '재료·음식'];
function creativeIds(tab) {
  const ids = ITEMS.filter(Boolean).map((it) => it.id);
  if (tab === 0) return ids.filter((id) => ITEMS[id].place!==undefined&&id!==0);
  if (tab === 1) return ids.filter((id) => ITEMS[id].tool || ITEMS[id].armor || [I.FLINT_STEEL, I.BUCKET, I.WATER_BUCKET, I.LAVA_BUCKET, I.BOW, I.ARROW, I.COMPASS, I.CLOCK, I.DOOR, I.BED].includes(id));
  return ids.filter((id) => ITEMS[id].place===undefined && !ITEMS[id].tool && !ITEMS[id].armor && ![I.FLINT_STEEL, I.BUCKET, I.WATER_BUCKET, I.LAVA_BUCKET, I.BOW, I.ARROW, I.COMPASS, I.CLOCK, I.DOOR, I.BED].includes(id));
}
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
function creativeHtml() {
 const tabs=CREATIVE_TABS.map((name,k)=>`<button class="tab ${k===UI.tab?'on':''}" data-tab="${k}">${name}</button>`).join('');
 const items=creativeIds(UI.tab).map(id=>slotHtml(`cr:${id}`,newStack(id))).join('');
 return `<div class="tabs">${tabs}<div class="slot trash" data-s="trash" title="버리기">🗑</div></div><div class="crgrid">${items}</div>`;
}
function catalogHtml() {
 const catalog=UI.open==='catalog',tab=catalog?0:UI.tab;
 const tabs=catalog?'':CREATIVE_TABS.map((t,k)=>`<button class="tab ${k===tab?'on':''}" data-tab="${k}">${t}</button>`).join('');
 const query=(UI.search??'').toLowerCase().trim();
 const ids=creativeIds(tab).filter(id=>{const it=ITEMS[id];return (!query||`${it.name} ${it.mcName??''} ${id}`.toLowerCase().includes(query))&&(tab!==0||UI.category==='전체'||blockGroup(it.mcName)===UI.category);});
 const pages=Math.max(1,Math.ceil(ids.length/48));UI.page=Math.max(0,Math.min(pages-1,UI.page??0));
 const items=ids.slice(UI.page*48,UI.page*48+48).map(id=>`<div class="catalog-cell" title="${esc(ITEMS[id].name)}"><div class="slot" data-s="cr:${id}" aria-label="${esc(ITEMS[id].name)}"><img loading="lazy" src="${iconUrl[id]}" alt=""></div><small>${esc(ITEMS[id].name)}</small></div>`).join('');
 return `<div class="catalog-heading"><b>블록 도감 · 자바 ${BLOCK_VERSION}</b><small>등록 블록 ${VANILLA_BLOCKS.length}종 · ${G.mode==='creative'?'Shift+클릭으로 가방에 받기':'야생에서는 구경하기 · 재료를 모아 제작해 줘'}</small></div><div class="tabs">${tabs}${G.mode==='creative'?'<div class="slot trash" data-s="trash" title="버리기">🗑</div>':''}</div><div class="catalog-controls"><input id="catalogSearch" aria-label="블록·아이템 검색" placeholder="한글 이름 / 영어 ID 검색" value="${esc(UI.search??'')}">${tab===0?`<select id="catalogCategory" aria-label="블록 분류">${['전체','자연','나무','색깔','건축','유리·얼음','식물','차원','기능·장식'].map(c=>`<option ${UI.category===c?'selected':''}>${c}</option>`).join('')}</select>`:''}</div><div class="catalog-pager"><button data-page="${UI.page-1}" ${UI.page===0?'disabled':''}>← 이전</button><span>검색 ${ids.length}종 · ${UI.page+1}/${pages}</span><button data-page="${UI.page+1}" ${UI.page>=pages-1?'disabled':''}>다음 →</button></div><div class="crgrid catalog-grid">${items||'<p>이름을 찾지 못했어.</p>'}</div><small class="catalog-note">모든 블록은 2D 타일로 설치해. 회로·자동화·3D 전용 상태는 단순화되어 있어.</small>`;
}
function enchantHtml(){
 const candidates=[...G.player.inv.map((s,i)=>({s,ref:`i:${i}`})),...(G.player.armor??[]).map((s,i)=>({s,ref:`a:${i}`})),...(G.adventure?.coop&&!G.onlineSession?(G.companion?.armor??[]).map((s,i)=>({s,ref:`a:${i+4}`})):[])].filter(({s})=>s&&(ITEMS[s.id].tool||ITEMS[s.id].armor||s.id===I.BOW));
 if(!candidates.some(c=>c.ref===UI.enchantTarget))UI.enchantTarget=candidates[0]?.ref;
 const selected=candidates.find(c=>c.ref===UI.enchantTarget)?.s,creative=G.mode==='creative',power=creative?{shelves:0,maxLevel:5}:bookshelfPower(G,UI.ref%W,Math.floor(UI.ref/W));
 const targets=candidates.map(({s,ref})=>`<button class="enchant-target ${ref===UI.enchantTarget?'selected':''}" data-enchant-target="${ref}"><img src="${iconUrl[s.id]}" alt=""><span>${ref.startsWith('a:')?(Number(ref.slice(2))>=4?'2P 착용 · ':'1P 착용 · '):''}${ITEMS[s.id].name}<small>${enchantLines(s).join(' · ')||'인챈트 없음'}</small></span></button>`).join('');
 const choices=Object.entries(ENCHANTMENTS).filter(([,e])=>selected&&e.fits(ITEMS[selected.id])).map(([key,e])=>{const lv=enchantLevel(selected,key),next=lv+1,blocked=next>e.max||e.conflicts?.some(k=>enchantLevel(selected,k));return `<div class="enchant-choice"><span><b>${e.name} ${lv?`· 현재 ${lv}`:''}</b><small>${e.description}</small>${!blocked?`<small>${creative?'무료':`필요: 경험치 ${next*3}레벨 · 청금석 ${next}개${next>power.maxLevel?` · 책장 ${Math.max(0,(next-1)*3-power.shelves)}개 더 필요`:''}`}</small>`:''}</span><button data-enchant="${key}" data-level="${next}" ${blocked?'disabled':''}>${next>e.max?'최대 레벨':blocked?'함께 사용 불가':`${next}레벨 부여`}</button></div>`;}).join('');
 return `<section class="enchant-panel"><h2>✦ 마법 부여대</h2><p>경험치 <b>${experienceLevel(G.player)}레벨</b> · 청금석 ${countItem(G.player.inv,[I.LAPIS])}개 · ${creative?'크리에이티브: 무료':`책장 ${power.shelves}개 · 최대 ${power.maxLevel}레벨`}</p><small>야생 비용: 부여할 레벨 × (경험치 3레벨 + 청금석 1개). 책장 3개마다 최대 레벨 +1.</small><div class="enchant-targets">${targets||'가방에 검·도구·활·방어구를 넣어 줘.'}</div><div class="enchant-current">${selected?`선택: ${ITEMS[selected.id].name} · ${enchantLines(selected).join(' · ')||'인챈트 없음'}`:''}</div><p class="enchant-message" role="status">${esc(UI.message??'')}</p><div class="enchant-options">${choices}</div></section>`;
}
function furnaceHtml() {
  const f = furnace();
  const burn = f.burnMax ? f.burn / f.burnMax : 0;
  const cook = f.cook / SMELT_TIME;
  return `<div class="furnace"><div class="label">${BLOCKS[G.w.tiles[UI.ref]]?.name??'화로'}</div>
    <div class="fcol">${slotHtml('f:0', f.slots[0])}<div class="flame"><span style="height:${Math.round(burn * 100)}%"></span></div>${slotHtml('f:1', f.slots[1])}</div>
    <div class="farrow"><span style="width:${Math.round(Math.min(1, cook) * 100)}%"></span></div>${slotHtml('f:2', f.slots[2], 'big')}
    <p class="hint">위: 구울 것 · 아래: 연료(석탄, 나무)</p></div>`;
}
function chestHtml() {
  const c = chestSlots();
  let cells = '';
  for (let k = 0; k < 27; k++) cells += slotHtml(`c:${k}`, c[k]);
  return `<div class="label">${BLOCKS[G.w.tiles[UI.ref]]?.name??'상자'}</div><div class="grid9">${cells}</div>`;
}

function armorHtml() {
  const row = (player, offset, label) => `<div class="armor-line"><span>${label}<br><small>방어 ${armorPoints(player)}/20</small></span>${ARMOR_SLOTS.map((name, k) => `<div class="armor-cell">${slotHtml(`a:${offset+k}`, player.armor?.[k])}<small>${name}</small></div>`).join('')}</div>`;
  return `<div class="armor-rack"><div class="offhand-rack"><div>${slotHtml('h:0',G.player.offhand?.[0])}<small>왼손</small></div><span>G · 양손 바꾸기<br>블록·음식: 사용 버튼 / 우클릭</span></div>${row(G.player, 0, G.onlineSession?'내 방어구':G.adventure?.coop ? '1P 방어구' : '방어구')}${G.adventure?.coop&&!G.onlineSession ? row(G.companion, 4, '2P 방어구') : ''}<small>가방에서 집어 맞는 부위에 놓기 · Shift+클릭: 내 장비 빠른 착용</small></div>`;
}
export function renderPanel() {
  if(UI.silent)return;
  if (!UI.open) return;
  const panel = $('panel');
  let top = '';
  let side = '';
  if(UI.open==='enchant')top=enchantHtml();
  else if(UI.open==='catalog')top=catalogHtml();
  else if (UI.open === 'inv' && G.mode === 'creative') top = creativeHtml();
  else if (UI.open === 'inv' || UI.open === 'table') {
    top = craftHtml();
    side = bookHtml();
  } else if (UI.open === 'furnace') top = furnaceHtml();
  else if (UI.open === 'chest') top = chestHtml();
  panel.innerHTML = `<div class="mc-wrap"><div class="mc-panel ${['enchant','catalog'].includes(UI.open)?'expanded-panel':''}"><button class="close" data-close aria-label="닫기">✕</button>${top}${['inv', 'table'].includes(UI.open) ? armorHtml() : ''}${invHtml()}</div>${side ? `<div class="mc-panel side">${side}</div>` : ''}</div>`;
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
  else if (it.armor) extra = `<br>방어력 +${it.armor.points} · 내구도 ${s.dur ?? durabilityOf(s.id)}/${durabilityOf(s.id)}`;
  else if (it.food) extra = `<br>배고픔 +${it.food}`;
  else if (FUEL[s.id]) extra = `<br>연료 (${Math.round(FUEL[s.id] / SMELT_TIME)}개 굽기)`;
  return `<b>${it.name}</b>${extra}${enchantLines(s).map(line=>`<br><span class="enchant-label">✦ ${line}</span>`).join('')}`;
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
  const parts = [JSON.stringify(p.offhand),p.xp, armorPoints(p), p.sel, G.mode, Math.ceil(p.hp), Math.ceil(p.food), Math.ceil(p.air)];
  for (let k = 0; k < 9; k++) parts.push(inv[k] ? `${inv[k].id}x${inv[k].count}d${inv[k].dur ?? ''}e${JSON.stringify(inv[k].enchants??{})}` : '-');
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
    hot += `<div class="slot ${s?.enchants ? 'enchanted' : ''} ${k === p.sel ? 'sel' : ''}" data-hot="${k}">${inner}</div>`;
  }
  $('hotbar').innerHTML = hot;
  const off=p.offhand?.[0];$('offhandHUD').innerHTML=`<span class="slot">${off&&iconUrl[off.id]?`<img src="${iconUrl[off.id]}" alt="${ITEMS[off.id].name}">${off.count>1?`<b>${off.count}</b>`:''}`:''}</span><span>왼손 ⇄ G</span>`;
  const bars = $('bars');
  if (G.mode === 'creative') {
    bars.innerHTML = `<span class="creative-tag">크리에이티브 · F 날기 · 경험치 ${experienceLevel(p)}레벨</span>`;
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
  bars.innerHTML = `<div class="xp-hud">경험치 ${experienceLevel(p)}레벨</div><div class="row air">${air}</div>${armorPoints(p) ? `<div class="armor-hud">🛡 방어 ${armorPoints(p)}/20</div>` : ''}<div class="hb"><div class="row hearts ${p.hp <= 6 ? 'low' : ''}">${row(Math.ceil(p.hp), hudIcons.heart, hudIcons.heartHalf, hudIcons.heartEmpty)}</div><div class="row food">${row(Math.ceil(p.food), hudIcons.food, hudIcons.foodHalf, hudIcons.foodEmpty)}</div></div>`;
}
export function hudDirty() {
  hudKey = '';
}
// 화로가 열려 있으면 불 게이지를 자주 다시 그린다
export function tickPanel() {
  if (UI.open === 'furnace' && performance.now() - UI.lastRender > 200) renderPanel();
}

// Replay a guest's UI intents on the host, using the same crafting/stacking rules.
// The host supplies a separate UI context and its authoritative guest player.
const UI_STATE_KEYS = ['open','ref','cursor','grid','enchantTarget','message'];
export function panelState() { return Object.fromEntries(UI_STATE_KEYS.map(k=>[k,UI[k]])); }
export function installPanelState(state) { for(const k of UI_STATE_KEYS)if(k in state)UI[k]=state[k]; }
export function syncOnlinePanel(state) {
  installPanelState(state);
  $('panel').hidden=!UI.open;
  if(UI.open)renderPanel();
  else { showTip('');renderCursor(); }
}
function validRef(ref) {
  if(typeof ref!=='string'||ref.length>16)return false;
  if(ref==='o')return ['inv','table'].includes(UI.open)&&!!currentRecipe();
  if(ref==='trash')return G.mode==='creative';
  const m=/^(i|a|h|g|c|f|cr|rb):(\d{1,4})$/.exec(ref);if(!m)return false;
  const n=Number(m[2]);
  if(m[1]==='i')return n<36;
  if(m[1]==='a')return n<4;
  if(m[1]==='h')return n===0&&['inv','table'].includes(UI.open);
  if(m[1]==='g')return n<9&&['inv','table'].includes(UI.open);
  if(m[1]==='c')return UI.open==='chest'&&n<27&&!!chestSlots();
  if(m[1]==='f')return UI.open==='furnace'&&n<3&&!!furnace();
  if(m[1]==='cr')return G.mode==='creative'&&!!ITEMS[n];
  return !!RECIPES[n]&&['inv','table'].includes(UI.open);
}
export function replayPanelAction(action) {
  if(!action||typeof action!=='object')return;
  if(action.op==='close'){closePanel();return;}
  if(action.op==='open'){
    const kind=action.kind,ref=action.ref;
    if(!['inv','catalog','enchant','table','chest','furnace'].includes(kind))return;
    if(!['inv','catalog'].includes(kind)&&!(kind==='enchant'&&G.mode==='creative')){
      if(!Number.isInteger(ref)||ref<0||ref>=G.w.tiles.length||Math.hypot(G.player.x-ref%W,G.player.y-Math.floor(ref/W))>6)return;
      const block=G.w.tiles[ref],valid=kind==='enchant'?block===B.ENCHANTING_TABLE:kind==='table'?BLOCKS[block].use==='table':kind==='chest'?BLOCKS[block].use==='chest':BLOCKS[block].use==='furnace';
      if(!valid)return;
      if(kind==='chest'&&!G.chests.has(ref))G.chests.set(ref,Array(27).fill(null));
      if(kind==='furnace'&&!G.furnaces.has(ref))G.furnaces.set(ref,{slots:[null,null,null],burn:0,burnMax:0,cook:0});
    }
    if(UI.open)closePanel();
    openPanel(kind,Number.isInteger(ref)?ref:-1);return;
  }
  if(!UI.open)return;
  if(action.op==='slot'&&validRef(action.ref))clickSlot(action.ref,action.button===2?2:0,action.shift===true);
  if(action.op==='target'&&UI.open==='enchant'&&/^[ia]:\d+$/.test(action.ref)&&validRef(action.ref)){UI.enchantTarget=action.ref;UI.message='';}
  if(action.op==='enchant'&&UI.open==='enchant'&&Object.hasOwn(ENCHANTMENTS,action.key)){
    // A station may have been mined while its panel was open.
    const slot=resolve(UI.enchantTarget??`i:${G.player.sel}`),stack=slot?.arr?.[slot.k];
    UI.message=applyEnchant(G,stack,action.key,action.level,{x:UI.ref%W,y:Math.floor(UI.ref/W)}).text;
  }
}
