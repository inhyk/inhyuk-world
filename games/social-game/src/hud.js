// DOM heads-up display: 체력/배고픔 bars (as in 인혁's drawing), quest card, clock, prompt, toasts, hotbar.
const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.el = $('hud');
    this.hp = $('hp-fill'); this.food = $('food-fill');
    this.hpBar = this.hp.parentElement; this.foodBar = this.food.parentElement;
    this.questText = $('quest-text'); this.questList = $('quest-list');
    this.promptEl = $('prompt'); this.toastEl = $('toast');
    this.dayEl = $('day'); this.timeEl = $('time'); this.moneyEl = $('money');
    this.hotbar = $('hotbar');
    this.viewBtn = $('btn-view');
    this._prompt = '';
  }
  show() { this.el.classList.remove('hidden'); }
  bars(hp, food) {
    // called every frame: only touch the page when a bar really moved (style writes cost a re-layout)
    const h = Math.max(0, Math.min(100, hp)).toFixed(1), f = Math.max(0, Math.min(100, food)).toFixed(1);
    if (h === this._hp && f === this._food) return;
    this._hp = h; this._food = f;
    this.hp.style.width = `${h}%`;
    this.food.style.width = `${f}%`;
    this.hpBar.classList.toggle('low', hp < 25);
    this.foodBar.classList.toggle('low', food < 20);
  }
  quest(text, steps = [], goal = null) {
    if (this._q !== text) { this.questText.textContent = text; this._q = text; }
    const gk = goal ? `${goal.label}|${goal.now}|${goal.max}` : '';
    if (this._g !== gk) {
      this._g = gk;
      let el = document.getElementById('quest-goal');
      if (!el) { el = document.createElement('div'); el.id = 'quest-goal'; this.questText.after(el); }
      el.classList.toggle('hidden', !goal);
      if (goal) {
        const p = Math.max(0, Math.min(1, goal.now / goal.max));
        el.innerHTML = `<div class="gl">${goal.label} <b>${goal.now.toLocaleString('ko-KR')}</b> / ${goal.max.toLocaleString('ko-KR')}원</div><div class="gb"><i style="width:${(p * 100).toFixed(1)}%"></i></div>`;
      }
    }
    const key = JSON.stringify(steps);
    if (this._steps === key) return;
    this._steps = key;
    this.questList.innerHTML = '';
    for (const s of steps) {
      const li = document.createElement('li');
      li.textContent = s.label;
      li.className = s.done ? 'done' : s.now ? 'now' : '';
      this.questList.appendChild(li);
    }
  }
  clock(dayText, timeText, money) {
    if (this._d !== dayText) { this.dayEl.textContent = dayText; this._d = dayText; }
    if (this._t !== timeText) { this.timeEl.textContent = timeText; this._t = timeText; }
    const m = `${money.toLocaleString('ko-KR')}원`;
    if (this._m !== m) { this.moneyEl.textContent = m; this._m = m; }
  }
  prompt(text, key = 'E') {
    const t = text ? `${key}|${text}` : '';
    if (t === this._prompt) return;
    this._prompt = t;
    if (!text) { this.promptEl.classList.add('hidden'); return; }
    this.promptEl.innerHTML = `<kbd>${key}</kbd>${text}`;
    this.promptEl.classList.remove('hidden');
  }
  toast(text, ms = 2200) {
    const d = document.createElement('div');
    d.textContent = text;
    this.toastEl.appendChild(d);
    while (this.toastEl.children.length > 3) this.toastEl.firstChild.remove();
    setTimeout(() => d.remove(), ms);
  }
  setView(view) { this.viewBtn.textContent = view === 'first' ? '1인칭' : '3인칭'; }
}
