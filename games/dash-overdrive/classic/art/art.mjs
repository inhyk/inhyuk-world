#!/usr/bin/env node
/*
 * DASH / OVERDRIVE · CLASSIC: original art generator.
 *
 * Every texture the engine loads from res/gfx is drawn here from scratch:
 *   - sprites and UI are SVG strings rasterized by Chromium (Playwright) at their exact pixel size,
 *   - the tinted grayscale textures (background, emptyBG, ground) and groundLine are computed per pixel,
 *   - sharp encodes the PNGs (palette PNG only when it is visually lossless).
 * Output is deterministic: no randomness except seeded PRNGs.
 *
 * Usage (from the repo root):
 *   node games/dash-overdrive/classic/art/art.mjs            # regenerate everything
 *   node games/dash-overdrive/classic/art/art.mjs skins/ 8   # only files whose path contains a filter
 *
 * Brand: acid green #bfff59, electric blue #2559eb, white, navy outline #0b1030,
 * hazards hot pink -> orange, gold for jump things. Font: Lilita One (SIL OFL) in res/fonts.
 */
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLASSIC = path.resolve(HERE, '..');
const REPO = path.resolve(CLASSIC, '../../..');
const GFX = path.join(CLASSIC, 'res', 'gfx');
const FONT_FILE = path.join(CLASSIC, 'res', 'fonts', 'LilitaOne-Regular.ttf');
const FONT = "'Lilita One'";

// ---------------------------------------------------------------- palette
const NAVY = '#0b1030';
const ACID = '#bfff59';
const BLUE = '#2559eb';
const WHITE = '#ffffff';
const PINK = '#ff3d7f';
const ORANGE = '#ff9a3d';
const GOLD = '#ffd23d';
const PAT = '#4c74ec'; // inner pattern on the glass blocks

// ---------------------------------------------------------------- svg helpers
const n2 = (v) => Math.round(v * 100) / 100;
const pts = (list) => list.map(([x, y]) => `${n2(x)} ${n2(y)}`).join(' L');
const poly = (list) => `M${pts(list)} Z`;
const stopList = (stops) =>
  stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a == null ? '' : ` stop-opacity="${a}"`}/>`).join('');
const lin = (id, x1, y1, x2, y2, stops) =>
  `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${n2(x1)}" y1="${n2(y1)}" x2="${n2(x2)}" y2="${n2(y2)}">${stopList(stops)}</linearGradient>`;
const rad = (id, cx, cy, r, stops, extra = '') =>
  `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r)}" ${extra}>${stopList(stops)}</radialGradient>`;
const blur = (id, sd) =>
  `<filter id="${id}" x="-60%" y="-60%" width="220%" height="220%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${sd}"/></filter>`;
const svg = (w, h, defs, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defs}</defs>${body}</svg>`;

function starPath(cx, cy, R, r, n = 5, rot = -90) {
  const list = [];
  for (let i = 0; i < n * 2; i++) {
    const a = ((rot + (i * 180) / n) * Math.PI) / 180;
    const rr = i % 2 ? r : R;
    list.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
  }
  return poly(list);
}

// four-point twinkle with concave sides
function sparkle(cx, cy, R, k = 0.22) {
  const q = R * k;
  return `M${n2(cx)} ${n2(cy - R)} Q${n2(cx + q)} ${n2(cy - q)} ${n2(cx + R)} ${n2(cy)} Q${n2(cx + q)} ${n2(cy + q)} ${n2(cx)} ${n2(cy + R)} Q${n2(cx - q)} ${n2(cy + q)} ${n2(cx - R)} ${n2(cy)} Q${n2(cx - q)} ${n2(cy - q)} ${n2(cx)} ${n2(cy - R)} Z`;
}

// arc of an axis-aligned ellipse, angles in degrees (0 = right, 90 = down)
function ellipseArc(cx, cy, a, b, t0, t1) {
  const p = (t) => [cx + a * Math.cos((t * Math.PI) / 180), cy + b * Math.sin((t * Math.PI) / 180)];
  const [x0, y0] = p(t0);
  const [x1, y1] = p(t1);
  return `M${n2(x0)} ${n2(y0)} A${n2(a)} ${n2(b)} 0 ${t1 - t0 > 180 ? 1 : 0} 1 ${n2(x1)} ${n2(y1)}`;
}

// a line parallel to edge p0->p1, moved `inset` px to the right-hand side (inside of a clockwise shape)
function insetLine(p0, p1, inset, t0, t1) {
  const ex = p1[0] - p0[0];
  const ey = p1[1] - p0[1];
  const l = Math.hypot(ex, ey);
  const nx = -ey / l;
  const ny = ex / l;
  const at = (t) => [p0[0] + ex * t + nx * inset, p0[1] + ey * t + ny * inset];
  return `M${pts([at(t0), at(t1)])}`;
}

function mulberry32(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ================================================================ game objects

const BLOCK_PATTERNS = {
  // main tile: a soft raised core panel
  1: `<rect x="31" y="31" width="58" height="58" rx="13" fill="${PAT}" fill-opacity=".14" stroke="${PAT}" stroke-opacity=".5" stroke-width="4"/>`,
  // stripes
  2: [-84, -48, -12, 24, 60, 96]
    .map((o) => `<path d="M${o} 120 L${o + 120} 0" stroke="${PAT}" stroke-opacity=".32" stroke-width="10"/>`)
    .join(''),
  // dots
  3: [36, 60, 84]
    .flatMap((y) => [36, 60, 84].map((x) => `<circle cx="${x}" cy="${y}" r="6.5" fill="${PAT}" fill-opacity=".6"/>`))
    .join(''),
  // chevrons
  4: `<path d="M38 64 L60 44 L82 64 M38 90 L60 70 L82 90" fill="none" stroke="${PAT}" stroke-opacity=".6" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`,
  // crosshatch
  6: `<path d="M46 22 V98 M74 22 V98 M22 46 H98 M22 74 H98" stroke="${PAT}" stroke-opacity=".42" stroke-width="5" stroke-linecap="round"/>`,
  // plain
  7: '',
};

const RIM_STOPS = [[0, '#f3ffd1'], [0.28, '#d2ff7d'], [0.62, '#aef04e'], [1, '#6cbc22']];
const GLASS_STOPS = [[0, '#23419f'], [0.5, '#162b78'], [1, '#0c1548']];

// navy glass tile with an acid neon rim (shared by blocks and the level-select corner)
function blockParts(p, variant) {
  const defs =
    lin(`${p}rim`, 4, 4, 116, 116, RIM_STOPS) +
    lin(`${p}glass`, 0, 12, 0, 108, GLASS_STOPS) +
    lin(`${p}shine`, 12, 12, 66, 66, [[0, WHITE, 0.2], [1, WHITE, 0]]) +
    `<clipPath id="${p}gc"><rect x="12" y="12" width="96" height="96" rx="7"/></clipPath>` +
    blur(`${p}soft`, 3.2);
  const body =
    `<rect width="120" height="120" fill="${NAVY}"/>` +
    `<rect x="4" y="4" width="112" height="112" rx="13" fill="url(#${p}rim)"/>` +
    `<rect x="10" y="10" width="100" height="100" rx="8.5" fill="${NAVY}"/>` +
    `<rect x="12" y="12" width="96" height="96" rx="7" fill="url(#${p}glass)"/>` +
    `<g clip-path="url(#${p}gc)">` +
    `<rect x="12" y="12" width="96" height="96" rx="7" fill="none" stroke="${ACID}" stroke-opacity=".3" stroke-width="9" filter="url(#${p}soft)"/>` +
    BLOCK_PATTERNS[variant] +
    `<path d="M12 12 H88 L12 88 Z" fill="url(#${p}shine)"/>` +
    `<path d="M12 100 L100 12 H112 L12 112 Z" fill="${WHITE}" fill-opacity=".05"/>` +
    `</g>` +
    `<path d="M7 42 V20 Q7 7 20 7 H42" fill="none" stroke="${WHITE}" stroke-opacity=".8" stroke-width="2.4" stroke-linecap="round"/>`;
  return { defs, body };
}

function block(variant) {
  const { defs, body } = blockParts('b', variant);
  return svg(120, 120, defs, body);
}

function slab() {
  const defs =
    lin('rim', 4, 4, 116, 50, RIM_STOPS) +
    lin('glass', 0, 12, 0, 42, GLASS_STOPS) +
    lin('shine', 12, 12, 42, 42, [[0, WHITE, 0.2], [1, WHITE, 0]]) +
    `<clipPath id="gc"><rect x="12" y="12" width="96" height="30" rx="5"/></clipPath>` +
    blur('soft', 3);
  const body =
    `<rect width="120" height="54" fill="${NAVY}"/>` +
    `<rect x="4" y="4" width="112" height="46" rx="11" fill="url(#rim)"/>` +
    `<rect x="10" y="10" width="100" height="34" rx="6.5" fill="${NAVY}"/>` +
    `<rect x="12" y="12" width="96" height="30" rx="5" fill="url(#glass)"/>` +
    `<g clip-path="url(#gc)">` +
    `<rect x="12" y="12" width="96" height="30" rx="5" fill="none" stroke="${ACID}" stroke-opacity=".3" stroke-width="8" filter="url(#soft)"/>` +
    [40, 60, 80].map((x) => `<circle cx="${x}" cy="27" r="4" fill="${PAT}" fill-opacity=".6"/>`).join('') +
    `<path d="M12 12 H54 L24 42 H12 Z" fill="url(#shine)"/>` +
    `</g>` +
    `<path d="M7 30 V18 Q7 7 18 7 H42" fill="none" stroke="${WHITE}" stroke-opacity=".8" stroke-width="2.4" stroke-linecap="round"/>`;
  return svg(120, 54, defs, body);
}

// background-only tile: dim, translucent, no rim
function decoTile() {
  return svg(
    120,
    120,
    '',
    `<rect width="120" height="120" fill="${NAVY}" fill-opacity=".26"/>` +
      `<rect x="7" y="7" width="106" height="106" rx="14" fill="${WHITE}" fill-opacity=".035" stroke="${WHITE}" stroke-opacity=".09" stroke-width="2.5"/>` +
      `<path d="M60 34 L86 60 L60 86 L34 60 Z" fill="${WHITE}" fill-opacity=".05"/>`,
  );
}

const HAZ_LIGHT = [[0, '#ff4f8d'], [0.5, '#ff7660'], [1, '#ffab4b']];
const HAZ_DARK = [[0, '#d51d5f'], [0.5, '#e8434b'], [1, '#ef7a25']];

// faceted pink -> orange spike standing on the bottom edge
function spike(W, H, ax, ay, lx, rx, by, sw) {
  const defs = lin('lf', 0, ay, 0, by, HAZ_LIGHT) + lin('rf', 0, ay, 0, by, HAZ_DARK);
  const tri = `M${lx} ${by} L${ax} ${ay} L${rx} ${by} Z`;
  const body =
    `<path d="${tri}" fill="url(#lf)"/>` +
    `<path d="M${ax} ${ay} L${rx} ${by} L${ax} ${by} Z" fill="url(#rf)"/>` +
    `<path d="M${ax} ${ay + 12} L${ax} ${by - 3}" stroke="${WHITE}" stroke-opacity=".2" stroke-width="2"/>` +
    `<path d="${insetLine([lx, by], [ax, ay], sw * 0.95, 0.12, 0.74)}" stroke="${WHITE}" stroke-opacity=".62" stroke-width="${n2(sw * 0.42)}" stroke-linecap="round"/>` +
    `<path d="${tri}" fill="none" stroke="${NAVY}" stroke-width="${sw}" stroke-linejoin="round"/>`;
  return svg(W, H, defs, body);
}

// three hazard teeth; the lower part fades because levels sink it into the ground or a block
function spikeCluster() {
  const P = [[5, 104], [19, 19], [41, 44], [60, 3], [79, 44], [101, 19], [115, 104]];
  const outline = poly(P);
  const darks = [
    [[19, 19], [41, 44], [41, 104], [28, 104]],
    [[60, 3], [79, 44], [79, 104], [60, 104]],
    [[101, 19], [115, 104], [96, 104]],
  ];
  const defs =
    lin('lf', 0, 3, 0, 104, HAZ_LIGHT) +
    lin('rf', 0, 3, 0, 104, HAZ_DARK) +
    lin('fade', 0, 0, 0, 104, [[0, WHITE], [0.74, WHITE], [1, WHITE, 0]]) +
    `<clipPath id="cp"><path d="${outline}"/></clipPath>` +
    `<mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="104"><rect width="120" height="104" fill="url(#fade)"/></mask>`;
  const hi = (a, b, t0, t1) =>
    `<path d="${insetLine(a, b, 6, t0, t1)}" stroke="${WHITE}" stroke-opacity=".6" stroke-width="2.6" stroke-linecap="round"/>`;
  const body =
    `<g mask="url(#m)">` +
    `<path d="${outline}" fill="url(#lf)"/>` +
    `<g clip-path="url(#cp)">${darks.map((d) => `<path d="${poly(d)}" fill="url(#rf)"/>`).join('')}</g>` +
    hi([5, 104], [19, 19], 0.45, 0.88) +
    hi([41, 44], [60, 3], 0.12, 0.8) +
    hi([79, 44], [101, 19], 0.15, 0.75) +
    `<path d="${outline}" fill="none" stroke="${NAVY}" stroke-width="6.5" stroke-linejoin="round"/>` +
    `</g>`;
  return svg(120, 104, defs, body);
}

function jumpPad() {
  const defs =
    rad('glow', 50, 10, 50, [[0, GOLD, 0.85], [0.6, GOLD, 0.35], [1, GOLD, 0]], 'gradientTransform="translate(50 10) scale(1 .3) translate(-50 -10)"') +
    lin('plate', 0, 4, 0, 16, [[0, '#fff8cc'], [0.4, GOLD], [1, '#f29018']]);
  const top = 'M3 16 L7.5 6 Q9 3.6 12 3.6 H88 Q91 3.6 92.5 6 L97 16';
  const body =
    `<ellipse cx="50" cy="10" rx="50" ry="15" fill="url(#glow)"/>` +
    `<path d="${top} Z" fill="url(#plate)"/>` +
    `<path d="M11 6.6 H89" stroke="${WHITE}" stroke-opacity=".9" stroke-width="1.6" stroke-linecap="round"/>` +
    [30, 50, 70]
      .map((x) => `<path d="M${x - 6} 13 L${x} 8.2 L${x + 6} 13" fill="none" stroke="${NAVY}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`)
      .join('') +
    `<path d="${top}" fill="none" stroke="${NAVY}" stroke-width="2.6" stroke-linejoin="round"/>`;
  return svg(100, 16, defs, body);
}

