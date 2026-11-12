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
  ball: { light: '#ffcfb0', mid: '#ff6a3d', deep: '#d8263a' },
  ufo: { light: '#fffbd2', mid: '#ffe04d', deep: '#f2a900' },
  wave: { light: '#d4fffb', mid: '#3fefe2', deep: '#00a3d6' },
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
  if (kind === 'ball' || kind === 'ufo' || kind === 'wave') {
    const X = (v) => n2(cx + v * br);
    const Y = (v) => n2(cy + v * br);
    if (kind === 'ball') {
      return (
        `<circle cx="${n2(cx)}" cy="${n2(cy)}" r="${s(0.6)}" fill="${WHITE}" ${line}/>` +
        `<path d="M${X(-0.56)} ${Y(-0.16)} Q${X(0)} ${Y(0.22)} ${X(0.56)} ${Y(-0.16)}" fill="none" stroke="#ff5a3d" stroke-width="${n2(br * 0.16)}" stroke-linecap="round"/>` +
        `<path d="M${X(-0.14)} ${Y(-0.56)} Q${X(0.2)} ${Y(-0.1)} ${X(0.06)} ${Y(0.58)}" fill="none" stroke="${NAVY}" stroke-width="${n2(br * 0.08)}" stroke-linecap="round"/>`
      );
    }
    if (kind === 'ufo') {
      return (
        `<path d="M${X(-0.32)} ${Y(0.08)} A${s(0.32)} ${s(0.36)} 0 0 1 ${X(0.32)} ${Y(0.08)} Z" fill="#a8f4ff" ${line}/>` +
        `<ellipse cx="${n2(cx)}" cy="${Y(0.16)}" rx="${s(0.74)}" ry="${s(0.25)}" fill="${WHITE}" ${line}/>` +
        [-0.42, 0, 0.42].map((k) => `<circle cx="${X(k)}" cy="${Y(0.17)}" r="${s(0.075)}" fill="${NAVY}"/>`).join('')
      );
    }
    // wave: zigzag that ends in an arrowhead
    const P = [[-0.62, 0.36], [-0.3, -0.16], [0, 0.3], [0.3, -0.18]].map(([x, y]) => [cx + x * br, cy + y * br]);
    const [ax, ay] = P[3];
    const [bx, by] = P[2];
    const ang = Math.atan2(ay - by, ax - bx);
    const h = br * 0.42;
    const tip = [ax + Math.cos(ang) * h, ay + Math.sin(ang) * h];
    const l = [ax + Math.cos(ang + Math.PI / 2) * h * 0.62, ay + Math.sin(ang + Math.PI / 2) * h * 0.62];
    const r = [ax + Math.cos(ang - Math.PI / 2) * h * 0.62, ay + Math.sin(ang - Math.PI / 2) * h * 0.62];
    const d = `M${pts(P)}`;
    return (
      `<path d="${d}" fill="none" stroke="${NAVY}" stroke-width="${n2(br * 0.3)}" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path d="${poly([l, tip, r])}" fill="${WHITE}" ${line}/>` +
      `<path d="${d}" fill="none" stroke="${WHITE}" stroke-width="${n2(br * 0.15)}" stroke-linecap="round" stroke-linejoin="round"/>`
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
// a gold key with a round bow and a star hole: the tower's collectible (object 204)
function keyParts(scale, { glow = false } = {}) {
  const k = scale;
  const v = (n) => n2(n * k);
  const defs =
    (glow ? rad("kglow", 60 * k, 60 * k, 60 * k, [[0.55, GOLD, 0.5], [0.8, GOLD, 0.15], [1, GOLD, 0]]) : "") +
    lin("kgold", 0, 12 * k, 0, 108 * k, [[0, "#fff3a8"], [0.45, GOLD], [1, "#e08a14"]]);
  // bow (a ring), shaft and two teeth; outlines first, then the gold on top so the parts join
  const parts = (paint) =>
    `<circle cx="${v(60)}" cy="${v(36)}" r="${v(24)}" ${paint}/>` +
    `<rect x="${v(54)}" y="${v(52)}" width="${v(12)}" height="${v(56)}" rx="${v(4)}" ${paint}/>` +
    `<rect x="${v(64)}" y="${v(84)}" width="${v(16)}" height="${v(9)}" rx="${v(2.5)}" ${paint}/>` +
    `<rect x="${v(64)}" y="${v(97)}" width="${v(12)}" height="${v(9)}" rx="${v(2.5)}" ${paint}/>`;
  const outline = Math.max(10 * k, 4.6);
  const body =
    (glow ? `<circle cx="${v(60)}" cy="${v(60)}" r="${v(60)}" fill="url(#kglow)"/>` : "") +
    parts(`fill="${NAVY}" stroke="${NAVY}" stroke-width="${n2(outline)}" stroke-linejoin="round"`) +
    parts('fill="url(#kgold)"') +
    `<path d="${starPath(60 * k, 37 * k, 12 * k, 5.4 * k)}" fill="${NAVY}" fill-opacity=".9"/>` +
    `<path d="M${v(44)} ${v(26)} Q${v(50)} ${v(16)} ${v(60)} ${v(15)}" fill="none" stroke="${WHITE}" stroke-opacity=".85" stroke-width="${n2(Math.max(3.5 * k, 1.6))}" stroke-linecap="round"/>` +
    `<path d="M${v(57)} ${v(60)} V${v(100)}" stroke="${WHITE}" stroke-opacity=".45" stroke-width="${n2(Math.max(2.5 * k, 1.2))}" stroke-linecap="round"/>`;
  return { defs, body };
}
function key() {
  const { defs, body } = keyParts(1, { glow: true });
  return svg(120, 120, defs, body + `<path d="${sparkle(98, 22, 8)}" fill="${WHITE}"/>`);
}
function keyIcon() {
  const { defs, body } = keyParts(64 / 120);
  return svg(64, 64, defs, body);
}
function keyEmpty() {
  const k = 64 / 120;
  const { body } = keyParts(k);
  return svg(64, 64, '', `<g opacity=".38" fill="none">${body.replace(/fill="url\(#kgold\)"/g, 'fill="#0b1030" fill-opacity=".5"').replace(/stroke="#0b1030"/g, 'stroke="#ffffff"')}</g>`);
}

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

// ================================================================ locks

// chunky padlock drawn in a 160 x 190 frame; `detail` adds the glow, rivets and star of the big version
function padlockParts(detail) {
  const shackle = 'M47 98 V58 A33 33 0 0 1 113 58 V98';
  const o = detail ? 8 : 9;
  const B = { x: 14, y: 80, w: 132, h: 102, r: 26 };
  const I = { x: B.x + o, y: B.y + o, w: B.w - 2 * o, h: B.h - 2 * o, r: B.r - o };
  const rect = (q, extra) => `<rect x="${q.x}" y="${q.y}" width="${q.w}" height="${q.h}" rx="${q.r}" ${extra}/>`;
  const defs =
    lin('lsh', 30, 14, 130, 96, [[0, '#f6f9ff'], [0.45, '#c3cfe4'], [1, '#7a8bb2']]) +
    lin('lbody', 0, I.y, 0, I.y + I.h, [[0, '#e2eaf8'], [0.45, '#a6b8da'], [1, '#61759f']]) +
    lin('lbev', I.x, I.y, I.x + I.w, I.y + I.h, [[0, WHITE, 0.6], [0.4, WHITE, 0], [0.6, NAVY, 0], [1, NAVY, 0.3]]) +
    lin('lgold', 0, 98, 0, 144, [[0, '#fff3a8'], [0.45, GOLD], [1, '#ffb000']]) +
    lin('lstar', 0, 152, 0, 172, [[0, '#f0ffc4'], [0.5, ACID], [1, '#86d630']]) +
    `<clipPath id="lbc">${rect(I, '')}</clipPath>` +
    (detail ? blur('lglow', 6) : '');
  const keyhole = 'M80 107.5 A7.5 7.5 0 0 1 84.2 121.2 L86.6 134 Q87 136.5 84.4 136.5 H75.6 Q73 136.5 73.4 134 L75.8 121.2 A7.5 7.5 0 0 1 80 107.5 Z';
  const body =
    (detail
      ? `<g filter="url(#lglow)" opacity=".55"><path d="${shackle}" fill="none" stroke="#dfe8ff" stroke-width="30" stroke-linecap="round"/>${rect(B, 'fill="#dfe8ff"')}</g>`
      : '') +
    `<path d="${shackle}" fill="none" stroke="${NAVY}" stroke-width="${detail ? 27 : 29}" stroke-linecap="round"/>` +
    `<path d="${shackle}" fill="none" stroke="url(#lsh)" stroke-width="15" stroke-linecap="round"/>` +
    `<path d="M44 90 V58 A36 36 0 0 1 67.7 24.2" fill="none" stroke="${WHITE}" stroke-opacity=".8" stroke-width="3.5" stroke-linecap="round"/>` +
    rect(B, `fill="${NAVY}"`) +
    rect(I, 'fill="url(#lbody)"') +
    `<g clip-path="url(#lbc)">${rect(I, 'fill="none" stroke="url(#lbev)" stroke-width="14"')}` +
    `<rect x="34" y="${I.y + 6}" width="72" height="11" rx="5.5" fill="${WHITE}" fill-opacity=".45"/><circle cx="118" cy="${I.y + 11.5}" r="5.5" fill="${WHITE}" fill-opacity=".45"/></g>` +
    (detail
      ? [[35, 104], [125, 104], [35, 161], [125, 161]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.6" fill="#eef2fa" stroke="${NAVY}" stroke-width="2.2"/>`).join('')
      : '') +
    `<circle cx="80" cy="121" r="23" fill="url(#lgold)" stroke="${NAVY}" stroke-width="5"/>` +
    `<path d="${ellipseArc(80, 121, 18.5, 18.5, 200, 265)}" fill="none" stroke="${WHITE}" stroke-opacity=".85" stroke-width="3" stroke-linecap="round"/>` +
    `<path d="${keyhole}" fill="${NAVY}"/>` +
    (detail ? `<path d="${starPath(80, 162.5, 10.5, 4.8)}" fill="url(#lstar)" stroke="${NAVY}" stroke-width="3" stroke-linejoin="round"/>` : '');
  return { defs, body };
}

// big padlock shown over a locked secret level
function lock() {
  const { defs, body } = padlockParts(true);
  return svg(160, 190, defs, body);
}

// the same padlock, simplified, for small spots (exactly 0.4 scale)
function lockSmall() {
  const { defs, body } = padlockParts(false);
  return svg(64, 76, defs, `<g transform="scale(.4)">${body}</g>`);
}

// ================================================================ skins 12-30 (second set and the shop) and the locked-slot cover

// cube with a non-square silhouette: the 11 px navy outline is drawn inside the shape
function skinShape({ shape, colors, defs = '', pattern = '', face = '' }) {
  const [c0, c1, c2] = colors;
  const D =
    lin('body', 17, 17, 168, 168, [[0, c0], [0.5, c1], [1, c2]]) +
    lin('bevel', 17, 17, 168, 168, [[0, WHITE, 0.55], [0.42, WHITE, 0], [0.58, NAVY, 0], [1, NAVY, 0.32]]) +
    `<clipPath id="sc"><path d="${shape}"/></clipPath>` +
    defs;
  const body =
    `<path d="${shape}" fill="url(#body)"/>` +
    `<g clip-path="url(#sc)">${pattern}<path d="${shape}" fill="none" stroke="url(#bevel)" stroke-width="36"/><path d="${shape}" fill="none" stroke="${NAVY}" stroke-width="22"/></g>` +
    `<rect x="29" y="26" width="70" height="12" rx="6" fill="${WHITE}" fill-opacity=".42"/><circle cx="111" cy="32" r="6" fill="${WHITE}" fill-opacity=".42"/>` +
    face;
  return svg(185, 185, D, body);
}

// head that starts lower so a horn/antenna/stem/crown can sit above it inside the 185 px frame
const tallHead = (top) =>
  `<rect x="6" y="${top}" width="173" height="${179 - top}" rx="31" fill="${NAVY}"/><rect x="17" y="${top + 11}" width="151" height="${157 - top}" rx="20" fill="url(#body)"/>`;
const headGloss = (top) => `<rect x="29" y="${top + 9}" width="60" height="10" rx="5" fill="${WHITE}" fill-opacity=".42"/>`;

const SKINS_2 = [
  // 12: ninja
  () =>
    cube({
      colors: ['#717ca3', '#414a6e', '#222844'],
      defs: lin('band', 0, 42, 0, 62, [[0, '#ff8591'], [0.5, '#ff3d55'], [1, '#c81e3c']]),
      pattern:
        `<rect x="19.5" y="19.5" width="146" height="146" rx="18" fill="none" stroke="#a3add3" stroke-opacity=".5" stroke-width="3"/>` +
        `<rect x="10" y="72" width="165" height="40" fill="#ffdcbf"/><path d="M10 72 H175 M10 112 H175" stroke="${NAVY}" stroke-width="4"/>` +
        `<rect x="10" y="42" width="165" height="20" fill="url(#band)"/><path d="M10 42 H175 M10 62 H175" stroke="${NAVY}" stroke-width="3.5"/>` +
        `<path d="M40 146 Q92.5 157 145 146" fill="none" stroke="${NAVY}" stroke-opacity=".35" stroke-width="3" stroke-linecap="round"/>`,
      face:
        `<ellipse cx="65" cy="94" rx="9.5" ry="11" fill="${NAVY}"/><ellipse cx="120" cy="94" rx="9.5" ry="11" fill="${NAVY}"/>` +
        `<circle cx="62" cy="90" r="3.4" fill="${WHITE}"/><circle cx="117" cy="90" r="3.4" fill="${WHITE}"/>` +
        `<path d="M50 80 L77 86 M135 80 L108 86" stroke="${NAVY}" stroke-width="5" stroke-linecap="round"/>` +
        `<path d="M150 50 Q164 40 177 30 L177 45 Q165 51 152 56 Z M150 55 Q164 63 176 74 L170 80 Q159 68 149 60 Z" fill="url(#band)" stroke="${NAVY}" stroke-width="3" stroke-linejoin="round"/>` +
        `<rect x="140" y="43" width="17" height="17" rx="5" fill="url(#band)" stroke="${NAVY}" stroke-width="3"/>`,
    }),
  // 13: retro robot with an antenna
  () =>
    cube({
      colors: ['#ffd9ad', '#eea15c', '#bf6427'],
      frame:
        `<path d="M92.5 42 V24" stroke="${NAVY}" stroke-width="12" stroke-linecap="round"/><path d="M92.5 42 V24" stroke="#dfe4ee" stroke-width="5" stroke-linecap="round"/>` +
        `<circle cx="92.5" cy="18" r="8.5" fill="${PINK}" stroke="${NAVY}" stroke-width="4"/><circle cx="89.5" cy="15" r="2.6" fill="${WHITE}"/>` +
        tallHead(34),
      inner: [17, 45, 151, 123],
      gloss: false,
      pattern: `<path d="M17 74 H168" stroke="${NAVY}" stroke-opacity=".18" stroke-width="3"/>`,
      face:
        headGloss(34) +
        [[31, 60], [154, 60], [31, 154], [154, 154]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.2" fill="#ffe6c7" stroke="${NAVY}" stroke-width="2.2"/>`).join('') +
        [63, 122].map((x) => `<circle cx="${x}" cy="102" r="21" fill="${NAVY}"/><circle cx="${x}" cy="102" r="15.5" fill="#fff8e8"/><circle cx="${x + 3}" cy="104" r="7.5" fill="${NAVY}"/><circle cx="${x - 3}" cy="97" r="3.4" fill="${WHITE}"/>`).join('') +
        `<rect x="62" y="132" width="61" height="24" rx="8" fill="${NAVY}"/>` +
        [70, 83, 96, 109].map((x) => `<rect x="${x}" y="137" width="6" height="14" rx="3" fill="#ffe9a8"/>`).join(''),
    }),
  // 14: dragon
  () =>
    cube({
      colors: ['#a6f2ad', '#43cf6e', '#1d8c4b'],
      frame:
        `<path d="M40 50 Q24 32 29 13 Q47 23 64 42 Z M145 50 Q161 32 156 13 Q138 23 121 42 Z" fill="#fff0c4" stroke="${NAVY}" stroke-width="9" stroke-linejoin="round"/>` +
        tallHead(32),
      inner: [17, 43, 151, 125],
      gloss: false,
      pattern:
        [[60, 0], [73, 9]]
          .map(([y, off]) => [0, 1, 2, 3, 4].map((i) => {
            const x = 56 + off + i * 18;
            return `<path d="M${x - 9} ${y} Q${x} ${y + 10} ${x + 9} ${y}" fill="none" stroke="#167a3e" stroke-opacity=".5" stroke-width="3" stroke-linecap="round"/>`;
          }).join(''))
          .join('') +
        `<ellipse cx="92.5" cy="178" rx="52" ry="30" fill="#dcf8a8"/>`,
      face:
        headGloss(32) +
        [64, 121].map((x) => `<ellipse cx="${x}" cy="100" rx="15" ry="16" fill="#fff4a8" stroke="${NAVY}" stroke-width="4.5"/><ellipse cx="${x + 1}" cy="101" rx="4.6" ry="11" fill="${NAVY}"/><circle cx="${x - 5}" cy="94" r="3.2" fill="${WHITE}"/>`).join('') +
        `<ellipse cx="82" cy="128" rx="3.8" ry="2.8" fill="${NAVY}"/><ellipse cx="103" cy="128" rx="3.8" ry="2.8" fill="${NAVY}"/>` +
        `<path d="M66 138 Q92.5 156 119 138" fill="none" stroke="${NAVY}" stroke-width="5.5" stroke-linecap="round"/>` +
        `<path d="M75 143 L79 153 L84 146 Z M110 143 L106 153 L101 146 Z" fill="${WHITE}" stroke="${NAVY}" stroke-width="2.2" stroke-linejoin="round"/>` +
        blush(126, '#ff9a6b', 0.5),
    }),
  // 15: ghost (wavy bottom edge)
  () => {
    const w = 173 / 4;
    let bottom = '';
    for (let i = 1; i <= 4; i++) bottom += ` A${n2(w / 2)} 13 0 0 1 ${n2(179 - i * w)} 166`;
    return skinShape({
      shape: `M37 6 H148 Q179 6 179 37 V166${bottom} V37 Q6 6 37 6 Z`,
      colors: [WHITE, '#f3efff', '#cfc5f2'],
      face:
        eyesRound(66, 119, 86, 13, 17) +
        `<ellipse cx="92.5" cy="124" rx="9.5" ry="11.5" fill="${NAVY}"/><ellipse cx="92.5" cy="130" rx="6" ry="4" fill="#ff8fb3"/>` +
        blush(112, '#ff9ac8', 0.55),
    });
  },
  // 16: pumpkin
  () =>
    cube({
      colors: ['#ffc56e', '#ff8f22', '#d8600c'],
      frame:
        `<path d="M92.5 42 Q90 28 98 17" fill="none" stroke="${NAVY}" stroke-width="17" stroke-linecap="round"/><path d="M92.5 42 Q90 28 98 17" fill="none" stroke="#5aa832" stroke-width="8" stroke-linecap="round"/>` +
        `<path d="M101 27 Q119 11 138 22 Q120 37 101 27 Z" fill="#7fd04a" stroke="${NAVY}" stroke-width="4" stroke-linejoin="round"/>` +
        tallHead(30),
      inner: [17, 41, 151, 127],
      gloss: false,
      pattern: `<path d="M56 41 Q38 104 56 168 M129 41 Q147 104 129 168 M92.5 41 V168" fill="none" stroke="#b9500a" stroke-opacity=".5" stroke-width="4.5"/>`,
      face:
        headGloss(30) +
        `<path d="M46 102 L82 102 L64 74 Z M103 102 L139 102 L121 74 Z" fill="${NAVY}" stroke="${NAVY}" stroke-width="4" stroke-linejoin="round"/>` +
        `<path d="M56 99 L72 99 L64 88 Z M113 99 L129 99 L121 88 Z" fill="${GOLD}"/>` +
        `<path d="M85 116 L100 116 L92.5 106 Z" fill="${NAVY}" stroke="${NAVY}" stroke-width="3" stroke-linejoin="round"/>` +
        `<path d="M48 124 Q92.5 172 137 124 Q92.5 142 48 124 Z" fill="${NAVY}" stroke="${NAVY}" stroke-width="4" stroke-linejoin="round"/>` +
        `<path d="M70 131 h11 v9 h-11 Z M104 131 h11 v9 h-11 Z" fill="#ff9a2f"/>` +
        `<path d="M74 142 Q92.5 153 111 142" fill="none" stroke="${GOLD}" stroke-opacity=".7" stroke-width="3" stroke-linecap="round"/>`,
    }),
  // 17: rainbow
  () => {
    const bands = ['#ff4f5e', '#ff9a3d', '#ffd23d', '#6fd85a', '#4fa8ff', '#9b7bff'];
    const arcs = bands.map((c, i) => `<circle cx="92.5" cy="190" r="${185 - i * 17}" fill="${c}"/>`).join('') + `<circle cx="92.5" cy="190" r="83" fill="url(#body)"/>`;
    const cloud = (x, y) =>
      `<g fill="${WHITE}" stroke="#cfe3ff" stroke-width="3"><circle cx="${x - 14}" cy="${y + 4}" r="13"/><circle cx="${x}" cy="${y - 6}" r="17"/><circle cx="${x + 15}" cy="${y + 4}" r="13"/></g>` +
      `<rect x="${x - 26}" y="${y}" width="52" height="17" fill="${WHITE}"/>`;
    return cube({
      colors: [WHITE, '#f7faff', '#e6eeff'],
      pattern: arcs + cloud(30, 152) + cloud(155, 152),
      face:
        eyesRound(72, 113, 126, 10, 13) +
        `<path d="M81 145 Q92.5 156 104 145" fill="none" stroke="${NAVY}" stroke-width="5" stroke-linecap="round"/>` +
        `<ellipse cx="58" cy="143" rx="7" ry="4.5" fill="#ff8fb3" fill-opacity=".6"/><ellipse cx="127" cy="143" rx="7" ry="4.5" fill="#ff8fb3" fill-opacity=".6"/>`,
    });
  },
  // 18: tiger stripes
  () => {
    const wedge = (q) => `<path d="${poly(q)}" fill="${NAVY}" stroke="${NAVY}" stroke-width="3" stroke-linejoin="round"/>`;
    const side = [[[17, 56], [54, 66], [17, 78]], [[17, 98], [48, 106], [17, 116]], [[17, 138], [42, 145], [17, 154]]];
    const stripes =
      side.map(wedge).join('') +
      side.map((q) => wedge(q.map(([x, y]) => [185 - x, y]))).join('') +
      wedge([[74, 17], [80, 40], [86, 17]]) + wedge([[87.5, 17], [92.5, 46], [97.5, 17]]) + wedge([[99, 17], [105, 40], [111, 17]]);
    return cube({
      colors: ['#ffd98c', '#ffad3a', '#ec8312'],
      pattern: stripes + `<ellipse cx="92.5" cy="140" rx="40" ry="25" fill="#fff6e6"/>`,
      face:
        eyesRound(64, 121, 96, 11, 14) +
        `<path d="M84 122 H101 Q101 127 92.5 132 Q84 127 84 122 Z" fill="#ff7f8f" stroke="${NAVY}" stroke-width="3" stroke-linejoin="round"/>` +
        `<path d="M80 141 Q86 148 92.5 140 Q99 148 105 141" fill="none" stroke="${NAVY}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>` +
        [[68, 136], [64, 146], [73, 150], [117, 136], [121, 146], [112, 150]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.4" fill="${NAVY}"/>`).join(''),
    });
  },
  // 19: astronaut helmet
  () =>
    cube({
      colors: [WHITE, '#eaeff8', '#bcc6dc'],
      defs:
        lin('vis', 0, 52, 0, 138, [[0, '#4a72f0'], [0.45, '#18287f'], [1, NAVY]]) +
        `<clipPath id="vc"><rect x="34" y="52" width="117" height="86" rx="30"/></clipPath>`,
      face:
        `<circle cx="24" cy="95" r="8" fill="#d7ddeb" stroke="${NAVY}" stroke-width="3"/><circle cx="161" cy="95" r="8" fill="#d7ddeb" stroke="${NAVY}" stroke-width="3"/>` +
        `<rect x="28" y="46" width="129" height="98" rx="36" fill="${NAVY}"/>` +
        `<rect x="34" y="52" width="117" height="86" rx="30" fill="url(#vis)"/>` +
        `<g clip-path="url(#vc)"><path d="M46 72 Q58 60 84 60" fill="none" stroke="${WHITE}" stroke-opacity=".7" stroke-width="6" stroke-linecap="round"/>` +
        `<path d="${sparkle(131, 72, 6)}" fill="${WHITE}" fill-opacity=".85"/><circle cx="56" cy="124" r="2" fill="${WHITE}" fill-opacity=".7"/><circle cx="138" cy="116" r="1.6" fill="${WHITE}" fill-opacity=".7"/></g>` +
        `<ellipse cx="72" cy="99" rx="8" ry="10.5" fill="${WHITE}"/><ellipse cx="113" cy="99" rx="8" ry="10.5" fill="${WHITE}"/>` +
        `<path d="M83 119 Q92.5 127 102 119" fill="none" stroke="${WHITE}" stroke-width="4.5" stroke-linecap="round"/>` +
        `<circle cx="148" cy="30" r="6" fill="${ACID}" stroke="${NAVY}" stroke-width="3"/>` +
        `<path d="${starPath(46, 157, 8, 3.6)}" fill="${GOLD}" stroke="${NAVY}" stroke-width="2.4" stroke-linejoin="round"/>` +
        `<rect x="98" y="152" width="40" height="10" rx="5" fill="#ff5a6e" stroke="${NAVY}" stroke-width="2.4"/>`,
    }),
  // 20: cactus with a flower
  () => {
    const petals = [0, 72, 144, 216, 288]
      .map((a) => {
        const r = ((a - 90) * Math.PI) / 180;
        return `<circle cx="${n2(146 + 8 * Math.cos(r))}" cy="${n2(25 + 8 * Math.sin(r))}" r="7.5"/>`;
      })
      .join('');
    return cube({
      colors: ['#c4f5a0', '#72cf5e', '#36984c'],
      pattern:
        `<path d="M50 10 V175 M92.5 10 V175 M135 10 V175" stroke="#23803f" stroke-opacity=".38" stroke-width="5"/>` +
        `<path d="M57 10 V175 M99.5 10 V175 M142 10 V175" stroke="${WHITE}" stroke-opacity=".2" stroke-width="3"/>` +
        [[50, 36], [50, 152], [135, 152], [92.5, 162], [30, 132], [158, 124], [30, 62]]
          .map(([x, y]) => `<path d="M${x - 4} ${y - 3} L${x} ${y} L${x + 4} ${y - 3} M${x} ${y} V${y - 5}" fill="none" stroke="${WHITE}" stroke-width="2" stroke-linecap="round"/>`)
          .join(''),
      face:
        eyesRound(66, 119, 96, 11, 14) +
        `<path d="M74 122 Q92.5 138 111 122" fill="none" stroke="${NAVY}" stroke-width="5.5" stroke-linecap="round"/>` +
        blush(116, '#ff7aa6', 0.55) +
        `<g fill="#ff7ab8" stroke="${NAVY}" stroke-width="3">${petals}</g><circle cx="146" cy="25" r="6" fill="${GOLD}" stroke="${NAVY}" stroke-width="2.6"/>`,
    });
  },
  // 21: ice cube with a snow cap
  () =>
    cube({
      colors: ['#e2f8ff', '#7fd2ff', '#2f8ee0'],
      pattern:
        `<rect x="36" y="46" width="114" height="108" rx="16" fill="${WHITE}" fill-opacity=".16" stroke="${WHITE}" stroke-opacity=".5" stroke-width="3"/>` +
        [[46, 142, 5], [140, 134, 4], [131, 152, 6.5], [42, 70, 3.5], [148, 68, 3]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${WHITE}" stroke-opacity=".75" stroke-width="2"/>`).join('') +
        `<path d="M10 10 H175 V36 Q168 44 161 38 Q156 56 149 40 Q141 48 133 38 Q125 54 117 38 Q109 46 101 36 Q94 50 87 38 Q79 46 71 36 Q63 54 55 38 Q47 46 39 36 Q31 50 24 38 Q17 44 10 36 Z" fill="${WHITE}" stroke="#bfe6ff" stroke-width="3"/>`,
      face:
        eyesRound(66, 119, 100, 11, 14) +
        `<path d="M72 132 q5.2 -6 10.4 0 t10.4 0 t10.4 0 t10.4 0" fill="none" stroke="${NAVY}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>` +
        blush(122, '#ff9ac0', 0.5),
    }),
  // 22: lava rock
  () => {
    const cracks = ['M17 60 L40 66 L54 54 L76 62', 'M108 17 L116 40 L140 50 L168 44', 'M17 130 L38 122 L52 136 L72 130', 'M118 168 L130 146 L152 140 L168 128', 'M84 168 L90 152 L80 142'];
    const draw = (w, c) => cracks.map((d) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
    const grin = 'M70 128 L81 136 L92.5 127 L104 136 L115 128';
    return cube({
      colors: ['#6b3429', '#3e1b17', '#210c0c'],
      defs: blur('lv', 3.5),
      pattern:
        `<g filter="url(#lv)">${draw(10, '#ff5a1f')}</g>` + draw(4.5, '#ffb23d') + draw(1.6, '#fff1a8') +
        `<rect x="19.5" y="19.5" width="146" height="146" rx="18" fill="none" stroke="#a9502e" stroke-opacity=".75" stroke-width="3"/>`,
      face:
        `<g filter="url(#lv)"><ellipse cx="66" cy="96" rx="15" ry="16" fill="#ff6a1f"/><ellipse cx="119" cy="96" rx="15" ry="16" fill="#ff6a1f"/>` +
        `<path d="${grin}" fill="none" stroke="#ff6a1f" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/></g>` +
        `<ellipse cx="66" cy="96" rx="10.5" ry="12.5" fill="${GOLD}"/><ellipse cx="119" cy="96" rx="10.5" ry="12.5" fill="${GOLD}"/>` +
        `<ellipse cx="63" cy="92" rx="4" ry="5" fill="#fff6c8"/><ellipse cx="116" cy="92" rx="4" ry="5" fill="#fff6c8"/>` +
        `<path d="${grin}" fill="none" stroke="${GOLD}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`,
    });
  },
  // 23: king with a crown
  () =>
    cube({
      colors: ['#e2b8ff', '#a95eff', '#6a2bcf'],
      defs: lin('crown', 0, 20, 0, 54, [[0, '#fff3a8'], [0.5, GOLD], [1, '#f0a020']]),
      frame: tallHead(36),
      inner: [17, 47, 151, 121],
      gloss: false,
      pattern:
        `<rect x="10" y="150" width="165" height="22" fill="#fff8ec"/><path d="M10 150 H175" stroke="${NAVY}" stroke-opacity=".35" stroke-width="3"/>` +
        [36, 64, 92.5, 121, 149].map((x) => `<path d="M${x} 156 l3 5 l-3 5 l-3 -5 Z" fill="${NAVY}"/>`).join(''),
      face:
        `<rect x="26" y="58" width="12" height="40" rx="6" fill="${WHITE}" fill-opacity=".35"/>` +
        eyesRound(66, 119, 100, 11, 14) +
        `<path d="M70 124 Q92.5 146 115 124" fill="none" stroke="${NAVY}" stroke-width="6" stroke-linecap="round"/>` +
        blush(122, '#ff8fc8', 0.6) +
        `<path d="M40 54 L40 30 L63 42 L92.5 20 L122 42 L145 30 L145 54 Z" fill="url(#crown)" stroke="${NAVY}" stroke-width="5.5" stroke-linejoin="round"/>` +
        `<circle cx="40" cy="27" r="5" fill="${PINK}" stroke="${NAVY}" stroke-width="2.5"/><circle cx="92.5" cy="16" r="6" fill="${ACID}" stroke="${NAVY}" stroke-width="2.6"/><circle cx="145" cy="27" r="5" fill="#45d4ff" stroke="${NAVY}" stroke-width="2.5"/>` +
        `<circle cx="66" cy="47" r="3.5" fill="#45d4ff"/><circle cx="92.5" cy="45" r="4" fill="${PINK}"/><circle cx="119" cy="47" r="3.5" fill="${ACID}"/>`,
    }),
  // 24: runner with a sweatband and speed lines, the reward for level 21 (DASH AND RUN)
  () =>
    cube({
      colors: ['#ffd9b0', '#ff7b30', '#d43e14'],
      defs: lin('sweat', 0, 40, 0, 62, [[0, '#a8f7ff'], [0.5, '#30d0f0'], [1, '#148ec0']]),
      pattern:
        `<rect x="10" y="40" width="165" height="22" fill="url(#sweat)"/><path d="M10 40 H175 M10 62 H175" stroke="${NAVY}" stroke-width="3.5"/>` +
        `<path d="M10 51 H175" stroke="${WHITE}" stroke-opacity=".7" stroke-width="3" stroke-dasharray="10 8"/>` +
        [[124, 46], [138, 34], [152, 24]].map(([y, w]) => `<rect x="12" y="${y}" width="${w}" height="7" rx="3.5" fill="${WHITE}" fill-opacity=".5"/>`).join(''),
      face:
        eyesRound(72, 122, 92, 12, 14) +
        `<path d="M56 74 L84 81 M138 74 L110 81" stroke="${NAVY}" stroke-width="5.5" stroke-linecap="round"/>` +
        `<path d="M72 117 H124 Q122 144 98 144 Q74 144 72 117 Z" fill="${NAVY}" stroke="${NAVY}" stroke-width="4" stroke-linejoin="round"/>` +
        `<path d="M78 120 H118 V127 Q98 131 78 127 Z" fill="${WHITE}"/>` +
        `<path d="M85 139 Q98 131 111 139 Q105 144 98 144 Q91 144 85 139 Z" fill="#ff6f9c"/>` +
        `<path d="M27 46 Q14 39 3 43 L5 52 Q16 49 26 54 Z M27 56 Q15 62 5 72 L11 77 Q20 66 29 61 Z" fill="url(#sweat)" stroke="${NAVY}" stroke-width="3" stroke-linejoin="round"/>` +
        `<rect x="22" y="43" width="16" height="16" rx="5" fill="url(#sweat)" stroke="${NAVY}" stroke-width="3"/>`,
    }),
  // ---- shop skins 25-30, bought with diamonds on the page (31, the tower's reward, is last)
  // 25: crystal with cut faces and sparkles
  () =>
    cube({
      colors: ['#e8fcff', '#7fe3ff', '#3a8fe8'],
      pattern:
        `<path d="M17 17 L92.5 70 L168 17 Z" fill="${WHITE}" fill-opacity=".28"/><path d="M17 168 L92.5 118 L168 168 Z" fill="#1f5fc4" fill-opacity=".28"/>` +
        `<path d="M17 17 L92.5 70 L92.5 118 L17 168 Z" fill="${WHITE}" fill-opacity=".1"/>` +
        `<path d="M17 17 L92.5 70 L168 17 M17 168 L92.5 118 L168 168 M92.5 70 V118" fill="none" stroke="${WHITE}" stroke-opacity=".7" stroke-width="3"/>` +
        [[40, 44, 7], [150, 140, 6], [146, 52, 4.5]].map(([x, y, r]) => `<path d="${starPath(x, y, r * 1.6, r * 0.45, 4, 0)}" fill="${WHITE}"/>`).join(''),
      face:
        eyesRound(66, 119, 96, 12, 14) +
        `<path d="M74 124 Q92.5 140 111 124" fill="none" stroke="${NAVY}" stroke-width="6" stroke-linecap="round"/>` +
        blush(120, '#ff8fc8', 0.5),
    }),
  // 26: panda with round ears
  () =>
    cube({
      colors: ['#ffffff', '#f1f3f8', '#cfd5e2'],
      frame:
        [42, 143].map((x) => `<circle cx="${x}" cy="36" r="24" fill="${NAVY}"/><circle cx="${x}" cy="36" r="13" fill="#3b4060"/>`).join('') +
        tallHead(34),
      inner: [17, 45, 151, 123],
      gloss: false,
      face:
        headGloss(34) +
        `<ellipse cx="62" cy="98" rx="20" ry="24" fill="${NAVY}" transform="rotate(-20 62 98)"/><ellipse cx="123" cy="98" rx="20" ry="24" fill="${NAVY}" transform="rotate(20 123 98)"/>` +
        `<circle cx="64" cy="96" r="7" fill="${WHITE}"/><circle cx="121" cy="96" r="7" fill="${WHITE}"/><circle cx="66" cy="98" r="3.2" fill="${NAVY}"/><circle cx="119" cy="98" r="3.2" fill="${NAVY}"/>` +
        `<ellipse cx="92.5" cy="124" rx="9" ry="6.5" fill="${NAVY}"/>` +
        `<path d="M92.5 130 V138 M80 140 Q92.5 150 105 140" fill="none" stroke="${NAVY}" stroke-width="4.5" stroke-linecap="round"/>` +
        blush(130, '#ff9ab8', 0.55),
    }),
  // 27: astronaut helmet with a dark visor
  () =>
    cube({
      colors: ['#ffffff', '#e2e8f4', '#a9b6d0'],
      defs: lin('visor', 0, 58, 0, 140, [[0, '#2a3a8a'], [0.6, '#121a4a'], [1, '#0a0f30']]),
      frame:
        `<path d="M150 40 V20" stroke="${NAVY}" stroke-width="10" stroke-linecap="round"/><circle cx="150" cy="16" r="7.5" fill="${PINK}" stroke="${NAVY}" stroke-width="3.5"/>` +
        tallHead(30),
      inner: [17, 41, 151, 127],
      gloss: false,
      pattern: [[34, 150], [151, 150]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6" fill="#ffd23d" stroke="${NAVY}" stroke-width="2.5"/>`).join(''),
      face:
        headGloss(30) +
        `<rect x="32" y="58" width="121" height="82" rx="30" fill="url(#visor)" stroke="${NAVY}" stroke-width="5"/>` +
        `<path d="M44 74 Q50 64 64 62" fill="none" stroke="${WHITE}" stroke-opacity=".55" stroke-width="5" stroke-linecap="round"/>` +
        `<ellipse cx="72" cy="100" rx="9" ry="11" fill="#7fe3ff"/><ellipse cx="113" cy="100" rx="9" ry="11" fill="#7fe3ff"/>` +
        `<path d="M80 122 Q92.5 130 105 122" fill="none" stroke="#7fe3ff" stroke-width="4.5" stroke-linecap="round"/>` +
        [[118, 70, 2.5], [134, 86, 1.8], [52, 120, 2]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${WHITE}"/>`).join(''),
    }),
  // 28: watermelon slice
  () =>
    cube({
      colors: ['#ff9aa8', '#ff4f6a', '#e0254a'],
      frame: `<rect x="6" y="6" width="173" height="173" rx="31" fill="${NAVY}"/><rect x="17" y="17" width="151" height="151" rx="20" fill="#3fbf5a"/><rect x="27" y="27" width="131" height="131" rx="14" fill="#c9f2a8"/><rect x="33" y="33" width="119" height="119" rx="11" fill="url(#body)"/>`,
      inner: [33, 33, 119, 119],
      pattern: [[52, 58], [128, 54], [46, 132], [140, 128], [92, 46]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="4" ry="6.5" fill="${NAVY}" transform="rotate(20 ${x} ${y})"/>`).join(''),
      face:
        eyesRound(68, 117, 92, 11, 13) +
        `<path d="M72 118 H113 Q112 140 92.5 140 Q73 140 72 118 Z" fill="${NAVY}"/><path d="M80 132 Q92.5 124 105 132 Q100 140 92.5 140 Q85 140 80 132 Z" fill="#ffb3c2"/>`,
    }),
  // 29: thunder with a lightning bolt
  () =>
    cube({
      colors: ['#fff6b0', '#ffd23d', '#f08a1c'],
      defs: blur('bolt', 3),
      pattern:
        `<path d="M122 17 L96 82 H124 L74 168 L86 104 H60 L84 17 Z" fill="${WHITE}" fill-opacity=".38" filter="url(#bolt)"/>` +
        `<path d="M122 17 L96 82 H124 L74 168 L86 104 H60 L84 17 Z" fill="none" stroke="${WHITE}" stroke-opacity=".75" stroke-width="3" stroke-linejoin="round"/>`,
      face:
        `<path d="M48 82 L78 90 M137 82 L107 90" stroke="${NAVY}" stroke-width="6" stroke-linecap="round"/>` +
        eyesRound(64, 121, 104, 11, 12) +
        `<path d="M70 128 L81 136 L92.5 128 L104 136 L115 128" fill="none" stroke="${NAVY}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`,
    }),
  // 30: chocolate chip cookie (round)
  () => {
    let edge = '';
    const bumps = 14;
    for (let i = 0; i < bumps; i++) {
      const a = (i / bumps) * Math.PI * 2;
      const r = i % 2 ? 80 : 86;
      edge += `${i ? 'L' : 'M'}${n2(92.5 + Math.cos(a) * r)} ${n2(92.5 + Math.sin(a) * r)} `;
    }
    return skinShape({
      shape: edge + 'Z',
      colors: ['#f5d39a', '#d99a52', '#a8662a'],
      // (cookie)
      pattern: [[50, 54, 9], [130, 48, 8], [44, 120, 8], [138, 126, 10], [92, 152, 7], [100, 40, 6]].map(([x, y, r]) => `<path d="M${x - r} ${y} Q${x - r * 0.6} ${y - r} ${x} ${y - r * 0.8} Q${x + r} ${y - r * 0.5} ${x + r * 0.8} ${y + r * 0.4} Q${x} ${y + r} ${x - r} ${y} Z" fill="#5a3418"/>`).join(''),
      face:
        eyesRound(68, 117, 92, 11, 13) +
        `<path d="M74 120 Q92.5 138 111 120" fill="none" stroke="${NAVY}" stroke-width="6" stroke-linecap="round"/>` +
        blush(116, '#ff8f7a', 0.55),
    });
  },
  // 31: tower top with battlements and a flag, the reward for clearing DASH TOWER 10F
  () =>
    cube({
      colors: ['#d9e2f5', '#9aa9cc', '#5d6a93'],
      defs: lin('flag', 0, 4, 0, 30, [[0, '#ff8fb0'], [1, PINK]]),
      frame:
        `<path d="M150 46 V8" stroke="${NAVY}" stroke-width="8" stroke-linecap="round"/><path d="M152 9 L178 17 L152 26 Z" fill="url(#flag)" stroke="${NAVY}" stroke-width="4" stroke-linejoin="round"/>` +
        `<path d="M6 60 V34 H38 V48 H62 V34 H94 V48 H118 V34 H150 V48 H179 V179 H6 Z" fill="${NAVY}" stroke="${NAVY}" stroke-width="10" stroke-linejoin="round"/>` +
        `<path d="M17 62 V45 H28 V58 H72 V45 H84 V58 H128 V45 H140 V58 H168 V168 H17 Z" fill="url(#body)"/>`,
      inner: [17, 58, 151, 110],
      gloss: false,
      pattern:
        [72, 96, 120, 144].map((y, row) => [0, 1, 2, 3, 4].map((i) => `<rect x="${n2(12 + i * 36 + (row % 2) * 18)}" y="${y}" width="34" height="22" rx="4" fill="none" stroke="${NAVY}" stroke-opacity=".18" stroke-width="2.5"/>`).join('')).join(''),
      face:
        eyesRound(66, 119, 100, 11, 13) +
        `<path d="M70 126 Q92.5 146 115 126" fill="none" stroke="${NAVY}" stroke-width="6" stroke-linecap="round"/>` +
        `<path d="M80 128 H105" stroke="${WHITE}" stroke-width="3" stroke-linecap="round"/>` +
        blush(124, '#ff8fc8', 0.5),
    }),
];

// small diamond for the shop prices in the skin picker
function diamond() {
  const D = lin('dg', 0, 6, 0, 58, [[0, '#e8fcff'], [0.45, '#7fe3ff'], [1, '#2f7ee0']]);
  const body =
    `<path d="M14 8 H50 L60 24 L32 58 L4 24 Z" fill="url(#dg)" stroke="${NAVY}" stroke-width="4" stroke-linejoin="round"/>` +
    `<path d="M4 24 H60 M14 8 L24 24 L32 58 L40 24 L50 8 M24 24 L32 8 L40 24" fill="none" stroke="${NAVY}" stroke-opacity=".55" stroke-width="2.2" stroke-linejoin="round"/>` +
    `<path d="M16 12 L22 20" stroke="${WHITE}" stroke-width="3" stroke-linecap="round"/>`;
  return svg(64, 64, D, body);
}

// dark translucent cover with a small padlock, laid over a locked 180 x 180 skin slot
function skinLock() {
  const { defs, body } = padlockParts(false);
  const s = 0.44;
  return svg(
    180,
    180,
    defs,
    `<rect x="2" y="2" width="176" height="176" rx="36" fill="${NAVY}" fill-opacity=".64"/>` +
      `<rect x="9" y="9" width="162" height="162" rx="29" fill="none" stroke="${WHITE}" stroke-opacity=".22" stroke-width="2.5"/>` +
      `<g transform="translate(${n2(90 - 80 * s)} ${n2(92 - 95 * s)}) scale(${s})">${body}</g>`,
  );
}

// ================================================================ black blocks (glossy near-black body, crisp light rim)

const BLACK_RIM = [[0, WHITE], [0.35, '#eceef5'], [0.7, '#c3c6d3'], [1, '#8b8ea2']];
const BLACK_GLASS = [[0, '#1c1c28'], [1, '#0d0d14']];

function blackParts(w, h, pattern) {
  const r = h >= 100 ? 13 : 11;
  const defs =
    lin('rim', 4, 4, w - 4, h - 4, BLACK_RIM) +
    lin('glass', 0, 12, 0, h - 12, BLACK_GLASS) +
    lin('shine', 12, 12, 12 + Math.min(w, h) * 0.5, 12 + Math.min(w, h) * 0.5, [[0, WHITE, 0.16], [1, WHITE, 0]]) +
    `<clipPath id="gc"><rect x="12" y="12" width="${w - 24}" height="${h - 24}" rx="${r - 6}"/></clipPath>` +
    blur('soft', 3);
  const body =
    `<rect width="${w}" height="${h}" fill="${NAVY}"/>` +
    `<rect x="4" y="4" width="${w - 8}" height="${h - 8}" rx="${r}" fill="url(#rim)"/>` +
    `<rect x="10" y="10" width="${w - 20}" height="${h - 20}" rx="${r - 4.5}" fill="#05050b"/>` +
    `<rect x="12" y="12" width="${w - 24}" height="${h - 24}" rx="${r - 6}" fill="url(#glass)"/>` +
    `<g clip-path="url(#gc)">` +
    `<rect x="12" y="12" width="${w - 24}" height="${h - 24}" rx="${r - 6}" fill="none" stroke="${WHITE}" stroke-opacity=".13" stroke-width="8" filter="url(#soft)"/>` +
    pattern +
    `<path d="M12 12 H${12 + Math.min(w, h) * 0.64} L12 ${12 + Math.min(w, h) * 0.64} Z" fill="url(#shine)"/>` +
    `</g>` +
    `<path d="M7 ${Math.min(42, h - 24)} V20 Q7 7 20 7 H42" fill="none" stroke="${WHITE}" stroke-width="2.4" stroke-linecap="round"/>`;
  return svg(w, h, defs, body);
}

function blackBlock() {
  return blackParts(
    120,
    120,
    `<path d="M60 33 L87 60 L60 87 L33 60 Z" fill="#191926" stroke="#34344c" stroke-width="3.5" stroke-linejoin="round"/>` +
      `<circle cx="60" cy="60" r="5" fill="#3a3a55"/>` +
      `<path d="M12 104 L104 12 H112 L12 112 Z" fill="${WHITE}" fill-opacity=".04"/>`,
  );
}

function blackSlab() {
  return blackParts(120, 54, [42, 60, 78].map((x) => `<circle cx="${x}" cy="27" r="3.8" fill="#34344c"/>`).join(''));
}

// ================================================================ speed gates, colored orbs and pads, mode bodies, debris

const SPEED_SCHEMES = {
  slow: { light: '#ffdcae', mid: '#ff9a3d', deep: '#e0601a' },
  normal: { light: '#c4dcff', mid: '#3f7dff', deep: '#1f3cc4' },
  fast: { light: '#e6ffc2', mid: '#7fe03a', deep: '#3c9a1c' },
  veryFast: { light: '#ffd0f2', mid: '#ff4fc8', deep: '#bf1f96' },
};

// forward-leaning rounded gate with n white chevrons (same chevron size at every speed, so the count reads)
function speedPortal(scheme, n) {
  const sc = SPEED_SCHEMES[scheme];
  const cx = 55;
  const cy = 75;
  const g = { x: 12, y: 5, w: 86, h: 140, r: 30 };
  const inset = (d) => `x="${g.x + d}" y="${g.y + d}" width="${g.w - 2 * d}" height="${g.h - 2 * d}" rx="${Math.max(4, g.r - d)}"`;
  const defs =
    lin('rim', g.x, 0, g.x + g.w, 0, [[0, sc.deep], [0.5, sc.mid], [1, sc.light]]) +
    rad('field', cx, cy, 72, [[0, sc.mid, 0.12], [0.7, sc.mid, 0.24], [1, sc.light, 0.55]]) +
    blur('soft', 3);
  const step = n >= 4 ? 13.5 : 15;
  const half = 9;
  const tall = 23;
  const x0 = cx + 1 - ((n - 1) * step) / 2;
  let chev = '';
  for (let i = 0; i < n; i++) {
    const x = x0 + i * step;
    chev += `M${n2(x - half)} ${cy - tall} L${n2(x + half)} ${cy} L${n2(x - half)} ${cy + tall} `;
  }
  const body =
    `<g transform="translate(${cx} ${cy}) skewX(-7) translate(${-cx} ${-cy})">` +
    `<rect ${inset(0)} fill="${NAVY}"/>` +
    `<rect ${inset(5)} fill="url(#rim)"/>` +
    `<rect ${inset(12)} fill="${NAVY}"/>` +
    `<rect ${inset(14)} fill="url(#field)"/>` +
    `<rect ${inset(14)} fill="none" stroke="${sc.light}" stroke-opacity=".6" stroke-width="5" filter="url(#soft)"/>` +
    [-46, 46].map((dy) => `<path d="M${cx - 20} ${cy + dy} H${cx + 20}" stroke="${WHITE}" stroke-opacity=".4" stroke-width="3" stroke-linecap="round"/>`).join('') +
    `<path d="M${g.x + 9} ${g.y + 46} V${g.y + 32} Q${g.x + 9} ${g.y + 9} ${g.x + 32} ${g.y + 9} H${g.x + 52}" fill="none" stroke="${WHITE}" stroke-opacity=".8" stroke-width="2.5" stroke-linecap="round"/>` +
    `</g>` +
    `<path d="${chev}" fill="none" stroke="${NAVY}" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${chev}" fill="none" stroke="${WHITE}" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  return svg(110, 150, defs, body);
}

const ORB_SCHEMES = {
  pink: { halo: '#ff5cc8', ring: ['#ffd9f2', '#ff5cc8', '#c81f8a'], core: [WHITE, '#ffeaf8', '#ffa3de'] },
  blue: { halo: '#3fc0ff', ring: ['#d2f6ff', '#3fc0ff', '#1f5ee0'], core: [WHITE, '#e6f9ff', '#94deff'] },
};

// same build as the gold orb (36), recolored, with a small hint symbol in the core
function coloredOrb(kind) {
  const S = ORB_SCHEMES[kind];
  const defs =
    rad('halo', 60, 60, 60, [[0.6, S.halo, 0.6], [0.8, S.halo, 0.2], [1, S.halo, 0]]) +
    lin('ring', 22, 16, 98, 104, [[0, S.ring[0]], [0.45, S.ring[1]], [1, S.ring[2]]]) +
    rad('core', 53, 51, 40, [[0, S.core[0]], [0.42, S.core[1]], [1, S.core[2]]]);
  const symbol =
    kind === 'pink'
      ? `<path d="M49 69 L60 58 L71 69" fill="none" stroke="${NAVY}" stroke-opacity=".55" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>`
      : `<path d="M60 45 V75 M51 54 L60 45 L69 54 M51 66 L60 75 L69 66" fill="none" stroke="${NAVY}" stroke-opacity=".6" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`;
  const body =
    `<circle cx="60" cy="60" r="60" fill="url(#halo)"/>` +
    `<circle cx="60" cy="60" r="52" fill="${NAVY}"/>` +
    `<circle cx="60" cy="60" r="48" fill="url(#ring)"/>` +
    `<circle cx="60" cy="60" r="37.5" fill="${NAVY}"/>` +
    `<circle cx="60" cy="60" r="34" fill="url(#core)"/>` +
    `<path d="${ellipseArc(60, 60, 43, 43, 195, 265)}" fill="none" stroke="${WHITE}" stroke-opacity=".8" stroke-width="3.5" stroke-linecap="round"/>` +
    `<path d="${ellipseArc(60, 60, 43, 43, 20, 45)}" fill="none" stroke="${WHITE}" stroke-opacity=".45" stroke-width="2.5" stroke-linecap="round"/>` +
    symbol +
    `<path d="${sparkle(42, 42, 7)}" fill="${WHITE}"/>`;
  return svg(120, 120, defs, body);
}

const PAD_SCHEMES = {
  pink: { glow: '#ff5cc8', plate: ['#ffe3f5', '#ff6fd0', '#cc2a92'] },
  blue: { glow: '#3fc0ff', plate: ['#dcf7ff', '#4fc8ff', '#1f68dc'] },
};

// same build as the gold pad (35), recolored; the blue (gravity) pad gets up+down marks
function coloredPad(kind) {
  const S = PAD_SCHEMES[kind];
  const defs =
    rad('glow', 50, 10, 50, [[0, S.glow, 0.85], [0.6, S.glow, 0.35], [1, S.glow, 0]], 'gradientTransform="translate(50 10) scale(1 .3) translate(-50 -10)"') +
    lin('plate', 0, 4, 0, 16, [[0, S.plate[0]], [0.4, S.plate[1]], [1, S.plate[2]]]);
  const top = 'M3 16 L7.5 6 Q9 3.6 12 3.6 H88 Q91 3.6 92.5 6 L97 16';
  const mark = (x) =>
    kind === 'pink'
      ? `M${x - 6} 13 L${x} 8.2 L${x + 6} 13`
      : `M${x - 5} 10 L${x} 6.8 L${x + 5} 10 M${x - 5} 11.8 L${x} 15 L${x + 5} 11.8`;
  const body =
    `<ellipse cx="50" cy="10" rx="50" ry="15" fill="url(#glow)"/>` +
    `<path d="${top} Z" fill="url(#plate)"/>` +
    `<path d="M11 6.6 H89" stroke="${WHITE}" stroke-opacity=".9" stroke-width="1.6" stroke-linecap="round"/>` +
    `<path d="${[30, 50, 70].map(mark).join(' ')}" fill="none" stroke="${NAVY}" stroke-width="${kind === 'pink' ? 2.4 : 2.1}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${top}" fill="none" stroke="${NAVY}" stroke-width="2.6" stroke-linejoin="round"/>`;
  return svg(100, 16, defs, body);
}

// ball mode: round shell with a transparent 64 x 64 window (28..92) for the cube face
function ballBody() {
  const sector = (a0, a1, r0, r1) => {
    const p = (a, r) => [60 + r * Math.cos((a * Math.PI) / 180), 60 + r * Math.sin((a * Math.PI) / 180)];
    const [x0, y0] = p(a0, r1);
    const [x1, y1] = p(a1, r1);
    const [x2, y2] = p(a1, r0);
    const [x3, y3] = p(a0, r0);
    return `M${n2(x0)} ${n2(y0)} A${r1} ${r1} 0 0 1 ${n2(x1)} ${n2(y1)} L${n2(x2)} ${n2(y2)} A${r0} ${r0} 0 0 0 ${n2(x3)} ${n2(y3)} Z`;
  };
  const defs =
    rad('shell', 44, 38, 76, [[0, '#93b3ff'], [0.5, '#3f6dff'], [1, '#1a37a2']]) +
    lin('bump', 0, 0, 120, 120, [[0, '#efffc6'], [0.5, ACID], [1, '#78c62a']]) +
    `<mask id="win" maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="120"><rect width="120" height="120" fill="${WHITE}"/><rect x="28" y="28" width="64" height="64" rx="18" fill="#000000"/></mask>`;
  const body =
    `<g mask="url(#win)">` +
    `<circle cx="60" cy="60" r="58" fill="${NAVY}"/>` +
    `<circle cx="60" cy="60" r="53.5" fill="url(#shell)"/>` +
    [45, 135, 225, 315].map((a) => `<path d="${sector(a - 17, a + 17, 44, 53.5)}" fill="url(#bump)" stroke="${NAVY}" stroke-width="3.5" stroke-linejoin="round"/>`).join('') +
    [0, 90, 180, 270].map((a) => `<circle cx="${n2(60 + 48.5 * Math.cos((a * Math.PI) / 180))}" cy="${n2(60 + 48.5 * Math.sin((a * Math.PI) / 180))}" r="4" fill="#dfe7ff" stroke="${NAVY}" stroke-width="2"/>`).join('') +
    `<path d="${ellipseArc(60, 60, 50, 50, 200, 250)}" fill="none" stroke="${WHITE}" stroke-opacity=".75" stroke-width="3" stroke-linecap="round"/>` +
    `<rect x="23.5" y="23.5" width="73" height="73" rx="23" fill="${NAVY}"/>` +
    `<rect x="25.5" y="25.5" width="69" height="69" rx="21" fill="none" stroke="#a9c0ff" stroke-opacity=".7" stroke-width="1.6"/>` +
    `</g>`;
  return svg(120, 120, defs, body);
}

// ufo mode: saucer; the cube (x 43-110, y -26..41) sits in an open glass cup on top, like the ship's cockpit
function ufoBody() {
  const defs =
    lin('top', 0, 40, 0, 57, [[0, '#f6f9ff'], [1, '#b4c4ec']]) +
    lin('bot', 0, 57, 0, 74, [[0, '#3f6dff'], [1, '#1a35a0']]) +
    lin('pod', 0, 64, 0, 84, [[0, '#2a4cc9'], [1, '#13246e']]) +
    lin('rim', 0, 26, 0, 34, [[0, WHITE], [1, '#a9c0ff']]) +
    lin('cup', 0, 6, 0, 32, [[0, '#e2fcff', 0.18], [1, '#45c8ff', 0.42]]) +
    lin('collar', 0, 30, 0, 48, [[0, '#e6edff'], [1, '#9fb2e2']]) +
    rad('beam', 74.5, 84, 26, [[0, '#9ff6ff', 0.8], [1, '#9ff6ff', 0]], 'gradientTransform="translate(74.5 84) scale(1 .35) translate(-74.5 -84)"') +
    `<clipPath id="disc"><ellipse cx="74.5" cy="57" rx="71" ry="17"/></clipPath>`;
  const lights = [17, 37, 57, 92, 112, 132].map((x, i) => `<circle cx="${x}" cy="57.5" r="3.2" fill="${i % 2 ? GOLD : WHITE}" stroke="${NAVY}" stroke-width="1.6"/>`).join('');
  const body =
    `<ellipse cx="74.5" cy="84" rx="26" ry="9" fill="url(#beam)"/>` +
    `<ellipse cx="74.5" cy="73" rx="27" ry="10" fill="url(#pod)" stroke="${NAVY}" stroke-width="3.5"/>` +
    `<ellipse cx="74.5" cy="76" rx="9" ry="3.5" fill="#9ff6ff"/>` +
    `<ellipse cx="74.5" cy="57" rx="71" ry="17" fill="url(#bot)"/>` +
    `<g clip-path="url(#disc)"><rect x="0" y="36" width="149" height="18.5" fill="url(#top)"/>` +
    `<rect x="0" y="53" width="149" height="9" fill="${ACID}"/><path d="M0 53 H149 M0 62 H149" stroke="${NAVY}" stroke-width="2"/>` +
    `<path d="M14 49 Q74.5 41 135 49" fill="none" stroke="${WHITE}" stroke-opacity=".8" stroke-width="2.6" stroke-linecap="round"/></g>` +
    lights +
    `<ellipse cx="74.5" cy="57" rx="71" ry="17" fill="none" stroke="${NAVY}" stroke-width="4"/>` +
    `<path d="M33 47 L40 31 H113 L120 47 Z" fill="url(#collar)" stroke="${NAVY}" stroke-width="3.5" stroke-linejoin="round"/>` +
    `<path d="M36 8 C36 22 46 30 76.5 30 C107 30 117 22 117 8" fill="url(#cup)" stroke="${WHITE}" stroke-opacity=".75" stroke-width="2.2"/>` +
    `<ellipse cx="76.5" cy="8" rx="40.5" ry="4.5" fill="none" stroke="${WHITE}" stroke-opacity=".9" stroke-width="2.4"/>` +
    `<path d="M44 13 Q46 22 57 26" fill="none" stroke="${WHITE}" stroke-opacity=".75" stroke-width="3" stroke-linecap="round"/>` +
    `<rect x="37" y="26" width="79" height="8" rx="4" fill="url(#rim)" stroke="${NAVY}" stroke-width="3"/>`;
  return svg(149, 88, defs, body);
}

// wave mode: dart pointing right (the engine rotates it)
function waveBody() {
  const dart = poly([[84, 45], [13, 15], [29, 45], [13, 75]]);
  const defs =
    lin('dart', 13, 15, 84, 75, [[0, '#efffc6'], [0.45, ACID], [1, '#6fbe24']]) +
    `<clipPath id="dc"><path d="${dart}"/></clipPath>`;
  const body =
    `<path d="${dart}" fill="url(#dart)" stroke="${NAVY}" stroke-width="6" stroke-linejoin="round"/>` +
    `<g clip-path="url(#dc)"><path d="M84 45 L13 15 L22 45 Z" fill="${WHITE}" fill-opacity=".22"/><path d="M84 45 L22 45 L13 75 Z" fill="${NAVY}" fill-opacity=".12"/></g>` +
    `<path d="${poly([[70, 45], [33, 31], [40, 45], [33, 59]])}" fill="${BLUE}" stroke="${NAVY}" stroke-width="3" stroke-linejoin="round"/>` +
    `<path d="M24 23 L66 40" stroke="${WHITE}" stroke-opacity=".75" stroke-width="2.6" stroke-linecap="round"/>` +
    `<circle cx="50" cy="45" r="4.5" fill="${WHITE}" stroke="${NAVY}" stroke-width="2"/>`;
  return svg(90, 90, defs, body);
}

// death debris: square, triangle, circle in plain white (the engine tints them)
function debris() {
  return svg(
    96,
    32,
    '',
    `<rect x="4" y="4" width="24" height="24" rx="3" fill="${WHITE}"/>` +
      `<path d="M48 4.5 L60.5 27.5 H35.5 Z" fill="${WHITE}" stroke="${WHITE}" stroke-width="1" stroke-linejoin="round"/>` +
      `<circle cx="80" cy="16" r="12" fill="${WHITE}"/>`,
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
  { file: 'objects/202.png', w: 120, h: 120, svg: blackBlock },
  { file: 'objects/203.png', w: 120, h: 54, svg: blackSlab },
  { file: 'objects/210.png', w: 132, h: 335, svg: () => portal(132, 335, 'ball', 'ball') },
  { file: 'objects/211.png', w: 132, h: 335, svg: () => portal(132, 335, 'ufo', 'ufo') },
  { file: 'objects/212.png', w: 132, h: 335, svg: () => portal(132, 335, 'wave', 'wave') },
  { file: 'objects/213.png', w: 110, h: 150, svg: () => speedPortal('slow', 1) },
  { file: 'objects/214.png', w: 110, h: 150, svg: () => speedPortal('normal', 2) },
  { file: 'objects/215.png', w: 110, h: 150, svg: () => speedPortal('fast', 3) },
  { file: 'objects/216.png', w: 110, h: 150, svg: () => speedPortal('veryFast', 4) },
  { file: 'objects/220.png', w: 120, h: 120, svg: () => coloredOrb('pink') },
  { file: 'objects/221.png', w: 120, h: 120, svg: () => coloredOrb('blue') },
  { file: 'objects/222.png', w: 100, h: 16, svg: () => coloredPad('pink') },
  { file: 'objects/223.png', w: 100, h: 16, svg: () => coloredPad('blue') },
  { file: 'ball.png', w: 120, h: 120, svg: ballBody },
  { file: 'ufo.png', w: 149, h: 88, svg: ufoBody },
  { file: 'wave.png', w: 90, h: 90, svg: waveBody },
  { file: 'debris.png', w: 96, h: 32, svg: debris },
  { file: 'coinIcon.png', w: 64, h: 64, svg: coinIcon },
  { file: 'coinEmpty.png', w: 64, h: 64, svg: coinEmpty },
  { file: 'lock.png', w: 160, h: 190, svg: lock },
  { file: 'lockSmall.png', w: 64, h: 76, svg: lockSmall },
  ...SKINS.map((make, i) => ({ file: `skins/${i}.png`, w: 185, h: 185, svg: make })),
  ...SKINS_2.map((make, i) => ({ file: `skins/${12 + i}.png`, w: 185, h: 185, svg: make })),
  { file: 'skinLock.png', w: 180, h: 180, svg: skinLock },
  { file: 'diamond.png', w: 64, h: 64, svg: diamond },
  { file: 'objects/204.png', w: 120, h: 120, svg: key },
  { file: 'keyIcon.png', w: 64, h: 64, svg: keyIcon },
  { file: 'keyEmpty.png', w: 64, h: 64, svg: keyEmpty },
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
