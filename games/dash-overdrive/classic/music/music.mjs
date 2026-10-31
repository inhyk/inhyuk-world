#!/usr/bin/env node
// DASH / OVERDRIVE · CLASSIC: original soundtrack and sound-effect generator.
//
// Every sound in this file is synthesized from oscillators, noise and filters. It uses no samples,
// no downloads and no existing songs. Output is deterministic: seeded PRNG, and ffmpeg runs with
// bit-exact muxing.
//
//   node games/dash-overdrive/classic/music/music.mjs                render everything, then verify
//   node games/dash-overdrive/classic/music/music.mjs --only=0,7,menu,practice,sfx
//   node games/dash-overdrive/classic/music/music.mjs --check        verify the existing files only
//
// Outputs (paths relative to the repo root):
//   public/play/dash-overdrive/classic/music/0.ogg … 14.ogg      level songs (file index = level - 1)
//   games/dash-overdrive/classic/res/sfx/menuLoop.ogg, practice.ogg   seamless loops
//   games/dash-overdrive/classic/res/sfx/deathSound.ogg, levelComplete.ogg, playSound.ogg
//   games/dash-overdrive/classic/music/timeline.json             song sections in beats (beat 0 = 0 s)
//
// Sync rules: beat 0 of the grid is sample 0, the tempo never changes, and every level song starts
// with a kick on sample 0. Needs ffmpeg with libvorbis (FFMPEG env var, Homebrew or PATH).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SR = 48000;
const TAU = 2 * Math.PI;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../..');
const OUT_MUSIC = path.join(ROOT, 'public/play/dash-overdrive/classic/music');
const OUT_SFX = path.join(ROOT, 'games/dash-overdrive/classic/res/sfx');
const OUT_TIMELINE = path.join(HERE, 'timeline.json');
const tool = (env, name) => process.env[env]
  || ['/opt/homebrew/bin/', '/usr/local/bin/', '/usr/bin/'].map(d => d + name).find(p => fs.existsSync(p))
  || name;
const FFMPEG = tool('FFMPEG', 'ffmpeg');
const FFPROBE = tool('FFPROBE', 'ffprobe');

// ------------------------------------------------------------------ helpers
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const mtof = m => 440 * 2 ** ((m - 69) / 12);
const dbg = d => 10 ** (d / 20);
const panL = p => Math.cos((clamp(p, -1, 1) + 1) * Math.PI / 4) * Math.SQRT2;
const panR = p => Math.sin((clamp(p, -1, 1) + 1) * Math.PI / 4) * Math.SQRT2;
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let RND = rng(1);
const seedAll = s => { RND = rng(s); };
function noiseGen(seed) {
  let x = Math.imul(seed | 0, 2654435761) >>> 0 || 0x9e3779b9;
  return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 2147483648 - 1; };
}
// Smooth saturator (rational tanh), output limited to ±1.
function sclip(x) {
  if (x >= 3) return 1;
  if (x <= -3) return -1;
  const x2 = x * x;
  return x * (27 + x2) / (27 + 9 * x2);
}
// PolyBLEP residual for band-limited saw and pulse edges.
function blep(t, dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}
// Topology-preserving state-variable filter (Zavalishin); after run(): .lp .bp .hp
class SVF {
  constructor(fc, q = 0.707) { this.s1 = 0; this.s2 = 0; this.lp = 0; this.bp = 0; this.hp = 0; this.set(fc, q); }
  set(fc, q = this.q) {
    this.q = q;
    const g = Math.tan(Math.PI * clamp(fc, 10, SR * 0.45) / SR);
    this.k = 1 / q; this.a1 = 1 / (1 + g * (g + this.k)); this.a2 = g * this.a1; this.a3 = g * this.a2;
  }
  run(x) {
    const v3 = x - this.s2, v1 = this.a1 * this.s1 + this.a2 * v3, v2 = this.s2 + this.a2 * this.s1 + this.a3 * v3;
    this.s1 = 2 * v1 - this.s1; this.s2 = 2 * v2 - this.s2;
    this.lp = v2; this.bp = v1; this.hp = x - this.k * v1 - v2;
    return v2;
  }
}
// A mix holds a drum bus (never ducked), a music bus (sidechained), and mono reverb/delay sends.
function makeMix(seconds) {
  const n = Math.round(seconds * SR);
  const f = () => new Float32Array(n);
  return { n, dL: f(), dR: f(), mL: f(), mR: f(), rev: f(), dly: f(), kicks: [] };
}

// ------------------------------------------------------------------ the synth voice
// P (patch): osc [{w: saw|sq|tri|sin|noise|fm, g, oct, det (cents), pw, uni, spr (cents), wid, pan, ratio, idx}],
//   a d s r (ADSR, s), glide (s), legato, reset (phase reset per note), vib {r, d (semitones), dl},
//   pe {a (semitones), d (s)} pitch envelope, fmd/fms (FM index decay / sustain),
//   flt {t: lp|bp|hp, f, q, env (oct), fa, fd, fs, kt, lfo {r (Hz), d (oct), sh: sin|saw, ph}},
//   drive (pre-filter saturation), hp (Hz, output high-pass), gain, pan, rev, dly, tr (semitones), bus 'd'
// notes: [{t (s), d (s), m (MIDI), v (0..1), slide, lfo (Hz)}]; one call = one monophonic line.
const WAVE = { saw: 0, sq: 1, tri: 2, sin: 3, noise: 4, fm: 5 };
function play(mx, P, notes, o = {}) {
  notes = notes.filter(q => q.d > 0 && q.t < mx.n / SR).sort((a, b) => a.t - b.t);
  if (!notes.length) return;
  const toDrum = (o.bus ?? P.bus) === 'd';
  const BL = toDrum ? mx.dL : mx.mL, BR = toDrum ? mx.dR : mx.mR, RV = mx.rev, DL = mx.dly;
  const gain = (P.gain ?? 0.2) * (o.gain ?? 1);
  const pan = clamp((P.pan ?? 0) + (o.pan ?? 0), -1, 1);
  const pl = panL(pan) * gain, pr = panR(pan) * gain;
  const sRev = (o.rev ?? P.rev ?? 0) * gain * 0.5, sDly = (o.dly ?? P.dly ?? 0) * gain * 0.5;
  const tr = (P.tr ?? 0) + (o.tr ?? 0);
  const W = [], MU = [], PW = [], GL = [], GR = [], RA = [], IX = [];
  for (const s of P.osc) {
    const uni = s.uni ?? 1, spr = s.spr ?? 0, wid = s.wid ?? 0.7, g = (s.g ?? 1) / Math.sqrt(uni);
    for (let k = 0; k < uni; k++) {
      const x = uni === 1 ? 0 : (2 * k) / (uni - 1) - 1;
      const p = clamp((s.pan ?? 0) + x * wid, -1, 1);
      W.push(WAVE[s.w]); MU.push(2 ** ((s.oct ?? 0) + ((s.det ?? 0) + x * spr) / 1200));
      PW.push(s.pw ?? 0.5); GL.push(panL(p) * g); GR.push(panR(p) * g); RA.push(s.ratio ?? 1); IX.push(s.idx ?? 0);
    }
  }
  const U = W.length, PH = new Float64Array(U), MP = new Float64Array(U);
  for (let u = 0; u < U; u++) PH[u] = U > 1 && W[u] !== 3 && W[u] !== 5 ? RND() : 0;
  const A = Math.max(0.0005, P.a ?? 0.002), D = Math.max(0.002, P.d ?? 0.2), S = P.s ?? 0.7, R = Math.max(0.004, P.r ?? 0.06);
  const aInc = 1 / (A * SR), dCo = Math.exp(-3 / (D * SR)), rCo = Math.exp(-6.9 / (R * SR));
  const F = P.flt, ft = F ? (F.t === 'bp' ? 1 : F.t === 'hp' ? 2 : 0) : -1, fk = F ? 1 / (F.q ?? 0.707) : 0;
  const fA = F ? 1 / (Math.max(0.0005, F.fa ?? 0.001) * SR) : 0;
  const fDco = F ? Math.exp(-3 / (Math.max(0.002, F.fd ?? 0.3) * SR)) : 0, fS = F?.fs ?? 0, lfo = F?.lfo;
  const fmCo = Math.exp(-1 / (Math.max(0.002, P.fmd ?? 0.3) * SR)), fmS = P.fms ?? 0;
  const gCo = Math.exp(-3 / (Math.max(0.004, P.glide ?? 0.06) * SR)), glideOn = !!P.glide;
  const hpC = P.hp ? 1 - Math.exp(-TAU * P.hp / SR) : 0;
  const drv = P.drive ?? 0, drvN = drv ? 1 / sclip(drv) : 1, vib = P.vib, pe = P.pe;
  const peCo = pe ? Math.exp(-1 / (pe.d * SR)) : 0;
  const NS = notes.map(q => Math.round(q.t * SR)), NE = notes.map(q => Math.round((q.t + q.d) * SR)), nN = notes.length;
  let ni = -1, env = 0, stage = 0, fenv = 0, fst = 0, fe = 1, pev = 0, tn = 0, cu = 0;
  let cur = notes[0].m + tr, tgt = cur, vel = 1, f = mtof(cur), lph = 0, lrate = lfo?.r ?? 0;
  let a1 = 0, a2 = 0, a3 = 0, l1 = 0, l2 = 0, r1 = 0, r2 = 0, hl = 0, hr = 0;
  let nz = Math.imul(NS[0] + 1, 2654435761) | 1;
  const end = Math.min(mx.n, NE[nN - 1] + Math.round(R * SR) + 2);
  for (let i = Math.max(0, NS[0]); i < end; i++) {
    while (ni + 1 < nN && i >= NS[ni + 1]) {
      ni++;
      const q = notes[ni];
      const leg = P.legato && ni > 0 && NS[ni] <= NE[ni - 1] + 1 && (stage === 1 || stage === 2);
      tgt = q.m + tr; vel = q.v ?? 1;
      if (q.lfo) lrate = q.lfo;
      if (!((leg && glideOn) || q.slide)) cur = tgt;
      if (!leg) {
        stage = 1; tn = 0; fst = 1; fe = 1; pev = 1; cu = 0;
        if (lfo && lfo.reset !== false) lph = lfo.ph ?? 0;
        if (P.reset) { PH.fill(0); MP.fill(0); }
      }
    }
    if (ni < 0) continue;
    if ((stage === 1 || stage === 2) && i >= NE[ni] && !(P.legato && ni + 1 < nN && NS[ni + 1] <= NE[ni] + 1)) { stage = 3; fst = 3; }
    if (stage === 1) { env += aInc; if (env >= 1) { env = 1; stage = 2; } }
    else if (stage === 2) env = S + (env - S) * dCo;
    else if (stage === 3) { env *= rCo; if (env < 1e-4) { env = 0; stage = 0; } }
    if (stage === 0) { if (ni + 1 < nN) { i = NS[ni + 1] - 1; continue; } break; }
    if (cur !== tgt) { cur = tgt + (cur - tgt) * gCo; if (Math.abs(cur - tgt) < 1e-3) cur = tgt; }
    if ((i & 3) === 0 || tn === 0) {
      let m = cur;
      if (vib) { const tv = tn / SR - (vib.dl ?? 0.15); if (tv > 0) m += vib.d * Math.min(1, tv * 4) * Math.sin(TAU * vib.r * tv); }
      if (pe) m += pe.a * pev;
      f = 440 * Math.pow(2, (m - 69) / 12);
    }
    if (pe) pev *= peCo;
    tn++;
    fe *= fmCo;
    const fmI = fmS + (1 - fmS) * fe, fi = f / SR;
    let sL = 0, sR = 0;
    for (let u = 0; u < U; u++) {
      const dt = fi * MU[u];
      let p = PH[u] + dt; if (p >= 1) p -= Math.floor(p); PH[u] = p;
      let s;
      switch (W[u]) {
        case 0: s = 2 * p - 1 - blep(p, dt); break;
        case 1: { const w = PW[u]; let q = p - w; if (q < 0) q += 1; s = (p < w ? 1 : -1) + blep(p, dt) - blep(q, dt) - (2 * w - 1); break; }
        case 2: s = 4 * Math.abs(p - 0.5) - 1; break;
        case 3: s = Math.sin(TAU * p); break;
        case 4: nz ^= nz << 13; nz ^= nz >>> 17; nz ^= nz << 5; s = (nz >>> 0) / 2147483648 - 1; break;
        default: { let mp = MP[u] + dt * RA[u]; if (mp >= 1) mp -= Math.floor(mp); MP[u] = mp; s = Math.sin(TAU * (p + IX[u] * fmI * Math.sin(TAU * mp))); }
      }
      sL += s * GL[u]; sR += s * GR[u];
    }
    if (drv) { sL = sclip(sL * drv) * drvN; sR = sclip(sR * drv) * drvN; }
    if (ft >= 0) {
      if (fst === 1) { fenv += fA; if (fenv >= 1) { fenv = 1; fst = 2; } }
      else if (fst === 2) fenv = fS + (fenv - fS) * fDco;
      else fenv *= rCo;
      if (lfo) { lph += lrate / SR; if (lph >= 1) lph -= 1; }
      if (--cu <= 0) {
        cu = 16;
        let oc = (F.env ?? 0) * fenv + (F.kt ? F.kt * (cur - 60) / 12 : 0);
        if (lfo) oc += lfo.d * (lfo.sh === 'saw' ? 1 - lph : 0.5 - 0.5 * Math.cos(TAU * lph));
        const g = Math.tan(Math.PI * clamp(F.f * 2 ** oc, 15, SR * 0.45) / SR);
        a1 = 1 / (1 + g * (g + fk)); a2 = g * a1; a3 = g * a2;
      }
      let v3 = sL - l2, v1 = a1 * l1 + a2 * v3, v2 = l2 + a2 * l1 + a3 * v3; l1 = 2 * v1 - l1; l2 = 2 * v2 - l2;
      sL = ft === 0 ? v2 : ft === 1 ? v1 : sL - fk * v1 - v2;
      v3 = sR - r2; v1 = a1 * r1 + a2 * v3; v2 = r2 + a2 * r1 + a3 * v3; r1 = 2 * v1 - r1; r2 = 2 * v2 - r2;
      sR = ft === 0 ? v2 : ft === 1 ? v1 : sR - fk * v1 - v2;
    }
    const a = env * vel;
    let yL = sL * a, yR = sR * a;
    if (hpC) { hl += (yL - hl) * hpC; yL -= hl; hr += (yR - hr) * hpC; yR -= hr; }
    BL[i] += yL * pl; BR[i] += yR * pr;
    if (sRev) RV[i] += (yL + yR) * sRev;
    if (sDly) DL[i] += (yL + yR) * sDly;
  }
}
// Polyphonic: every note is its own voice (overlapping releases).
function poly(mx, P, notes, o) { for (const q of notes) play(mx, P, [q], o); }