function jumpOrb() {
  const defs =
    rad('halo', 60, 60, 60, [[0.6, GOLD, 0.6], [0.8, GOLD, 0.2], [1, GOLD, 0]]) +
    lin('ring', 22, 16, 98, 104, [[0, '#fff4a6'], [0.45, GOLD], [1, '#f08c1a']]) +
    rad('core', 53, 51, 40, [[0, WHITE], [0.42, '#fffbe2'], [1, '#ffe36a']]);
  const body =
    `<circle cx="60" cy="60" r="60" fill="url(#halo)"/>` +
    `<circle cx="60" cy="60" r="52" fill="${NAVY}"/>` +
    `<circle cx="60" cy="60" r="48" fill="url(#ring)"/>` +
    `<circle cx="60" cy="60" r="37.5" fill="${NAVY}"/>` +
    `<circle cx="60" cy="60" r="34" fill="url(#core)"/>` +
    `<path d="${ellipseArc(60, 60, 43, 43, 195, 265)}" fill="none" stroke="${WHITE}" stroke-opacity=".8" stroke-width="3.5" stroke-linecap="round"/>` +
    `<path d="${ellipseArc(60, 60, 43, 43, 20, 45)}" fill="none" stroke="${WHITE}" stroke-opacity=".45" stroke-width="2.5" stroke-linecap="round"/>` +
    `<path d="${sparkle(47, 46, 10)}" fill="${WHITE}"/>`;
  return svg(120, 120, defs, body);
}

const PORTAL_SCHEMES = {
  gravityDown: { light: '#b8f8ff', mid: '#45d4ff', deep: BLUE },
  gravityUp: { light: '#fff2a8', mid: '#ffc23d', deep: '#ff7d22' },
  cube: { light: '#f2ffcc', mid: ACID, deep: '#5aa81d' },
  ship: { light: '#ffc6f5', mid: '#ff4fd8', deep: '#8f3dff' },
};

function portalSymbol(kind, cx, cy, br) {
  const s = (v) => n2(v * br);
  const line = `stroke="${NAVY}" stroke-width="${n2(br * 0.15)}" stroke-linejoin="round"`;
  if (kind === 'down' || kind === 'up') {
    const d = kind === 'down' ? 1 : -1;
    const P = [
      [cx - br * 0.27, cy - d * br * 0.62],
      [cx + br * 0.27, cy - d * br * 0.62],
      [cx + br * 0.27, cy + d * br * 0.02],
      [cx + br * 0.6, cy + d * br * 0.02],
      [cx, cy + d * br * 0.66],
      [cx - br * 0.6, cy + d * br * 0.02],
      [cx - br * 0.27, cy + d * br * 0.02],
    ];
    return `<path d="${poly(P)}" fill="${WHITE}" ${line}/>`;
  }
  if (kind === 'square') {
    const h = br * 0.56;
    return (
      `<rect x="${n2(cx - h)}" y="${n2(cy - h)}" width="${n2(2 * h)}" height="${n2(2 * h)}" rx="${s(0.2)}" fill="${WHITE}" ${line}/>` +
      `<circle cx="${n2(cx - br * 0.2)}" cy="${n2(cy - br * 0.05)}" r="${s(0.09)}" fill="${NAVY}"/>` +
      `<circle cx="${n2(cx + br * 0.2)}" cy="${n2(cy - br * 0.05)}" r="${s(0.09)}" fill="${NAVY}"/>`
    );
  }
  // rocket pointing right
  const X = (v) => n2(cx + v * br);
  const Y = (v) => n2(cy + v * br);
  return (
    `<path d="M${X(-0.62)} ${Y(0)} Q${X(-0.95)} ${Y(-0.16)} ${X(-0.98)} ${Y(0)} Q${X(-0.95)} ${Y(0.16)} ${X(-0.62)} ${Y(0)} Z" fill="${ORANGE}" stroke="${NAVY}" stroke-width="${n2(br * 0.08)}"/>` +
    `<path d="M${X(-0.42)} ${Y(-0.2)} L${X(-0.64)} ${Y(-0.52)} L${X(-0.2)} ${Y(-0.26)} Z M${X(-0.42)} ${Y(0.2)} L${X(-0.64)} ${Y(0.52)} L${X(-0.2)} ${Y(0.26)} Z" fill="${WHITE}" ${line}/>` +
    `<path d="M${X(-0.66)} ${Y(0)} C${X(-0.66)} ${Y(-0.34)} ${X(0.18)} ${Y(-0.4)} ${X(0.74)} ${Y(0)} C${X(0.18)} ${Y(0.4)} ${X(-0.66)} ${Y(0.34)} ${X(-0.66)} ${Y(0)} Z" fill="${WHITE}" ${line}/>` +
    `<circle cx="${X(0.08)}" cy="${Y(0)}" r="${s(0.14)}" fill="#ff4fd8" stroke="${NAVY}" stroke-width="${n2(br * 0.07)}"/>`
  );
}

// tall glowing oval ring with a symbol badge in the middle
function portal(W, H, scheme, symbol) {
  const sc = PORTAL_SCHEMES[scheme];
  const cx = W / 2;
  const cy = H / 2;
  const t = Math.round(W * 0.15);
  const o = 3.5;
  const ax = W / 2 - 2 - (t / 2 + o);
  const ay = H / 2 - 2 - (t / 2 + o);
  const ix = ax - t / 2 - o;
  const iy = ay - t / 2 - o;
  const br = Math.round(W * 0.19);
  const defs =
    lin('ring', cx - ax, 0, cx + ax, 0, [[0, sc.deep], [0.5, sc.mid], [1, sc.light]]) +
    rad('field', cx, cy, iy, [[0, sc.mid, 0.05], [0.72, sc.mid, 0.16], [1, sc.light, 0.55]], `gradientTransform="translate(${n2(cx)} ${n2(cy)}) scale(${n2(ix / iy)} 1) translate(${n2(-cx)} ${n2(-cy)})"`) +
    rad('badge', cx - br * 0.3, cy - br * 0.35, br * 1.3, [[0, sc.light], [0.5, sc.mid], [1, sc.deep]]) +
    `<clipPath id="in"><ellipse cx="${cx}" cy="${cy}" rx="${n2(ix)}" ry="${n2(iy)}"/></clipPath>` +
    blur('soft', 2.5);
  const streaks = [-0.5, -0.12, 0.34]
    .map((k, i) => `<path d="M${n2(cx + k * ix)} ${n2(cy - iy * (0.72 - i * 0.1))} V${n2(cy + iy * (0.62 + i * 0.08))}" stroke="${WHITE}" stroke-opacity=".2" stroke-width="${i === 1 ? 4 : 2.5}" stroke-linecap="round"/>`)
    .join('');
  const sparkles = [[300, 7], [28, 6], [150, 6.5], [212, 5]]
    .map(([deg, R]) => {
      const a = (deg * Math.PI) / 180;
      return `<path d="${sparkle(cx + ax * Math.cos(a), cy + ay * Math.sin(a), R)}" fill="${WHITE}"/>`;
    })
    .join('');
  const body =
    `<ellipse cx="${cx}" cy="${cy}" rx="${n2(ix)}" ry="${n2(iy)}" fill="url(#field)"/>` +
    `<g clip-path="url(#in)">${streaks}<ellipse cx="${cx}" cy="${cy}" rx="${n2(ix)}" ry="${n2(iy)}" fill="none" stroke="${sc.light}" stroke-opacity=".7" stroke-width="7" filter="url(#soft)"/></g>` +
    `<ellipse cx="${cx}" cy="${cy}" rx="${n2(ax)}" ry="${n2(ay)}" fill="none" stroke="${NAVY}" stroke-width="${t + 2 * o}"/>` +
    `<ellipse cx="${cx}" cy="${cy}" rx="${n2(ax)}" ry="${n2(ay)}" fill="none" stroke="url(#ring)" stroke-width="${t}"/>` +
    `<path d="${ellipseArc(cx, cy, ax + t * 0.18, ay + t * 0.18, 196, 300)}" fill="none" stroke="${WHITE}" stroke-opacity=".75" stroke-width="2.6" stroke-linecap="round"/>` +
    `<path d="${ellipseArc(cx, cy, ax - t * 0.1, ay - t * 0.1, 20, 80)}" fill="none" stroke="${WHITE}" stroke-opacity=".4" stroke-width="2" stroke-linecap="round"/>` +
    sparkles +
    `<circle cx="${cx}" cy="${cy}" r="${br + 4}" fill="${NAVY}"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${br}" fill="url(#badge)"/>` +
    `<path d="${ellipseArc(cx, cy, br - 4, br - 4, 200, 280)}" fill="none" stroke="${WHITE}" stroke-opacity=".6" stroke-width="2.4" stroke-linecap="round"/>` +
    portalSymbol(symbol, cx, cy, br);
  return svg(W, H, defs, body);
}

// thin light rod with a soft lamp on top (decoration)
function pole(W, H) {
  const cx = W / 2;
  const capR = W >= 24 ? 7.5 : 6;
  const rodW = W >= 24 ? 6 : 5;
  const cy = capR + 2.5;
  const defs =
    lin('rod', 0, cy, 0, H, [[0, WHITE, 0.8], [1, WHITE, 0.28]]) +
    rad('halo', cx, cy, W / 2, [[0, WHITE, 0.55], [0.55, ACID, 0.32], [1, ACID, 0]]) +
    rad('cap', cx - 2, cy - 2, capR + 1, [[0, WHITE], [0.6, '#f4ffd8'], [1, '#c9f77a']]);
  const body =
    `<rect x="${n2(cx - rodW / 2)}" y="${n2(cy)}" width="${rodW}" height="${n2(H - cy + rodW)}" rx="${rodW / 2}" fill="url(#rod)" stroke="${NAVY}" stroke-opacity=".28" stroke-width="1.5"/>` +
    `<circle cx="${cx}" cy="${n2(cy)}" r="${W / 2}" fill="url(#halo)"/>` +
    `<circle cx="${cx}" cy="${n2(cy)}" r="${capR}" fill="url(#cap)" stroke="${NAVY}" stroke-opacity=".35" stroke-width="1.5"/>`;
  return svg(W, H, defs, body);
}

