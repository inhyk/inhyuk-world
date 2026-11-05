// 사진첩 갤러리 (인혁: "갤러리도 만들어줘"): photos taken with P are kept on this computer, shown in an
// album (G key) and hung in the frames of the 세온 갤러리 building.
import * as THREE from 'three';

const KEY = 'social-game-photos-v1';
const MAX = 12;
const $ = (id) => document.getElementById(id);

export class Album {
  constructor({ hud, input, sfx }) {
    this.hud = hud;
    this.input = input;
    this.sfx = sfx;
    this.photos = [];
    try { this.photos = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { this.photos = []; }
    this.frames = null; // frame meshes of the gallery building, once built
    this.loader = new THREE.TextureLoader();
  }

  save() {
    // storage is small: drop the oldest photos until it fits
    for (;;) {
      try { localStorage.setItem(KEY, JSON.stringify(this.photos)); return; } catch {
        if (this.photos.length <= 1) return;
        this.photos.pop();
      }
    }
  }

  /** Add a full-size data URL; it is shrunk to 480 px wide first. */
  add(dataUrl, caption) {
    const img = new Image();
    img.onload = () => {
      const w = 480, h = Math.round(img.height * (w / img.width));
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      this.photos.unshift({ url: c.toDataURL('image/jpeg', 0.78), caption, at: Date.now() });
      this.photos.length = Math.min(this.photos.length, MAX);
      this.save();
      this.fillFrames();
      this.hud.toast(`📷 갤러리에 저장했어요 (G로 보기) · ${this.photos.length}/${MAX}`, 1800);
    };
    img.src = dataUrl;
  }

  /** Put the newest photos into the gallery building's frames (empty frames keep their painting). */
  fillFrames(frames = this.frames) {
    if (!frames) return;
    this.frames = frames;
    frames.forEach((f, i) => {
      const p = this.photos[i];
      const m = f.mesh?.material;
      if (!m) return;
      if (!f.original) f.original = { map: m.map };
      if (!p) { if (m.map !== f.original.map) { m.map = f.original.map; m.needsUpdate = true; } return; }
      this.loader.load(p.url, (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        const pa = t.image.width / t.image.height, fa = (f.w ?? 1) / (f.h ?? 0.7);
        if (pa > fa) { t.repeat.set(fa / pa, 1); t.offset.set((1 - fa / pa) / 2, 0); } else { t.repeat.set(1, pa / fa); t.offset.set(0, (1 - pa / fa) / 2); }
        m.map = t;
        if (m.emissiveMap !== undefined && m.emissive) { m.emissiveMap = t; }
        m.needsUpdate = true;
      });
    });
  }

  open() {
    const el = $('album');
    const list = this.photos.map((p, i) => `<figure data-i="${i}"><img src="${p.url}" alt="사진 ${i + 1}"><figcaption>${p.caption ?? ''}</figcaption><button class="del" data-i="${i}" title="지우기">✕</button></figure>`).join('');
    el.innerHTML = `<div class="mcard wide"><h2>🖼️ 내 갤러리 <small>${this.photos.length}/${MAX}</small></h2>${this.photos.length ? `<div class="grid">${list}</div>` : '<p class="small">아직 사진이 없어요. P 키로 사진을 찍어 봐요! 📷 찍은 사진은 세온 갤러리 건물 액자에도 걸려요.</p>'}<div class="big-view hidden" id="album-big"></div><button class="alt close" id="album-x">닫기</button></div>`;
    el.classList.remove('hidden');
    this.input.enabled = false;
    document.exitPointerLock?.();
    el.querySelectorAll('figure img').forEach((img) => {
      img.onclick = () => { const b = $('album-big'); b.innerHTML = `<img src="${img.src}" alt="크게 보기">`; b.classList.remove('hidden'); b.onclick = () => b.classList.add('hidden'); };
    });
    el.querySelectorAll('.del').forEach((b) => {
      b.onclick = (e) => { e.stopPropagation(); this.photos.splice(Number(b.dataset.i), 1); this.save(); this.fillFrames(); this.sfx?.('click'); this.open(); };
    });
    $('album-x').onclick = () => this.close();
  }

  close() {
    $('album').classList.add('hidden');
    this.input.enabled = true;
    this.input.lock();
  }
}
