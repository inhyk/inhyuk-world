// 관전: 탈락하면 아직 남은 사람을 따라가며 구경한다 (배틀 로얄, 바닥이 사라져요).
// list() → [{ key, name, x, y, z, info }] 지금 남은 사람들. ◀ ▶ 버튼이나 Q/E 로 바꾼다.
export class Spectate {
  constructor(game, list, { onLeave } = {}) {
    this.game = game;
    this.list = list;
    this.sel = null; // 지금 보는 사람 key
    this.onLeave = onLeave;
    const bar = document.createElement('div');
    bar.id = 'spectate-bar';
    bar.innerHTML = '<button class="prev" aria-label="앞 사람">◀</button><div class="who"><small>👀 관전 중 · Q/E 로 바꾸기</small><b></b></div><button class="next" aria-label="다음 사람">▶</button><button class="leave">그만 보기</button>';
    bar.querySelector('.prev').addEventListener('click', () => { game.sfx('click'); this.step(-1); });
    bar.querySelector('.next').addEventListener('click', () => { game.sfx('click'); this.step(1); });
    bar.querySelector('.leave').addEventListener('click', () => { game.sfx('click'); this.onLeave?.(); });
    document.body.append(bar);
    this.bar = bar;
    if (matchMedia('(pointer: coarse)').matches) bar.querySelector('small').textContent = '👀 관전 중';
  }

  current() {
    const l = this.list();
    if (!l.length) return null;
    let t = l.find(x => x.key === this.sel);
    if (!t) { t = l[0]; this.sel = t.key; }
    return t;
  }
  step(d) {
    const l = this.list();
    if (!l.length) return;
    let i = l.findIndex(x => x.key === this.sel);
    i = ((i < 0 ? 0 : i + d) % l.length + l.length) % l.length;
    this.sel = l[i].key;
  }
  key(code) {
    if (code === 'KeyQ') { this.step(-1); return true; }
    if (code === 'KeyE') { this.step(1); return true; }
    return false;
  }
  // 매 프레임: 따라갈 사람 (없으면 null)
  update() {
    const t = this.current();
    const b = this.bar.querySelector('b');
    const text = t ? `${t.name}${t.info ? ` · ${t.info}` : ''}` : '남은 사람이 없어';
    if (b.textContent !== text) b.textContent = text;
    return t;
  }
  dispose() { this.bar.remove(); }
}