// ------------------------------------------------------------------ drums and effects (all synthesized)
// Kick: sine with pitch and amplitude envelopes, a short noise click, soft saturation.
function kick(mx, t, o = {}) {
  const v = (o.v ?? 1) * (o.g ?? 0.85), n0 = Math.round(t * SR);
  if (n0 < 0 || n0 >= mx.n || v <= 0) return;
  const f0 = o.f0 ?? 170, f1 = o.f1 ?? 48, hold = o.hold ?? 0.012, dec = o.dec ?? 0.26, drv = o.drive ?? 1.4, click = o.click ?? 0.35;
  const N = Math.min(Math.round((o.len ?? Math.min(1.2, hold + dec * 5)) * SR), mx.n - n0);
  const nz = noiseGen(n0 + 11), dn = 1 / sclip(drv), lpC = o.lp ? 1 - Math.exp(-TAU * o.lp / SR) : 0;
  const pCo = Math.exp(-1 / ((o.pd ?? 0.03) * SR)), aCo = Math.exp(-1 / (dec * SR)), cCo = Math.exp(-1 / (0.0016 * SR)), hN = Math.round(hold * SR);
  let ph = 0.25, pe = 1, ae = 1, z = 0, cl = 1, lp = 0;
  for (let i = 0; i < N; i++) {
    const f = f1 + (f0 - f1) * pe; pe *= pCo;
    ph += f / SR; if (ph >= 1) ph -= 1;
    let a = i < hN ? 1 : (ae *= aCo);
    if (i < 20) a *= i / 20;
    if (i > N - 240) a *= (N - i) / 240;
    let s = Math.sin(TAU * ph) * a;
    z += (nz() - z) * 0.5; s += z * cl * click * Math.min(1, i / 8); cl *= cCo;
    s = sclip(s * drv) * dn;
    if (lpC) { lp += (s - lp) * lpC; s = lp; }
    const y = s * v;
    mx.dL[n0 + i] += y; mx.dR[n0 + i] += y;
    if (o.rev) mx.rev[n0 + i] += y * o.rev;
  }
  if (!o.nosc) mx.kicks.push(t);
}
// Generic drum: tone part (sine with pitch drop, optional 2nd partial) plus a filtered noise/metal part.
// Covers snares, claps (bursts), hats, cymbals (wide), shakers, toms, congas, darbuka, rims.
const METAL = [205.3, 304.4, 369.6, 522.7, 540.0, 800.0];
function burstEnv(t, B, nd) {
  let e = 0;
  for (let j = 0; j < B.length; j++) { const d = t - B[j]; if (d >= 0) e = j === B.length - 1 ? Math.max(e, Math.exp(-d / nd)) : Math.max(e, Math.exp(-d / 0.0045)); }
  return e;
}
function drum(mx, t, o) {
  const v = (o.v ?? 1) * (o.g ?? 0.4), n0 = Math.round(t * SR);
  if (n0 < 0 || n0 >= mx.n || v <= 0) return;
  const td = o.td ?? 0.05, nd = o.nd ?? 0.1;
  const len = o.len ?? Math.max(o.tone ? td : 0, (o.noise || o.metal) ? nd : 0) * 7 + 0.004;
  const N = Math.min(Math.round(len * SR), mx.n - n0), chans = o.wide ? 2 : 1;
  const pl = panL(o.pan ?? 0) * v, pr = panR(o.pan ?? 0) * v;
  const tCo = Math.exp(-1 / (td * SR)), nCo = Math.exp(-1 / (nd * SR)), pCo = Math.exp(-1 / ((o.pd ?? 0.02) * SR));
  const att = Math.max(1, Math.round((o.att ?? 0.0003) * SR)), B = o.bursts;
  const bus = o.bus === 'm' ? [mx.mL, mx.mR] : [mx.dL, mx.dR];
  for (let c = 0; c < chans; c++) {
    const nz = noiseGen(n0 * 31 + c * 7 + (o.seed ?? 3));
    const hp = o.hp ? new SVF(o.hp, o.hq ?? 0.7) : null, bp = o.bp ? new SVF(o.bp, o.bq ?? 1.2) : null, lp = o.lp ? new SVF(o.lp, o.lq ?? 0.7) : null;
    const mph = new Float64Array(6), mf = (o.mf ?? 1) * (1 + c * 0.013);
    for (let k = 0; k < 6; k++) mph[k] = (k * 0.37 + c * 0.11) % 1;
    let ph = 0.25, ph2 = 0, te = 1, ne = 1, pe = 1;
    const out = c === 0 ? bus[0] : bus[1];
    for (let i = 0; i < N; i++) {
      let y = 0;
      if (o.tone) {
        const f = o.f * (1 + (o.pa ?? 0) * pe); pe *= pCo;
        ph += f / SR; if (ph >= 1) ph -= 1;
        let s = Math.sin(TAU * ph);
        if (o.t2) { ph2 += f * (o.r2 ?? 1.48) / SR; if (ph2 >= 1) ph2 -= 1; s += o.t2 * Math.sin(TAU * ph2); }
        y += o.tone * te * s; te *= tCo;
      }
      let w = 0;
      if (o.noise) w += o.noise * nz();
      if (o.metal) {
        let m = 0;
        for (let k = 0; k < 6; k++) { mph[k] += METAL[k] * mf / SR; if (mph[k] >= 1) mph[k] -= 1; m += mph[k] < 0.5 ? 1 : -1; }
        w += o.metal * m / 4;
      }
      if (o.noise || o.metal) {
        if (hp) { hp.run(w); w = hp.hp; }
        if (bp) { bp.run(w); w = bp.bp; }
        if (lp) w = lp.run(w);
        y += w * (B ? burstEnv(i / SR, B, nd) : ne); ne *= nCo;
      }
      if (i < att) y *= i / att;
      if (i > N - 64) y *= (N - i) / 64;
      if (o.drive) y = sclip(y * o.drive);
      const k = n0 + i;
      if (chans === 1) { bus[0][k] += y * pl; bus[1][k] += y * pr; } else out[k] += y * v;
      if (o.rev) mx.rev[k] += y * v * o.rev / chans;
      if (o.dly) mx.dly[k] += y * v * o.dly / chans;
    }
  }
}
// FM metal clang (anvil / factory hits).
function clang(mx, t, o = {}) {
  const v = (o.v ?? 1) * (o.g ?? 0.2), n0 = Math.round(t * SR);
  if (n0 < 0 || n0 >= mx.n || v <= 0) return;
  const f = o.f ?? 420, dec = o.dec ?? 0.3, N = Math.min(Math.round(dec * 6 * SR), mx.n - n0);
  const r1 = o.r1 ?? 1.414, r2 = o.r2 ?? 2.76, I = o.idx ?? 4, nz = noiseGen(n0 + 77), hp = new SVF(o.hp ?? 300, 0.7);
  const pl = panL(o.pan ?? 0) * v, pr = panR(o.pan ?? 0) * v;
  const eCo = Math.exp(-1 / (dec * SR)), iCo = Math.exp(-1 / (dec * 0.35 * SR)), nCo = Math.exp(-1 / (0.008 * SR));
  let pc = 0, p1 = 0, p2 = 0, e = 1, ie = 1, ne = 1;
  for (let i = 0; i < N; i++) {
    p1 += f * r1 / SR; p2 += f * r2 / SR; pc += f / SR;
    let y = Math.sin(TAU * (pc + I * ie * (0.6 * Math.sin(TAU * p1) + 0.4 * Math.sin(TAU * p2)))) * e + nz() * ne * 0.5;
    e *= eCo; ie *= iCo; ne *= nCo;
    hp.run(y); y = hp.hp;
    if (o.drive) y = sclip(y * o.drive);
    if (i < 12) y *= i / 12;
    if (i > N - 64) y *= (N - i) / 64;
    mx.dL[n0 + i] += y * pl; mx.dR[n0 + i] += y * pr;
    if (o.rev) mx.rev[n0 + i] += y * v * o.rev;
    if (o.dly) mx.dly[n0 + i] += y * v * o.dly;
  }
}
// 8-bit style LFSR noise drum with stepped volume (chiptune hats and snares).
function chip(mx, t, o = {}) {
  const v = (o.v ?? 1) * (o.g ?? 0.25), n0 = Math.round(t * SR);
  if (n0 < 0 || n0 >= mx.n || v <= 0) return;
  const dec = o.dec ?? 0.06, N = Math.min(Math.round(dec * 5 * SR), mx.n - n0), short = o.short ? 6 : 1;
  const eCo = Math.exp(-1 / (dec * SR)), lp = new SVF(o.lp ?? 11000, 0.7), pl = panL(o.pan ?? 0) * v, pr = panR(o.pan ?? 0) * v;
  let lfsr = 0x4a31, acc = 0, out = 1, e = 1, rate = o.rate ?? 12000;
  const rCo = o.sweep ? Math.exp(-1 / (o.sweep * SR)) : 1, rMin = o.rmin ?? 800;
  for (let i = 0; i < N; i++) {
    acc += rate / SR; rate = rMin + (rate - rMin) * rCo;
    while (acc >= 1) { acc -= 1; const bit = (lfsr ^ (lfsr >> short)) & 1; lfsr = (lfsr >> 1) | (bit << 14); out = (lfsr & 1) ? 1 : -1; }
    let y = lp.run(out * Math.ceil(e * 15) / 15); e *= eCo;
    if (i < 8) y *= i / 8;
    if (i > N - 48) y *= (N - i) / 48;
    mx.dL[n0 + i] += y * pl; mx.dR[n0 + i] += y * pr;
    if (o.dly) mx.dly[n0 + i] += y * v * o.dly;
  }
}
// Laser zap: band-limited saw or pulse with an exponential pitch sweep.
function zap(mx, t, o = {}) {
  const v = (o.v ?? 1) * (o.g ?? 0.1), n0 = Math.round(t * SR);
  if (n0 < 0 || n0 >= mx.n || v <= 0) return;
  const d = o.d ?? 0.16, N = Math.min(Math.round(d * SR), mx.n - n0), f0 = o.f0 ?? 2600, f1 = o.f1 ?? 160, sq = o.sq ?? true;
  const pl = panL(o.pan ?? 0) * v, pr = panR(o.pan ?? 0) * v, k = Math.log(f1 / f0) / N, lp = new SVF(o.lp ?? 7000, 0.8);
  let ph = 0;
  for (let i = 0; i < N; i++) {
    const f = f0 * Math.exp(k * i), dt = f / SR;
    ph += dt; if (ph >= 1) ph -= 1;
    let s;
    if (sq) { let q = ph - 0.5; if (q < 0) q += 1; s = (ph < 0.5 ? 1 : -1) + blep(ph, dt) - blep(q, dt); } else s = 2 * ph - 1 - blep(ph, dt);
    const x = i / N;
    let y = lp.run(s) * (1 - x) * (1 - x);
    if (i < 24) y *= i / 24;
    mx.dL[n0 + i] += y * pl; mx.dR[n0 + i] += y * pr;
    mx.dly[n0 + i] += y * v * (o.dly ?? 0.5);
    mx.rev[n0 + i] += y * v * (o.rev ?? 0.2);
  }
}
// Noise riser (band-pass sweep up, swelling), ends exactly at t1 (or falls if f1 < f0).
function riser(mx, t0, t1, o = {}) {
  const n0 = Math.max(0, Math.round(t0 * SR)), n1 = Math.min(mx.n, Math.round(t1 * SR)), N = n1 - n0;
  if (N <= 0) return;
  const g = o.g ?? 0.1, f0 = o.f0 ?? 250, f1 = o.f1 ?? 9000, q = o.q ?? 1.6, fall = f1 < f0, pw = o.pow ?? 2;
  for (let c = 0; c < 2; c++) {
    const nz = noiseGen(n0 * 3 + c + 5), bp = new SVF(f0, q), out = c ? mx.dR : mx.dL;
    for (let i = 0; i < N; i++) {
      const x = i / N;
      if ((i & 31) === 0) bp.set(f0 * (f1 / f0) ** x, q);
      bp.run(nz());
      let e = fall ? (1 - x) ** pw : x ** pw;
      if (i > N - 240 && !fall) e *= (N - i) / 240;
      if (i < 240 && fall) e *= i / 240;
      const y = bp.bp * e * g;
      out[n0 + i] += y;
      mx.rev[n0 + i] += y * (o.rev ?? 0.3) * 0.5;
    }
  }
}
// Reverse cymbal swell that ends at t1.
function revCym(mx, t1, len, o = {}) {
  const n1 = Math.min(mx.n, Math.round(t1 * SR)), N = Math.round(len * SR), n0 = n1 - N;
  if (n0 < 0) return;
  const g = o.g ?? 0.12;
  for (let c = 0; c < 2; c++) {
    const nz = noiseGen(n1 * 5 + c), hp = new SVF(5200, 0.7), out = c ? mx.dR : mx.dL;
    const mph = new Float64Array(6);
    for (let i = 0; i < N; i++) {
      let m = 0;
      for (let k = 0; k < 6; k++) { mph[k] += METAL[k] * 1.7 / SR; if (mph[k] >= 1) mph[k] -= 1; m += mph[k] < 0.5 ? 1 : -1; }
      hp.run(nz() * 0.7 + m * 0.12);
      let e = Math.exp((i - N) / (0.28 * SR));
      if (i > N - 96) e *= (N - i) / 96;
      out[n0 + i] += hp.hp * e * g;
    }
  }
}
// Downbeat impact: sub boom plus dark noise burst.
function impact(mx, t, o = {}) {
  const n0 = Math.round(t * SR);
  if (n0 < 0 || n0 >= mx.n) return;
  const g = o.g ?? 0.4, N = Math.min(Math.round(2.0 * SR), mx.n - n0), nz = noiseGen(n0 + 99), lp = new SVF(o.lp ?? 900, 0.7);
  const pCo = Math.exp(-1 / (0.09 * SR)), aCo = Math.exp(-1 / ((o.dec ?? 0.55) * SR)), nCo = Math.exp(-1 / (0.35 * SR));
  let ph = 0.25, pe = 1, ae = 1, ne = 1;
  for (let i = 0; i < N; i++) {
    const f = (o.f1 ?? 34) + ((o.f0 ?? 90) - (o.f1 ?? 34)) * pe; pe *= pCo;
    ph += f / SR; if (ph >= 1) ph -= 1;
    let y = Math.sin(TAU * ph) * ae + lp.run(nz()) * ne * 0.5;
    ae *= aCo; ne *= nCo;
    if (i < 24) y *= i / 24;
    if (i > N - 480) y *= (N - i) / 480;
    y = sclip(y * 1.2) * g;
    mx.dL[n0 + i] += y; mx.dR[n0 + i] += y;
    mx.rev[n0 + i] += y * 0.25;
  }
}

// ------------------------------------------------------------------ mix processing
// 8-line feedback-delay-network reverb (Hadamard mixing, damped lines, input diffusion).
function reverb(inp, outL, outR, n, o = {}) {
  const size = o.size ?? 1, rt = o.rt ?? 1.8, wet = o.wet ?? 0.5;
  const lens = [1153, 1361, 1559, 1787, 1949, 2207, 2441, 2683].map(x => Math.round(x * size));
  const bufs = lens.map(L => new Float32Array(L)), idx = new Int32Array(8);
  const g = lens.map(L => 10 ** (-3 * L / (rt * SR))), dc = 1 - Math.exp(-TAU * (o.damp ?? 6000) / SR);
  const lps = new Float64Array(8), y = new Float64Array(8);
  const pre = Math.max(1, Math.round((o.pre ?? 0.012) * SR)), pbuf = new Float32Array(pre);
  const apB = [142, 379, 107, 277].map(x => new Float32Array(Math.round(x * size))), apI = new Int32Array(4);
  const hpC = 1 - Math.exp(-TAU * (o.hp ?? 200) / SR), s8 = 0.35355339059327373;
  let pi = 0, hz = 0;
  for (let i = 0; i < n; i++) {
    let x = pbuf[pi]; pbuf[pi] = inp[i]; if (++pi === pre) pi = 0;
    hz += (x - hz) * hpC; x -= hz;
    for (let a = 0; a < 4; a++) { const B = apB[a], j = apI[a], d = B[j], w = x + 0.6 * d; B[j] = w; x = d - 0.6 * w; apI[a] = j + 1 === B.length ? 0 : j + 1; }
    for (let k = 0; k < 8; k++) { lps[k] += (bufs[k][idx[k]] - lps[k]) * dc; y[k] = lps[k]; }
    const a0 = y[0] + y[1], a1 = y[0] - y[1], a2 = y[2] + y[3], a3 = y[2] - y[3], a4 = y[4] + y[5], a5 = y[4] - y[5], a6 = y[6] + y[7], a7 = y[6] - y[7];
    const b0 = a0 + a2, b1 = a1 + a3, b2 = a0 - a2, b3 = a1 - a3, b4 = a4 + a6, b5 = a5 + a7, b6 = a4 - a6, b7 = a5 - a7;
    const h = [b0 + b4, b1 + b5, b2 + b6, b3 + b7, b0 - b4, b1 - b5, b2 - b6, b3 - b7];
    for (let k = 0; k < 8; k++) {
      const B = bufs[k];
      B[idx[k]] = x * (k & 1 ? -0.3 : 0.3) + h[k] * s8 * g[k];
      if (++idx[k] === B.length) idx[k] = 0;
    }
    outL[i] += (y[0] - y[2] + y[4] - y[6]) * wet;
    outR[i] += (y[1] - y[3] + y[5] - y[7]) * wet;
  }
}
// Ping-pong delay with damped feedback.
function delay(inp, outL, outR, n, o = {}) {
  const D = Math.max(1, Math.round(o.time * SR)), fb = o.fb ?? 0.35, wet = o.wet ?? 0.5;
  const bL = new Float32Array(D), bR = new Float32Array(D);
  const lc = 1 - Math.exp(-TAU * (o.lp ?? 5000) / SR), hc = 1 - Math.exp(-TAU * (o.hp ?? 280) / SR);
  let j = 0, lL = 0, lR = 0, h = 0;
  for (let i = 0; i < n; i++) {
    let x = inp[i]; h += (x - h) * hc; x -= h;
    lL += (bL[j] - lL) * lc; lR += (bR[j] - lR) * lc;
    bL[j] = x + lR * fb; bR[j] = lL * fb;
    if (++j === D) j = 0;
    outL[i] += lL * wet; outR[i] += lR * wet;
  }
}
// Kick-triggered ducking of the music bus (raised-cosine release). wrap = loop length in samples.
function sidechain(L, R, n, kicks, o = {}) {
  const depth = o.depth ?? 0.5, rel = Math.max(1, Math.round((o.rel ?? 0.25) * SR)), att = Math.round(0.003 * SR);
  const g = new Float32Array(n).fill(1);
  const ks = o.wrap ? kicks.flatMap(k => [k, k + o.wrap / SR]) : kicks;
  for (const tk of ks) {
    const k0 = Math.round(tk * SR);
    for (let i = Math.max(0, k0 - att); i < Math.min(n, k0 + rel); i++) {
      const sh = i < k0 ? (i - (k0 - att)) / att : 0.5 + 0.5 * Math.cos(Math.PI * (i - k0) / rel);
      const v = 1 - depth * sh;
      if (v < g[i]) g[i] = v;
    }
  }
  for (let i = 0; i < n; i++) { L[i] *= g[i]; R[i] *= g[i]; }
}
// Filter sweep on a bus between t0 and t1 with short crossfades at the edges.
function sweep(L, R, n, s) {
  const n0 = Math.max(0, Math.round(s.t0 * SR)), n1 = Math.min(n, Math.round(s.t1 * SR)), N = n1 - n0;
  if (N <= 0) return;
  const q = s.q ?? 0.75, fl = new SVF(s.f0, q), fr = new SVF(s.f0, q), X = Math.round(0.008 * SR), hp = s.type === 'hp';
  for (let i = n0; i < n1; i++) {
    const x = (i - n0) / N;
    if (((i - n0) & 31) === 0) { const fc = s.f0 * (s.f1 / s.f0) ** (x ** (s.curve ?? 1)); fl.set(fc, q); fr.set(fc, q); }
    fl.run(L[i]); fr.run(R[i]);
    let e = 1;
    if (s.xin !== false) e = Math.min(e, (i - n0) / X);
    if (s.xout !== false) e = Math.min(e, (n1 - 1 - i) / X);
    e = clamp(e, 0, 1);
    L[i] += ((hp ? fl.hp : fl.lp) - L[i]) * e;
    R[i] += ((hp ? fr.hp : fr.lp) - R[i]) * e;
  }
}
// Mute a bus between t0 and t1 (pre-drop stops) with short ramps.
function mute(L, R, n, t0, t1, floor = 0) {
  const n0 = Math.max(0, Math.round(t0 * SR)), n1 = Math.min(n, Math.round(t1 * SR)), F = Math.round(0.012 * SR), Fi = Math.round(0.002 * SR);
  for (let i = n0; i < n1; i++) {
    const a = Math.min(1, (i - n0) / F), b = Math.min(1, (n1 - i) / Fi), g = 1 - (1 - floor) * Math.min(a, b);
    L[i] *= g; R[i] *= g;
  }
}
// ITU-R BS.1770 integrated loudness (48 kHz K-weighting, 400 ms blocks, gated).
function kLoud(L, R, n) {
  const hop = SR / 10, nb = Math.floor(n / hop), sums = new Float64Array(nb + 1);
  for (const X of [L, R]) {
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0, w1 = 0, w2 = 0, v1 = 0, v2 = 0;
    for (let i = 0; i < n; i++) {
      const x = X[i];
      const y = 1.53512485958697 * x - 2.69169618940638 * x1 + 1.19839281085285 * x2 + 1.69065929318241 * y1 - 0.73248077421585 * y2;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
      const v = y - 2 * w1 + w2 + 1.99004745483398 * v1 - 0.99007225036621 * v2;
      w2 = w1; w1 = y; v2 = v1; v1 = v;
      sums[(i / hop) | 0] += v * v;
    }
  }
  const blocks = [];
  for (let j = 0; j + 4 <= nb; j++) blocks.push((sums[j] + sums[j + 1] + sums[j + 2] + sums[j + 3]) / (4 * hop));
  const lk = z => -0.691 + 10 * Math.log10(z + 1e-30);
  const abs = blocks.filter(z => lk(z) > -70);
  if (!abs.length) return -70;
  const rel = lk(abs.reduce((a, b) => a + b, 0) / abs.length) - 10;
  const g = abs.filter(z => lk(z) > rel);
  return lk(g.reduce((a, b) => a + b, 0) / g.length);
}
// Look-ahead peak limiter: windowed-minimum gain, instant attack, smooth release, box smoothing.
// circular=true treats the buffer as a loop (used for seamless loop files).
function limiter(L, R, n, ceil, o = {}) {
  const la = Math.round((o.la ?? 0.0015) * SR), relCo = Math.exp(-1 / ((o.rel ?? 0.09) * SR));
  const M = o.circular ? Math.min(n, Math.round(1.0 * SR)) : 0, T = n + 2 * M;
  const at = i => (o.circular ? (i - M + n) % n : i);
  const gt = new Float32Array(T);
  for (let i = 0; i < T; i++) { const k = at(i), p = Math.max(Math.abs(L[k]), Math.abs(R[k])); gt[i] = p > ceil ? ceil / p : 1; }
  const wm = new Float32Array(T), dq = new Int32Array(T);
  let h = 0, tl = 0;
  for (let i = T - 1; i >= 0; i--) {
    while (tl > h && gt[dq[tl - 1]] >= gt[i]) tl--;
    dq[tl++] = i;
    while (dq[h] > i + la) h++;
    wm[i] = gt[dq[h]];
  }
  let g = 1;
  for (let i = 0; i < T; i++) { g = Math.min(wm[i], 1 - (1 - g) * relCo); wm[i] = g; }
  let acc = la + 1;
  for (let i = 0; i < T; i++) {
    acc += wm[i] - (i > la ? wm[i - la - 1] : 1);
    if (i >= M && i < M + n) { const gg = acc / (la + 1), k = i - M; L[k] *= gg; R[k] *= gg; }
  }
}
// Glitch tools (Black Hole): stutter repeats, tape stop, bit crush.
function stutter(L, R, n, t0, slice, reps, o = {}) {
  const s0 = Math.round(t0 * SR), S = Math.round(slice * SR), F = Math.round(0.0015 * SR);
  if (s0 < 0 || s0 + S * reps > n) return;
  const sL = L.slice(s0, s0 + S), sR = R.slice(s0, s0 + S);
  for (let i = S - F; i < S; i++) { const e = (S - 1 - i) / F; L[s0 + i] *= e; R[s0 + i] *= e; }
  for (let r = 1; r < reps; r++) {
    const b = s0 + r * S, gr = (o.decay ?? 1) ** r, rate = (o.pitch ?? 1) ** r;
    for (let i = 0; i < S; i++) {
      const e = Math.min(1, i / F, (S - 1 - i) / F) * gr, p = i * rate, k = Math.floor(p), fr = p - k;
      const a = k + 1 < S ? (sL[k] * (1 - fr) + sL[k + 1] * fr) : 0, c = k + 1 < S ? (sR[k] * (1 - fr) + sR[k + 1] * fr) : 0;
      L[b + i] = a * e; R[b + i] = c * e;
    }
  }
}
function tapeStop(L, R, n, t0, dur) {
  const s0 = Math.round(t0 * SR), N = Math.round(dur * SR);
  if (s0 < 0 || s0 + N > n) return;
  const sL = L.slice(s0, s0 + N), sR = R.slice(s0, s0 + N);
  let pos = 0;
  for (let i = 0; i < N; i++) {
    const x = i / N, k = Math.floor(pos), fr = pos - k, e = Math.min(1, (N - i) / (0.01 * SR));
    L[s0 + i] = (sL[k] * (1 - fr) + (sL[k + 1] ?? 0) * fr) * e;
    R[s0 + i] = (sR[k] * (1 - fr) + (sR[k + 1] ?? 0) * fr) * e;
    pos += (1 - x) ** 1.6;
  }
}
function crush(L, R, n, t0, t1, bits = 5, hold = 6) {
  const n0 = Math.max(0, Math.round(t0 * SR)), n1 = Math.min(n, Math.round(t1 * SR)), F = Math.round(0.003 * SR), q = 2 ** (bits - 1);
  let hl = 0, hr = 0;
  for (let i = n0; i < n1; i++) {
    if ((i - n0) % hold === 0) { hl = Math.round(L[i] * q) / q; hr = Math.round(R[i] * q) / q; }
    const e = clamp(Math.min((i - n0) / F, (n1 - 1 - i) / F), 0, 1);
    L[i] += (hl - L[i]) * e; R[i] += (hr - R[i]) * e;
  }
}