// soft translucent rounded crystal tufts sitting on the bottom edge (decoration)
function tufts(W, H, seed, count, sparkles) {
  const rnd = mulberry32(seed);
  const items = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const bell = 1 - ((t - 0.5) * 2) ** 2 * 0.55;
    const w = (W / count) * (1.15 + rnd() * 0.45);
    const h = Math.min(H - 3, H * (0.42 + 0.56 * bell * (0.72 + rnd() * 0.28)));
    const tilt = (rnd() - 0.5) * 16 + (t - 0.5) * 10;
    let cx = 4 + w / 2 + t * (W - 8 - w) + (rnd() - 0.5) * (W / count) * 0.35;
    // keep the rotated capsule inside the texture
    const lean = Math.sin((Math.abs(tilt) * Math.PI) / 180) * h;
    const minX = w / 2 + 3 + (tilt < 0 ? lean : 0);
    const maxX = W - w / 2 - 3 - (tilt > 0 ? lean : 0);
    cx = Math.max(minX, Math.min(maxX, cx));
    items.push({ cx, w, h, tilt });
  }
  items.sort((a, b) => b.h - a.h);
  let defs = '';
  let body = '';
  items.forEach(({ cx, w, h, tilt }, i) => {
    const top = H - h;
    const r = w / 2;
    defs += lin(`f${i}`, 0, top, 0, H, [[0, WHITE, 0.6], [0.45, WHITE, 0.32], [1, WHITE, 0]]);
    defs += lin(`l${i}`, 0, top, 0, H, [[0, WHITE, 0.45], [1, WHITE, 0]]);
    body +=
      `<g transform="rotate(${n2(tilt)} ${n2(cx)} ${H})">` +
      `<rect x="${n2(cx - r)}" y="${n2(top)}" width="${n2(w)}" height="${n2(h + 30)}" rx="${n2(r)}" fill="url(#f${i})"/>` +
      `<path d="M${n2(cx - w * 0.18)} ${n2(top + r * 0.75)} V${H + 4}" stroke="url(#l${i})" stroke-width="2"/>` +
      `<path d="${ellipseArc(cx, top + r, r - 2.5, r - 2.5, 198, 322)}" fill="none" stroke="${WHITE}" stroke-opacity=".9" stroke-width="2.6" stroke-linecap="round"/>` +
      `</g>`;
  });
  for (const [fx, fy, R] of sparkles) body += `<path d="${sparkle(fx * W, fy * H, R)}" fill="${WHITE}" fill-opacity=".85"/>`;
  return svg(W, H, defs, body);
}

// hanging chain with a small lantern (decoration)
function chainLantern() {
  const W = 78;
  const H = 278;
  const cx = 39;
  let chain = '';
  for (let k = 0; k * 18 < 212; k++) {
    const y = k * 18 + 9;
    chain +=
      k % 2 === 0
        ? `<ellipse cx="${cx}" cy="${y}" rx="7.5" ry="11.5" fill="none" stroke="${NAVY}" stroke-opacity=".45" stroke-width="7"/><ellipse cx="${cx}" cy="${y}" rx="7.5" ry="11.5" fill="none" stroke="#eef3ff" stroke-width="3.8"/>`
        : `<rect x="${cx - 3.2}" y="${y - 12}" width="6.4" height="24" rx="3.2" fill="#eef3ff" stroke="${NAVY}" stroke-opacity=".45" stroke-width="2"/>`;
  }
  const defs =
    rad('glow', cx, 246, 40, [[0, '#fff3c0', 0.75], [0.5, '#ffe08a', 0.3], [1, '#ffe08a', 0]]) +
    lin('glass', 0, 226, 0, 266, [[0, '#fffbe8'], [0.55, '#ffe9a3'], [1, '#ffd36b']]) +
    lin('metal', 0, 210, 0, 230, [[0, WHITE], [1, '#b9c8ee']]);
  const body =
    `<g opacity=".9">${chain}</g>` +
    `<ellipse cx="${cx}" cy="246" rx="39" ry="32" fill="url(#glow)"/>` +
    `<path d="M21 228 Q21 212 39 210 Q57 212 57 228 Z" fill="url(#metal)" stroke="${NAVY}" stroke-opacity=".55" stroke-width="2.5" stroke-linejoin="round"/>` +
    `<rect x="22" y="226" width="34" height="40" rx="9" fill="url(#glass)" stroke="${NAVY}" stroke-opacity=".55" stroke-width="2.5"/>` +
    `<path d="M32 228 V264 M46 228 V264" stroke="${NAVY}" stroke-opacity=".28" stroke-width="2.4"/>` +
    `<ellipse cx="${cx}" cy="247" rx="6" ry="9" fill="${WHITE}"/>` +
    `<rect x="27" y="264" width="24" height="9" rx="4.5" fill="url(#metal)" stroke="${NAVY}" stroke-opacity=".55" stroke-width="2.5"/>`;
  return svg(W, H, defs, body);
}

// ================================================================ player

// rounded cube body with an 11 px navy outline, bevel and gloss, plus a face/pattern
function cube({ colors, defs = '', pattern = '', face = '', gloss = true, frame = null, inner = [17, 17, 151, 151] }) {
  const [c0, c1, c2] = colors;
  const [bx, by, bw, bh] = inner;
  const D =
    lin('body', 17, 17, 168, 168, [[0, c0], [0.5, c1], [1, c2]]) +
    lin('bevel', bx, by, bx + bw, by + bh, [[0, WHITE, 0.55], [0.42, WHITE, 0], [0.58, NAVY, 0], [1, NAVY, 0.32]]) +
    `<clipPath id="bc"><rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="20"/></clipPath>` +
    defs;
  const shell = frame ?? `<rect x="6" y="6" width="173" height="173" rx="31" fill="${NAVY}"/><rect x="17" y="17" width="151" height="151" rx="20" fill="url(#body)"/>`;
  const body =
    shell +
    `<g clip-path="url(#bc)">${pattern}<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="20" fill="none" stroke="url(#bevel)" stroke-width="14"/></g>` +
    (gloss ? `<rect x="29" y="26" width="70" height="12" rx="6" fill="${WHITE}" fill-opacity=".42"/><circle cx="111" cy="32" r="6" fill="${WHITE}" fill-opacity=".42"/>` : '') +
    face;
  return svg(185, 185, D, body);
}

const eyesRound = (lx, rx, y, rxx, ryy) =>
  `<ellipse cx="${lx}" cy="${y}" rx="${rxx}" ry="${ryy}" fill="${NAVY}"/><ellipse cx="${rx}" cy="${y}" rx="${rxx}" ry="${ryy}" fill="${NAVY}"/>` +
  `<circle cx="${n2(lx - rxx * 0.38)}" cy="${n2(y - ryy * 0.38)}" r="${n2(rxx * 0.4)}" fill="${WHITE}"/><circle cx="${n2(rx - rxx * 0.38)}" cy="${n2(y - ryy * 0.38)}" r="${n2(rxx * 0.4)}" fill="${WHITE}"/>` +
  `<circle cx="${n2(lx + rxx * 0.35)}" cy="${n2(y + ryy * 0.42)}" r="${n2(rxx * 0.17)}" fill="${WHITE}"/><circle cx="${n2(rx + rxx * 0.35)}" cy="${n2(y + ryy * 0.42)}" r="${n2(rxx * 0.17)}" fill="${WHITE}"/>`;
const blush = (y, c = '#ff7aa6', a = 0.55) =>
  `<ellipse cx="42" cy="${y}" rx="10" ry="6" fill="${c}" fill-opacity="${a}"/><ellipse cx="143" cy="${y}" rx="10" ry="6" fill="${c}" fill-opacity="${a}"/>`;

