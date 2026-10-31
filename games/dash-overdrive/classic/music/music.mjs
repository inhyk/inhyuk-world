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

//@@PART2
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

//@@PART3
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
  let acc = 0;
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

//@@PART5

// ------------------------------------------------------------------ main
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'dash-music-'));
function writeSfx(name, fn) {
  const t = Date.now(), { L, R, n } = fn(), wav = path.join(TMP, name + '.wav'), out = path.join(OUT_SFX, name + '.ogg');
  writeWav(wav, L, R, n);
  ff(['-y', '-i', wav, '-ar', String(SR), '-ac', '2', '-c:a', 'libvorbis', '-q:a', '5', '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', out]);
  fs.rmSync(wav);
  console.log(`${name}.ogg  ${(n / SR).toFixed(3)} s  ${fs.statSync(out).size} B  (${Date.now() - t} ms)`);
}
const JOBS = [
  { id: 'sfx', run: () => { writeSfx('deathSound', sfxDeath); writeSfx('levelComplete', sfxComplete); writeSfx('playSound', sfxPlay); } },
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