// ------------------------------------------------------------------ files and ffmpeg
function writeWav(file, L, R, n) {
  const data = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { data[2 * i] = L[i]; data[2 * i + 1] = R[i]; }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + n * 8, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(3, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * 8, 28); h.writeUInt16LE(8, 32); h.writeUInt16LE(32, 34); h.write('data', 36); h.writeUInt32LE(n * 8, 40);
  fs.writeFileSync(file, Buffer.concat([h, Buffer.from(data.buffer)]));
}
function ff(args, bin = FFMPEG) {
  const r = spawnSync(bin, ['-hide_banner', '-nostdin', ...args], { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`${path.basename(bin)} failed: ${(r.stderr || '').slice(-2000)}`);
  return r.stderr;
}
const lastJson = s => JSON.parse(s.slice(s.lastIndexOf('{'), s.lastIndexOf('}') + 1));
// Two-pass ffmpeg loudnorm in linear mode (pure gain, so loops stay seamless), then Vorbis.
// If linear mode is impossible, falls back to the largest plain gain that respects the peak target.
function encode(wav, out, o = {}) {
  const I = o.I ?? -15, TP = o.TP ?? -1.5, maxBytes = o.maxBytes ?? 1100000;
  const m = lastJson(ff(['-i', wav, '-af', `loudnorm=I=${I}:TP=${TP}:LRA=20:print_format=json`, '-f', 'null', '-']));
  const lin = `loudnorm=I=${I}:TP=${TP}:LRA=20:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true:print_format=json`;
  const canLinear = +m.input_tp + (I - +m.input_i) <= TP && +m.input_lra <= 20;
  const gainDb = canLinear ? I - +m.input_i : Math.min(I - +m.input_i, TP - +m.input_tp - 0.1);
  const af = canLinear ? lin : `volume=${gainDb.toFixed(2)}dB`;
  if (!Number.isFinite(gainDb)) throw new Error(`loudnorm measurement unusable for ${wav}: ${JSON.stringify(m)}`);
  let size = 0, q = 0;
  for (q of o.qs ?? [2, 1.5, 1, 0.5, 0]) {
    ff(['-y', '-i', wav, '-af', af, '-ar', String(SR), '-ac', '2', '-c:a', 'libvorbis', '-q:a', String(q),
      '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', out]);
    size = fs.statSync(out).size;
    if (size <= maxBytes) break;
  }
  return { mode: canLinear ? 'loudnorm-linear' : 'gain', gainDb: +gainDb.toFixed(2), q, size };
}

// ------------------------------------------------------------------ sound effects
function whoosh(mx, t0, dur, o = {}) {
  const n0 = Math.round(t0 * SR), N = Math.min(Math.round(dur * SR), mx.n - n0), f0 = o.f0 ?? 400, f1 = o.f1 ?? 6000, g = o.g ?? 0.3;
  for (let c = 0; c < 2; c++) {
    const nz = noiseGen(n0 + 41 + c), bp = new SVF(f0, o.q ?? 1.3), out = c ? mx.dR : mx.dL;
    for (let i = 0; i < N; i++) {
      const x = i / N;
      if ((i & 15) === 0) bp.set(f0 * (f1 / f0) ** (x ** 0.8), o.q ?? 1.3);
      bp.run(nz());
      const e = Math.sin(Math.PI * Math.min(1, x * 1.15)) ** 1.4 * (x < 0.87 ? 1 : 0);
      out[n0 + i] += bp.bp * e * g;
      mx.rev[n0 + i] += bp.bp * e * g * 0.2;
    }
  }
}
function finishSfx(mx, o = {}) {
  const n = mx.n, L = mx.dL, R = mx.dR;
  for (let i = 0; i < n; i++) { L[i] += mx.mL[i]; R[i] += mx.mR[i]; }
  reverb(mx.rev, L, R, n, { rt: o.rt ?? 1.1, wet: 0.45, pre: 0.006 });
  delay(mx.dly, L, R, n, { time: o.dt ?? 0.11, fb: 0.32, wet: 0.45 });
  let hl = 0, hr = 0;
  const hc = 1 - Math.exp(-TAU * 25 / SR), F = Math.round((o.fade ?? 0.03) * SR);
  for (let i = 0; i < n; i++) {
    hl += (L[i] - hl) * hc; L[i] -= hl; hr += (R[i] - hr) * hc; R[i] -= hr;
    if (i >= n - F) { const g = 0.5 + 0.5 * Math.cos(Math.PI * (i - (n - F)) / F); L[i] *= g; R[i] *= g; }
  }
  L[n - 1] = 0; R[n - 1] = 0;
  let pk = 0;
  for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i]));
  const g = dbg(o.peak ?? -1.5) / pk;
  for (let i = 0; i < n; i++) { L[i] *= g; R[i] *= g; }
  return { L, R, n };
}
const PLUCK = { osc: [{ w: 'sq', pw: 0.3 }, { w: 'saw', det: 8, g: 0.6 }], a: 0.001, d: 0.18, s: 0.25, r: 0.1, reset: true,
  flt: { t: 'lp', f: 2000, q: 1, env: 2.6, fd: 0.12 }, gain: 0.2, rev: 0.25, dly: 0.25 };
const BELL = { osc: [{ w: 'fm', ratio: 3.5, idx: 1.6 }, { w: 'sin', oct: 1, g: 0.2 }], fmd: 0.3, a: 0.001, d: 1.0, s: 0, r: 0.5, reset: true, gain: 0.14, rev: 0.4, dly: 0.25 };
function sfxDeath() {
  const mx = makeMix(0.52);
  kick(mx, 0, { f0: 260, f1: 46, dec: 0.08, g: 0.75, drive: 2.2, click: 0.8, nosc: true });
  drum(mx, 0, { noise: 1, bp: 1300, bq: 0.7, nd: 0.075, g: 0.55, drive: 2.6, seed: 9 });
  drum(mx, 0.004, { noise: 1, hp: 3800, nd: 0.035, g: 0.3, wide: true, seed: 4 });
  play(mx, { osc: [{ w: 'sq', pw: 0.35 }, { w: 'saw', g: 0.5, det: 30 }], a: 0.001, d: 0.28, s: 0, r: 0.06, pe: { a: 26, d: 0.045 },
    flt: { t: 'lp', f: 2400, q: 1.3, env: 2, fd: 0.14 }, drive: 2.2, gain: 0.32, rev: 0.12 }, [{ t: 0, d: 0.3, m: 45 }]);
  const r = rng(77);
  for (let k = 0; k < 16; k++) drum(mx, 0.02 + r() * 0.3, { noise: 1, bp: 1500 + r() * 6000, bq: 2.2, nd: 0.005 + r() * 0.01, g: 0.28 * (1 - k / 18), pan: r() * 1.6 - 0.8, seed: 20 + k });
  crush(mx.dL, mx.dR, mx.n, 0, 0.16, 7, 2);
  return finishSfx(mx, { rt: 0.8, fade: 0.06, peak: -1.5 });
}
function sfxComplete() {
  const mx = makeMix(2.5);
  [72, 76, 79, 84, 88, 91].forEach((m, k) => {
    play(mx, PLUCK, [{ t: k * 0.06, d: 0.1, m }]);
    play(mx, BELL, [{ t: k * 0.06, d: 0.1, m: m + 12 }], { gain: 0.45 });
  });
  const SUP = { osc: [{ w: 'saw', uni: 5, spr: 24, wid: 0.9 }, { w: 'sq', oct: -1, g: 0.35 }], a: 0.004, d: 0.35, s: 0.65, r: 0.7,
    flt: { t: 'lp', f: 2400, q: 0.8, env: 1.6, fd: 0.25 }, gain: 0.075, rev: 0.4 };
  const chords = [[0.42, 0.17, [65, 69, 72, 77], 41], [0.62, 0.17, [67, 71, 74, 79], 43], [0.84, 1.0, [60, 64, 67, 72, 76, 79], 36]];
  for (const [t, d, notes, b] of chords) {
    poly(mx, SUP, notes.map(m => ({ t, d, m })));
    play(mx, { osc: [{ w: 'saw' }, { w: 'sin', oct: -1, g: 0.8 }], a: 0.002, d: 0.3, s: 0.7, r: 0.4, flt: { t: 'lp', f: 300, env: 2, fd: 0.15 }, gain: 0.3 }, [{ t, d, m: b }]);
    kick(mx, t, { g: t > 0.8 ? 0.8 : 0.5, nosc: true });
  }
  drum(mx, 0.78, { noise: 0.8, tone: 0.5, f: 210, hp: 900, nd: 0.11, td: 0.05, g: 0.3 });
  drum(mx, 0.84, { noise: 0.6, metal: 0.9, hp: 4500, nd: 1.0, wide: true, g: 0.22, rev: 0.3 });
  impact(mx, 0.84, { g: 0.35 });
  [103, 100, 96, 91, 88, 84, 79].forEach((m, k) => play(mx, BELL, [{ t: 0.95 + k * 0.11, d: 0.1, m }], { gain: 0.4 * (1 - k / 9), pan: k % 2 ? 0.5 : -0.5 }));
  return finishSfx(mx, { rt: 1.6, fade: 0.5, dt: 0.14, peak: -1.5 });
}
function sfxPlay() {
  const mx = makeMix(0.42);
  whoosh(mx, 0, 0.36, { f0: 450, f1: 7500, g: 0.5 });
  kick(mx, 0, { f0: 220, f1: 75, dec: 0.05, g: 0.45, click: 0.5, nosc: true });
  play(mx, PLUCK, [{ t: 0.0, d: 0.06, m: 88 }, { t: 0.065, d: 0.12, m: 95 }], { gain: 0.9 });
  play(mx, BELL, [{ t: 0.065, d: 0.1, m: 107 }], { gain: 0.35 });
  return finishSfx(mx, { rt: 0.7, fade: 0.08, dt: 0.07, peak: -1.5 });
}