const SKINS = [
  // 0: default acid-green buddy with a big open smile
  () =>
    cube({
      colors: ['#edffc0', ACID, '#86d630'],
      face:
        eyesRound(66, 119, 86, 15, 18) +
        `<path d="M64 115 H121 Q120 147 92.5 147 Q65 147 64 115 Z" fill="${NAVY}" stroke="${NAVY}" stroke-width="4" stroke-linejoin="round"/>` +
        `<path d="M78 140 Q92.5 127 107 140 Q101 147 92.5 147 Q84 147 78 140 Z" fill="#ff6f9c"/>` +
        blush(113),
    }),
  // 1: robot
  () =>
    cube({
      colors: ['#e9f0fb', '#aebedb', '#6e82aa'],
      defs:
        lin('scr', 0, 60, 0, 132, [[0, '#1d2f6d'], [1, '#0c1541']]) +
        blur('led', 3),
      pattern: `<path d="M17 148 H168" stroke="${NAVY}" stroke-opacity=".16" stroke-width="3"/>`,
      face:
        [[34, 34], [151, 34], [34, 151], [151, 151]]
          .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6.5" fill="#dfe7f4" stroke="${NAVY}" stroke-width="2.6"/><path d="M${x - 3.2} ${y + 3.2} L${x + 3.2} ${y - 3.2}" stroke="${NAVY}" stroke-width="2.2" stroke-linecap="round"/>`)
          .join('') +
        `<circle cx="92.5" cy="38" r="7" fill="${PINK}" stroke="${NAVY}" stroke-width="3"/>` +
        `<rect x="36" y="56" width="113" height="78" rx="17" fill="${NAVY}"/>` +
        `<rect x="42" y="62" width="101" height="66" rx="12" fill="url(#scr)"/>` +
        `<g filter="url(#led)" opacity=".9"><rect x="56" y="76" width="26" height="20" rx="6" fill="#5ff3ff"/><rect x="103" y="76" width="26" height="20" rx="6" fill="#5ff3ff"/></g>` +
        `<rect x="56" y="76" width="26" height="20" rx="6" fill="#8ff8ff"/><rect x="103" y="76" width="26" height="20" rx="6" fill="#8ff8ff"/>` +
        `<rect x="60" y="79" width="7" height="6" rx="2" fill="${WHITE}"/><rect x="107" y="79" width="7" height="6" rx="2" fill="${WHITE}"/>` +
        `<path d="M68 106 V112 H117 V106" fill="none" stroke="#5ff3ff" stroke-width="6" stroke-linejoin="round"/>` +
        `<path d="M74 156 H111" stroke="${NAVY}" stroke-opacity=".35" stroke-width="4" stroke-linecap="round"/>`,
    }),
  // 2: cat (ears inside the square margin)
  () =>
    cube({
      colors: ['#fff3b0', '#ffd25c', '#f39c1d'],
      frame:
        `<path d="M18 76 L36 14 Q39 9 44 13 L90 46 Z M167 76 L149 14 Q146 9 141 13 L95 46 Z" fill="url(#body)" stroke="${NAVY}" stroke-width="11" stroke-linejoin="round"/>` +
        `<path d="M31 62 L41 28 L68 47 Z M154 62 L144 28 L117 47 Z" fill="#ff8fb3"/>` +
        `<rect x="6" y="40" width="173" height="139" rx="31" fill="${NAVY}"/>` +
        `<rect x="17" y="51" width="151" height="117" rx="20" fill="url(#body)"/>`,
      inner: [17, 51, 151, 117],
      gloss: false,
      face:
        `<path d="M80 54 V66 M92.5 54 V70 M105 54 V66" stroke="#e8860c" stroke-width="6" stroke-linecap="round"/>` +
        `<rect x="31" y="59" width="40" height="10" rx="5" fill="${WHITE}" fill-opacity=".4"/>` +
        eyesRound(66, 119, 102, 12, 16) +
        `<path d="M85 121 H100 Q100 126 92.5 131 Q85 126 85 121 Z" fill="#ff6f9c" stroke="${NAVY}" stroke-width="3.2" stroke-linejoin="round"/>` +
        `<path d="M79 137 Q85.5 145 92.5 136 Q99.5 145 106 137" fill="none" stroke="${NAVY}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>` +
        `<path d="M47 124 L24 118 M47 132 L24 137 M138 124 L161 118 M138 132 L161 137" stroke="${NAVY}" stroke-width="3.4" stroke-linecap="round"/>` +
        blush(124, '#ff7a7a', 0.45),
    }),
  // 3: star eyes
  () =>
    cube({
      colors: ['#ffc0dc', '#ff5c98', '#df2a6c'],
      defs: `<clipPath id="mouth"><path d="M62 114 H123 Q123 151 92.5 151 Q62 151 62 114 Z"/></clipPath>`,
      pattern: [[40, 150, 4], [150, 140, 3.2], [146, 58, 3]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${WHITE}" fill-opacity=".55"/>`).join(''),
      face:
        `<path d="${starPath(65, 84, 25, 11.5)}" fill="${GOLD}" stroke="${NAVY}" stroke-width="5" stroke-linejoin="round"/>` +
        `<path d="${starPath(120, 84, 25, 11.5)}" fill="${GOLD}" stroke="${NAVY}" stroke-width="5" stroke-linejoin="round"/>` +
        `<circle cx="60" cy="80" r="4" fill="${WHITE}"/><circle cx="115" cy="80" r="4" fill="${WHITE}"/>` +
        `<path d="M62 114 H123 Q123 151 92.5 151 Q62 151 62 114 Z" fill="${NAVY}" stroke="${NAVY}" stroke-width="4" stroke-linejoin="round"/>` +
        `<g clip-path="url(#mouth)"><ellipse cx="92.5" cy="150" rx="19" ry="11" fill="#ff8fb3"/><rect x="70" y="112" width="45" height="9" rx="3" fill="${WHITE}"/></g>`,
    }),
  // 4: visor
  () =>
    cube({
      colors: ['#9ab8ff', '#3f6dff', '#1a3cb3'],
      defs:
        lin('vg', 0, 64, 0, 102, [[0, '#c4fdff'], [0.5, '#45c8ff'], [1, '#1567d6']]) +
        `<clipPath id="vc"><rect x="30" y="64" width="125" height="38" rx="19"/></clipPath>`,
      pattern: `<rect x="85" y="10" width="15" height="60" fill="${ACID}"/><path d="M85 10 V70 M100 10 V70" stroke="${NAVY}" stroke-width="2.5"/>`,
      face:
        `<rect x="24" y="58" width="137" height="50" rx="25" fill="${NAVY}"/>` +
        `<rect x="30" y="64" width="125" height="38" rx="19" fill="url(#vg)"/>` +
        `<g clip-path="url(#vc)"><path d="M44 64 H66 L50 102 H28 Z" fill="${WHITE}" fill-opacity=".6"/><path d="M73 64 H82 L66 102 H57 Z" fill="${WHITE}" fill-opacity=".38"/>` +
        `<ellipse cx="68" cy="84" rx="9" ry="7" fill="${WHITE}" fill-opacity=".9"/><ellipse cx="117" cy="84" rx="9" ry="7" fill="${WHITE}" fill-opacity=".9"/></g>` +
        `<path d="M76 133 Q93 143 111 128" fill="none" stroke="${NAVY}" stroke-width="6.5" stroke-linecap="round"/>`,
    }),
  // 5: angry
  () =>
    cube({
      colors: ['#ff9e9e', '#f0414f', '#b11b34'],
      face:
        `<ellipse cx="64" cy="99" rx="16" ry="13" fill="${WHITE}" stroke="${NAVY}" stroke-width="3.5"/><ellipse cx="121" cy="99" rx="16" ry="13" fill="${WHITE}" stroke="${NAVY}" stroke-width="3.5"/>` +
        `<circle cx="69" cy="101" r="7.5" fill="${NAVY}"/><circle cx="116" cy="101" r="7.5" fill="${NAVY}"/>` +
        `<path d="M36 70 L86 88 L83 99 L33 81 Z M149 70 L99 88 L102 99 L152 81 Z" fill="${NAVY}" stroke="${NAVY}" stroke-width="4" stroke-linejoin="round"/>` +
        `<rect x="58" y="123" width="69" height="27" rx="9" fill="${WHITE}" stroke="${NAVY}" stroke-width="5"/>` +
        `<path d="M58 136.5 H127 M75 123 V150 M92.5 123 V150 M110 123 V150" stroke="${NAVY}" stroke-width="3"/>` +
        `<path d="M138 30 Q144 40 152 34 M146 26 Q148 36 158 38" fill="none" stroke="${NAVY}" stroke-opacity=".55" stroke-width="3.5" stroke-linecap="round"/>`,
    }),
  // 6: sleepy
  () => {
    const z = (x, y, s) => `M${x} ${y} H${x + s} L${x} ${y + s} H${x + s}`;
    const zz = `${z(122, 28, 22)} ${z(152, 56, 13)}`;
    return cube({
      colors: ['#efe4ff', '#b49bff', '#7d60e6'],
      pattern: `<path d="M44 52 A14 14 0 1 1 58 32 A11 11 0 1 0 44 52 Z" fill="${WHITE}" fill-opacity=".45"/>`,
      face:
        `<path d="M48 98 Q64 112 80 98 M105 98 Q121 112 137 98" fill="none" stroke="${NAVY}" stroke-width="7" stroke-linecap="round"/>` +
        `<path d="M52 104 L47 110 M76 104 L81 110 M109 104 L104 110 M133 104 L138 110" stroke="${NAVY}" stroke-width="3.5" stroke-linecap="round"/>` +
        `<ellipse cx="92.5" cy="133" rx="8" ry="9.5" fill="${NAVY}"/>` +
        `<path d="${zz}" fill="none" stroke="${NAVY}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>` +
        `<path d="${zz}" fill="none" stroke="${WHITE}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>` +
        blush(120, '#ff8fc8', 0.5),
    });
  },
  // 7: pixel
  () => {
    const px = (cells, color, op = 1) =>
      cells.map(([x, y]) => `<rect x="${x}" y="${y}" width="12" height="12" fill="${color}"${op < 1 ? ` fill-opacity="${op}"` : ''}/>`).join('');
    const grid = [];
    for (let y = 17; y < 168; y += 16) for (let x = 17; x < 168; x += 16) if (((x - 17) / 16 + (y - 17) / 16) % 2 === 0) grid.push(`<rect x="${x}" y="${y}" width="16" height="16" fill="${NAVY}" fill-opacity=".07"/>`);
    return cube({
      colors: ['#b4ffe9', '#3fe3be', '#12a587'],
      pattern: grid.join(''),
      face:
        px([[50, 70], [62, 70], [50, 82], [62, 82], [50, 94], [62, 94], [111, 70], [123, 70], [111, 82], [123, 82], [111, 94], [123, 94]], NAVY) +
        px([[50, 70], [111, 70]], WHITE) +
        px([[56, 118], [116, 118], [68, 130], [80, 130], [92, 130], [104, 130]], NAVY) +
        px([[34, 112], [139, 112]], '#ff6fa8', 0.7),
    });
  },
  // 8: galaxy
  () =>
    cube({
      colors: ['#5d38cc', '#2b1784', '#140944'],
      defs: blur('neb', 11) + blur('eg', 4),
      pattern:
        `<g filter="url(#neb)"><ellipse cx="62" cy="134" rx="52" ry="26" fill="#ff4fd8" fill-opacity=".55"/><ellipse cx="128" cy="58" rx="44" ry="24" fill="#45d4ff" fill-opacity=".45"/></g>` +
        [[40, 46, 7], [150, 124, 6], [124, 156, 4.5], [44, 152, 5], [147, 38, 4]].map(([x, y, r]) => `<path d="${sparkle(x, y, r)}" fill="${WHITE}"/>`).join('') +
        [[70, 40], [104, 58], [32, 100], [160, 92], [88, 160], [60, 66]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.8" fill="${WHITE}" fill-opacity=".8"/>`).join('') +
        `<rect x="19" y="19" width="147" height="147" rx="18" fill="none" stroke="#b39cff" stroke-opacity=".85" stroke-width="3"/>`,
      face:
        `<g filter="url(#eg)"><ellipse cx="66" cy="92" rx="13" ry="16" fill="#7ff0ff"/><ellipse cx="119" cy="92" rx="13" ry="16" fill="#7ff0ff"/></g>` +
        `<ellipse cx="66" cy="92" rx="10.5" ry="13.5" fill="${WHITE}"/><ellipse cx="119" cy="92" rx="10.5" ry="13.5" fill="${WHITE}"/>` +
        `<path d="M78 126 Q92.5 139 107 126" fill="none" stroke="${WHITE}" stroke-width="5.5" stroke-linecap="round"/>`,
    }),
  // 9: candy stripes
  () =>
    cube({
      colors: [WHITE, '#fbf3fb', '#eadcf0'],
      pattern:
        [-120, -80, -40, 0, 40, 80, 120, 160].map((o) => `<path d="M${o} 0 L${o + 190} 190" stroke="#ff4f9a" stroke-width="20"/>`).join('') +
        `<circle cx="92.5" cy="96" r="51" fill="${WHITE}" stroke="${NAVY}" stroke-width="5"/>`,
      face:
        `<circle cx="75" cy="89" r="8.5" fill="${NAVY}"/><circle cx="110" cy="89" r="8.5" fill="${NAVY}"/>` +
        `<circle cx="72" cy="86" r="3" fill="${WHITE}"/><circle cx="107" cy="86" r="3" fill="${WHITE}"/>` +
        `<path d="M78 106 Q92.5 121 107 106" fill="none" stroke="${NAVY}" stroke-width="5.5" stroke-linecap="round"/>` +
        `<ellipse cx="62" cy="106" rx="7" ry="4.5" fill="#ff7aa6" fill-opacity=".6"/><ellipse cx="123" cy="106" rx="7" ry="4.5" fill="#ff7aa6" fill-opacity=".6"/>`,
    }),
  // 10: diamond
  () => {
    const C = [92.5, 92.5];
    const oct = [];
    for (let i = 0; i < 8; i++) {
      const a = ((i * 45 - 112.5) * Math.PI) / 180;
      oct.push([C[0] + 40 * Math.cos(a), C[1] + 40 * Math.sin(a)]);
    }
    const edge = [[17, 17], [92.5, 17], [168, 17], [168, 92.5], [168, 168], [92.5, 168], [17, 168], [17, 92.5]];
    // facet between octagon side i and the matching body edge segment
    const shades = [0.32, 0.14, 0.05, -0.1, -0.18, -0.08, 0.06, 0.24];
    let facets = '';
    for (let i = 0; i < 8; i++) {
      const q = [oct[i], oct[(i + 1) % 8], edge[(i + 2) % 8], edge[(i + 1) % 8]];
      const s = shades[i];
      facets += `<path d="${poly(q)}" fill="${s > 0 ? WHITE : NAVY}" fill-opacity="${Math.abs(s)}" stroke="${WHITE}" stroke-opacity=".45" stroke-width="1.5" stroke-linejoin="round"/>`;
    }
    facets += `<path d="${poly(oct)}" fill="${WHITE}" fill-opacity=".28" stroke="${WHITE}" stroke-opacity=".6" stroke-width="2"/>`;
    return cube({
      colors: ['#f4fdff', '#a5ecff', '#4cbfee'],
      pattern: facets,
      face:
        `<circle cx="72" cy="94" r="10.5" fill="${NAVY}" stroke="${WHITE}" stroke-width="3"/><circle cx="113" cy="94" r="10.5" fill="${NAVY}" stroke="${WHITE}" stroke-width="3"/>` +
        `<circle cx="68.5" cy="90.5" r="3.5" fill="${WHITE}"/><circle cx="109.5" cy="90.5" r="3.5" fill="${WHITE}"/>` +
        `<path d="M81 115 Q92.5 125 104 115" fill="none" stroke="${NAVY}" stroke-width="5" stroke-linecap="round"/>` +
        `<path d="${sparkle(146, 44, 15)}" fill="${WHITE}" stroke="${NAVY}" stroke-opacity=".25" stroke-width="1.5"/>`,
    });
  },
  // 11: fire
  () =>
    cube({
      colors: ['#ffb347', '#ff7a2a', '#e8401f'],
      pattern:
        `<path d="M17 170 V122 Q30 130 35 112 Q41 88 53 106 Q59 120 67 96 Q75 68 87 98 Q93 112 101 92 Q111 64 123 96 Q129 112 137 100 Q147 84 151 108 Q157 122 170 112 V170 Z" fill="${GOLD}"/>` +
        `<path d="M30 170 V140 Q40 146 46 132 Q54 116 62 134 Q70 146 80 124 Q88 108 96 128 Q104 144 114 122 Q122 108 128 128 Q134 142 146 134 Q152 130 156 140 V170 Z" fill="#fff1a8"/>`,
      face:
        `<path d="M50 63 L80 70 M135 63 L105 70" stroke="${NAVY}" stroke-width="7" stroke-linecap="round"/>` +
        eyesRound(66, 119, 86, 12, 14) +
        `<path d="M72 112 Q92.5 128 113 112" fill="none" stroke="${NAVY}" stroke-width="6.5" stroke-linecap="round"/>`,
    }),
];

// side-view hover rocket facing right; the small cube sits in the cockpit tub (x 43-110, y -26..41)
function ship() {
  const hull = 'M14 40 L38 30 H114 C128 30 143 42 146 55 C148 66 138 78 120 82 L40 85 C26 85 18 80 14 70 L10 56 C9 47 10 42 14 40 Z';
  const defs =
    lin('hull', 0, 28, 0, 86, [[0, '#86a8ff'], [0.35, '#3f6dff'], [0.75, BLUE], [1, '#1937a3']]) +
    lin('rim', 0, 22, 0, 32, [[0, WHITE], [1, '#a9c0ff']]) +
    lin('fin', 0, 6, 0, 42, [[0, '#efffc6'], [1, '#93dd34']]) +
    lin('glass', 112, 6, 134, 26, [[0, '#e2fcff', 0.95], [1, '#45c8ff', 0.6]]) +
    rad('flame', 6, 60, 13, [[0, '#fff7c8'], [0.45, GOLD], [1, '#ff7a2a', 0]]) +
    `<clipPath id="hc"><path d="${hull}"/></clipPath>`;
  const body =
    `<ellipse cx="6" cy="60" rx="7" ry="11" fill="url(#flame)"/>` +
    `<path d="M18 42 L7 13 Q5 6 12 6 L21 6 Q26 6 29 11 L43 33 Z" fill="url(#fin)" stroke="${NAVY}" stroke-width="3.6" stroke-linejoin="round"/>` +
    `<path d="M18 13 L27 30" stroke="${WHITE}" stroke-opacity=".7" stroke-width="2" stroke-linecap="round"/>` +
    `<path d="M32 80 L24 86.5 H54 L60 80 Z" fill="url(#fin)" stroke="${NAVY}" stroke-width="3" stroke-linejoin="round"/>` +
    `<path d="${hull}" fill="url(#hull)"/>` +
    `<g clip-path="url(#hc)">` +
    `<path d="M0 58 H160 V66 H0 Z" fill="${ACID}"/><path d="M0 57.5 H160 M0 66.5 H160" stroke="${NAVY}" stroke-width="2"/>` +
    `<circle cx="160" cy="58" r="27" fill="${ACID}" stroke="${NAVY}" stroke-width="3"/>` +
    `<path d="M20 42 L40 35 H112 C121 35 131 39 138 46" fill="none" stroke="${WHITE}" stroke-opacity=".55" stroke-width="3" stroke-linecap="round"/>` +
    `<path d="M20 79 H124" stroke="${NAVY}" stroke-opacity=".25" stroke-width="5"/>` +
    `</g>` +
    `<path d="${hull}" fill="none" stroke="${NAVY}" stroke-width="4" stroke-linejoin="round"/>` +
    `<rect x="3" y="50" width="13" height="20" rx="4" fill="#1a2a66" stroke="${NAVY}" stroke-width="3"/>` +
    `<rect x="4.5" y="54" width="5" height="12" rx="2.5" fill="${GOLD}"/>` +
    `<rect x="36" y="22" width="82" height="10" rx="5" fill="url(#rim)" stroke="${NAVY}" stroke-width="3.5"/>` +
    `<path d="M112 24 L119 9 Q121 5 125 7 L134 20 Q136 24 132 24 Z" fill="url(#glass)" stroke="${NAVY}" stroke-width="3" stroke-linejoin="round"/>` +
    `<path d="M119.5 12 L116 20" stroke="${WHITE}" stroke-width="2" stroke-linecap="round"/>`;
  return svg(149, 88, defs, body);
}

// practice-mode checkpoint: acid flag on a pole
function checkpoint() {
  const flag = 'M36 17 C46 11 55 14 62 19 C70 25 78 25 86 20 L86 51 C78 56 70 56 62 50 C55 45 46 42 36 48 Z';
  const defs =
    rad('glow', 52, 40, 48, [[0, ACID, 0.45], [1, ACID, 0]]) +
    lin('flag', 36, 14, 86, 54, [[0, '#f2ffcc'], [0.4, ACID], [1, '#7fcf2c']]);
  const body =
    `<circle cx="52" cy="40" r="48" fill="url(#glow)"/>` +
    `<rect x="26" y="12" width="9" height="78" rx="4.5" fill="${WHITE}" stroke="${NAVY}" stroke-width="3"/>` +
    `<path d="${flag}" fill="url(#flag)" stroke="${NAVY}" stroke-width="3.6" stroke-linejoin="round"/>` +
    `<path d="${starPath(61, 34, 9, 4)}" fill="${WHITE}" stroke="${NAVY}" stroke-width="1.6" stroke-linejoin="round"/>` +
    `<circle cx="30.5" cy="12" r="7" fill="${ACID}" stroke="${NAVY}" stroke-width="3"/>` +
    `<rect x="13" y="85" width="36" height="11" rx="5.5" fill="${BLUE}" stroke="${NAVY}" stroke-width="3"/>`;
  return svg(100, 100, defs, body);
}

// ================================================================ collectibles

const COIN_RIM = [[0, '#fff3a8'], [0.35, GOLD], [0.75, '#ffb000'], [1, '#e08600']];
const COIN_FACE = [[0, '#ffb000'], [0.5, GOLD], [1, '#ffe98a']]; // reversed, so the face looks pressed in

// round gold coin: navy outline, beveled rim, recessed face, acid-green star (proportions drawn at R = 48)
function coinParts(c, R, { outline, glow = false, reeding = false, twinkle = false }) {
  const k = R / 48;
  const rim = R - outline;
  const groove = 36 * k;
  const face = groove - Math.max(2.5 * k, 2);
  const mid = (rim + groove) / 2;
  const dash = (2 * Math.PI * mid) / 40; // 40 edge notches, an exact fit so the ring has no seam
  const sy = c + 1.5 * k;
  const defs =
    (glow ? rad('cglow', c, c, c, [[0.62, GOLD, 0.55], [0.82, GOLD, 0.18], [1, GOLD, 0]]) : '') +
    lin('crim', c - rim, c - rim, c + rim, c + rim, COIN_RIM) +
    lin('cface', c - face, c - face, c + face, c + face, COIN_FACE) +
    lin('cstar', 0, sy - 21 * k, 0, sy + 17 * k, [[0, '#f0ffc4'], [0.5, ACID], [1, '#86d630']]);
  const body =
    (glow ? `<circle cx="${c}" cy="${c}" r="${c}" fill="url(#cglow)"/>` : '') +
    `<circle cx="${c}" cy="${c}" r="${n2(R)}" fill="${NAVY}"/>` +
    `<circle cx="${c}" cy="${c}" r="${n2(rim)}" fill="url(#crim)"/>` +
    (reeding
      ? `<circle cx="${c}" cy="${c}" r="${n2(mid)}" fill="none" stroke="${NAVY}" stroke-opacity=".2" stroke-width="${n2(2.6 * k)}" stroke-dasharray="${n2(dash * 0.38)} ${n2(dash * 0.62)}"/>`
      : '') +
    `<circle cx="${c}" cy="${c}" r="${n2(groove)}" fill="${NAVY}"/>` +
    `<circle cx="${c}" cy="${c}" r="${n2(face)}" fill="url(#cface)"/>` +
    `<path d="${ellipseArc(c, c, rim - 2.6 * k, rim - 2.6 * k, 195, 265)}" fill="none" stroke="${WHITE}" stroke-opacity=".9" stroke-width="${n2(Math.max(3 * k, 2))}" stroke-linecap="round"/>` +
    `<path d="${ellipseArc(c, c, rim - 2.6 * k, rim - 2.6 * k, 15, 45)}" fill="none" stroke="${WHITE}" stroke-opacity=".45" stroke-width="${n2(Math.max(2.2 * k, 1.5))}" stroke-linecap="round"/>` +
    `<path d="${starPath(c, sy, 21 * k, 9.6 * k)}" fill="url(#cstar)" stroke="${NAVY}" stroke-width="${n2(Math.max(4.5 * k, 2.6))}" stroke-linejoin="round"/>` +
    `<circle cx="${n2(c - 4.5 * k)}" cy="${n2(sy - 5.5 * k)}" r="${n2(Math.max(2.8 * k, 1.6))}" fill="${WHITE}" fill-opacity=".9"/>` +
    (twinkle ? `<path d="${sparkle(c + 33 * k, c - 33 * k, 9 * k)}" fill="${WHITE}"/>` : '');
  return { defs, body };
}

// in-level coin, about 96 px across (hitbox 20,20,80,80)
function coin() {
  const { defs, body } = coinParts(60, 48, { outline: 4.5, glow: true, reeding: true, twinkle: true });
  return svg(120, 120, defs, body);
}

// small collected-coin icon for menus
function coinIcon() {
  const { defs, body } = coinParts(32, 29.5, { outline: 3.6 });
  return svg(64, 64, defs, body);
}

// empty slot with the coin's silhouette, for coins not collected yet
function coinEmpty() {
  return svg(
    64,
    64,
    '',
    `<circle cx="32" cy="32" r="29.5" fill="${NAVY}" fill-opacity=".45"/>` +
      `<circle cx="32" cy="32" r="28" fill="none" stroke="${WHITE}" stroke-opacity=".62" stroke-width="3"/>` +
      `<circle cx="32" cy="32" r="21.2" fill="none" stroke="${WHITE}" stroke-opacity=".22" stroke-width="2"/>` +
      `<path d="${starPath(32, 32.9, 12.9, 5.9)}" fill="${WHITE}" fill-opacity=".08" stroke="${WHITE}" stroke-opacity=".32" stroke-width="2.2" stroke-linejoin="round"/>`,
  );
}

// ================================================================ UI

const FACES = {
  acid: { c: ['#f4ffd2', ACID, '#7cc92a'], side: '#5a9c1c' },
  blue: { c: ['#8fb0ff', '#3f6dff', '#1c3db8'], side: '#13297a' },
};

// navy-outlined round arcade button with a 3D base
function roundButton(W, H, { depth, outline, face, icon }) {
  const R = (H - depth) / 2 - 0.5;
  const cx = W / 2;
  const cy = R + 0.5;
  const r = R - outline;
  const f = FACES[face];
  const defs =
    rad('face', cx - r * 0.35, cy - r * 0.45, r * 1.55, [[0, f.c[0]], [0.5, f.c[1]], [1, f.c[2]]]) +
    lin('bevel', cx - r, cy - r, cx + r, cy + r, [[0, WHITE, 0.6], [0.45, WHITE, 0], [0.6, NAVY, 0], [1, NAVY, 0.3]]) +
    `<clipPath id="fc"><circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r)}"/></clipPath>`;
  const body =
    `<circle cx="${n2(cx)}" cy="${n2(cy + depth)}" r="${n2(R)}" fill="${NAVY}"/>` +
    `<circle cx="${n2(cx)}" cy="${n2(cy + depth)}" r="${n2(r)}" fill="${f.side}"/>` +
    `<circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(R)}" fill="${NAVY}"/>` +
    `<circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r)}" fill="url(#face)"/>` +
    `<g clip-path="url(#fc)"><circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r)}" fill="none" stroke="url(#bevel)" stroke-width="${n2(r * 0.16)}"/>` +
    `<ellipse cx="${n2(cx)}" cy="${n2(cy - r * 0.6)}" rx="${n2(r * 0.6)}" ry="${n2(r * 0.27)}" fill="${WHITE}" fill-opacity=".26"/></g>` +
    icon(cx, cy, r);
  return svg(W, H, defs, body);
}

// navy-outlined rounded-rect button with a 3D base
function rectButton(W, H, { depth, outline, radius, face, icon, defs: extra = '' }) {
  const f = FACES[face];
  const w = W - 2;
  const h = H - depth - 2;
  const iw = w - 2 * outline;
  const ih = h - 2 * outline;
  const ir = radius - outline;
  const defs =
    lin('face', 0, 1 + outline, 0, 1 + outline + ih, [[0, f.c[0]], [0.45, f.c[1]], [1, f.c[2]]]) +
    lin('bevel', 1, 1, 1 + w, 1 + h, [[0, WHITE, 0.6], [0.45, WHITE, 0], [0.6, NAVY, 0], [1, NAVY, 0.3]]) +
    `<clipPath id="fc"><rect x="${1 + outline}" y="${1 + outline}" width="${iw}" height="${ih}" rx="${ir}"/></clipPath>` +
    extra;
  const body =
    `<rect x="1" y="${1 + depth}" width="${w}" height="${h}" rx="${radius}" fill="${NAVY}"/>` +
    `<rect x="${1 + outline}" y="${1 + depth + outline}" width="${iw}" height="${ih}" rx="${ir}" fill="${f.side}"/>` +
    `<rect x="1" y="1" width="${w}" height="${h}" rx="${radius}" fill="${NAVY}"/>` +
    `<rect x="${1 + outline}" y="${1 + outline}" width="${iw}" height="${ih}" rx="${ir}" fill="url(#face)"/>` +
    `<g clip-path="url(#fc)"><rect x="${1 + outline}" y="${1 + outline}" width="${iw}" height="${ih}" rx="${ir}" fill="none" stroke="url(#bevel)" stroke-width="16"/>` +
    `<rect x="${1 + outline + ir * 0.6}" y="${1 + outline + 8}" width="${n2(iw - ir * 1.2)}" height="${n2(ih * 0.2)}" rx="${n2(ih * 0.1)}" fill="${WHITE}" fill-opacity=".2"/></g>` +
    icon(1 + w / 2, 1 + h / 2);
  return svg(W, H, defs, body);
}

// icons, drawn white/acid with navy outlines, scaled by the face radius s
function iconPlay(fill = WHITE) {
  return (cx, cy, s) => {
    const x0 = cx - s * 0.26;
    const x1 = cx + s * 0.5;
    const h = s * 0.44;
    return `<path d="M${n2(x0)} ${n2(cy - h)} L${n2(x1)} ${n2(cy)} L${n2(x0)} ${n2(cy + h)} Z" fill="${fill}" stroke="${NAVY}" stroke-width="${n2(s * 0.1)}" stroke-linejoin="round"/>`;
  };
}

function flagShape(cx, cy, s) {
  const px = cx - s * 0.36;
  const top = cy - s * 0.56;
  const bot = cy + s * 0.6;
  const fw = s * 0.82;
  const fh = s * 0.54;
  const lw = n2(s * 0.08);
  const flag =
    `M${n2(px)} ${n2(top + s * 0.06)} C${n2(px + fw * 0.3)} ${n2(top - s * 0.08)} ${n2(px + fw * 0.55)} ${n2(top + s * 0.14)} ${n2(px + fw)} ${n2(top + s * 0.02)} ` +
    `L${n2(px + fw)} ${n2(top + fh)} C${n2(px + fw * 0.55)} ${n2(top + fh + s * 0.12)} ${n2(px + fw * 0.3)} ${n2(top + fh - s * 0.1)} ${n2(px)} ${n2(top + fh + s * 0.04)} Z`;
  return (
    `<rect x="${n2(px - s * 0.08)}" y="${n2(top - s * 0.04)}" width="${n2(s * 0.16)}" height="${n2(bot - top + s * 0.04)}" rx="${n2(s * 0.08)}" fill="${WHITE}" stroke="${NAVY}" stroke-width="${lw}"/>` +
    `<path d="${flag}" fill="${ACID}" stroke="${NAVY}" stroke-width="${lw}" stroke-linejoin="round"/>` +
    `<path d="${starPath(px + fw * 0.48, top + fh * 0.48, s * 0.15, s * 0.065)}" fill="${WHITE}"/>` +
    `<circle cx="${n2(px)}" cy="${n2(top - s * 0.06)}" r="${n2(s * 0.11)}" fill="${GOLD}" stroke="${NAVY}" stroke-width="${n2(s * 0.06)}"/>`
  );
}

function iconFlag(cx, cy, s) {
  return flagShape(cx + s * 0.04, cy, s * 0.95);
}

function crossOut(cx, cy, s) {
  const a = s * 0.62;
  const d = `M${n2(cx - a)} ${n2(cy - a)} L${n2(cx + a)} ${n2(cy + a)}`;
  return `<path d="${d}" stroke="${NAVY}" stroke-width="${n2(s * 0.3)}" stroke-linecap="round"/><path d="${d}" stroke="${PINK}" stroke-width="${n2(s * 0.16)}" stroke-linecap="round"/>`;
}

function iconFlagCrossed(cx, cy, s) {
  return iconFlag(cx, cy, s) + crossOut(cx, cy, s);
}

function iconList(cx, cy, s) {
  let out = '';
  for (const k of [-0.36, 0, 0.36]) {
    const y = cy + k * s;
    out +=
      `<circle cx="${n2(cx - s * 0.42)}" cy="${n2(y)}" r="${n2(s * 0.1)}" fill="${WHITE}" stroke="${NAVY}" stroke-width="${n2(s * 0.07)}"/>` +
      `<rect x="${n2(cx - s * 0.22)}" y="${n2(y - s * 0.085)}" width="${n2(s * 0.68)}" height="${n2(s * 0.17)}" rx="${n2(s * 0.085)}" fill="${WHITE}" stroke="${NAVY}" stroke-width="${n2(s * 0.07)}"/>`;
  }
  return out;
}

function iconPause(cx, cy, s) {
  const w = s * 0.25;
  const h = s * 0.92;
  return [-1, 1]
    .map((k) => `<rect x="${n2(cx + k * s * 0.21 - w / 2)}" y="${n2(cy - h / 2)}" width="${n2(w)}" height="${n2(h)}" rx="${n2(w * 0.4)}" fill="${WHITE}" stroke="${NAVY}" stroke-width="${n2(s * 0.08)}"/>`)
    .join('');
}

function iconBack(cx, cy, s) {
  const P = [
    [cx - s * 0.62, cy],
    [cx - s * 0.06, cy - s * 0.5],
    [cx - s * 0.06, cy - s * 0.2],
    [cx + s * 0.56, cy - s * 0.2],
    [cx + s * 0.56, cy + s * 0.2],
    [cx - s * 0.06, cy + s * 0.2],
    [cx - s * 0.06, cy + s * 0.5],
  ];
  return `<path d="${poly(P)}" fill="${WHITE}" stroke="${NAVY}" stroke-width="${n2(s * 0.1)}" stroke-linejoin="round"/>`;
}

function keyCap(cx, cy, size, letter) {
  const x = n2(cx - size / 2);
  const y = n2(cy - size / 2);
  const r = n2(size * 0.22);
  return (
    `<rect x="${x}" y="${n2(cy - size / 2 + size * 0.1)}" width="${size}" height="${size}" rx="${r}" fill="${NAVY}"/>` +
    `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${r}" fill="${NAVY}"/>` +
    `<rect x="${n2(cx - size / 2 + 6)}" y="${n2(cy - size / 2 + 6)}" width="${size - 12}" height="${size - 12}" rx="${n2(size * 0.16)}" fill="url(#key)"/>` +
    `<text x="${n2(cx)}" y="${n2(cy + size * 0.215)}" text-anchor="middle" font-family="${FONT}" font-size="${n2(size * 0.6)}" fill="${NAVY}">${letter}</text>`
  );
}
const KEY_DEFS = lin('key', 0, 0, 0, 1, [[0, WHITE], [1, '#d3defc']]).replace('gradientUnits="userSpaceOnUse"', 'gradientUnits="objectBoundingBox"');

function titlePlay() {
  return roundButton(415, 415, { depth: 16, outline: 12, face: 'acid', icon: iconPlayGold });
}
function iconPlayGold(cx, cy, s) {
  const x0 = cx - s * 0.26;
  const x1 = cx + s * 0.5;
  const h = s * 0.44;
  const tri = `M${n2(x0)} ${n2(cy - h)} L${n2(x1)} ${n2(cy)} L${n2(x0)} ${n2(cy + h)} Z`;
  return (
    `<linearGradient id="pg" gradientUnits="userSpaceOnUse" x1="0" y1="${n2(cy - h)}" x2="0" y2="${n2(cy + h)}">${stopList([[0, WHITE], [0.5, '#fff6cf'], [1, GOLD]])}</linearGradient>` +
    `<path d="${tri}" transform="translate(0 ${n2(s * 0.05)})" fill="${NAVY}" stroke="${NAVY}" stroke-width="${n2(s * 0.1)}" stroke-linejoin="round" opacity=".35"/>` +
    `<path d="${tri}" fill="url(#pg)" stroke="${NAVY}" stroke-width="${n2(s * 0.1)}" stroke-linejoin="round"/>`
  );
}

// rounded-square frame shared by the skins and create buttons
function frameButton(glassStops, inner) {
  const defs =
    lin('rim', 9, 9, 291, 291, RIM_STOPS) +
    lin('glass', 0, 20, 0, 280, glassStops) +
    `<clipPath id="gc"><rect x="20" y="20" width="260" height="260" rx="44"/></clipPath>` +
    blur('soft', 5) +
    inner.defs;
  const body =
    `<rect x="2" y="2" width="296" height="296" rx="62" fill="${NAVY}"/>` +
    `<rect x="9" y="9" width="282" height="282" rx="55" fill="url(#rim)"/>` +
    `<rect x="17" y="17" width="266" height="266" rx="47" fill="${NAVY}"/>` +
    `<rect x="20" y="20" width="260" height="260" rx="44" fill="url(#glass)"/>` +
    `<g clip-path="url(#gc)"><rect x="20" y="20" width="260" height="260" rx="44" fill="none" stroke="${ACID}" stroke-opacity=".3" stroke-width="12" filter="url(#soft)"/>` +
    `<path d="M20 20 H200 L20 200 Z" fill="${WHITE}" fill-opacity=".07"/></g>` +
    inner.body +
    `<path d="M13 92 V58 Q13 13 58 13 H110" fill="none" stroke="${WHITE}" stroke-opacity=".8" stroke-width="3.5" stroke-linecap="round"/>`;
  return svg(300, 300, defs, body);
}

function skinsButton() {
  return frameButton([[0, '#3a68f0'], [0.55, '#1f43b5'], [1, '#132a78']], {
    defs: rad('well', 150, 150, 120, [[0, '#0d1648'], [0.75, '#0b1030'], [1, '#0b1030']]),
    body:
      `<rect x="62" y="62" width="176" height="176" rx="30" fill="url(#well)" stroke="${NAVY}" stroke-width="4"/>` +
      `<rect x="62" y="62" width="176" height="176" rx="30" fill="none" stroke="${WHITE}" stroke-opacity=".14" stroke-width="2" transform="translate(0 2)"/>` +
      [[40, 40], [260, 40], [40, 260], [260, 260]].map(([x, y]) => `<path d="${sparkle(x, y, 8)}" fill="${ACID}"/>`).join(''),
  });
}

function createButton() {
  // wrench: open jaw head (top), shaft, ring end (bottom); local frame pointing up
  const jy = -64;
  const jr = 34;
  const jw = 14;
  const jyTop = n2(jy - Math.sqrt(jr * jr - jw * jw));
  const head = `M${jw} ${jyTop} A${jr} ${jr} 0 1 1 ${-jw} ${jyTop} L${-jw} ${jy + 6} L${jw} ${jy + 6} Z`;
  const shaft = 'M-13 -44 H13 V74 H-13 Z';
  const ring = 'M0 64 m-22 0 a22 22 0 1 0 44 0 a22 22 0 1 0 -44 0 Z M0 64 m-8 0 a8 8 0 1 1 16 0 a8 8 0 1 1 -16 0 Z';
  const wrenchShapes = [head, shaft, ring];
  const wrench =
    wrenchShapes.map((d) => `<path d="${d}" fill="${NAVY}" stroke="${NAVY}" stroke-width="13" stroke-linejoin="round" fill-rule="evenodd"/>`).join('') +
    wrenchShapes.map((d) => `<path d="${d}" fill="url(#wr)" fill-rule="evenodd"/>`).join('') +
    `<path d="M-5 -40 V58" stroke="${WHITE}" stroke-opacity=".55" stroke-width="4" stroke-linecap="round"/>`;
  // hammer: head across the top, handle down
  const hHead = 'M-56 -82 H50 Q58 -82 58 -74 V-40 Q58 -32 50 -32 H-56 Q-62 -32 -62 -38 V-76 Q-62 -82 -56 -82 Z';
  const hHandle = 'M-12 -40 H12 V92 Q12 100 0 100 Q-12 100 -12 92 Z';
  const hammer =
    [hHandle, hHead].map((d) => `<path d="${d}" fill="${NAVY}" stroke="${NAVY}" stroke-width="13" stroke-linejoin="round"/>`).join('') +
    `<path d="${hHandle}" fill="url(#hd)"/>` +
    `<path d="M-12 60 H12 M-12 72 H12 M-12 84 H12" stroke="#c96a12" stroke-width="5"/>` +
    `<path d="${hHead}" fill="url(#hh)"/>` +
    `<path d="M-50 -74 H44" stroke="${WHITE}" stroke-opacity=".6" stroke-width="5" stroke-linecap="round"/>` +
    `<path d="M30 -82 V-32" stroke="${NAVY}" stroke-opacity=".35" stroke-width="4"/>`;
  return frameButton([[0, '#1e2f78'], [0.6, '#121c55'], [1, '#0b1030']], {
    defs:
      lin('wr', -40, -100, 40, 90, [[0, '#fff3a6'], [0.4, GOLD], [1, '#f0a020']]) +
      lin('hd', -12, 0, 12, 0, [[0, '#ffe58a'], [1, '#f2a72a']]) +
      lin('hh', 0, -82, 0, -32, [[0, '#ffc07a'], [0.5, ORANGE], [1, '#e86e1c']]),
    body: `<g transform="translate(150 152) rotate(-45) scale(.95)">${wrench}</g><g transform="translate(150 152) rotate(45) scale(.95)">${hammer}</g>`,
  });
}

function skinSlot() {
  const defs =
    lin('rim', 0, 0, 180, 180, [[0, '#b9ccff'], [0.5, '#6d93ff'], [1, '#3a5fd6']]) +
    lin('glass', 0, 12, 0, 168, [[0, '#24409e'], [1, '#0e1852']]);
  const body =
    `<rect x="2" y="2" width="176" height="176" rx="36" fill="${NAVY}"/>` +
    `<rect x="7" y="7" width="166" height="166" rx="31" fill="url(#rim)"/>` +
    `<rect x="12" y="12" width="156" height="156" rx="26" fill="${NAVY}"/>` +
    `<rect x="14" y="14" width="152" height="152" rx="24" fill="url(#glass)"/>` +
    `<path d="M14 90 V40 Q14 14 40 14 H90" fill="none" stroke="${WHITE}" stroke-opacity=".12" stroke-width="10" stroke-linecap="round"/>` +
    `<path d="M10 60 V36 Q10 10 36 10 H60" fill="none" stroke="${WHITE}" stroke-opacity=".75" stroke-width="2.5" stroke-linecap="round"/>`;
  return svg(180, 180, defs, body);
}

function skinSelected() {
  const defs = blur('g', 5) + lin('ring', 0, 0, 200, 200, [[0, '#f4ffd2'], [0.5, ACID], [1, '#86d630']]);
  const body =
    `<rect x="7" y="7" width="186" height="186" rx="44" fill="${ACID}" filter="url(#g)"/>` +
    `<rect x="5" y="5" width="190" height="190" rx="44" fill="${NAVY}" fill-opacity=".9"/>` +
    `<rect x="8" y="8" width="184" height="184" rx="41" fill="url(#ring)"/>` +
    `<rect x="13" y="13" width="174" height="174" rx="37" fill="none" stroke="${WHITE}" stroke-opacity=".7" stroke-width="2.5"/>`;
  return svg(200, 200, defs, body);
}

function topBanner() {
  const W = 1226;
  const shape = `M0 -12 H${W} L${W - 40} 100 Q${W - 52} 132 ${W - 86} 132 H86 Q52 132 40 100 L0 -12 Z`;
  const defs =
    lin('tb', 0, 0, 0, 132, [[0, '#3c6dff'], [0.55, BLUE], [1, '#1a3cb3']]) +
    `<clipPath id="tc"><path d="${shape}"/></clipPath>`;
  let lights = '';
  for (let x = 150; x <= W - 150; x += 58) lights += `<circle cx="${x}" cy="106" r="5" fill="${WHITE}" fill-opacity="${(x / 58) % 2 < 1 ? 0.9 : 0.5}"/>`;
  const chev = (x, dir) =>
    [0, 22, 44].map((o) => `<path d="M${x + dir * o} 34 L${x + dir * (o + 16)} 56 L${x + dir * o} 78" fill="none" stroke="${WHITE}" stroke-opacity=".28" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
  const body =
    `<path d="${shape}" fill="url(#tb)"/>` +
    `<g clip-path="url(#tc)">` +
    `<rect x="0" y="0" width="${W}" height="30" fill="${WHITE}" fill-opacity=".12"/>` +
    `<path d="M50 121 Q60 124 92 124 H${W - 92} Q${W - 60} 124 ${W - 50} 121" fill="none" stroke="${ACID}" stroke-width="7" stroke-linecap="round"/>` +
    lights +
    chev(90, 1) +
    chev(W - 90, -1) +
    `</g>` +
    `<path d="${shape}" fill="none" stroke="${NAVY}" stroke-width="8" stroke-linejoin="round"/>`;
  return svg(W, 142, defs, body);
}

function selectCorner() {
  const tiles = [
    [0, 188, 1], [94, 188, 3], [188, 188, 4],
    [0, 94, 2], [94, 94, 6],
    [0, 0, 7],
  ];
  let defs = '';
  let body = '';
  tiles.forEach(([x, y, v], i) => {
    const p = blockParts(`t${i}`, v);
    defs += p.defs;
    body += `<g transform="translate(${x} ${y}) scale(${n2(94 / 120)})">${p.body}</g>`;
  });
  return svg(285, 282, defs, body);
}

function levelArrow() {
  const d = 'M30 26 L78 119 L30 212';
  const defs = lin('ar', 0, 0, 106, 238, [[0, '#f4ffd2'], [0.45, ACID], [1, '#77c427']]);
  const body =
    `<path d="${d}" fill="none" stroke="${NAVY}" stroke-width="50" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="url(#ar)" stroke-width="35" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M33 34 L70 106" fill="none" stroke="${WHITE}" stroke-opacity=".7" stroke-width="6" stroke-linecap="round"/>`;
  return svg(106, 238, defs, body);
}

// ================================================================ title (wordmark)

async function title(ctx) {
  const F = 150;
  const base = 146;
  const [mD, mO, mC] = await ctx.measure([
    { text: 'DASH', size: F },
    { text: 'OVERDRIVE', size: F },
    { text: 'CLASSIC', size: 42, spacing: 3 },
  ]);
  const pad = 16;
  const gap = 18;
  const slashW = 74;
  const tagW = Math.round(mC.w + 50);
  const tagH = 62;
  const W = Math.ceil(pad + mD.w + gap + slashW + gap + mO.w + 26 + tagW + pad);
  const H = 200;
  const xD = pad + 4;
  const xS = xD + mD.w + gap;
  const xO = xS + slashW + gap;
  const xT = xO + mO.w + 26;
  const capTop = base - 106;
  const slash = poly([[xS + 6, base], [xS + 34, base], [xS + slashW - 4, capTop], [xS + slashW - 32, capTop]]);
  const tcx = xT + tagW / 2;
  const tcy = capTop + 40;
  const words = (fillD, fillO, extra = '') =>
    `<text x="${n2(xD)}" y="${base}" font-family="${FONT}" font-size="${F}" fill="${fillD}" ${extra}>DASH</text>` +
    `<path d="${slash}" fill="${fillD === NAVY ? NAVY : 'url(#sl)'}" stroke="${NAVY}" stroke-width="12" stroke-linejoin="round"/>` +
    `<text x="${n2(xO)}" y="${base}" font-family="${FONT}" font-size="${F}" fill="${fillO}" ${extra}>OVERDRIVE</text>`;
  let extrude = '';
  for (let k = 12; k >= 1; k -= 1) extrude += `<g transform="translate(${n2(k * 0.25)} ${k})">${words(NAVY, NAVY, `stroke="${NAVY}" stroke-width="18" stroke-linejoin="round"`)}</g>`;
  const tag = (dy, fill, text) =>
    `<rect x="${n2(xT)}" y="${n2(tcy - tagH / 2 + dy)}" width="${tagW}" height="${tagH}" rx="${tagH / 2}" fill="${fill}" stroke="${NAVY}" stroke-width="7"/>` +
    (text ? `<text x="${n2(tcx + 1.5)}" y="${n2(tcy + 15)}" text-anchor="middle" font-family="${FONT}" font-size="42" letter-spacing="3" fill="${WHITE}">CLASSIC</text>` : '');
  const defs =
    lin('wd', 0, capTop, 0, base, [[0, WHITE], [1, '#dde6ff']]) +
    lin('wo', 0, capTop, 0, base, [[0, '#f2ffcc'], [0.5, ACID], [1, '#8fd935']]) +
    lin('sl', 0, capTop, 0, base, [[0, '#7fa2ff'], [1, BLUE]]) +
    lin('tg', 0, tcy - tagH / 2, 0, tcy + tagH / 2, [[0, '#5f88ff'], [1, '#1f45c4']]);
  const body =
    extrude +
    words('url(#wd)', 'url(#wo)', `stroke="${NAVY}" stroke-width="18" stroke-linejoin="round" paint-order="stroke"`) +
    `<g transform="rotate(-6 ${n2(tcx)} ${n2(tcy)})">${tag(7, NAVY, false)}${tag(0, 'url(#tg)', true)}</g>`;
  return { svg: svg(W, H, defs, body), w: W, h: H };
}

// ================================================================ grayscale textures (computed per pixel)

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
function hash2(i, j) {
  let h = (Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul(j | 0, 0x165667b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function sdRoundBox(px, py, hx, hy, r) {
  const qx = Math.abs(px) - hx + r;
  const qy = Math.abs(py) - hy + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

function toGray(values, w, h, mean) {
  let sum = 0;
  for (let i = 0; i < values.length; i++) sum += values[i];
  const shift = mean == null ? 0 : mean - sum / values.length;
  const out = Buffer.alloc(w * h);
  for (let i = 0; i < values.length; i++) out[i] = Math.round(clamp01(values[i] + shift) * 255);
  return { data: out, w, h, channels: 1 };
}

// big soft rounded diamonds with a gentle emboss and diagonal light bands; tiles left<->right
function backgroundTexture() {
  const S = 2048;
  const D = 256; // horizontal diagonal of one diamond; 2048 / 256 = 8 per row
  const K = D / Math.SQRT2;
  const half = K / 2 - 6;
  const corner = 38;
  const v = new Float32Array(S * S);
  for (let y = 0; y < S; y++) {
    const py = y + 0.5;
    for (let x = 0; x < S; x++) {
      const px = x + 0.5;
      const a = (px + py) / D;
      const b = (px - py) / D;
      const ia = Math.floor(a);
      const ib = Math.floor(b);
      const u = (a - ia - 0.5) * K;
      const w = (b - ib - 0.5) * K;
      const d = sdRoundBox(u, w, half, half, corner);
      const du = sdRoundBox(u + 0.5, w, half, half, corner) - sdRoundBox(u - 0.5, w, half, half, corner);
      const dw = sdRoundBox(u, w + 0.5, half, half, corner) - sdRoundBox(u, w - 0.5, half, half, corner);
      const nx = (du + dw) * Math.SQRT1_2;
      const ny = (du - dw) * Math.SQRT1_2;
      const nl = Math.hypot(nx, ny) || 1;
      const lit = (-nx - ny) * Math.SQRT1_2 / nl; // +1 where the edge faces the top-left light
      // per-diamond tone; (ia+ib) mod 16 keeps it periodic over 2048 px
      const cell = hash2(ia - ib, (((ia + ib) % 16) + 16) % 16);
      let inside = 0.79 + (cell - 0.5) * 0.035 + 0.04 * smoothstep(-24, -1, d) * lit;
      if (cell > 0.5) {
        const d2 = sdRoundBox(u, w, half * 0.44, half * 0.44, 16);
        inside += 0.016 * (1 - smoothstep(1.2, 3.2, Math.abs(d2)));
      }
      const grout = 0.735;
      let val = grout + (inside - grout) * smoothstep(0.8, -0.8, d);
      const s = (px + py) % 1024;
      val += 0.035 * Math.exp(-(((s - 330) / 120) ** 2)) + 0.024 * Math.exp(-(((s - 610) / 24) ** 2));
      val += (0.5 - py / S) * 0.05;
      v[y * S + x] = val;
    }
  }
  return toGray(v, S, S, 0.78);
}

// level-select backdrop: smooth vertical gradient, very faint diamonds (engine draws it flipped)
function emptyBgTexture() {
  const S = 2048;
  const D = 256;
  const K = D / Math.SQRT2;
  const half = K / 2 - 4;
  const v = new Float32Array(S * S);
  for (let y = 0; y < S; y++) {
    const py = y + 0.5;
    const grad = 0.56 + 0.38 * smoothstep(0, 1, py / S);
    for (let x = 0; x < S; x++) {
      const px = x + 0.5;
      const a = (px + py) / D;
      const b = (px - py) / D;
      const u = (a - Math.floor(a) - 0.5) * K;
      const w = (b - Math.floor(b) - 0.5) * K;
      const d = sdRoundBox(u, w, half, half, 40);
      const s = (px + py) % 1024;
      v[y * S + x] = grad - 0.014 * smoothstep(-1.5, 1.5, d) + 0.012 * Math.exp(-(((s - 330) / 140) ** 2));
    }
  }
  return toGray(v, S, S, null);
}

// floor: light top band, calm rounded tiles, darker toward the bottom; tiles left<->right
function groundTexture() {
  const S = 512;
  const T = 128;
  const top = 14;
  const v = new Float32Array(S * S);
  for (let y = 0; y < S; y++) {
    const py = y + 0.5;
    const base = 0.86 - 0.3 * (py / S);
    for (let x = 0; x < S; x++) {
      const px = x + 0.5;
      const ty = py - top;
      const row = Math.floor(ty / T);
      const col = Math.floor(px / T);
      const lu = px - col * T - T / 2;
      const lv = ty - row * T - T / 2;
      const d = sdRoundBox(lu, lv, T / 2 - 5, T / 2 - 5, 22);
      const dv = sdRoundBox(lu, lv + 0.5, T / 2 - 5, T / 2 - 5, 22) - sdRoundBox(lu, lv - 0.5, T / 2 - 5, T / 2 - 5, 22);
      const du = sdRoundBox(lu + 0.5, lv, T / 2 - 5, T / 2 - 5, 22) - sdRoundBox(lu - 0.5, lv, T / 2 - 5, T / 2 - 5, 22);
      const nl = Math.hypot(du, dv) || 1;
      const lit = (-dv * 0.85 - du * 0.35) / nl; // light from above, a little from the left
      const tone = ((row + col) & 1 ? 0.012 : -0.012) + (hash2(row, col & 3) - 0.5) * 0.02;
      const tile = base + tone + 0.07 * smoothstep(-20, -1, d) * lit;
      const grout = base - 0.12;
      let val = grout + (tile - grout) * smoothstep(0.8, -0.8, d);
      if (py < top) {
        // bright lip on top, then a thin shadow line into the tiles
        const lip = 0.97 - 0.05 * (py / 10);
        val = py < 10 ? lip : lip + (0.6 - lip) * smoothstep(10, 13, py);
      }
      v[y * S + x] = val;
    }
  }
  return toGray(v, S, S, 0.7);
}

// white glowing line, soft vertical falloff, fading out over the last 300 px at both ends
function groundLineTexture() {
  const W = 2048;
  const H = 12;
  const data = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) {
    const dy = y + 0.5 - 6;
    const ay = clamp01(Math.exp(-(dy * dy) / (2 * 0.85 * 0.85)) + 0.55 * Math.exp(-(dy * dy) / (2 * 2.6 * 2.6)));
    for (let x = 0; x < W; x++) {
      const fx = smoothstep(0, 300, x + 0.5) * smoothstep(0, 300, W - x - 0.5);
      const i = (y * W + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = Math.round(ay * fx * 255);
    }
  }
  return { data, w: W, h: H, channels: 4 };
}

// ================================================================ sprite list

const DECO_SPARKLES = {
  18: [[0.3, 0.12, 7], [0.62, 0.06, 5], [0.86, 0.3, 4.5]],
  19: [[0.42, 0.1, 6], [0.76, 0.22, 4.5]],
  20: [[0.55, 0.1, 5.5], [0.2, 0.3, 4]],
  21: [],
};

const SPRITES = [
  ...[1, 2, 3, 4, 6, 7].map((v) => ({ file: `objects/${v}.png`, w: 120, h: 120, svg: () => block(v) })),
  { file: 'objects/5.png', w: 120, h: 120, svg: decoTile },
  { file: 'objects/40.png', w: 120, h: 54, svg: slab },
  { file: 'objects/8.png', w: 120, h: 120, svg: () => spike(120, 120, 60, 8, 8, 112, 116, 7) },
  { file: 'objects/39.png', w: 120, h: 54, svg: () => spike(120, 54, 60, 4.5, 9, 111, 50, 6.5) },
  { file: 'objects/9.png', w: 120, h: 104, svg: spikeCluster },
  { file: 'objects/35.png', w: 100, h: 16, svg: jumpPad },
  { file: 'objects/36.png', w: 120, h: 120, svg: jumpOrb },
  { file: 'objects/10.png', w: 96, h: 292, svg: () => portal(96, 292, 'gravityDown', 'down') },
  { file: 'objects/11.png', w: 95, h: 292, svg: () => portal(95, 292, 'gravityUp', 'up') },
  { file: 'objects/12.png', w: 132, h: 335, svg: () => portal(132, 335, 'cube', 'square') },
  { file: 'objects/13.png', w: 133, h: 335, svg: () => portal(133, 335, 'ship', 'rocket') },
  { file: 'objects/15.png', w: 24, h: 168, svg: () => pole(24, 168) },
  { file: 'objects/16.png', w: 24, h: 104, svg: () => pole(24, 104) },
  { file: 'objects/17.png', w: 20, h: 48, svg: () => pole(20, 48) },
  { file: 'objects/18.png', w: 508, h: 164, svg: () => tufts(508, 164, 18, 9, DECO_SPARKLES[18]) },
  { file: 'objects/19.png', w: 416, h: 144, svg: () => tufts(416, 144, 19, 8, DECO_SPARKLES[19]) },
  { file: 'objects/20.png', w: 288, h: 116, svg: () => tufts(288, 116, 20, 6, DECO_SPARKLES[20]) },
  { file: 'objects/21.png', w: 168, h: 52, svg: () => tufts(168, 52, 21, 4, DECO_SPARKLES[21]) },
  { file: 'objects/41.png', w: 78, h: 278, svg: chainLantern },
  { file: 'objects/201.png', w: 120, h: 120, svg: coin },
  { file: 'coinIcon.png', w: 64, h: 64, svg: coinIcon },
  { file: 'coinEmpty.png', w: 64, h: 64, svg: coinEmpty },
  ...SKINS.map((make, i) => ({ file: `skins/${i}.png`, w: 185, h: 185, svg: make })),
  { file: 'ship.png', w: 149, h: 88, svg: ship },
  { file: 'checkpoint.png', w: 100, h: 100, svg: checkpoint },
  { file: 'background.png', w: 2048, h: 2048, raw: backgroundTexture },
  { file: 'emptyBG.png', w: 2048, h: 2048, raw: emptyBgTexture },
  { file: 'ground.png', w: 512, h: 512, raw: groundTexture },
  { file: 'groundLine.png', w: 2048, h: 12, raw: groundLineTexture },
  { file: 'title.png', svg: title },
  { file: 'titlePlay.png', w: 415, h: 415, svg: titlePlay },
  { file: 'skinsButton.png', w: 300, h: 300, svg: skinsButton },
  { file: 'createButton.png', w: 300, h: 300, svg: createButton },
  { file: 'skinSlot.png', w: 180, h: 180, svg: skinSlot },
  { file: 'skinSelected.png', w: 200, h: 200, svg: skinSelected },
  { file: 'top.png', w: 1226, h: 142, svg: topBanner },
  { file: 'selectCorner.png', w: 285, h: 282, svg: selectCorner },
  { file: 'levelArrow.png', w: 106, h: 238, svg: levelArrow },
  { file: 'toTitleScreen.png', w: 124, h: 150, svg: () => rectButton(124, 150, { depth: 10, outline: 7, radius: 46, face: 'blue', icon: (cx, cy) => iconBack(cx, cy, 46) }) },
  { file: 'pause.png', w: 96, h: 96, svg: () => roundButton(96, 96, { depth: 7, outline: 5, face: 'blue', icon: iconPause }) },
  { file: 'resume.png', w: 304, h: 310, svg: () => roundButton(304, 310, { depth: 14, outline: 9, face: 'acid', icon: iconPlay() }) },
  { file: 'enterPractice.png', w: 237, h: 244, svg: () => roundButton(237, 244, { depth: 12, outline: 8, face: 'blue', icon: iconFlag }) },
  { file: 'exitPractice.png', w: 237, h: 242, svg: () => roundButton(237, 242, { depth: 10, outline: 8, face: 'blue', icon: iconFlagCrossed }) },
  { file: 'exitLevel.png', w: 237, h: 244, svg: () => roundButton(237, 244, { depth: 12, outline: 8, face: 'blue', icon: iconList }) },
  {
    file: 'placeCheckpoint.png',
    w: 292,
    h: 222,
    svg: () =>
      rectButton(292, 222, { depth: 12, outline: 8, radius: 54, face: 'blue', defs: KEY_DEFS, icon: (cx, cy) => flagShape(cx - 62, cy, 70) + keyCap(cx + 66, cy - 2, 92, 'Z') }),
  },
  {
    file: 'removeCheckpoint.png',
    w: 186,
    h: 222,
    svg: () =>
      rectButton(186, 222, { depth: 12, outline: 8, radius: 48, face: 'blue', defs: KEY_DEFS, icon: (cx, cy) => flagShape(cx + 2, cy - 40, 50) + crossOut(cx, cy - 40, 50) + keyCap(cx, cy + 52, 68, 'X') }),
  },
];

// ================================================================ rendering pipeline

async function loadChromium() {
  // repo convention (see ../browser-check.mjs): Playwright lives in tools/node_modules
  const local = path.join(REPO, 'tools', 'node_modules', 'playwright', 'index.mjs');
  if (existsSync(local)) return (await import(pathToFileURL(local).href)).chromium;
  try {
    return (await import('playwright')).chromium;
  } catch {
    throw new Error('Playwright not found. Install it with `npm --prefix tools install` (tools/package.json lists it).');
  }
}

async function openPage() {
  const chromium = await loadChromium();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 256, height: 256 }, deviceScaleFactor: 1 });
  const font = (await readFile(FONT_FILE)).toString('base64');
  await page.setContent(
    `<!doctype html><html><head><style>@font-face{font-family:'Lilita One';src:url(data:font/ttf;base64,${font}) format('truetype');}` +
      `html,body{margin:0;padding:0;background:transparent;overflow:hidden}#art{position:absolute;left:0;top:0}#art svg{display:block}</style></head>` +
      `<body><div id="art"></div><span style="font-family:'Lilita One';position:absolute;left:-999px">DASH</span></body></html>`,
  );
  await page.evaluate(async () => {
    await document.fonts.load("100px 'Lilita One'");
    await document.fonts.ready;
  });
  const ok = await page.evaluate(() => document.fonts.check("100px 'Lilita One'"));
  if (!ok) throw new Error('Lilita One did not load');
  return { browser, page };
}

async function measure(page, items) {
  return page.evaluate((list) => {
    const ns = 'http://www.w3.org/2000/svg';
    const s = document.createElementNS(ns, 'svg');
    s.setAttribute('width', '2000');
    s.setAttribute('height', '400');
    document.body.appendChild(s);
    const out = list.map(({ text, size, spacing }) => {
      const t = document.createElementNS(ns, 'text');
      t.setAttribute('font-family', 'Lilita One');
      t.setAttribute('font-size', String(size));
      if (spacing) t.setAttribute('letter-spacing', String(spacing));
      t.textContent = text;
      s.appendChild(t);
      return { w: t.getComputedTextLength() };
    });
    s.remove();
    return out;
  }, items);
}

async function rasterize(page, markup, w, h) {
  await page.setViewportSize({ width: w, height: h });
  await page.evaluate((m) => {
    document.getElementById('art').innerHTML = m;
  }, markup);
  await page.evaluate(() => document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => r()))));
  const shot = await page.screenshot({ clip: { x: 0, y: 0, width: w, height: h }, omitBackground: true, type: 'png' });
  const { data, info } = await sharp(shot).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== w || info.height !== h) throw new Error(`rasterized ${info.width}x${info.height}, expected ${w}x${h}`);
  return data;
}

