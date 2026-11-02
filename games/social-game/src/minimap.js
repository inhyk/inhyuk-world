// Round minimap (north up): roads, buildings, the car, the quest target.
import { LAYOUT, SITES } from './world.js';

export class Minimap {
  constructor(canvas) {
    this.c = canvas;
    this.g = canvas.getContext('2d');
    this.big = false;
  }
  toggle() { this.big = !this.big; this.c.classList.toggle('big', this.big); this.c.width = this.c.height = this.big ? 520 : 220; }
  draw(player, yaw, car, target) {
    const g = this.g, W = this.c.width, H = this.c.height;
    const scale = this.big ? 0.75 : 1.25; // px per metre
    const cx = this.big ? -20 : player.x, cz = this.big ? 0 : player.z;
    const P = (x, z) => [W / 2 + (x - cx) * scale, H / 2 + (z - cz) * scale];
    g.save();
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#5d7d48'; g.fillRect(0, 0, W, H);
    // beach and sea
    let [sx] = P(LAYOUT.beachX, 0);
    g.fillStyle = '#e3cf9a'; g.fillRect(0, 0, Math.max(0, sx), H);
    [sx] = P(LAYOUT.beachX - 27, 0);
    g.fillStyle = '#3f8fb0'; g.fillRect(0, 0, Math.max(0, sx), H);
    // road
    const [rx0, rz0] = P(LAYOUT.roadX[0], LAYOUT.roadZ - LAYOUT.roadHalf - LAYOUT.walk);
    const [rx1, rz1] = P(LAYOUT.roadX[1], LAYOUT.roadZ + LAYOUT.roadHalf + LAYOUT.walk);
    g.fillStyle = '#cfc8ba'; g.fillRect(rx0, rz0, rx1 - rx0, rz1 - rz0);
    const [ax0, az0] = P(LAYOUT.roadX[0], LAYOUT.roadZ - LAYOUT.roadHalf);
    const [ax1, az1] = P(LAYOUT.roadX[1], LAYOUT.roadZ + LAYOUT.roadHalf);
    g.fillStyle = '#3c3f44'; g.fillRect(ax0, az0, ax1 - ax0, az1 - az0);
    // buildings
    g.font = `${this.big ? 16 : 12}px Jua, sans-serif`; g.textAlign = 'center';
    for (const s of SITES) {
      const fp = s.footprint;
      if (!fp) continue;
      const rot = Math.abs(Math.sin(s.yaw)) > 0.5;
      const w = (rot ? fp.d : fp.w) * scale, d = (rot ? fp.w : fp.d) * scale;
      const [x, z] = P(s.pos[0], s.pos[2]);
      g.fillStyle = s.color; g.strokeStyle = '#2a2420'; g.lineWidth = 2;
      g.beginPath(); g.roundRect(x - w / 2, z - d / 2, w, d, 4); g.fill(); g.stroke();
      g.fillStyle = '#fff'; g.strokeStyle = '#000a'; g.lineWidth = 3;
      g.strokeText(s.label, x, z - d / 2 - 4); g.fillText(s.label, x, z - d / 2 - 4);
    }
    if (car) {
      const [x, z] = P(car.x, car.z);
      g.fillStyle = '#4f8fd8'; g.strokeStyle = '#fff'; g.lineWidth = 2;
      g.beginPath(); g.arc(x, z, 5, 0, Math.PI * 2); g.fill(); g.stroke();
    }
    if (target) {
      let [x, z] = P(target.x, target.z);
      const r = W / 2 - 12, dx = x - W / 2, dz = z - H / 2, d = Math.hypot(dx, dz);
      if (!this.big && d > r) { x = W / 2 + dx / d * r; z = H / 2 + dz / d * r; }
      g.fillStyle = '#ffd23a'; g.strokeStyle = '#7a4a00'; g.lineWidth = 2;
      g.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 4 : 9; g.lineTo(x + Math.cos(a) * rr, z + Math.sin(a) * rr); }
      g.closePath(); g.fill(); g.stroke();
    }
    // player arrow
    const [px, pz] = P(player.x, player.z);
    g.translate(px, pz); g.rotate(-yaw);
    g.fillStyle = '#ff4a4a'; g.strokeStyle = '#fff'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, -9); g.lineTo(6, 7); g.lineTo(0, 3); g.lineTo(-6, 7); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }
}