// ------------------------------------------------------------------ music theory
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const pcOf = s => (PC[s[0]] + (s[1] === '#' ? 1 : s[1] === 'b' ? -1 : 0) + 12) % 12;
const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], phrygdom: [0, 1, 4, 5, 7, 8, 10] };
const QUAL = {
  '': [0, 4, 7], m: [0, 3, 7], 5: [0, 7, 12], sus2: [0, 2, 7], sus4: [0, 5, 7], dim: [0, 3, 6], aug: [0, 4, 8],
  7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], add9: [0, 4, 7, 14], madd9: [0, 3, 7, 14],
  m9: [0, 3, 7, 10, 14], maj9: [0, 4, 7, 11, 14], 9: [0, 4, 7, 10, 14], 6: [0, 4, 7, 9], m6: [0, 3, 7, 9],
  m7b5: [0, 3, 6, 10], '7sus4': [0, 5, 7, 10], 13: [0, 4, 10, 14, 21], m11: [0, 3, 7, 10, 14, 17],
};
function parseChord(sym) {
  const m = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/.exec(sym);
  if (!m || !QUAL[m[2]]) throw new Error('bad chord ' + sym);
  const root = pcOf(m[1]), iv = QUAL[m[2]];
  return { sym, root, iv, bass: m[3] ? pcOf(m[3]) : root, tones: [...new Set(iv.map(x => (root + x) % 12))] };
}
// "C G Am F" (one bar each) or "C:2 G:2" (beats)
const parseProg = str => str.trim().split(/\s+/).map(tok => { const [s, b] = tok.split(':'); return { c: parseChord(s), beats: b ? +b : 4 }; });
// Melody notation, 16th-note grid: degree [#|b]1-7, ' = octave up, , = octave down, :len (16ths, default 2),
// r = rest, - = tie (extends previous note), ~ prefix = slide into the note, | = bar line (each bar must be 16).
function parseMel(str, tonic, scale) {
  const notes = [];
  let pos = 0;
  for (const bar of str.split('|').map(b => b.trim()).filter(Boolean)) {
    const start = pos;
    for (const tok of bar.split(/\s+/)) {
      let m;
      if ((m = /^r(?::(\d+))?$/.exec(tok))) { pos += m[1] ? +m[1] : 2; continue; }
      if ((m = /^-(?::(\d+))?$/.exec(tok))) { const l = m[1] ? +m[1] : 2; notes[notes.length - 1].len += l; pos += l; continue; }
      m = /^(~?)([#b]?)([1-7])([',]*)(?::(\d+))?$/.exec(tok);
      if (!m) throw new Error(`bad melody token "${tok}"`);
      const oct = [...m[4]].reduce((a, c) => a + (c === "'" ? 1 : -1), 0);
      const len = m[5] ? +m[5] : 2;
      notes.push({ s: pos, len, m: tonic + scale[+m[3] - 1] + 12 * oct + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0), slide: !!m[1] });
      pos += len;
    }
    if (pos - start !== 16) throw new Error(`melody bar has ${pos - start} sixteenths: "${bar}"`);
  }
  return notes;
}
// Close voicing in [lo, hi] with the least movement from the previous voicing.
function voicing(c, prev, lo = 52, hi = 76, size = 4) {
  const tones = c.tones;
  let best = null, cost = Infinity;
  for (let inv = 0; inv < tones.length; inv++) {
    for (let base = lo; base < lo + 12; base++) {
      if (base % 12 !== tones[inv]) continue;
      const v = [base];
      let cur = base;
      for (let j = 1; j < size; j++) { const pc = tones[(inv + j) % tones.length]; cur++; while (cur % 12 !== pc) cur++; v.push(cur); }
      if (v[v.length - 1] > hi) continue;
      const k = prev ? v.reduce((a, x, j) => a + Math.abs(x - prev[Math.min(j, prev.length - 1)]), 0)
        : Math.abs(v.reduce((a, x) => a + x, 0) / v.length - (lo + hi) / 2);
      if (k < cost) { cost = k; best = v; }
    }
  }
  if (!best) { best = []; let cur = lo; for (let j = 0; j < size; j++) { const pc = tones[j % tones.length]; while (cur % 12 !== pc) cur++; best.push(cur); cur++; } }
  return best;
}
const bassNote = (c, lo = 28) => lo + (((c.bass - lo) % 12) + 12) % 12;

// ------------------------------------------------------------------ arranger
const VEL = { X: 1, x: 0.8, o: 0.5, g: 0.3 };
// Mix trims found by measuring stem loudness in the drops (kick about 5 LU under the full mix).
const TRIM = { kick: 0.6, drums: 2.0, music: 1.8 };
const KIT = {
  k: { type: 'kick' },
  s: { tone: 0.55, f: 185, pa: 0.4, pd: 0.015, td: 0.06, noise: 0.8, hp: 1300, lp: 9500, nd: 0.13, g: 0.4, rev: 0.12 },
  c: { noise: 1, bp: 1250, bq: 0.9, nd: 0.12, bursts: [0, 0.011, 0.022, 0.032], g: 0.42, rev: 0.16, seed: 5 },
  h: { metal: 1, noise: 0.5, hp: 7000, nd: 0.034, g: 0.2, pan: 0.15, seed: 7 },
  H: { metal: 1, noise: 0.6, hp: 6500, nd: 0.2, g: 0.13, pan: 0.15, seed: 8 },
  r: { metal: 1, noise: 0.25, hp: 5200, bp: 8000, bq: 0.8, nd: 0.4, g: 0.1, pan: -0.25, seed: 9 },
  x: { metal: 0.9, noise: 0.6, hp: 4200, nd: 1.1, g: 0.17, wide: true, rev: 0.2, seed: 10 },
  t: { noise: 1, hp: 6000, nd: 0.03, att: 0.006, g: 0.11, pan: -0.3, seed: 11 },
  m: { tone: 0.85, f: 110, pa: 0.7, pd: 0.03, td: 0.17, noise: 0.15, lp: 3000, nd: 0.04, g: 0.34, rev: 0.12 },
  p: { tone: 0.8, f: 320, pa: 0.25, pd: 0.01, td: 0.08, noise: 0.25, bp: 2600, nd: 0.018, g: 0.2, pan: 0.3 },
  b: { metal: 0.9, noise: 0.7, hp: 6500, bp: 9500, bq: 0.9, nd: 0.08, g: 0.075, pan: 0.35, seed: 12 },
  w: { tone: 0.6, f: 790, t2: 0.7, r2: 0.68, td: 0.07, g: 0.08, pan: -0.2 },
};
const LAYERS = {
  intro: { drums: 'intro', bass: 0, pad: 1, arp: 1, lead: 0, stab: 0, filt: { type: 'lp', f0: 380, f1: 15000, curve: 1.6 } },
  verse: { drums: 'verse', bass: 1, pad: 1, arp: 1, lead: 0, stab: 0 },
  build: { drums: 'build', bass: 1, pad: 1, arp: 1, lead: 0, stab: 0, filt: { type: 'hp', f0: 30, f1: 650, curve: 1.6 }, riser: 1, roll: 1 },
  drop: { drums: 'drop', bass: 1, pad: 1, arp: 0, lead: 1, stab: 1, crash: 1 },
  break: { drums: 'break', bass: 'sub', pad: 1, arp: 1, lead: 'soft', stab: 0, down: 1 },
  outro: { drums: 'outro', bass: 1, pad: 1, arp: 1, lead: 0, stab: 0, filt: { type: 'lp', f0: 15000, f1: 1100, xout: false, curve: 0.7 } },
  loop: { drums: 'drop', bass: 1, pad: 1, arp: 1, lead: 1, stab: 0 },
};
const NAMES = { intro: 'intro', verse: 'verse', build: 'build', drop: 'drop', break: 'breakdown', outro: 'outro', loop: 'loop' };
function hit(ctx, key, t, v) {
  const k = ctx.S.kit?.[key] ?? KIT[key];
  if (!k) throw new Error('no drum ' + key);
  const stem = key === 'k' ? 'kick' : 'drums';
  if (!ctx.on(stem)) return;
  const o = { ...k, v: v * (k.v ?? 1) * TRIM[stem] * ctx.g(stem) };
  if (k.type === 'kick') kick(ctx.mx, t, { ...ctx.S.kick, ...o });
  else if (k.type === 'clang') clang(ctx.mx, t, o);
  else if (k.type === 'chip') chip(ctx.mx, t, o);
  else if (k.type === 'zap') zap(ctx.mx, t, o);
  else drum(ctx.mx, t, o);
  if (k.and) hit(ctx, k.and, t, v);
}
const clean = p => p.replace(/[\s|]/g, '');
function chordAt(h, beat) { let c = h[0].c; for (const x of h) { if (x.b0 <= beat + 1e-6) c = x.c; else break; } return c; }
function drumsSec(ctx, sec, pats, bars = sec.bars) {
  if (!pats) return;
  const r = rng(ctx.S.seed * 31 + sec.bar0);
  for (const key of Object.keys(pats)) {
    const p = clean(pats[key]);
    for (let s = 0; s < bars * 16; s++) {
      const v = VEL[p[s % p.length]];
      if (!v) continue;
      const t = ctx.t(sec.bar0, s) + (s % 4 === 2 ? (ctx.S.swing8 ?? 0) * ctx.st : 0);
      if (!ctx.stopped(t)) hit(ctx, key, t, v * (0.94 + 0.06 * r()));
    }
  }
}
function roll(ctx, sec, bars = sec.bars) {
  const total = bars * 16, startDiv = bars >= 4 ? 4 : 2, k = ctx.S.kit?.roll ?? ctx.S.kit?.s ?? KIT.s;
  for (let s = 0; s < total;) {
    const x = s / total, t = ctx.t(sec.bar0, s);
    if (!ctx.stopped(t) && ctx.on('drums')) drum(ctx.mx, t, { ...k, v: (0.25 + 0.75 * x * x) * (k.v ?? 1) * TRIM.drums * ctx.g('drums'), f: (k.f ?? 185) * (1 + 0.6 * x), nd: (k.nd ?? 0.13) * 0.8, rev: (k.rev ?? 0.1) + 0.1 * x });
    s += x < 0.5 ? startDiv : x < 0.75 ? Math.max(1, startDiv / 2) : x < 0.9 ? 1 : 0.5;
  }
}
// Bass pattern per 16th: R root, r soft root, O/o octave, 5 fifth, 4 fourth, 3 chord third, 7 minor 7th,
// b flat 2nd, 2 second, 6 sixth, L octave down, - tie, . rest.
const BIV = { R: 0, r: 0, O: 12, o: 12, 5: 7, 4: 5, 7: 10, b: 1, 2: 2, 6: 9, L: -12 };
function bassSec(ctx, sec, P, pat, o = {}) {
  if (!ctx.on('bass')) return;
  const p = clean(pat), notes = [], bars = o.bars ?? sec.bars, lo = ctx.S.bassLo ?? 28;
  let cur = null;
  for (let s = 0; s < bars * 16; s++) {
    const ch = p[s % p.length], t = ctx.t(sec.bar0, s);
    if (ch === '-') { if (cur) cur.d += ctx.st; continue; }
    cur = null;
    if (ch === '.' || ctx.stopped(t)) continue;
    const c = chordAt(sec.harm, t / ctx.spb), iv = ch === '3' ? c.iv[1] : BIV[ch];
    if (iv === undefined) throw new Error('bad bass step ' + ch);
    cur = { t, d: ctx.st, m: bassNote(c, lo) + iv + (o.oct ?? 0) * 12, v: ch === 'r' || ch === 'o' ? 0.6 : 1, lfo: o.lfo?.(s) };
    notes.push(cur);
  }
  for (const q of notes) q.d *= P.gate ?? 0.86;
  play(ctx.mx, P, notes, { ...o, gain: (o.gain ?? 1) * ctx.g('bass') });
}
function padSec(ctx, sec, P, o = {}) {
  if (!ctx.on(o.stem ?? 'pad')) return;
  const S = ctx.S, endBeat = (sec.bar0 + (o.bars ?? sec.bars)) * 4, lo = o.lo ?? S.padLo ?? 52, hi = o.hi ?? S.padHi ?? 76;
  let prev = ctx.prevV;
  const notes = [];
  for (const h of sec.harm) {
    if (h.b0 >= endBeat) break;
    const v = voicing(h.c, prev, lo, hi, o.size ?? 4); prev = v;
    const t0 = h.b0 * ctx.spb, dur = Math.min(h.beats, endBeat - h.b0) * ctx.spb;
    if (!o.pat) { for (const m of v) notes.push({ t: t0, d: dur, m, v: o.v ?? 1 }); continue; }
    const p = clean(o.pat), s0 = Math.round(t0 / ctx.st), steps = Math.round(dur / ctx.st);
    for (let s = 0; s < steps; s++) {
      const ch = p[(s0 + s) % p.length];
      if (ch === '.' || ch === '-') continue;
      let len = 1; while (s + len < steps && p[(s0 + s + len) % p.length] === '-') len++;
      const t = t0 + s * ctx.st;
      if (ctx.stopped(t)) continue;
      for (const m of v) notes.push({ t, d: len * ctx.st * (o.gate ?? 0.75), m, v: (VEL[ch] ?? 0.8) * (o.v ?? 1) });
    }
  }
  ctx.prevV = prev;
  poly(ctx.mx, P, notes, { ...o, gain: (o.gain ?? 1) * ctx.g(o.stem ?? 'pad') });
}
function arpSec(ctx, sec, P, A, o = {}) {
  if (!ctx.on('arp')) return;
  const rate = A.rate ?? 4, per = ctx.spb / rate, p = clean(A.pat), bars = o.bars ?? sec.bars, notes = [];
  let lastC = null, tones = null;
  for (let k = 0; k < bars * 4 * rate; k++) {
    const t = ctx.t(sec.bar0) + k * per, ch = p[k % p.length];
    if (ch === '.' || ctx.stopped(t)) continue;
    const c = chordAt(sec.harm, t / ctx.spb);
    if (c !== lastC) { const v = voicing(c, tones, A.lo ?? 60, A.hi ?? 80, A.size ?? 3); tones = v; lastC = c; }
    const ext = [...tones, ...tones.map(x => x + 12), ...tones.map(x => x + 24)];
    notes.push({ t, d: per * (A.gate ?? 0.6), m: ext[parseInt(ch, 36) % ext.length] + (o.oct ?? 0) * 12, v: k % (A.acc ?? 4) === 0 ? 1 : 0.72 });
  }
  play(ctx.mx, P, notes, { ...o, gain: (o.gain ?? 1) * ctx.g('arp') });
}
function leadSec(ctx, sec, P, o = {}) {
  if (!ctx.on('lead')) return;
  const ph = o.hooks ? o.hooks.map(i => ctx.hooks[i]) : ctx.hooks, bars = o.bars ?? sec.bars, notes = [];
  for (let j = 0; j * 4 < bars; j++) {
    for (const q of ph[(j + (o.phase ?? 0)) % ph.length]) {
      if (q.s >= (bars - j * 4) * 16) break;
      const t = ctx.t(sec.bar0 + j * 4, q.s);
      if (ctx.stopped(t)) continue;
      notes.push({ t, d: q.len * ctx.st * (P.gate ?? 0.9), m: q.m + (o.oct ?? 0) * 12, slide: q.slide, v: o.v ?? 1 });
    }
  }
  if (ctx.S.leadChords && !o.noChords) {
    const extra = [];
    for (const q of notes) {
      const c = chordAt(sec.harm, q.t / ctx.spb);
      for (let m = q.m - 1, k = 0; m > q.m - 13 && k < ctx.S.leadChords; m--) if (c.tones.includes(((m % 12) + 12) % 12)) { extra.push({ ...q, m }); k++; }
    }
    notes.push(...extra);
  }
  const oo = { ...o, gain: (o.gain ?? 1) * ctx.g('lead') };
  if (P.mono) play(ctx.mx, P, notes, oo); else poly(ctx.mx, P, notes, oo);
}
function harmFor(ctx, sec) {
  const S = ctx.S, list = sec.prog ?? S.progs?.[sec.type] ?? (['drop', 'break', 'verse', 'loop'].includes(sec.type) ? S.prog : [S.prog[0]]);
  const chords = list.flatMap(parseProg), out = [], end = (sec.bar0 + sec.bars) * 4;
  for (let beat = sec.bar0 * 4, k = 0; beat < end; k++) { const c = chords[k % chords.length]; out.push({ b0: beat, beats: Math.min(c.beats, end - beat), c: c.c }); beat += c.beats; }
  return out;
}
function makeCtx(S, seconds) {
  const spb = 60 / S.bpm, st = spb / 4, mx = makeMix(seconds), tonic = pcOf(S.key) + 12 * (S.oct ?? 5);
  const scale = SCALES[S.mode];
  const ctx = { S, mx, spb, st, barS: spb * 4, scale, stops: [], filt: [], cues: [], post: [], prevV: null,
    t: (bar, step = 0) => (bar * 16 + step) * st,
    stopped: t => ctx.stops.some(([a, b]) => t >= a - 1e-6 && t < b - 1e-6),
    on: name => !S.only || S.only.includes(name), g: name => S.mix?.[name] ?? 1 };
  ctx.hooks = S.hooks ? S.hooks.map(h => parseMel(h, S.hookTonic ?? tonic, scale)) : [[]];
  return ctx;
}

function sectionsOf(S, nBars) {
  const secs = [], count = {};
  let b = 0;
  for (const [type, bars, energy, opt] of S.form) {
    const len = bars || nBars - b;
    count[type] = (count[type] ?? 0) + 1;
    secs.push({ type, bars: len, bar0: b, energy, opt: opt ?? {}, n: count[type], name: NAMES[type] + (count[type] > 1 ? ' ' + count[type] : '') });
    b += len;
  }
  if (b !== nBars) throw new Error(`${S.name}: form has ${b} bars, song has ${nBars}`);
  return secs;
}
function renderSection(ctx, sec, next) {
  const S = ctx.S, L = { ...LAYERS[sec.type], ...(S.layers?.[sec.type] ?? {}), ...sec.opt }, mx = ctx.mx;
  if (sec.opt.prog) sec.prog = sec.opt.prog;
  sec.harm = harmFor(ctx, sec);
  const t0 = ctx.t(sec.bar0), t1 = ctx.t(sec.bar0 + sec.bars);
  const outro = sec.type === 'outro' && ctx.finalBar != null;
  const bars = outro ? ctx.finalBar - sec.bar0 : sec.bars;
  if (bars < 1) throw new Error(`${S.name}: outro too short`);
  if (next?.type === 'drop' && sec.type !== 'drop' && L.stop !== false) {
    ctx.stops.push([t1 - ctx.st * 2, t1]);
    ctx.cues.push({ beat: (sec.bar0 + sec.bars) * 4 - 0.5, type: 'stop' });
  }
  if (L.filt) ctx.filt.push({ ...L.filt, t0, t1: outro ? mx.n / SR : t1 });
  if (L.drums) drumsSec(ctx, sec, S.drums[L.drums] ?? S.drums.drop, bars);
  if (L.roll) roll(ctx, sec, bars);
  if (L.bass === 'sub') bassSec(ctx, sec, S.subPatch ?? PT.sub, S.subPat ?? 'R-------R-------', { bars });
  else if (L.bass) bassSec(ctx, sec, S.bassPatch, S.bassPat[sec.type] ?? S.bassPat.drop, { bars, ...(S.bassOpt?.(ctx, sec) ?? {}) });
  if (L.pad && S.padPatch) padSec(ctx, sec, S.padPatch, { bars, ...(S.padOpt?.[sec.type] ?? S.padOpt?.all ?? {}) });
  if (L.stab && S.stab) padSec(ctx, sec, S.stab.patch, { bars, stem: 'stab', ...S.stab });
  if (L.arp && S.arp) arpSec(ctx, sec, S.arp.patch, S.arp, { bars, ...(S.arp[sec.type] ?? {}) });
  const hooks = L.hooks;
  if (L.lead === 'soft') leadSec(ctx, sec, S.softLead ?? S.lead, { bars, hooks, gain: S.softGain ?? 0.85 });
  else if (L.lead === 'tease') leadSec(ctx, sec, S.teaseLead ?? S.lead, { bars, hooks, gain: 0.55 });
  else if (L.lead) {
    leadSec(ctx, sec, S.lead, { bars, hooks });
    if (sec.type === 'drop' && sec.n >= 2 && S.double !== false) leadSec(ctx, sec, S.lead2 ?? S.lead, { bars, hooks, oct: S.doubleOct ?? 1, gain: S.doubleGain ?? 0.38 });
  }
  if (L.crash) {
    hit(ctx, 'x', t0, 1);
    impact(mx, t0, { g: S.impactG ?? 0.28 });
    for (let b = 8; b < bars; b += 8) hit(ctx, 'x', ctx.t(sec.bar0 + b), 0.75);
    ctx.cues.push({ beat: sec.bar0 * 4, type: 'drop' });
  }
  if (L.riser) { riser(mx, t0, t1, { g: S.riserG ?? 0.075 }); revCym(mx, t1, Math.min(2.4, (t1 - t0) * 0.5)); }
  if (L.down) { hit(ctx, 'x', t0, 0.7); riser(mx, t0, t0 + Math.min(ctx.barS * 2, t1 - t0), { f0: 7000, f1: 300, g: 0.05, pow: 1.5 }); }
  S.extra?.(ctx, sec, L, bars);
  if (outro) {
    const tf = ctx.t(ctx.finalBar), rest = mx.n / SR - tf, c = parseProg(S.prog[0])[0].c, fsec = { ...sec, harm: [{ b0: ctx.finalBar * 4, beats: 64, c }] };
    hit(ctx, 'k', tf, 1); hit(ctx, 'x', tf, 1); impact(mx, tf, { g: (S.impactG ?? 0.28) * 0.8 });
    padSec(ctx, { ...fsec, bar0: ctx.finalBar, bars: 4 }, S.endPatch ?? S.padPatch ?? PT.warmPad, { bars: 4, v: 1.2 });
    play(mx, S.subPatch ?? PT.sub, [{ t: tf, d: rest, m: bassNote(c, S.bassLo ?? 28) }]);
    if (S.lead) play(mx, S.endLead ?? PT.bell, [{ t: tf, d: 0.4, m: (S.hookTonic ?? pcOf(S.key) + 12 * (S.oct ?? 5)) + 12 }], { gain: 0.9 });
    ctx.cues.push({ beat: ctx.finalBar * 4, type: 'end' });
  }
}
function master(ctx, o = {}) {
  const { mx, S } = ctx, n = mx.n;
  reverb(mx.rev, mx.mL, mx.mR, n, { rt: S.rt ?? 1.8, wet: S.revWet ?? 0.45, size: S.revSize ?? 1, damp: S.damp ?? 6500 });
  delay(mx.dly, mx.mL, mx.mR, n, { time: (S.dlyBeats ?? 0.75) * ctx.spb, fb: S.dlyFb ?? 0.35, wet: S.dlyWet ?? 0.45 });
  if (S.sc !== false) sidechain(mx.mL, mx.mR, n, mx.kicks, { depth: S.sc?.depth ?? 0.45, rel: (S.sc?.rel ?? 0.55) * ctx.spb, wrap: o.loopN });
  for (const f of ctx.filt) sweep(mx.mL, mx.mR, n, f);
  for (const [a, b] of ctx.stops) mute(mx.mL, mx.mR, n, a, b);
  const L = mx.dL, R = mx.dR;
  for (let i = 0; i < n; i++) { L[i] += mx.mL[i] * TRIM.music; R[i] += mx.mR[i] * TRIM.music; }
  mx.mL = mx.mR = mx.rev = mx.dly = null;
  for (const p of ctx.post) p(L, R, n);
  let len = n;
  if (o.loopN) { len = o.loopN; for (let i = len; i < n; i++) { L[i - len] += L[i]; R[i - len] += R[i]; } }
  const hc = 1 - Math.exp(-TAU * 18 / SR);
  let hl = 0, hr = 0;
  for (let pass = o.loopN ? 0 : 1; pass < 2; pass++) {
    for (let i = 0; i < len; i++) {
      hl += (L[i] - hl) * hc; hr += (R[i] - hr) * hc;
      if (pass) { L[i] -= hl; R[i] -= hr; }
    }
  }
  for (let i = 0; i < len; i++) if (!Number.isFinite(L[i]) || !Number.isFinite(R[i])) throw new Error(`${S.name}: non-finite sample at ${i}`);
  const I0 = kLoud(L, R, len), g = dbg((o.preI ?? -13) - I0);
  let pk = 0;
  for (let i = 0; i < len; i++) { L[i] *= g; R[i] *= g; pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i])); }
  limiter(L, R, len, dbg(o.ceil ?? -1), { circular: !!o.loopN });
  if (o.fade) {
    const F = Math.round(o.fade * SR);
    for (let i = len - F; i < len; i++) { const x = (i - (len - F)) / F, gg = 1 - x ** 2.5; L[i] *= gg; R[i] *= gg; }
    L[len - 1] = R[len - 1] = 0;
  }
  return { L, R, n: len, stats: { rawLUFS: +I0.toFixed(1), preLimitPeakDb: +(20 * Math.log10(pk)).toFixed(1), outLUFS: +kLoud(L, R, len).toFixed(1) } };
}
function renderSong(S) {
  seedAll(S.seed);
  const ctx = makeCtx(S, S.dur), totalBeats = S.dur / ctx.spb, nBars = Math.floor(totalBeats / 4 + 1e-9);
  const secs = sectionsOf(S, nBars);
  ctx.finalBar = Math.floor((S.dur - 2.0) / ctx.barS);
  secs.forEach((sec, i) => renderSection(ctx, sec, secs[i + 1]));
  if (!ctx.mx.kicks.includes(0)) hit(ctx, 'k', 0, 1);
  hit(ctx, 'x', 0, 0.55);
  const out = master(ctx, { fade: 4, preI: S.preI ?? -13 });
  out.timeline = {
    index: S.index, name: S.name, bpm: S.bpm, durationSeconds: S.dur, beatSeconds: +ctx.spb.toFixed(6), totalBeats: +totalBeats.toFixed(3),
    difficulty: S.difficulty, style: S.style, key: S.keyName,
    sections: secs.map((s, i) => ({ name: s.name, startBeat: s.bar0 * 4, endBeat: i === secs.length - 1 ? +totalBeats.toFixed(3) : (s.bar0 + s.bars) * 4, energy: s.energy })),
    cues: ctx.cues.sort((a, b) => a.beat - b.beat),
  };
  return out;
}
function renderLoop(S) {
  seedAll(S.seed);
  const spb = 60 / S.bpm, loopN = Math.round(S.bars * 4 * spb * SR), ctx = makeCtx(S, loopN / SR + 6);
  sectionsOf(S, S.bars).forEach(sec => renderSection(ctx, sec, null));
  return master(ctx, { loopN, preI: S.preI ?? -14, ceil: -1.5 });
}

// ------------------------------------------------------------------ patches
const PT = {
  sub: { osc: [{ w: 'sin' }, { w: 'tri', oct: 1, g: 0.18 }], a: 0.012, d: 0.4, s: 0.9, r: 0.18, gain: 0.24, gate: 0.97 },
  warmPad: { osc: [{ w: 'saw', uni: 5, spr: 18, wid: 0.9 }, { w: 'tri', g: 0.5 }], a: 0.35, d: 0.8, s: 0.8, r: 0.9, flt: { t: 'lp', f: 2600, q: 0.6, kt: 0.3 }, gain: 0.06, rev: 0.5 },
  bell: { osc: [{ w: 'fm', ratio: 3.5, idx: 1.5 }, { w: 'sin', oct: 1, g: 0.18 }], fmd: 0.35, a: 0.001, d: 1.4, s: 0, r: 0.7, reset: true, gain: 0.12, rev: 0.45, dly: 0.3 },
  pluck: { osc: [{ w: 'saw' }, { w: 'sq', det: 7, g: 0.6 }], a: 0.001, d: 0.22, s: 0, r: 0.1, reset: true, flt: { t: 'lp', f: 800, q: 1.1, env: 3.1, fd: 0.12, kt: 0.6 }, gain: 0.11, rev: 0.25, dly: 0.3 },
  softPluck: { osc: [{ w: 'tri' }, { w: 'saw', g: 0.35, det: 6 }], a: 0.001, d: 0.3, s: 0, r: 0.15, reset: true, flt: { t: 'lp', f: 2200, q: 0.8, env: 2.2, fd: 0.15, kt: 0.5 }, gain: 0.12, rev: 0.3, dly: 0.35 },
  flute: { osc: [{ w: 'tri' }, { w: 'sin', oct: 1, g: 0.25 }, { w: 'noise', g: 0.03 }], a: 0.03, d: 0.3, s: 0.8, r: 0.15, vib: { r: 5.2, d: 0.12, dl: 0.18 }, flt: { t: 'lp', f: 6500, q: 0.7 }, gain: 0.16, rev: 0.35, dly: 0.3, mono: true, glide: 0.03, legato: true },
  ep: { osc: [{ w: 'fm', ratio: 1, idx: 1.1 }, { w: 'fm', ratio: 14, idx: 0.3, g: 0.12 }, { w: 'sin', g: 0.35 }], fmd: 0.45, fms: 0.15, a: 0.002, d: 1.6, s: 0.35, r: 0.35, gain: 0.075, rev: 0.3, reset: true },
  vibes: { osc: [{ w: 'fm', ratio: 4, idx: 0.7 }, { w: 'sin', g: 0.6 }], fmd: 0.2, a: 0.001, d: 1.2, s: 0, r: 0.5, reset: true, gain: 0.12, rev: 0.35, dly: 0.25 },
  neonLead: { osc: [{ w: 'sq', pw: 0.42, g: 0.7 }, { w: 'saw', uni: 2, spr: 9, g: 0.5 }], a: 0.004, d: 0.25, s: 0.6, r: 0.14, vib: { r: 5.5, d: 0.1, dl: 0.2 }, flt: { t: 'lp', f: 2600, q: 0.8, env: 1.4, fd: 0.2, kt: 0.5 }, gain: 0.13, rev: 0.3, dly: 0.3, mono: true, glide: 0.025, legato: true },
  roundBass: { osc: [{ w: 'tri' }, { w: 'sin', g: 0.7 }, { w: 'saw', g: 0.12 }], a: 0.004, d: 0.3, s: 0.75, r: 0.08, flt: { t: 'lp', f: 900, q: 0.7 }, gain: 0.2, gate: 0.9 },
};