// truecolor RGBA, or a palette PNG when the quantized image is visually identical
async function encodeRGBA(data, w, h) {
  for (let i = 0; i < data.length; i += 4) if (data[i + 3] === 0) data[i] = data[i + 1] = data[i + 2] = 0;
  const raw = { raw: { width: w, height: h, channels: 4 } };
  // note: sharp's png `effort`/`quality`/`colours` options switch on palette mode, so the truecolor encode sets none of them
  const full = await sharp(data, raw).png({ compressionLevel: 9, adaptiveFiltering: true, palette: false }).toBuffer();
  const pal = await sharp(data, raw).png({ palette: true, colours: 256, quality: 100, dither: 0, effort: 10, compressionLevel: 9 }).toBuffer();
  const back = await sharp(pal).ensureAlpha().raw().toBuffer();
  let sum = 0;
  let max = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a0 = data[i + 3];
    const a1 = back[i + 3];
    let e = Math.abs(a0 - a1);
    for (let c = 0; c < 3; c++) e = Math.max(e, Math.abs(data[i + c] * a0 - back[i + c] * a1) / 255);
    sum += e;
    if (e > max) max = e;
  }
  const mean = sum / (w * h);
  const usePalette = pal.length < full.length && mean <= 0.35 && max <= 10;
  return { png: usePalette ? pal : full, mode: usePalette ? 'palette' : 'rgba' };
}

async function encodeGray(data, w, h) {
  const png = await sharp(data, { raw: { width: w, height: h, channels: 1 } })
    .toColourspace('b-w')
    .png({ compressionLevel: 9, adaptiveFiltering: true, palette: false })
    .toBuffer();
  return { png, mode: 'gray' };
}

async function main() {
  const filters = process.argv.slice(2);
  const selected = SPRITES.filter((s) => !filters.length || filters.some((f) => s.file.includes(f)));
  let session = null;
  if (selected.some((s) => s.svg)) session = await openPage();
  const ctx = { measure: (items) => measure(session.page, items) };
  const rows = [];
  try {
    for (const s of selected) {
      let out;
      if (s.svg) {
        const made = await s.svg(ctx);
        const markup = typeof made === 'string' ? made : made.svg;
        const w = typeof made === 'string' ? s.w : made.w;
        const h = typeof made === 'string' ? s.h : made.h;
        const data = await rasterize(session.page, markup, w, h);
        out = { ...(await encodeRGBA(data, w, h)), w, h };
      } else {
        const tex = s.raw();
        if (tex.w !== s.w || tex.h !== s.h) throw new Error(`${s.file}: made ${tex.w}x${tex.h}`);
        out = { ...(tex.channels === 1 ? await encodeGray(tex.data, tex.w, tex.h) : await encodeRGBA(tex.data, tex.w, tex.h)), w: tex.w, h: tex.h };
      }
      const file = path.join(GFX, s.file);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, out.png);
      rows.push([s.file, `${out.w}x${out.h}`, out.png.length, out.mode]);
      if (s.file === 'skins/0.png') {
        await copyFile(file, path.join(GFX, 'icon.png'));
        rows.push(['icon.png', `${out.w}x${out.h}`, out.png.length, 'copy of skins/0']);
      }
    }
  } finally {
    if (session) await session.browser.close();
  }
  for (const [f, size, bytes, mode] of rows) console.log(`${f.padEnd(24)} ${size.padStart(9)} ${String(bytes).padStart(9)} B  ${mode}`);
  if (!filters.length) {
    let total = 0;
    for (const [f] of rows) total += (await stat(path.join(GFX, f))).size;
    console.log(`total ${rows.length} files, ${(total / 1024 / 1024).toFixed(2)} MB`);
  }
}

await main();