// ------------------------------------------------------------------ menu and practice loops
const MENU = {
  name: 'menuLoop', seed: 901, bpm: 124.632, key: 'A', mode: 'major', bars: 20, preI: -14.5, rt: 2.0, revWet: 0.5, dlyBeats: 0.75, dlyFb: 0.4,
  sc: { depth: 0.3, rel: 0.6 },
  form: [['loop', 8, 0.5, { prog: ['Amaj7 C#m7 Dmaj7 E'], hooks: [0, 1] }], ['loop', 8, 0.6, { prog: ['F#m7 Dmaj7 Amaj7 E'], hooks: [2, 3] }],
    ['loop', 4, 0.4, { prog: ['Bm7 C#m7 Dmaj7 E'], lead: 0 }]],
  hooks: [
    '3:4 5:2 3:2 2:4 1:4 | 3:3 5:3 7:2 5:8 | 6:4 4:2 3:2 4:4 6:4 | 5:6 7,:2 2:8',
    '3:4 5:2 3:2 2:4 1:4 | 3:3 5:3 7:2 2\':8 | 1\':4 7:2 6:2 7:4 6:4 | 5:12 r:4',
    '6:2 6:2 5:2 3:2 5:4 6:4 | 4:2 4:2 3:2 1:2 3:4 4:4 | 3:2 3:2 2:2 1:2 2:4 3:4 | 2:6 7,:2 5,:8',
    '6:2 6:2 5:2 3:2 5:4 1\':4 | 1\':6 6:2 4:8 | 3:4 5:4 7:4 1\':4 | 7:12 r:4'],
  kick: { f0: 150, f1: 52, dec: 0.2, drive: 1.2, click: 0.25, g: 0.65 },
  kit: { c: { ...KIT.c, g: 0.26 }, t: { ...KIT.t, g: 0.06 } },
  drums: { drop: { k: 'x.......x.......', c: '....o.......o...', h: 'o.x.o.x.o.x.o.xo', H: '..............o.', t: 'goxogoxogoxogoxo' } },
  bassPatch: PT.roundBass, bassPat: { drop: 'R-----R---R-----' }, bassLo: 33,
  padPatch: { ...PT.warmPad, flt: { t: 'lp', f: 4200, q: 0.6 } }, padLo: 55, padHi: 74,
  arp: { patch: PT.softPluck, pat: '01213212', rate: 2, lo: 64, hi: 81, gate: 0.7 },
  lead: PT.neonLead,
};
const PRACTICE = {
  name: 'practice', seed: 902, bpm: 90, key: 'F', mode: 'major', bars: 16, preI: -15.5, rt: 1.6, revWet: 0.4, dlyBeats: 0.75, dlyFb: 0.3, dlyWet: 0.35,
  sc: false, swing8: 0.28,
  form: [['loop', 8, 0.3, { lead: 0 }], ['loop', 8, 0.35, { hooks: [0, 1] }]],
  prog: ['Fmaj9 Am7 Bbmaj7 C7sus4:2 C7:2', 'Dm9 Am7 Gm9 C9'],
  hooks: ['5:6 3:2 5:4 7:4 | 5:6 3:2 2\':8 | 1\':6 6:2 4:8 | 5:4 4:4 3:4 2:4', '3:6 5:2 7:4 6:4 | 5:6 3:2 5:8 | 4:4 6:4 1\':4 3\':4 | 2\':8 7:4 r:4'],
  kick: { f0: 120, f1: 48, dec: 0.26, drive: 1.1, click: 0.12, lp: 2500, g: 0.6 },
  kit: { s: { tone: 0.5, f: 200, pa: 0.3, td: 0.05, noise: 0.6, hp: 1500, lp: 5000, nd: 0.11, g: 0.2, rev: 0.15 }, h: { ...KIT.h, g: 0.06, hp: 6000, nd: 0.03 },
    v: { noise: 1, hp: 2500, lp: 9000, nd: 0.002, g: 0.03, att: 0.0001 } },
  drums: { drop: { k: 'X.....x...X.....', s: '....x.......x..o', h: 'o.x.o.x.o.x.o.xo' } },
  bassPatch: { ...PT.roundBass, gain: 0.15 }, bassPat: { drop: 'R-----R-....5---' }, bassLo: 29,
  padPatch: PT.ep, padOpt: { all: { pat: 'X-----x---------', gate: 0.95, lo: 53, hi: 72 } },
  lead: PT.vibes,
  extra(ctx, sec) {
    if (sec.bar0 !== 0) return;
    const r = rng(4242), end = ctx.t(16);
    for (let t = r() * 0.3; t < end; t += 0.05 + r() * 0.45) hit(ctx, 'v', t, 0.3 + r() * 0.7);
  },
};

// ------------------------------------------------------------------ level songs
// form: [type, bars (0 = rest of the song), energy 0..1, options]; prog: 4-bar progressions A, B;
// hooks: 4-bar melodies A, B written over prog A and B (see parseMel). Drum steps: X x o g = velocities.
const SONGS = [];
SONGS[0] = {
  index: 0, name: 'Neon Start', bpm: 124.632, dur: 64, difficulty: 'easy', style: 'bright happy electro-pop', keyName: 'C major',
  key: 'C', mode: 'major', seed: 100, mix: { pad: 0.5, lead: 1.2, drums: 1.2 }, hookTonic: 60,
  form: [['intro', 4, 0.35], ['build', 4, 0.6], ['drop', 8, 0.9], ['break', 4, 0.4], ['build', 2, 0.7], ['drop', 8, 1], ['outro', 0, 0.3]],
  prog: ['C G Am F', 'F G Em Am'],
  hooks: ["5:3 3:3 5:2 1':3 7:3 5:2 | 5:3 2:3 5:2 7:3 6:3 5:2 | 6:3 3:3 6:2 1':3 7:3 6:2 | 6:3 4:3 1':2 6:4 5:4",
    "1':2 1':2 2':2 1':2 6:4 1':4 | 2':2 2':2 3':2 2':2 7:4 5:4 | 3':2 3':2 5':2 3':2 2':3 1':3 7:2 | 1':4 7:2 6:6 r:4"],
  kick: { f0: 175, f1: 50, dec: 0.24, drive: 1.5, click: 0.4 },
  drums: {
    intro: { k: 'x...x...x...x...', h: '..o...o...o...o.', t: 'g.g.g.g.g.g.g.g.' },
    build: { k: 'x...x...x...x...', h: '..x...x...x...x.' },
    drop: { k: 'x...x...x...x...', c: '....x.......x...', H: '..x...x...x...x.', h: 'o.g.o.g.o.g.o.go', t: '.g.g.g.g.g.g.g.g' },
    break: { t: 'gogogogogogogogo', c: '............o...' },
    outro: { k: 'x...x...x...x...', c: '....o.......o...', h: '..x...x...x...x.' },
  },
  bassPatch: { osc: [{ w: 'saw' }, { w: 'sq', oct: -1, g: 0.5 }], a: 0.002, d: 0.18, s: 0.55, r: 0.05, flt: { t: 'lp', f: 320, q: 1.1, env: 2.4, fd: 0.13 }, gain: 0.22, gate: 0.8 },
  bassPat: { drop: 'R..R..R.R..R..O.', build: 'R.R.R.R.R.R.R.R.', outro: 'R...R...R...R...' },
  padPatch: PT.warmPad,
  stab: { patch: { osc: [{ w: 'saw', uni: 3, spr: 14 }, { w: 'sq', g: 0.4 }], a: 0.002, d: 0.2, s: 0.25, r: 0.1, flt: { t: 'lp', f: 1500, q: 0.9, env: 2, fd: 0.14 }, gain: 0.045, rev: 0.25, dly: 0.12 }, pat: '..x...x...x...x.', gate: 0.7, lo: 60, hi: 79 },
  arp: { patch: PT.pluck, pat: '0121', rate: 4, lo: 64, hi: 84 },
  lead: { osc: [{ w: 'sq', g: 0.55 }, { w: 'saw', g: 0.6, uni: 3, spr: 14, wid: 0.6 }], a: 0.003, d: 0.3, s: 0.55, r: 0.12, reset: true, flt: { t: 'lp', f: 2200, q: 0.9, env: 2, fd: 0.22, kt: 0.5 }, gain: 0.15, rev: 0.22, dly: 0.28 },
  softLead: PT.bell, teaseLead: PT.pluck, layers: { build: { lead: 'tease' } },
  sc: { depth: 0.5, rel: 0.55 },
};
SONGS[1] = {
  index: 1, name: 'Pixel Hop', bpm: 138.48, dur: 68, difficulty: 'easy', style: 'bouncy chiptune', keyName: 'G major',
  key: 'G', mode: 'major', seed: 101, mix: { lead: 0.85, arp: 1.6 }, hookTonic: 67,
  form: [['intro', 4, 0.35], ['build', 4, 0.55], ['drop', 8, 0.85], ['break', 8, 0.4], ['build', 4, 0.7], ['drop', 8, 1], ['outro', 0, 0.3]],
  prog: ['G Em C D', 'C D G:2 Em:2 Am:2 D:2'],
  hooks: ["1:2 5:1 1':1 5:2 3:2 5:2 1':2 2':2 1':2 | 6,:2 3:1 6:1 3:2 1:2 3:2 6:2 7:2 6:2 | 4,:2 1:1 4:1 1:2 6,:2 1:2 4:2 5:2 6:2 | 5,:2 2:1 5:1 7:2 5:2 2':4 r:2 7:2",
    '6:3 4:3 1:2 4:4 6:4 | 7:3 5:3 2:2 5:4 7:2 6:2 | 5:2 3:2 1:2 3:2 6,:2 1:2 3:4 | 2:2 4:2 6:2 4:2 5:4 7,:2 2:2'],
  kick: { f0: 200, f1: 55, dec: 0.18, drive: 1.6, click: 0.5 },
  kit: { s: { type: 'chip', rate: 6500, dec: 0.1, g: 0.3, and: 'c' }, c: { ...KIT.c, g: 0.16 }, h: { type: 'chip', rate: 24000, dec: 0.022, g: 0.15, short: true }, H: { type: 'chip', rate: 16000, dec: 0.08, g: 0.11 } },
  drums: {
    intro: { k: 'x...x...x...x...', h: '..x...x...x...x.' },
    build: { k: 'x...x...x...x...', h: 'x.x.x.x.x.x.x.x.' },
    drop: { k: 'x...x...x..xx...', s: '....x.......x...', h: 'x.xxx.xxx.xxx.xx', H: '..............x.' },
    break: { h: 'o.o.o.o.o.o.o.o.', s: '............o...' },
    outro: { k: 'x...x...x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
  },
  bassPatch: { osc: [{ w: 'tri' }, { w: 'sq', pw: 0.5, g: 0.12 }], a: 0.001, d: 0.1, s: 0.85, r: 0.02, gain: 0.3, gate: 0.75 },
  bassPat: { drop: 'R.O.R.O.R.O.R.O.', build: 'R...R...R...R...', outro: 'R.O.R.O.R.O.R.O.' },
  bassLo: 38, subPatch: { osc: [{ w: 'tri' }], a: 0.01, d: 0.2, s: 0.9, r: 0.1, gain: 0.26, gate: 0.95 },
  padPatch: { osc: [{ w: 'sq', pw: 0.5, uni: 2, spr: 10 }], a: 0.03, d: 0.4, s: 0.6, r: 0.25, flt: { t: 'lp', f: 2500, q: 0.6 }, gain: 0.035, rev: 0.25 },
  arp: { patch: { osc: [{ w: 'sq', pw: 0.125 }], a: 0.001, d: 0.05, s: 0.6, r: 0.015, flt: { t: 'lp', f: 7500, q: 0.6 }, gain: 0.07, dly: 0.12, pan: -0.25 }, pat: '012', rate: 8, lo: 67, hi: 86, gate: 0.85, acc: 3 },
  lead: { osc: [{ w: 'sq', pw: 0.25 }], a: 0.001, d: 0.08, s: 0.8, r: 0.03, vib: { r: 6, d: 0.18, dl: 0.12 }, flt: { t: 'lp', f: 8000, q: 0.6 }, gain: 0.15, dly: 0.2, rev: 0.06, mono: true },
  softLead: { osc: [{ w: 'sq', pw: 0.5 }], a: 0.002, d: 0.2, s: 0.5, r: 0.08, vib: { r: 5, d: 0.15, dl: 0.2 }, flt: { t: 'lp', f: 4500, q: 0.6 }, gain: 0.12, dly: 0.35, rev: 0.15, mono: true },
  layers: { drop: { arp: 1, stab: 0 } },
  sc: { depth: 0.35, rel: 0.5 }, rt: 1.2, revWet: 0.3, dlyBeats: 0.5, dlyFb: 0.3,
};
SONGS[2] = {
  index: 2, name: 'Blue Ladder', bpm: 124.632, dur: 72, difficulty: 'normal', style: 'upbeat synthwave', keyName: 'A minor',
  key: 'A', mode: 'minor', seed: 102, mix: { drums: 0.7, pad: 1.4, lead: 0.85 }, hookTonic: 57,
  form: [['intro', 4, 0.35], ['verse', 4, 0.5], ['build', 4, 0.65], ['drop', 8, 0.9], ['break', 4, 0.45], ['build', 2, 0.7], ['drop', 8, 1], ['outro', 0, 0.3]],
  prog: ['Am F C G', 'Dm Am F G'],
  hooks: ["5:6 3:2 5:2 6:2 5:4 | 1':6 6:2 1':2 2':2 1':4 | 3':6 1':2 3':2 4':2 3':4 | 2':6 7:2 2':2 4':2 2':4",
    "4':2 3':2 4':2 6':2 4':4 1':4 | 3':2 2':2 3':2 5':2 3':4 1':4 | 1':2 7:2 1':2 3':2 1':4 6:4 | 7:2 6:2 7:2 2':2 7:2 2':2 4':4"],
  kick: { f0: 160, f1: 52, dec: 0.25, drive: 1.4, click: 0.3 },
  kit: { s: { tone: 0.5, f: 190, pa: 0.4, td: 0.07, noise: 0.9, hp: 1100, lp: 8000, nd: 0.2, g: 0.42, rev: 0.45 } },
  drums: {
    intro: { k: 'x...x...x...x...', h: 'o.o.o.o.o.o.o.o.' },
    verse: { k: 'x...x...x...x...', s: '....x.......x...', h: 'o.x.o.x.o.x.o.x.' },
    build: { k: 'x...x...x...x...', h: 'oxoxoxoxoxoxoxox' },
    drop: { k: 'x...x...x...x...', s: '....X.......X...', h: 'gxoxgxoxgxoxgxox', H: '..............x.' },
    break: { h: 'g.g.g.g.g.g.g.g.' },
    outro: { k: 'x...x...x...x...', s: '....x.......x...', h: 'o.x.o.x.o.x.o.x.' },
  },
  bassPatch: { osc: [{ w: 'saw' }, { w: 'saw', det: 9, g: 0.6 }, { w: 'sin', oct: -1, g: 0.5 }], a: 0.002, d: 0.12, s: 0.5, r: 0.04, flt: { t: 'lp', f: 380, q: 1.2, env: 2.2, fd: 0.1 }, gain: 0.2, gate: 0.7 },
  bassPat: { drop: 'RRRRRRRRRRRRRRRR', verse: 'R.R.R.R.R.R.R.R.', build: 'R.R.R.R.R.R.R.R.', outro: 'R.R.R.R.R.R.R.R.' },
  padPatch: { osc: [{ w: 'saw', uni: 5, spr: 20, wid: 0.9 }, { w: 'sq', oct: -1, g: 0.25 }], a: 0.004, d: 0.12, s: 0.75, r: 0.06, flt: { t: 'lp', f: 2800, q: 0.7 }, gain: 0.05, rev: 0.3, dly: 0.08 },
  padOpt: { drop: { pat: 'x.xx.xx.x.xx.xx.', gate: 0.7 }, verse: { pat: 'x.x.x.x.x.x.x.x.', gate: 0.6 }, break: { v: 1.1 } },
  arp: { patch: PT.pluck, pat: '0123', rate: 4, lo: 60, hi: 81 },
  lead: { osc: [{ w: 'saw', uni: 2, spr: 10, wid: 0.4 }, { w: 'saw', oct: -1, g: 0.3 }], a: 0.005, d: 0.3, s: 0.75, r: 0.18, vib: { r: 5.5, d: 0.16, dl: 0.25 }, flt: { t: 'lp', f: 2800, q: 0.8, env: 1, fd: 0.3 }, gain: 0.15, rev: 0.3, dly: 0.35, mono: true, glide: 0.04, legato: true },
  softLead: { ...PT.bell, gain: 0.11 },
  sc: { depth: 0.45, rel: 0.55 }, rt: 2.4, revWet: 0.5, dlyBeats: 0.75, dlyFb: 0.38,
  extra(ctx, sec) {
    if (sec.type !== 'drop') return;
    const b = sec.bar0 + sec.bars - 1;
    [[12, 0.9, 140], [13, 0.85, 120], [14, 0.9, 100], [15, 1, 82]].forEach(([s, v, f]) => drum(ctx.mx, ctx.t(b, s), { ...KIT.m, f, v, g: 0.3 }));
  },
};
SONGS[3] = {
  index: 3, name: 'Desert Wind', bpm: 138.48, dur: 74, difficulty: 'normal', style: 'dance beat with a phrygian-dominant melody and hand percussion', keyName: 'D phrygian dominant',
  key: 'D', mode: 'phrygdom', seed: 103, mix: { bass: 1.25, arp: 1.4 }, hookTonic: 74,
  form: [['intro', 4, 0.35], ['verse', 4, 0.5], ['build', 4, 0.65], ['drop', 8, 0.9], ['break', 8, 0.45], ['build', 4, 0.75], ['drop', 8, 1], ['outro', 0, 0.3]],
  prog: ['D Eb Cm D', 'Gm Cm Eb D'],
  hooks: ["5:3 6:1 5:2 3:2 4:2 3:2 2:2 1:2 | 2:3 3:1 2:2 4:2 6:4 4:2 2:2 | 4:3 2:1 7,:2 2:2 4:4 6:2 5:2 | 1:6 2:1 1:1 3:4 1:4",
    "1':4 6:2 7:1 6:1 4:4 6:4 | 7:4 6:2 7:1 6:1 4:4 2:4 | 6:4 4:2 6:1 4:1 2:4 3:2 2:2 | 1:4 3:2 5:2 1':6 r:2"],
  kick: { f0: 165, f1: 50, dec: 0.24, drive: 1.5, click: 0.3 },
  kit: {
    d: { tone: 1, f: 95, pa: 0.5, pd: 0.02, td: 0.16, noise: 0.15, lp: 1200, nd: 0.03, g: 0.3, pan: -0.1 },
    e: { tone: 0.5, f: 720, pa: 0.1, td: 0.03, noise: 0.9, bp: 3200, bq: 1.5, nd: 0.025, g: 0.2, pan: 0.2, rev: 0.1 },
    f: { tone: 0.3, f: 650, td: 0.02, noise: 0.7, bp: 2800, bq: 1.5, nd: 0.018, g: 0.11, pan: -0.25 },
    b: { ...KIT.b, g: 0.09 },
  },
  drums: {
    intro: { k: 'x...............', d: 'x.......x.......', e: '..x...x.....x...', t: 'gogogogogogogogo' },
    verse: { k: 'x...x...x...x...', d: 'x.......x.......', e: '..x...x.....x...', f: '.o.o.o..o.oo.o.o', t: 'gogogogogogogogo' },
    build: { k: 'x...x...x...x...', e: '..x...x...x...x.', t: 'gogogogogogogogo' },
    drop: { k: 'x...x...x...x...', c: '....x.......x...', d: 'x.......x.......', e: '..x...x.....x.x.', f: '.o.o.o..o.oo.o..', b: '..x...x...x...x.', h: 'g.g.g.g.g.g.g.g.' },
    break: { d: 'x.......x.......', e: '..x...x.....x...', f: '.o.o.o..o.oo.o.o', t: 'g.g.g.g.g.g.g.g.' },
    outro: { k: 'x...x...x...x...', d: 'x.......x.......', e: '..x...x.....x...', t: 'gogogogogogogogo' },
  },
  bassPatch: { osc: [{ w: 'saw' }, { w: 'sin', oct: -1, g: 0.6 }], a: 0.002, d: 0.15, s: 0.6, r: 0.05, flt: { t: 'lp', f: 300, q: 1, env: 2.2, fd: 0.12 }, gain: 0.22, gate: 0.8 },
  bassPat: { drop: '..R...R...R.R.R.', verse: '..R...R...R...R.', build: 'R.R.R.R.R.R.R.R.', outro: '..R...R...R...R.' },
  padPatch: { ...PT.warmPad, gain: 0.045 },
  arp: { patch: { osc: [{ w: 'saw' }, { w: 'tri', oct: 1, g: 0.4 }], a: 0.001, d: 0.16, s: 0, r: 0.08, reset: true, flt: { t: 'lp', f: 1200, q: 1.4, env: 2.6, fd: 0.08, kt: 0.5 }, gain: 0.1, rev: 0.25, dly: 0.25, pan: 0.2 }, pat: '0102', rate: 4, lo: 62, hi: 80 },
  lead: { osc: [{ w: 'saw' }, { w: 'sq', pw: 0.3, g: 0.6 }], a: 0.01, d: 0.25, s: 0.8, r: 0.12, vib: { r: 5.8, d: 0.22, dl: 0.18 }, flt: { t: 'bp', f: 1300, q: 1.1, env: 0.6, fd: 0.2, kt: 0.6 }, drive: 1.3, gain: 0.26, rev: 0.3, dly: 0.25, mono: true, glide: 0.03, legato: true },
  softLead: { osc: [{ w: 'tri' }, { w: 'sin', oct: 1, g: 0.2 }, { w: 'noise', g: 0.04 }], a: 0.04, d: 0.3, s: 0.8, r: 0.2, vib: { r: 5, d: 0.2, dl: 0.2 }, flt: { t: 'lp', f: 3500 }, gain: 0.15, rev: 0.45, dly: 0.3, mono: true, glide: 0.04, legato: true },
  layers: { drop: { arp: 1 } },
  sc: { depth: 0.4, rel: 0.5 }, rt: 2.2, revWet: 0.45, dlyBeats: 0.75,
  extra(ctx, sec) {
    if (sec.type === 'intro' || sec.type === 'break') play(ctx.mx, { osc: [{ w: 'saw', uni: 3, spr: 8 }, { w: 'sin', g: 0.8 }], a: 1.2, d: 1, s: 0.9, r: 1.2, flt: { t: 'lp', f: 500, q: 0.8 }, gain: 0.08, rev: 0.3 }, [{ t: ctx.t(sec.bar0), d: sec.bars * ctx.barS - 0.2, m: 38 }]);
  },
};
SONGS[4] = {
  index: 4, name: 'Iron Gate', bpm: 155.79, dur: 78, difficulty: 'hard', style: 'industrial electro', keyName: 'E minor',
  key: 'E', mode: 'minor', seed: 104, mix: { kick: 1.2, drums: 0.5, bass: 1.25 }, hookTonic: 64,
  form: [['intro', 4, 0.4], ['verse', 8, 0.6], ['build', 4, 0.75], ['drop', 8, 0.95], ['break', 8, 0.5], ['build', 4, 0.8], ['drop', 12, 1], ['outro', 0, 0.35]],
  prog: ['Em Em C D', 'Em G C B'],
  hooks: ['1:2 1:1 1:1 b2:2 1:2 4:2 3:2 b2:2 1:2 | 5:2 5:1 5:1 4:2 3:2 1:4 7,:2 1:2 | 6:2 6:1 6:1 5:2 3:2 6:2 5:2 3:2 1:2 | 7:2 7:1 7:1 6:2 4:2 2:4 4:2 7:2',
    "1':4 7:2 1':2 3':4 2':4 | 3':4 2':2 3':2 5':4 4':4 | 6:4 5:2 6:2 1':4 3':4 | 5:6 #7,:2 2:4 5:4"],
  kick: { f0: 200, f1: 47, dec: 0.2, drive: 3, click: 0.5, lp: 7000 },
  kit: {
    s: { tone: 0.5, f: 210, pa: 0.5, td: 0.05, noise: 1, hp: 900, nd: 0.12, metal: 0.4, g: 0.42, drive: 1.8, rev: 0.15 },
    a: { type: 'clang', f: 470, dec: 0.22, idx: 5, drive: 1.6, g: 0.12, pan: 0.3, rev: 0.1, dly: 0.1 },
    A: { type: 'clang', f: 233, dec: 0.4, idx: 3, drive: 2, g: 0.13, pan: -0.3, rev: 0.15 },
  },
  drums: {
    intro: { k: 'x...x...x...x...', a: '...x.......x....', h: 'o.o.o.o.o.o.o.o.' },
    verse: { k: 'x...x...x...x...', s: '....x.......x...', h: 'xoxoxoxoxoxoxoxo', a: '...x.....x....x.' },
    build: { k: 'x...x...x...x...', h: 'xoxoxoxoxoxoxoxo', a: '...x.......x....' },
    drop: { k: 'x...x...x...x...', s: '....X.......X...', h: 'xoxoxoxoxoxoxoxo', a: '...x.....x....x.', A: 'x.......x.......', H: '..x...x...x...x.' },
    break: { a: '...x.......x....', A: 'x...............', h: 'g.g.g.g.g.g.g.g.' },
    outro: { k: 'x...x...x...x...', s: '....x.......x...', h: 'xoxoxoxoxoxoxoxo', a: '...x.....x....x.' },
  },
  bassPatch: { osc: [{ w: 'saw' }, { w: 'sq', g: 0.6, det: -8 }, { w: 'sin', oct: -1, g: 0.6 }], a: 0.002, d: 0.14, s: 0.6, r: 0.04, drive: 3.5, flt: { t: 'lp', f: 420, q: 1.3, env: 2.4, fd: 0.09 }, gain: 0.2, gate: 0.85 },
  bassPat: { drop: 'RR.RR.RR.RR.R.Ob', verse: 'R.R.R.R.R.R.R.Rb', build: 'R.R.R.R.R.R.R.R.', outro: 'R.R.R.R.R.R.R.R.' },
  padPatch: { osc: [{ w: 'saw', uni: 4, spr: 16 }], a: 0.3, d: 0.5, s: 0.8, r: 0.5, flt: { t: 'lp', f: 1400, q: 0.8 }, gain: 0.04, rev: 0.4 },
  stab: { patch: { osc: [{ w: 'saw', uni: 3, spr: 10 }, { w: 'sq', oct: -1, g: 0.5 }], a: 0.001, d: 0.12, s: 0.3, r: 0.06, drive: 2, flt: { t: 'lp', f: 1800, q: 1, env: 1.5, fd: 0.08 }, gain: 0.05, rev: 0.15 }, pat: 'x..x..x.........', gate: 0.6, lo: 52, hi: 70, size: 3 },
  arp: { patch: { ...PT.pluck, gain: 0.08 }, pat: '0.1.2.1.', rate: 4, lo: 64, hi: 82 },
  lead: { osc: [{ w: 'sq', pw: 0.5 }, { w: 'saw', g: 0.6, det: 10 }], a: 0.002, d: 0.15, s: 0.7, r: 0.06, drive: 2, flt: { t: 'lp', f: 2600, q: 1.1, env: 1.2, fd: 0.12 }, gain: 0.14, rev: 0.15, dly: 0.2, mono: true },
  softLead: { ...PT.bell, gain: 0.1 }, teaseLead: { ...PT.pluck, gain: 0.1 },
  layers: { verse: { arp: 0, stab: 1 }, build: { lead: 'tease' } },
  sc: { depth: 0.5, rel: 0.45 }, rt: 1.6, revWet: 0.35, dlyBeats: 0.75, dlyFb: 0.3,
  extra(ctx, sec) {
    if (sec.type === 'verse' || sec.type === 'drop') drum(ctx.mx, ctx.t(sec.bar0), { noise: 1, metal: 0.6, hp: 300, nd: 0.25, g: 0.18, drive: 2.5, wide: true, rev: 0.3 });
  },
};

const SUPERSAW = (o = {}) => ({ osc: [{ w: 'saw', uni: 7, spr: 32, wid: 0.95 }, { w: 'sq', g: 0.3, oct: -1 }], a: 0.004, d: 0.3, s: 0.7, r: 0.18, hp: 140,
  flt: { t: 'lp', f: 5200, q: 0.7, env: 0.8, fd: 0.25 }, gain: 0.07, rev: 0.3, dly: 0.2, ...o });
const DARKPAD = (o = {}) => ({ osc: [{ w: 'saw', uni: 5, spr: 16, wid: 0.9 }, { w: 'tri', oct: -1, g: 0.4 }], a: 0.4, d: 0.8, s: 0.8, r: 0.9, flt: { t: 'lp', f: 1300, q: 0.7 }, gain: 0.05, rev: 0.5, ...o });
const GLASS = (o = {}) => ({ osc: [{ w: 'fm', ratio: 3.5, idx: 1.3 }, { w: 'fm', ratio: 5.19, idx: 0.5, g: 0.35 }, { w: 'sin', g: 0.5 }], fmd: 0.4, a: 0.001, d: 1.5, s: 0, r: 0.8, reset: true, gain: 0.1, rev: 0.45, dly: 0.35, ...o });
SONGS[5] = {
  index: 5, name: 'Night Rail', bpm: 124.632, dur: 80, difficulty: 'hard', style: 'dark synthwave with half-time drops', keyName: 'F# minor',
  key: 'F#', mode: 'minor', seed: 105, hookTonic: 66, mix: { kick: 1.25, bass: 0.8, lead: 0.75, arp: 1.6 },
  form: [['intro', 4, 0.35], ['verse', 8, 0.55], ['build', 4, 0.7], ['drop', 8, 0.9], ['break', 4, 0.45], ['build', 2, 0.75], ['drop', 8, 1], ['outro', 0, 0.3]],
  prog: ['F#m D A E', 'Bm D E C#'],
  hooks: ["1':3 7:3 5:6 3:2 5:2 | 6:3 5:3 3:6 1:2 3:2 | 5:3 3:3 7:6 5:2 3:2 | 7:3 2':3 4':6 2':2 7:2",
    "4':4 3':2 1':2 6:4 4:4 | 6:4 5:2 3:2 1:4 3:4 | 7:4 4':2 2':2 7:4 5:4 | 5:4 #7,:2 2:2 5:8"],
  kick: { f0: 150, f1: 46, dec: 0.32, drive: 1.6, click: 0.3 },
  kit: { s: { tone: 0.45, f: 175, pa: 0.4, td: 0.08, noise: 1, hp: 900, lp: 7000, nd: 0.28, g: 0.45, rev: 0.5 },
    p: { noise: 1, metal: 0.5, bp: 2600, bq: 2, nd: 0.018, g: 0.11, pan: -0.35, seed: 31 } },
  drums: {
    intro: { k: 'x...............', p: 'x.x.....x.x.....', h: '..o...o...o...o.' },
    verse: { k: 'x...x...x...x...', s: '....x.......x...', p: 'x.x.....x.x.....', h: 'o.x.o.x.o.x.o.x.' },
    build: { k: 'x...x...x...x...', p: 'x.x.....x.x.....', h: 'oxoxoxoxoxoxoxox' },
    drop: { k: 'X.........x.....', s: '........X.......', h: 'o.x.o.x.o.x.o.x.', H: '......x.......x.', p: 'x.x.....x.x.....' },
    break: { p: 'x.x.....x.x.....', h: 'g...g...g...g...' },
    outro: { k: 'x...x...x...x...', s: '....x.......x...', p: 'x.x.....x.x.....', h: 'o.x.o.x.o.x.o.x.' },
  },
  bassPatch: { osc: [{ w: 'saw' }, { w: 'saw', det: 12, g: 0.7 }, { w: 'sin', oct: -1, g: 0.6 }], a: 0.003, d: 0.4, s: 0.7, r: 0.1, flt: { t: 'lp', f: 260, q: 1.1, env: 2, fd: 0.3 }, gain: 0.2, gate: 0.92 },
  bassPat: { drop: 'R---------R---O-', verse: 'R.R.R.R.R.R.R.R.', build: 'R.R.R.R.R.R.R.R.', outro: 'R.R.R.R.R.R.R.R.' },
  padPatch: DARKPAD(),
  arp: { patch: { ...PT.pluck, gain: 0.1, flt: { t: 'lp', f: 700, q: 1.2, env: 2.8, fd: 0.1, kt: 0.6 } }, pat: '0123', rate: 4, lo: 61, hi: 80 },
  lead: { osc: [{ w: 'saw', uni: 2, spr: 12, wid: 0.5 }, { w: 'sq', pw: 0.45, g: 0.4 }], a: 0.01, d: 0.4, s: 0.75, r: 0.25, vib: { r: 5, d: 0.15, dl: 0.3 }, flt: { t: 'lp', f: 2000, q: 0.9, env: 1, fd: 0.3 }, gain: 0.17, rev: 0.4, dly: 0.35, mono: true, glide: 0.05, legato: true },
  softLead: GLASS({ gain: 0.09 }),
  layers: { drop: { arp: 1 } },
  sc: { depth: 0.4, rel: 0.9 }, rt: 2.6, revWet: 0.5, dlyBeats: 0.75, dlyFb: 0.42,
  extra(ctx, sec) {
    if (sec.type === 'intro' || sec.type === 'break') riser(ctx.mx, ctx.t(sec.bar0), ctx.t(sec.bar0 + sec.bars), { f0: 120, f1: 260, q: 0.8, g: 0.05, pow: 0.6 });
  },
};
SONGS[6] = {
  index: 6, name: 'Sky Rocket', bpm: 155.79, dur: 82, difficulty: 'hard', style: 'uplifting trance', keyName: 'D major',
  key: 'D', mode: 'major', seed: 106, hookTonic: 62, mix: { pad: 0.8, stab: 1.6 },
  form: [['intro', 4, 0.4], ['verse', 8, 0.6], ['build', 4, 0.75], ['drop', 8, 0.9], ['break', 8, 0.45], ['build', 8, 0.8], ['drop', 8, 1], ['outro', 0, 0.35]],
  prog: ['Bm G D A', 'G A D A'],
  hooks: ["6:3 1':3 3':2 2':3 1':3 6:2 | 4:3 6:3 1':2 7:3 6:3 4:2 | 3:3 5:3 1':2 7:3 6:3 5:2 | 5:3 7:3 2':2 1':3 7:3 5:2",
    "6:4 1':4 2':8 | 2':4 3':4 2':8 | 3':4 5':4 4':4 3':4 | 2':12 7:2 1':2"],
  kick: { f0: 190, f1: 50, dec: 0.2, drive: 1.8, click: 0.45 },
  drums: {
    intro: { k: 'x...x...x...x...', h: '..x...x...x...x.' },
    verse: { k: 'x...x...x...x...', c: '....x.......x...', h: 'g.x.g.x.g.x.g.x.', t: 'gogogogogogogogo' },
    build: { k: 'x...x...x...x...', h: '..x...x...x...x.' },
    drop: { k: 'x...x...x...x...', c: '....x.......x...', H: '..x...x...x...x.', h: 'xgxgxgxgxgxgxgxg', r: 'x.x.x.x.x.x.x.x.' },
    break: { h: 'g.g.g.g.g.g.g.g.' },
    outro: { k: 'x...x...x...x...', c: '....x.......x...', H: '..x...x...x...x.' },
  },
  bassPatch: { osc: [{ w: 'saw' }, { w: 'sin', oct: -1, g: 0.5 }], a: 0.001, d: 0.09, s: 0.3, r: 0.03, flt: { t: 'lp', f: 340, q: 1.2, env: 2.2, fd: 0.07 }, gain: 0.24, gate: 0.85 },
  bassPat: { drop: '.RRR.RRR.RRR.RRR', verse: '.RRR.RRR.RRR.RRR', build: 'R.R.R.R.R.R.R.R.', outro: '.RRR.RRR.RRR.RRR' },
  padPatch: SUPERSAW({ a: 0.3, d: 0.6, s: 0.85, r: 0.7, gain: 0.045, flt: { t: 'lp', f: 3500, q: 0.6 } }),
  stab: { patch: SUPERSAW({ a: 0.002, d: 0.18, s: 0.3, r: 0.1, gain: 0.05 }), pat: '..x...x...x...x.', gate: 0.7, lo: 62, hi: 81 },
  arp: { patch: { ...PT.pluck, gain: 0.11 }, pat: '01234321', rate: 4, lo: 62, hi: 84 },
  lead: SUPERSAW({ a: 0.006, d: 0.3, s: 0.8, r: 0.22, gain: 0.11, vib: { r: 5.5, d: 0.12, dl: 0.3 }, mono: true, glide: 0.035, legato: true, flt: { t: 'lp', f: 6500, q: 0.7 } }),
  softLead: { ...PT.bell, gain: 0.12 }, teaseLead: { ...PT.pluck, gain: 0.1 },
  layers: { drop: { arp: 1 }, build: { lead: 'tease' } },
  sc: { depth: 0.55, rel: 0.6 }, rt: 2.8, revWet: 0.5, dlyBeats: 0.75, dlyFb: 0.4, riserG: 0.09,
};
SONGS[7] = {
  index: 7, name: 'Crystal Cave', bpm: 138.48, dur: 84, difficulty: 'harder', style: 'glassy bell arpeggios over deep bass', keyName: 'B minor',
  key: 'B', mode: 'minor', seed: 107, hookTonic: 71, mix: { arp: 1.3, kick: 1.35, drums: 1.6, bass: 0.7, lead: 0.75 },
  form: [['intro', 4, 0.35], ['verse', 8, 0.55], ['build', 4, 0.7], ['drop', 8, 0.9], ['break', 8, 0.45], ['build', 4, 0.75], ['drop', 8, 1], ['outro', 0, 0.3]],
  prog: ['Bm G Em F#', 'Bm D G F#'],
  hooks: ["5:4 3:2 1:2 3:4 5:4 | 6:4 3:2 1:2 3:4 6:4 | 4:4 6:2 1':2 7:4 6:4 | 5:4 #7:2 2':2 5:8",
    "1':6 2':2 3':4 1':4 | 3':6 5':2 3':4 7:4 | 6:6 1':2 3':4 1':4 | #7:6 5:2 2':4 5:4"],
  kick: { f0: 160, f1: 45, dec: 0.3, drive: 1.4, click: 0.35 },
  kit: { c: { ...KIT.c, rev: 0.3 }, s: { tone: 0.3, f: 420, td: 0.03, noise: 0.6, bp: 2500, bq: 1.5, nd: 0.05, g: 0.25, rev: 0.25 } },
  drums: {
    intro: { k: 'x...............', h: '..g...g...g...g.' },
    verse: { k: 'x.....x...x.....', s: '....x.......x...', h: 'gogxgogxgogxgogx', t: '.g.g.g.g.g.g.g.g' },
    build: { k: 'x...x...x...x...', h: 'gogxgogxgogxgogx' },
    drop: { k: 'x...x...x...x...', c: '....x.......x...', h: 'gogxgogxgogxgogx', H: '..x...x...x...x.', t: '.g.g.g.g.g.g.g.g' },
    break: { h: 'g...g...g...g...' },
    outro: { k: 'x...x...x...x...', c: '....x.......x...', h: 'gogxgogxgogxgogx' },
  },
  bassPatch: { osc: [{ w: 'sin' }, { w: 'tri', g: 0.25 }, { w: 'saw', g: 0.08, oct: 1 }], a: 0.004, d: 0.4, s: 0.85, r: 0.12, drive: 1.6, gain: 0.3, gate: 0.95 },
  bassPat: { drop: 'R-----R---R-----', verse: 'R-----R---R-----', build: 'R-------R-------', outro: 'R-----R---R-----' },
  bassLo: 30, subPatch: { ...PT.sub, gain: 0.28 },
  padPatch: DARKPAD({ flt: { t: 'lp', f: 1800, q: 0.6 }, gain: 0.04 }),
  arp: { patch: GLASS({ gain: 0.07, d: 0.7, r: 0.4, pan: 0.15 }), pat: '01232101', rate: 4, lo: 66, hi: 86, gate: 0.5 },
  lead: GLASS({ gain: 0.14, dly: 0.3 }),
  softLead: GLASS({ gain: 0.11, rev: 0.6 }),
  layers: { drop: { arp: 1, pad: 1 }, verse: { arp: 1 } },
  sc: { depth: 0.35, rel: 0.6 }, rt: 3.2, revWet: 0.55, revSize: 1.3, dlyBeats: 0.75, dlyFb: 0.45, dlyWet: 0.5,
  extra(ctx, sec) {
    if (sec.type !== 'intro' && sec.type !== 'break') return;
    const r = rng(sec.bar0 + 7);
    for (let b = 0; b < sec.bars * 4; b += 1 + Math.floor(r() * 3)) {
      play(ctx.mx, { osc: [{ w: 'sin' }], a: 0.001, d: 0.08, s: 0, r: 0.1, pe: { a: 14, d: 0.012 }, gain: 0.07, rev: 0.6, dly: 0.4, pan: r() * 1.4 - 0.7 },
        [{ t: ctx.t(sec.bar0) + (b + r() * 0.5) * ctx.spb, d: 0.05, m: 84 + Math.floor(r() * 12) }]);
    }
  },
};
SONGS[8] = {
  index: 8, name: 'Thunder Road', bpm: 178.05, dur: 86, difficulty: 'harder', style: 'drum and bass', keyName: 'C minor',
  key: 'C', mode: 'minor', seed: 108, hookTonic: 60, mix: { drums: 0.9, kick: 1.25, bass: 0.8 },
  form: [['intro', 8, 0.4], ['build', 8, 0.7], ['drop', 16, 0.95], ['break', 8, 0.45], ['build', 8, 0.8], ['drop', 12, 1], ['outro', 0, 0.35]],
  prog: ['Cm Ab Eb Bb', 'Fm Ab Bb G'],
  hooks: ['5:6 4:2 3:4 1:4 | 6:6 5:2 3:4 1:4 | 5:6 4:2 3:4 7,:4 | 4:6 3:2 2:8',
    "1':4 6:2 4:2 6:4 1':4 | 3':4 1':2 6:2 1':4 3':4 | 2':4 7:2 4:2 7:4 2':4 | #7:4 5:2 2:2 5:8"],
  kick: { f0: 180, f1: 50, dec: 0.16, drive: 1.8, click: 0.55 },
  kit: { s: { tone: 0.6, f: 200, pa: 0.5, td: 0.05, noise: 0.9, hp: 1200, lp: 10000, nd: 0.1, g: 0.45, rev: 0.12 },
    r: { ...KIT.r, g: 0.08 } },
  drums: {
    intro: { r: 'x.x.x.x.x.x.x.x.', t: 'gogogogogogogogo' },
    build: { k: 'x.........x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
    drop: { k: 'x.........x.....x.........x..x..', s: '....X..o.o..X..o....X..o.o..X...', h: 'x.x.x.x.x.x.x.x.', t: 'gogogogogogogogo', r: '..x...x...x...x.' },
    break: { r: 'x...x...x...x...', t: 'g.g.g.g.g.g.g.g.' },
    outro: { k: 'x.........x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
  },
  bassPatch: { osc: [{ w: 'saw', uni: 2, spr: 28, wid: 0.3 }, { w: 'saw', det: -14, g: 0.7 }, { w: 'sin', oct: -1, g: 0.7 }], a: 0.004, d: 0.5, s: 0.85, r: 0.08, drive: 2.2,
    flt: { t: 'lp', f: 480, q: 1.4, lfo: { r: 0.37, d: 1.4, sh: 'sin', reset: false } }, gain: 0.2, gate: 0.97, mono: true, legato: true, glide: 0.02 },
  bassPat: { drop: 'R---------R---5-', build: 'R-------R-------', outro: 'R---------R-----' },
  padPatch: DARKPAD({ gain: 0.05 }),
  stab: { patch: { osc: [{ w: 'saw', uni: 3, spr: 12 }, { w: 'sq', g: 0.4 }], a: 0.001, d: 0.15, s: 0.2, r: 0.12, flt: { t: 'lp', f: 2200, q: 1, env: 1.5, fd: 0.1 }, gain: 0.045, rev: 0.3, dly: 0.25 }, pat: 'x.........x.....', gate: 0.8, lo: 60, hi: 79 },
  arp: { patch: { ...PT.pluck, gain: 0.09 }, pat: '0.2.1.3.', rate: 4, lo: 60, hi: 82 },
  lead: { osc: [{ w: 'saw', uni: 3, spr: 14, wid: 0.5 }, { w: 'sq', g: 0.35 }], a: 0.006, d: 0.35, s: 0.7, r: 0.2, vib: { r: 5.5, d: 0.12, dl: 0.25 }, flt: { t: 'lp', f: 3000, q: 0.8, env: 1, fd: 0.25 }, gain: 0.15, rev: 0.3, dly: 0.3, mono: true, glide: 0.03, legato: true },
  softLead: { ...PT.bell, gain: 0.11 },
  layers: { intro: { arp: 0 } },
  sc: { depth: 0.35, rel: 0.5 }, rt: 2.4, revWet: 0.45, dlyBeats: 0.75, dlyFb: 0.35,
  extra(ctx, sec) {
    if (sec.type !== 'intro' && sec.type !== 'break') return;
    const r = rng(sec.bar0 + 3), t0 = ctx.t(sec.bar0);
    for (let k = 0; k < sec.bars / 4; k++) {
      const tt = t0 + (k * 4 + r() * 2) * ctx.barS;
      drum(ctx.mx, tt, { noise: 1, hp: 1500, nd: 0.06, g: 0.25 * TRIM.drums * 0.5, wide: true, rev: 0.6 });
      drum(ctx.mx, tt + 0.02, { noise: 1, lp: 260, nd: 1.2, g: 0.6, wide: true, rev: 0.3 });
    }
  },
};
SONGS[9] = {
  index: 9, name: 'Lava Lift', bpm: 155.79, dur: 88, difficulty: 'harder', style: 'heavy electro-house with big saw stabs', keyName: 'G minor',
  key: 'G', mode: 'minor', seed: 109, hookTonic: 67, leadChords: 3, mix: { lead: 1.3, kick: 0.75 },
  form: [['intro', 8, 0.4], ['build', 4, 0.7], ['drop', 16, 0.95], ['break', 8, 0.45], ['build', 8, 0.8], ['drop', 8, 1], ['outro', 0, 0.35]],
  prog: ['Gm Eb Bb F', 'Cm Eb D D'],
  hooks: ['5:3 5:3 3:4 4:2 5:2 r:2 | 6:3 6:3 5:4 3:2 1:2 r:2 | 5:3 5:3 3:4 4:2 5:2 r:2 | 4:3 4:3 2:4 7,:2 2:2 r:2',
    "1':3 6:3 4:2 1':3 6:3 4:2 | 3':3 1':3 6:2 3':3 1':3 6:2 | 2':3 #7:3 5:2 2':3 #7:3 5:2 | 5:4 #7:4 2':4 5':4"],
  kick: { f0: 210, f1: 49, dec: 0.22, drive: 2.4, click: 0.5 },
  kit: { c: { ...KIT.c, g: 0.5, nd: 0.16, rev: 0.25 } },
  drums: {
    intro: { k: 'x...x...x...x...', h: '..x...x...x...x.', t: 'gogogogogogogogo' },
    build: { k: 'x...x...x...x...', h: '..x...x...x...x.' },
    drop: { k: 'x...x...x...x...', c: '....X.......X...', h: 'xoxoxoxoxoxoxoxo', H: '..x...x...x...x.' },
    break: { t: 'gogogogogogogogo' },
    outro: { k: 'x...x...x...x...', c: '....x.......x...', h: '..x...x...x...x.' },
  },
  bassPatch: { osc: [{ w: 'saw' }, { w: 'sq', det: 7, g: 0.6 }, { w: 'sin', oct: -1, g: 0.6 }], a: 0.002, d: 0.12, s: 0.6, r: 0.04, drive: 2.8, flt: { t: 'lp', f: 380, q: 1.3, env: 2.4, fd: 0.08 }, gain: 0.2, gate: 0.8 },
  bassPat: { drop: '..RR..R...RR..RO', build: 'R.R.R.R.R.R.R.R.', outro: '..R...R...R...R.' },
  padPatch: DARKPAD({ gain: 0.035 }),
  arp: { patch: { ...PT.pluck, gain: 0.09 }, pat: '0213', rate: 4, lo: 62, hi: 82 },
  lead: SUPERSAW({ a: 0.002, d: 0.22, s: 0.5, r: 0.12, drive: 1.8, gain: 0.06, flt: { t: 'lp', f: 1600, q: 1, env: 2.2, fd: 0.16 }, dly: 0.15 }),
  softLead: { ...PT.bell, gain: 0.11 },
  sc: { depth: 0.5, rel: 0.5 }, rt: 2.0, revWet: 0.4, dlyBeats: 0.75, dlyFb: 0.3,
  extra(ctx, sec) {
    if (sec.type !== 'intro' && sec.type !== 'break') return;
    const r = rng(sec.bar0 + 19);
    for (let b = 0; b < sec.bars * 8; b += 1 + Math.floor(r() * 4)) {
      play(ctx.mx, { osc: [{ w: 'sin' }, { w: 'tri', g: 0.3 }], a: 0.002, d: 0.12, s: 0, r: 0.08, pe: { a: -9, d: 0.04 }, gain: 0.08, rev: 0.4, pan: r() * 1.2 - 0.6 },
        [{ t: ctx.t(sec.bar0) + b * ctx.spb / 2, d: 0.08, m: 50 + Math.floor(r() * 10) }]);
    }
  },
};

SONGS[10] = {
  index: 10, name: 'Star Factory', bpm: 138.48, dur: 90, difficulty: 'insane', style: 'funky electro', keyName: 'Eb major',
  key: 'Eb', mode: 'major', seed: 110, mix: { bass: 0.7, lead: 0.8, stab: 1.8 }, hookTonic: 63,
  form: [['intro', 4, 0.4], ['verse', 8, 0.6], ['build', 4, 0.75], ['drop', 8, 0.95], ['break', 8, 0.5], ['build', 4, 0.8], ['drop', 12, 1], ['outro', 0, 0.35]],
  prog: ['Ebmaj7 Cm7 Abmaj7 Bb7', 'Fm7 Gm7 Abmaj7 Bb7'],
  hooks: ["5:1 r:1 5:1 6:1 1':2 6:1 5:3 3:2 5:2 r:2 | 6:1 r:1 6:1 1':1 3':2 1':1 6:3 5:2 6:2 r:2 | 4:1 r:1 4:1 6:1 1':2 6:1 4:3 3:2 4:2 r:2 | 5:2 7:2 2':2 4':2 3':1 2':1 1':2 7:4",
    "2':2 r:1 2':1 4':2 2':1 1':3 6:2 4:2 r:2 | 3':2 r:1 3':1 5':2 3':1 2':3 7:2 5:2 r:2 | 4':2 r:1 4':1 6':2 4':1 3':3 1':2 6:2 r:2 | 5:2 7:2 2':2 4':2 5':4 r:4"],
  kick: { f0: 170, f1: 51, dec: 0.22, drive: 1.6, click: 0.4 },
  kit: { w: { ...KIT.w, g: 0.09 }, a: { type: 'clang', f: 610, dec: 0.12, idx: 3.5, g: 0.07, pan: -0.4, dly: 0.2 } },
  drums: {
    intro: { k: 'x...x...x...x...', h: 'g.x.g.x.g.x.g.x.', a: '......x.......x.' },
    verse: { k: 'x...x...x...x...', c: '....x.......x...', h: 'gxgxgxgxgxgxgxgx', w: '...x.......x..x.', a: '......x.......x.' },
    build: { k: 'x...x...x...x...', h: 'gxgxgxgxgxgxgxgx' },
    drop: { k: 'x...x...x...x...', c: '....x.......x...', H: '..x...x...x...x.', h: 'xgxgxgxgxgxgxgxg', w: '...x.......x..x.', a: '......x.......x.' },
    break: { h: 'g.x.g.x.g.x.g.x.', a: '......x.......x.' },
    outro: { k: 'x...x...x...x...', c: '....x.......x...', H: '..x...x...x...x.' },
  },
  bassPatch: { osc: [{ w: 'sq', pw: 0.5 }, { w: 'saw', g: 0.6 }, { w: 'sin', oct: -1, g: 0.5 }], a: 0.002, d: 0.14, s: 0.5, r: 0.04, flt: { t: 'lp', f: 420, q: 2.2, env: 2.4, fd: 0.09 }, gain: 0.2, gate: 0.6 },
  bassPat: { drop: 'R.R..O.RR..R.5.O', verse: 'R.R..O.RR..R.5.O', build: 'R.R.R.R.R.R.R.R.', outro: 'R...R...R...R...' },
  padPatch: { ...PT.warmPad, gain: 0.035 },
  stab: { patch: { osc: [{ w: 'sq', pw: 0.18 }, { w: 'saw', g: 0.5 }], a: 0.001, d: 0.12, s: 0.05, r: 0.05, reset: true, flt: { t: 'bp', f: 900, q: 1.6, env: 2, fd: 0.06 }, gain: 0.08, pan: 0.25, dly: 0.08 }, pat: '.x.x..x..x.x..xx', gate: 0.6, lo: 60, hi: 77, size: 3 },
  arp: { patch: { ...PT.pluck, gain: 0.08 }, pat: '0.2.1.3.', rate: 4, lo: 63, hi: 84 },
  lead: { osc: [{ w: 'saw', uni: 2, spr: 8 }, { w: 'sq', pw: 0.4, g: 0.5 }], a: 0.01, d: 0.25, s: 0.7, r: 0.1, flt: { t: 'lp', f: 1500, q: 1, env: 1.8, fd: 0.18, kt: 0.5 }, vib: { r: 5.8, d: 0.12, dl: 0.2 }, gain: 0.15, rev: 0.2, dly: 0.22, mono: true, glide: 0.03, legato: true },
  softLead: { ...PT.vibes, gain: 0.12 },
  layers: { verse: { stab: 1, arp: 0 } },
  sc: { depth: 0.45, rel: 0.5 }, rt: 1.6, revWet: 0.35, dlyBeats: 0.75, dlyFb: 0.3,
};
SONGS[11] = {
  index: 11, name: 'Frost Bite', bpm: 178.05, dur: 92, difficulty: 'insane', style: 'fast chiptune-trance', keyName: 'A minor',
  key: 'A', mode: 'minor', seed: 111, mix: { drums: 0.65, pad: 1.8, arp: 1.3 }, hookTonic: 69,
  form: [['intro', 8, 0.4], ['build', 8, 0.7], ['drop', 16, 0.95], ['break', 8, 0.5], ['build', 8, 0.8], ['drop', 16, 1], ['outro', 0, 0.35]],
  prog: ['Am F G Em', 'F G Am E'],
  hooks: ["1':2 5:2 3:2 5:2 1':2 2':2 3':2 2':2 | 1':2 6:2 3:2 6:2 1':2 2':2 3':2 1':2 | 2':2 7:2 4:2 7:2 2':2 3':2 4':2 2':2 | 5:2 2:2 7,:2 2:2 5:4 7:4",
    "3':4 2':4 1':4 6:4 | 2':4 1':4 7:4 4:4 | 3':4 5':4 3':4 1':4 | #7:4 2':4 5':8"],
  kick: { f0: 200, f1: 52, dec: 0.17, drive: 1.8, click: 0.5 },
  kit: { h: { type: 'chip', rate: 24000, dec: 0.02, g: 0.14, short: true }, H: { type: 'chip', rate: 15000, dec: 0.07, g: 0.1 }, s: { type: 'chip', rate: 7000, dec: 0.09, g: 0.26, and: 'c' }, c: { ...KIT.c, g: 0.3 } },
  drums: {
    intro: { k: 'x...x...x...x...', h: 'x.x.x.x.x.x.x.x.' },
    build: { k: 'x...x...x...x...', h: 'x.x.x.x.x.x.x.x.' },
    drop: { k: 'x...x...x...x...', s: '....x.......x...', H: '..x...x...x...x.', h: 'xxx.xxx.xxx.xxx.' },
    break: { h: 'o.o.o.o.o.o.o.o.' },
    outro: { k: 'x...x...x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
  },
  bassPatch: { osc: [{ w: 'sq', pw: 0.5 }, { w: 'sin', oct: -1, g: 0.6 }], a: 0.001, d: 0.06, s: 0.4, r: 0.02, flt: { t: 'lp', f: 500, q: 1, env: 2, fd: 0.05 }, gain: 0.22, gate: 0.8 },
  bassPat: { drop: '.RRR.RRR.RRR.RRR', build: 'R.R.R.R.R.R.R.R.', outro: '.RRR.RRR.RRR.RRR' },
  padPatch: SUPERSAW({ a: 0.003, d: 0.1, s: 0.7, r: 0.05, gain: 0.04 }), padOpt: { drop: { pat: 'x.xxx.xxx.xxx.xx', gate: 0.6 }, outro: { pat: 'x.xxx.xxx.xxx.xx', gate: 0.6 } },
  arp: { patch: { osc: [{ w: 'sq', pw: 0.125 }], a: 0.001, d: 0.04, s: 0.6, r: 0.015, flt: { t: 'lp', f: 7500, q: 0.6 }, gain: 0.07, dly: 0.15, pan: 0.25 }, pat: '0123', rate: 8, lo: 69, hi: 88, gate: 0.85 },
  lead: { osc: [{ w: 'sq', pw: 0.25 }, { w: 'sq', pw: 0.5, det: 8, g: 0.4 }], a: 0.001, d: 0.1, s: 0.8, r: 0.04, vib: { r: 6.5, d: 0.15, dl: 0.1 }, flt: { t: 'lp', f: 7000, q: 0.6 }, gain: 0.12, dly: 0.2, rev: 0.12, mono: true },
  softLead: GLASS({ gain: 0.1 }),
  layers: { drop: { arp: 1 }, build: { lead: 'tease' } }, teaseLead: { ...PT.pluck, gain: 0.08 },
  sc: { depth: 0.5, rel: 0.6 }, rt: 2.2, revWet: 0.4, dlyBeats: 0.75, dlyFb: 0.35,
  extra(ctx, sec) {
    if (sec.type !== 'intro' && sec.type !== 'break') return;
    const r = rng(sec.bar0 + 11);
    for (let b = 0; b < sec.bars * 4; b += 1 + Math.floor(r() * 2)) {
      const c = chordAt(sec.harm, sec.bar0 * 4 + b), m = 84 + c.tones[Math.floor(r() * c.tones.length)];
      play(ctx.mx, GLASS({ gain: 0.06, pan: r() * 1.4 - 0.7 }), [{ t: ctx.t(sec.bar0) + b * ctx.spb, d: 0.1, m: m > 96 ? m - 12 : m }]);
    }
  },
};
const WOB = [2, 3, 4, 1];
SONGS[12] = {
  index: 12, name: 'Laser Maze', bpm: 155.79, dur: 94, difficulty: 'insane', style: 'half-time wobble bass with laser zaps', keyName: 'F minor',
  key: 'F', mode: 'minor', seed: 112, mix: { drums: 0.6, bass: 0.6, kick: 1.3, lead: 1.4 }, hookTonic: 65,
  form: [['intro', 8, 0.4], ['build', 4, 0.7], ['drop', 16, 0.95], ['break', 8, 0.5], ['build', 8, 0.8], ['drop', 12, 1], ['outro', 0, 0.35]],
  prog: ['Fm Db Ab Eb', 'Bbm Db Eb C'],
  hooks: ["5:2 1':2 r:2 1':2 7:2 5:2 3:4 | 6:2 1':2 r:2 1':2 3':2 1':2 6:4 | 5:2 7:2 r:2 7:2 1':2 7:2 5:4 | 4:2 7:2 r:2 7:2 2':2 7:2 4:4",
    "4:4 6:4 1':6 r:2 | 6:4 1':4 3':6 r:2 | 7:4 2':4 4':6 r:2 | 5:4 #7:4 2':8"],
  kick: { f0: 190, f1: 46, dec: 0.3, drive: 2, click: 0.5 },
  kit: { s: { tone: 0.5, f: 180, pa: 0.5, td: 0.07, noise: 1, hp: 800, lp: 9000, nd: 0.2, g: 0.5, rev: 0.3, drive: 1.4 } },
  drums: {
    intro: { k: 'x...............', h: 'x.x.x.x.x.x.x.x.' },
    build: { k: 'x...x...x...x...', h: 'x.x.x.x.x.x.x.x.' },
    drop: { k: 'X.........x.....', s: '........X.......', h: 'x.xgx.xgx.xgx.xg', H: '......x.........' },
    break: { h: 'g.g.g.g.g.g.g.g.' },
    outro: { k: 'X.........x.....', s: '........x.......', h: 'x.x.x.x.x.x.x.x.' },
  },
  bassPatch: { osc: [{ w: 'saw' }, { w: 'sq', oct: -1, g: 0.7 }, { w: 'sin', oct: -1, g: 0.5 }], a: 0.004, d: 0.5, s: 0.9, r: 0.06, drive: 2.5,
    flt: { t: 'lp', f: 110, q: 2.6, lfo: { r: 4, d: 4.6, sh: 'sin', ph: 0 } }, gain: 0.22, gate: 0.97, mono: true, legato: true, glide: 0.02 },
  bassPat: { drop: 'R-------R---R-R-', build: 'R-------R-------', outro: 'R-------R-------' },
  bassOpt: (ctx, sec) => ({ lfo: s => ctx.S.bpm / 60 * (sec.type === 'drop' ? WOB[(s >> 4) % 4] : 1) }),
  padPatch: DARKPAD({ gain: 0.04 }),
  arp: { patch: { ...PT.pluck, gain: 0.09 }, pat: '0.1.2.3.', rate: 4, lo: 60, hi: 82 },
  lead: { osc: [{ w: 'saw', uni: 3, spr: 12, wid: 0.6 }, { w: 'sq', g: 0.3 }], a: 0.004, d: 0.3, s: 0.6, r: 0.15, flt: { t: 'lp', f: 2600, q: 1, env: 1.4, fd: 0.2 }, gain: 0.13, rev: 0.3, dly: 0.35, mono: true, glide: 0.03, legato: true },
  softLead: GLASS({ gain: 0.1 }),
  sc: { depth: 0.4, rel: 1.0 }, rt: 2.4, revWet: 0.45, dlyBeats: 0.75, dlyFb: 0.38,
  extra(ctx, sec, L, bars) {
    if (sec.type !== 'drop' && sec.type !== 'build') return;
    const steps = sec.type === 'drop' ? [2, 7, 11] : [14];
    for (let b = 0; b < bars; b++) steps.forEach((s, k) => {
      const t = ctx.t(sec.bar0 + b, s);
      if (!ctx.stopped(t)) zap(ctx.mx, t, { f0: 2600 + 800 * ((b + k) % 3), f1: 140 + 40 * k, d: 0.14 + 0.04 * k, pan: (k % 2 ? 0.6 : -0.6), g: 0.1, sq: k !== 1 });
    });
  },
};
const GROWL = { osc: [{ w: 'fm', ratio: 0.5, idx: 3.2 }, { w: 'saw', g: 0.5 }], fms: 0.6, fmd: 0.06, a: 0.002, d: 0.1, s: 0.8, r: 0.02, drive: 3, flt: { t: 'lp', f: 900, q: 2, env: 1.5, fd: 0.06 }, gain: 0.17 };
const SQB = { osc: [{ w: 'sq', pw: 0.3 }, { w: 'sin', oct: -1, g: 0.6 }], a: 0.002, d: 0.08, s: 0.7, r: 0.02, drive: 2, flt: { t: 'bp', f: 700, q: 2.5, env: 2, fd: 0.05 }, gain: 0.2 };
const FMB = { osc: [{ w: 'fm', ratio: 2.01, idx: 5 }, { w: 'sin', g: 0.5 }], fms: 0.3, fmd: 0.05, a: 0.001, d: 0.1, s: 0.7, r: 0.02, drive: 2.5, flt: { t: 'lp', f: 2400, q: 1 }, gain: 0.15 };
const SAWB = { osc: [{ w: 'saw', uni: 2, spr: 20 }, { w: 'sin', oct: -1, g: 0.6 }], a: 0.002, d: 0.08, s: 0.7, r: 0.02, drive: 2.5, flt: { t: 'lp', f: 300, q: 2.5, env: 3, fd: 0.07 }, gain: 0.2 };
SONGS[13] = {
  index: 13, name: 'Black Hole', bpm: 138.48, dur: 96, difficulty: 'demon', style: 'dark aggressive complextro with glitch fills', keyName: 'C# minor',
  key: 'C#', mode: 'minor', seed: 113, mix: { drums: 0.4, bass: 1.4, lead: 1.2 }, hookTonic: 61,
  form: [['intro', 8, 0.45], ['build', 4, 0.75], ['drop', 16, 1], ['break', 8, 0.5], ['build', 4, 0.8], ['drop', 12, 1], ['outro', 0, 0.35]],
  prog: ['C#m A F#m G#', 'C#m B A G#'],
  hooks: ["1:2 1:1 1:1 3:2 1:2 5:3 4:3 3:2 | 6:2 6:1 6:1 1':2 6:2 3':3 2':3 1':2 | 4:2 4:1 4:1 6:2 4:2 1':3 7:3 6:2 | 5:2 5:1 5:1 #7:2 5:2 2':4 #7:2 5:2",
    "1':3 7:3 5:2 r:2 5:2 3:2 5:2 | 7:3 6:3 4:2 r:2 4:2 2:2 4:2 | 6:3 5:3 3:2 r:2 3:2 1:2 3:2 | 5:3 #7:3 2':2 r:2 5:6"],
  kick: { f0: 230, f1: 48, dec: 0.2, drive: 3, click: 0.6, lp: 8000 },
  kit: { s: { tone: 0.5, f: 220, pa: 0.6, td: 0.05, noise: 1, hp: 1000, nd: 0.14, g: 0.45, drive: 2, rev: 0.2 }, c: { ...KIT.c, g: 0.35 } },
  drums: {
    intro: { k: 'x.......x.......', h: 'gogogogogogogogo' },
    build: { k: 'x...x...x...x...', h: 'xoxoxoxoxoxoxoxo' },
    drop: { k: 'x...x...x...x..x', s: '....X.......X...', c: '....x.......x...', h: 'xoxoxoxoxoxoxoxo', H: '..x...x...x...x.' },
    break: { h: 'g.g.g.g.g.g.g.g.' },
    outro: { k: 'x...x...x...x...', s: '....x.......x...', h: 'xoxoxoxoxoxoxoxo' },
  },
  bassPatch: SAWB, bassPat: { build: 'R.R.R.R.R.R.R.R.', outro: 'R.R.R.R.R.R.R.R.' }, bassLo: 25,
  padPatch: DARKPAD({ gain: 0.04 }),
  arp: { patch: { ...PT.pluck, gain: 0.09 }, pat: '0.1.2.1.', rate: 4, lo: 61, hi: 80 },
  lead: { osc: [{ w: 'saw', uni: 2, spr: 18 }, { w: 'sq', pw: 0.3, g: 0.5 }], a: 0.002, d: 0.2, s: 0.7, r: 0.06, drive: 2.4, flt: { t: 'lp', f: 2200, q: 1.4, env: 1.6, fd: 0.12 }, gain: 0.12, rev: 0.2, dly: 0.2, mono: true, glide: 0.02 },
  softLead: GLASS({ gain: 0.1 }),
  layers: { drop: { bass: 0 } },
  sc: { depth: 0.5, rel: 0.45 }, rt: 1.8, revWet: 0.35, dlyBeats: 0.5, dlyFb: 0.3,
  extra(ctx, sec, L, bars) {
    if (sec.type !== 'drop') return;
    const pat = 'R.RR.R.RRR.R.RO.', patches = [GROWL, SQB, FMB, SAWB], lists = patches.map(() => []);
    for (let s = 0; s < bars * 16; s++) {
      const ch = pat[s % 16], t = ctx.t(sec.bar0, s);
      if (ch === '.' || ctx.stopped(t)) continue;
      lists[Math.floor(s / 2) % 4].push({ t, d: ctx.st * 0.85, m: bassNote(chordAt(sec.harm, t / ctx.spb), 25) + (ch === 'O' ? 12 : 0) });
    }
    if (ctx.on('bass')) patches.forEach((P, k) => play(ctx.mx, P, lists[k], { gain: ctx.g('bass') }));
    const spb = ctx.spb;
    for (let b = 4; b <= bars; b += 4) {
      const tEnd = ctx.t(sec.bar0 + b);
      if (b === bars && sec.n === 1) {
        ctx.post.push((Lb, Rb, n) => tapeStop(Lb, Rb, n, tEnd - 2 * spb, 2 * spb));
        ctx.cues.push({ beat: (sec.bar0 + b) * 4 - 2, type: 'tapestop' });
        continue;
      }
      if (b === bars) continue;
      ctx.post.push((Lb, Rb, n) => stutter(Lb, Rb, n, tEnd - spb, spb / 4, 4, { decay: 0.92 }));
      if (b % 8 === 0) ctx.post.push((Lb, Rb, n) => { stutter(Lb, Rb, n, tEnd - spb / 2, spb / 8, 4, { pitch: 1.12 }); crush(Lb, Rb, n, tEnd - 2 * spb, tEnd - spb, 6, 4); });
    }
  },
};
SONGS[14] = {
  index: 14, name: 'Overdrive', bpm: 178.05, dur: 100, difficulty: 'demon', style: 'epic finale with hard kicks and a soaring lead', keyName: 'E minor',
  key: 'E', mode: 'minor', seed: 114, mix: { kick: 0.8, bass: 1.3, lead: 1.25, stab: 1.5 }, hookTonic: 64,
  form: [['intro', 8, 0.45], ['build', 8, 0.75], ['drop', 16, 0.95], ['break', 8, 0.5], ['build', 8, 0.85], ['drop', 20, 1], ['outro', 0, 0.4]],
  prog: ['Em C G D', 'Am C D B'],
  hooks: ["5:6 4:2 3:4 5:4 | 1':6 7:2 6:4 3:4 | 3':6 2':2 7:4 5:4 | 4:6 7:2 2':8",
    "4:4 6:4 1':8 | 6:4 1':4 3':8 | 7:4 2':4 4':8 | 5':4 #7:4 2':4 5':4"],
  kick: { f0: 320, f1: 41, pd: 0.025, hold: 0.025, dec: 0.15, drive: 5, click: 0.6, lp: 5500 },
  kit: { c: { ...KIT.c, g: 0.5, rev: 0.25 }, m: { ...KIT.m, g: 0.4, rev: 0.3 } },
  drums: {
    intro: { k: 'x...x...x...x...', H: '..x...x...x...x.' },
    build: { k: 'x...x...x...x...', h: '..x...x...x...x.' },
    drop: { k: 'x...x...x...x...', c: '....X.......X...', H: '..x...x...x...x.', h: 'xgxgxgxgxgxgxgxg', r: 'x.x.x.x.x.x.x.x.' },
    break: { m: 'x.....x.x.....x.x.....x.x..x.x.x', h: 'g.g.g.g.g.g.g.g.' },
    outro: { k: 'x...x...x...x...', c: '....x.......x...', H: '..x...x...x...x.' },
  },
  bassPatch: { osc: [{ w: 'saw' }, { w: 'sin', oct: -1, g: 0.6 }], a: 0.001, d: 0.08, s: 0.4, r: 0.03, drive: 1.6, flt: { t: 'lp', f: 360, q: 1.2, env: 2.2, fd: 0.06 }, gain: 0.22, gate: 0.85 },
  bassPat: { drop: '.RRR.RRR.RRR.RRR', build: 'R.R.R.R.R.R.R.R.', outro: '.RRR.RRR.RRR.RRR' },
  padPatch: { osc: [{ w: 'saw', uni: 6, spr: 22, wid: 0.9 }], a: 0.4, d: 0.8, s: 0.85, r: 0.9, flt: { t: 'bp', f: 950, q: 0.8, kt: 0.2 }, vib: { r: 4.5, d: 0.08, dl: 0.3 }, gain: 0.08, rev: 0.55 },
  stab: { patch: SUPERSAW({ a: 0.002, d: 0.16, s: 0.3, r: 0.1, gain: 0.05 }), pat: '..x...x...x...x.', gate: 0.7, lo: 59, hi: 79 },
  arp: { patch: { ...PT.pluck, gain: 0.1 }, pat: '01232123', rate: 4, lo: 64, hi: 86 },
  lead: SUPERSAW({ a: 0.008, d: 0.4, s: 0.85, r: 0.3, gain: 0.11, vib: { r: 5.5, d: 0.15, dl: 0.25 }, mono: true, glide: 0.05, legato: true, flt: { t: 'lp', f: 6000, q: 0.7 }, dly: 0.25 }),
  softLead: { ...PT.bell, gain: 0.12 }, teaseLead: { ...PT.pluck, gain: 0.1 },
  layers: { drop: { arp: 1 }, build: { lead: 'tease' } },
  sc: { depth: 0.55, rel: 0.55 }, rt: 2.8, revWet: 0.5, dlyBeats: 0.75, dlyFb: 0.38, riserG: 0.09, impactG: 0.35,
};

// ------------------------------------------------------------------ verification
function decode(file, mono = true) {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-i', file, '-ac', mono ? '1' : '2', '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error('decode failed: ' + file);
  return new Float32Array(r.stdout.buffer.slice(r.stdout.byteOffset, r.stdout.byteOffset + r.stdout.length));
}
function probe(file) {
  const r = spawnSync(FFPROBE, ['-v', 'error', '-show_entries', 'stream=codec_name,sample_rate,channels:format=duration,size', '-of', 'json', file], { encoding: 'utf8' });
  const j = JSON.parse(r.stdout), s = j.streams[0];
  return { codec: s.codec_name, sr: +s.sample_rate, ch: s.channels, dur: +j.format.duration, size: +j.format.size };
}
function ebur(file) {
  const e = ff(['-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-']);
  const I = [...e.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].pop()?.[1], P = [...e.matchAll(/Peak:\s+(-?[\d.]+|-inf) dBFS/g)].pop()?.[1];
  return { I: +I, TP: +P };
}
// Onset at beat 0: first 1 ms frame whose RMS reaches 10% of the loudest frame in the first beat.
function firstOnsetMs(x, spb) {
  const hop = SR / 1000, nF = Math.floor(spb * 1000);
  const rms = [];
  for (let f = 0; f < nF; f++) { let e = 0; for (let i = f * hop; i < (f + 1) * hop; i++) e += x[i] * x[i]; rms.push(Math.sqrt(e / hop)); }
  const mx = Math.max(...rms);
  return { onset: rms.findIndex(v => v >= 0.1 * mx), peak: rms.indexOf(mx) };
}
// Beat-grid check: for every beat in the drops (a kick lands on each), find the time within ±25 ms where the
// energy of the next 10 ms minus the energy of the previous 10 ms is largest (0.5 ms steps); report |offset| from the grid.
function gridCheck(x, spb, secs) {
  const P = new Float64Array(x.length + 1), W = 480;
  for (let i = 0; i < x.length; i++) P[i + 1] = P[i] + x[i] * x[i];
  const offs = [];
  for (const s of secs.filter(q => q.name.startsWith("drop"))) {
    for (let b = s.startBeat; b < s.endBeat; b++) {
      const c = Math.round(b * spb * SR);
      let best = -Infinity, bi = c;
      for (let t = c - 1200; t <= c + 1200; t += 24) {
        if (t - W < 0 || t + W > x.length) continue;
        const d = (P[t + W] - P[t]) - (P[t] - P[t - W]);
        if (d > best) { best = d; bi = t; }
      }
      offs.push(Math.abs(bi - c) / SR * 1000);
    }
  }
  offs.sort((p, q) => p - q);
  return { beats: offs.length, median: offs[offs.length >> 1].toFixed(1), p90: offs[Math.floor(offs.length * 0.9)].toFixed(1) };
}
function seamCheck(file) {
  const x = decode(file, false), n = x.length / 2, step = (i, j) => Math.max(Math.abs(x[2 * i] - x[2 * j]), Math.abs(x[2 * i + 1] - x[2 * j + 1]));
  const steps = [];
  for (let i = 1; i < n; i += 3) steps.push(step(i, i - 1));
  steps.sort((a, b) => a - b);
  return { seam: step(0, n - 1), median: steps[steps.length >> 1], p99: steps[Math.floor(steps.length * 0.99)], max: steps[steps.length - 1] };
}
function verify() {
  let tl = { songs: [] };
  try { tl = JSON.parse(fs.readFileSync(OUT_TIMELINE, 'utf8')); } catch { /* reported below */ }
  const rows = [], problems = [];
  let total = 0;
  const check = (file, label, durOk) => {
    if (!fs.existsSync(file)) { problems.push(`${label}: missing`); return null; }
    const p = probe(file);
    total += p.size;
    if (p.codec !== 'vorbis' || p.sr !== SR || p.ch !== 2) problems.push(`${label}: ${p.codec} ${p.sr} Hz ${p.ch} ch`);
    if (!durOk(p.dur)) problems.push(`${label}: duration ${p.dur}`);
    return p;
  };
  console.log('\nverification');
  for (const S of SONGS) {
    const file = path.join(OUT_MUSIC, S.index + '.ogg'), p = check(file, `${S.index}.ogg`, d => Math.abs(d - S.dur) <= 0.1);
    if (!p) continue;
    const L = ebur(file), x = decode(file), spb = 60 / S.bpm, on = firstOnsetMs(x, spb);
    const entry = tl.songs.find(s => s.index === S.index), grid = entry ? gridCheck(x, spb, entry.sections) : null;
    if (p.size > 1100000) problems.push(`${S.index}.ogg: ${p.size} B > 1.1 MB`);
    if (L.TP > -1.0) problems.push(`${S.index}.ogg: true peak ${L.TP} dBTP`);
    if (on.onset > 10) problems.push(`${S.index}.ogg: first onset at ${on.onset} ms`);
    if (!entry) problems.push(`${S.index}: missing from timeline.json`);
    rows.push(`${String(S.index).padStart(2)}.ogg ${S.name.padEnd(13)} ${p.dur.toFixed(3)} s (spec ${S.dur}) ${(p.size / 1024).toFixed(0).padStart(5)} KiB  I ${L.I.toFixed(1)} LUFS  TP ${L.TP.toFixed(1)} dBTP  onset ${on.onset} ms (peak ${on.peak} ms)` + (grid ? `  drop-beat kick offset median ${grid.median} ms p90 ${grid.p90} ms over ${grid.beats} beats` : ''));
  }
  const loops = [['menuLoop', 30, 45], ['practice', 40, 60]];
  for (const [name, lo, hi] of loops) {
    const file = path.join(OUT_SFX, name + '.ogg'), p = check(file, name + '.ogg', d => d >= lo && d <= hi);
    if (!p) continue;
    const L = ebur(file), s = seamCheck(file);
    if (s.seam > s.p99) problems.push(`${name}.ogg: loop seam step ${s.seam.toFixed(4)} above p99 ${s.p99.toFixed(4)}`);
    rows.push(`${name}.ogg ${p.dur.toFixed(3)} s ${(p.size / 1024).toFixed(0)} KiB  I ${L.I.toFixed(1)} LUFS  TP ${L.TP.toFixed(1)} dBTP  seam |last-first| ${s.seam.toFixed(4)} (median step ${s.median.toFixed(4)}, p99 ${s.p99.toFixed(4)})`);
  }
  for (const [name, d0] of [['deathSound', 0.5], ['levelComplete', 2.5], ['playSound', 0.4]]) {
    const file = path.join(OUT_SFX, name + '.ogg'), p = check(file, name + '.ogg', d => Math.abs(d - d0) <= 0.15);
    if (p) { const L = ebur(file); rows.push(`${name}.ogg ${p.dur.toFixed(3)} s ${(p.size / 1024).toFixed(0)} KiB  TP ${L.TP.toFixed(1)} dBTP`); }
  }
  console.log(rows.join('\n'));
  console.log(`total ${(total / 1048576).toFixed(2)} MiB; timeline.json ${tl.songs.length} songs`);
  console.log(problems.length ? 'PROBLEMS:\n  ' + problems.join('\n  ') : 'all checks passed');
  if (problems.length) process.exitCode = 1;
}

// ------------------------------------------------------------------ main
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'dash-music-'));
function writeSfx(name, fn) {
  const t = Date.now(), { L, R, n } = fn(), wav = path.join(TMP, name + '.wav'), out = path.join(OUT_SFX, name + '.ogg');
  writeWav(wav, L, R, n);
  ff(['-y', '-i', wav, '-ar', String(SR), '-ac', '2', '-c:a', 'libvorbis', '-q:a', '5', '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', out]);
  fs.rmSync(wav);
  console.log(`${name}.ogg  ${(n / SR).toFixed(3)} s  ${fs.statSync(out).size} B  (${Date.now() - t} ms)`);
}
function writeMusic(name, r, out, o = {}) {
  const t = Date.now(), wav = path.join(TMP, name + ".wav");
  writeWav(wav, r.L, r.R, r.n);
  const e = encode(wav, out, o);
  fs.rmSync(wav);
  console.log(`${path.basename(out)}  ${(r.n / SR).toFixed(3)} s  ${e.size} B  q=${e.q}  ${e.mode} ${e.gainDb} dB  ${JSON.stringify(r.stats)}  (${((Date.now() - t) / 1000).toFixed(1)} s total encode)`);
  return e;
}
function updateTimeline(entry) {
  let tl = {};
  try { tl = JSON.parse(fs.readFileSync(OUT_TIMELINE, "utf8")); } catch { tl = {}; }
  const songs = (tl.songs ?? []).filter(s => s.index !== entry.index).concat(entry).sort((a, b) => a.index - b.index);
  const doc = { format: "dash-overdrive-classic-timeline/1", sampleRate: SR, beatsPerBar: 4,
    note: "Beats are 0-based quarter notes from t = 0 s (seconds = beat * 60 / bpm). Sections tile the song; the last section ends at totalBeats. cues: drop = drop downbeat, stop = music cut for the last eighth before a drop, tapestop = music slows to silence over 2 beats, end = final hit (song then rings out and fades over the last 4 s).",
    songs };
  fs.writeFileSync(OUT_TIMELINE, JSON.stringify(doc, null, 2) + "\n");
}
function writeSong(S) {
  const r = renderSong(S);
  writeMusic(String(S.index), r, path.join(OUT_MUSIC, S.index + ".ogg"), { I: -15, TP: -1.5 });
  updateTimeline(r.timeline);
}
const JOBS = [
  { id: 'sfx', run: () => { writeSfx('deathSound', sfxDeath); writeSfx('levelComplete', sfxComplete); writeSfx('playSound', sfxPlay); } },
  { id: 'menu', run: () => writeMusic('menuLoop', renderLoop(MENU), path.join(OUT_SFX, 'menuLoop.ogg'), { I: -16 }) },
  { id: 'practice', run: () => writeMusic('practice', renderLoop(PRACTICE), path.join(OUT_SFX, 'practice.ogg'), { I: -17 }) },
  ...SONGS.map(S => ({ id: String(S.index), run: () => writeSong(S) })),
];
function main() {
  const args = process.argv.slice(2);
  const only = (args.find(a => a.startsWith('--only=')) ?? '').slice(7).split(',').filter(Boolean);
  fs.mkdirSync(OUT_MUSIC, { recursive: true }); fs.mkdirSync(OUT_SFX, { recursive: true });
  try {
    if (!args.includes('--check')) for (const j of JOBS) if (!only.length || only.includes(j.id)) j.run();
    if (typeof verify === 'function' && (!only.length || args.includes('--check'))) verify();
  } finally { fs.rmSync(TMP, { recursive: true, force: true }); }
}
main();
