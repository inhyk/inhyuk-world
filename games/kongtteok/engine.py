"""콩떡이 시리즈 영상 엔진: 진짜 햄스터 영상 + 유나 목소리 + 말풍선 + 음악 → mp4.
episode(dict) 하나를 받아서 만든다. 각 화 대본은 ep1.py ~ ep4.py."""
import json, os, subprocess, sys, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.abspath(__file__))
CLIPS = os.environ.get("KONGTTEOK_CLIPS", os.path.join(ROOT, "clips"))
W, H, FPS, SR = 1920, 1080, 30, 48000
FONT = "/System/Library/Fonts/AppleSDGothicNeo.ttc"
FONT_JP = "/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc"
def font(size, weight=16): return ImageFont.truetype(FONT, size, index=weight)

# 모든 햄스터는 또렷한 "유나" 목소리로, 높낮이·빠르기만 다르게 한다.
CHARS = {
    "kong":    {"name": "콩떡이", "f0": 560, "syl": 0.082, "pitch": 1.40, "rate": 185, "color": (255, 150, 40)},
    "ssaeng":  {"name": "쌩쌩이", "f0": 440, "syl": 0.064, "pitch": 1.15, "rate": 215, "color": (60, 150, 255)},
    "friend":  {"name": "친구들", "f0": 640, "syl": 0.085, "pitch": 1.55, "rate": 170, "color": (60, 190, 90)},
    "snow":    {"name": "눈송이", "f0": 600, "syl": 0.115, "pitch": 1.50, "rate": 150, "color": (150, 120, 255)},
    "hotteok": {"name": "호떡이", "f0": 400, "syl": 0.078, "pitch": 1.25, "rate": 195, "color": (200, 120, 60)},
    "babies":  {"name": "아기들", "f0": 780, "syl": 0.080, "pitch": 1.60, "rate": 175, "color": (255, 110, 170)},
    "uncle":   {"name": "들판 삼촌", "f0": 300, "syl": 0.105, "pitch": 0.95, "rate": 160, "color": (170, 110, 40)},
    "ttorong": {"name": "또롱이", "f0": 520, "syl": 0.070, "pitch": 1.30, "rate": 200, "color": (110, 110, 130)},
    "spots":   {"name": "점박이 형제", "f0": 700, "syl": 0.075, "pitch": 1.55, "rate": 185, "color": (60, 60, 60)},
    "doctor":  {"name": "햄 박사", "f0": 360, "syl": 0.090, "pitch": 1.05, "rate": 170, "color": (40, 160, 170)},
    "mom":     {"name": "엄마 햄스터", "f0": 330, "syl": 0.095, "pitch": 1.00, "rate": 165, "color": (150, 90, 200)},
}
# 영상 안의 검은 띠를 뺀 실제 그림 영역 (x, y, w, h)
CONTENT = {"c21.webm": (186, 0, 268, 480), "c22.webm": (186, 0, 268, 480), "c23.webm": (186, 0, 268, 478), "c24.webm": (186, 0, 268, 480),
           "c27.webm": (186, 0, 268, 420), "c29.webm": (186, 0, 268, 478), "c31.webm": (184, 14, 272, 466), "c32.webm": (184, 0, 270, 478),
           "c33.webm": (186, 0, 268, 480), "c25.webm": (0, 60, 640, 360), "c26.webm": (0, 60, 638, 360), "c28.webm": (0, 60, 640, 360),
           "c30.webm": (0, 60, 640, 360), "c34.webm": (2, 60, 638, 360), "c35.webm": (0, 0, 426, 132),
           "c08.webm": (186, 44, 268, 436), "c11.webm": (184, 0, 272, 480), "c15.webm": (186, 0, 268, 480), "c05.webm": (88, 0, 544, 480), "c09.webm": (0, 60, 640, 360), "c12.webm": (0, 60, 640, 360), "c13.webm": (0, 60, 640, 360)}
CREDIT_DB = json.load(open(os.path.join(ROOT, "credits_db.json")))

F_BUBBLE = font(60, 16); F_NAME = font(34, 16); F_LABEL = font(38, 14)
F_SUB = font(44, 14); F_CREDIT_KO = font(22, 4); F_CREDIT = ImageFont.truetype(FONT_JP, 20); F_END = font(110, 16)
F_METER = font(46, 16); F_METER_S = font(26, 14); F_BANNER = font(120, 16)

def probe(path):
    out = subprocess.check_output(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                                   "stream=width,height", "-of", "csv=p=0", path]).decode().strip().split(",")
    return int(out[0]), int(out[1])

def load_wav(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy()

# ── 소리 도구 ────────────────────────────────────────────
rng = np.random.default_rng(7)
def tt(n): return np.arange(n) / SR
def midi(m): return 440.0 * 2 ** ((m - 69) / 12)
def marimba(freq, dur=0.6, amp=1.0):
    x = tt(int(dur * SR))
    s = np.sin(2 * np.pi * freq * x) * np.exp(-x * 7) + 0.35 * np.sin(2 * np.pi * freq * 3.93 * x) * np.exp(-x * 22)
    return s * np.minimum(1, x / 0.004) * amp
def musicbox(freq, dur=0.9, amp=1.0):
    x = tt(int(dur * SR))
    s = (np.sin(2 * np.pi * freq * x) + 0.4 * np.sin(2 * np.pi * freq * 2 * x) * np.exp(-x * 6)
         + 0.15 * np.sin(2 * np.pi * freq * 5.4 * x) * np.exp(-x * 18)) * np.exp(-x * 4.5)
    return s * np.minimum(1, x / 0.003) * amp
def add(buf, sig, at, gain=1.0):
    i = int(at * SR)
    if i >= len(buf) or i + len(sig) <= 0: return
    if i < 0: sig = sig[-i:]; i = 0
    j = min(len(buf), i + len(sig)); buf[i:j] += sig[: j - i] * gain
def noise(n): return rng.standard_normal(n)
def hp(x): return np.concatenate([[0], np.diff(x)]) * 0.7 + x * 0.05

def make_bgm(total, key_shift=0, bpm=112, seed=100):
    N = int(total * SR) + SR; bgm = np.zeros(N); beat = 60 / bpm
    chords = [(60, [60, 64, 67]), (55, [55, 59, 62]), (57, [57, 60, 64]), (53, [53, 57, 60])]
    penta = [72, 74, 76, 79, 81, 84]
    for b in range(int(total / (4 * beat)) + 2):
        root, tones = chords[b % 4]; bt = b * 4 * beat
        root += key_shift; tones = [x + key_shift for x in tones]
        for k in range(8):
            note = tones[[0, 1, 2, 1, 0, 2, 1, 2][k]] + (12 if k in (2, 5) else 0)
            add(bgm, marimba(midi(note), 0.5, 0.32), bt + k * beat / 2)
        for k in (0, 2): add(bgm, marimba(midi(root - 12), 0.9, 0.55), bt + k * beat)
        pr = np.random.default_rng(seed + (b % 4)); pos = 0.0
        while pos < 4:
            d = pr.choice([0.5, 1.0, 1.0, 1.5])
            choices = [n + key_shift for n in penta if ((n + key_shift) % 12) in [x % 12 for x in tones]] + [n + key_shift for n in penta]
            note = pr.choice(choices)
            if pr.random() > 0.15: add(bgm, musicbox(midi(note), 0.9, 0.22), bt + pos * beat)
            pos += d
        for k in range(4):
            x = tt(int(0.12 * SR)); kick = np.sin(2 * np.pi * (50 + 90 * np.exp(-x * 30)) * x) * np.exp(-x * 25)
            if k in (0, 2): add(bgm, kick, bt + k * beat, 0.5)
            add(bgm, hp(noise(int(0.05 * SR))) * np.exp(-tt(int(0.05 * SR)) * 60), bt + k * beat + beat / 2, 0.25)
            if k in (1, 3): add(bgm, hp(noise(int(0.09 * SR))) * np.exp(-tt(int(0.09 * SR)) * 35), bt + k * beat, 0.22)
    return bgm

def sfx(kind, dur=None):
    if kind == "pop":
        x = tt(int(0.09 * SR)); return np.sin(2 * np.pi * (300 + 700 * np.exp(-x * 40)) * x) * np.exp(-x * 30) * 0.5
    if kind == "whoosh":
        n = int(0.35 * SR); x = tt(n); return hp(noise(n)) * np.sin(np.pi * x / x[-1]) ** 2 * 0.35
    if kind == "sniff":
        out = np.zeros(int(0.45 * SR))
        for k in range(2):
            n = int(0.11 * SR); out[int(k * 0.2 * SR): int(k * 0.2 * SR) + n] += hp(noise(n)) * np.sin(np.pi * tt(n) / (n / SR)) ** 2 * 0.5
        return out
    if kind == "boing":
        x = tt(int(0.6 * SR)); f = 180 + 120 * np.sin(2 * np.pi * 9 * x) * np.exp(-x * 4) + 80 * x
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x * 5) * 0.6
    if kind == "sparkle":
        out = np.zeros(int(1.0 * SR))
        for k, m in enumerate([88, 91, 95, 100]): add(out, musicbox(midi(m), 0.6, 0.25), k * 0.07)
        return out
    if kind == "ding": return musicbox(midi(84), 1.5, 0.5) + musicbox(midi(91), 1.5, 0.3)
    if kind == "fanfare":
        out = np.zeros(int(2.2 * SR))
        for k, m in enumerate([72, 76, 79, 84]):
            add(out, musicbox(midi(m), 1.2, 0.5), k * 0.13); add(out, marimba(midi(m - 12), 1.0, 0.4), k * 0.13)
        add(out, musicbox(midi(88), 1.6, 0.5), 0.6)
        x = tt(int(1.5 * SR)); add(out, hp(noise(len(x))) * np.exp(-x * 3) * 0.12, 0.55)  # 박수 같은 소리
        return out
    if kind == "zzz":
        x = tt(int(1.2 * SR)); return np.sin(2 * np.pi * (220 - 60 * x) * x) * np.sin(np.pi * x / 1.2) ** 2 * 0.18
    if kind == "wheel":
        out = np.zeros(int(dur * SR)); x = tt(int(0.02 * SR)); click = hp(noise(len(x))) * np.exp(-x * 300); tp = 0.0
        while tp < dur - 0.05: add(out, click, tp, 0.35 + 0.1 * rng.random()); tp += 0.075 + 0.01 * rng.random()
        return out
    if kind == "munch":
        out = np.zeros(int(dur * SR)); tp = 0.1
        while tp < dur - 0.1:
            n = int(0.03 * SR); add(out, hp(noise(n)) * np.exp(-tt(n) * 90), tp, 0.25 + 0.15 * rng.random()); tp += 0.07 + 0.12 * rng.random()
        return out
    raise ValueError(kind)


# ── 햄스터 말소리 (사이트용, 직접 합성) ─────────────────
# 한글 한 글자마다 짧은 "삐약" 소리를 낸다. 모음에 맞춰 소리 색(포먼트)을 바꿔서 말하는 것처럼 들린다.
VOWEL_F = [(800, 1300), (600, 1800), (800, 1300), (600, 1800), (600, 1000), (500, 1900), (600, 1000), (500, 1900),
           (400, 800), (800, 1200), (600, 1700), (450, 1800), (400, 800), (320, 800), (600, 1000), (500, 1800),
           (300, 2000), (320, 800), (350, 1300), (350, 2000), (280, 2300)]
FRIC = {9, 10, 12, 13, 14, 18}; PLOS = {0, 1, 3, 4, 7, 8, 15, 16, 17}
def babble(text, char, seed=0):
    c = CHARS[char]; r = np.random.default_rng(seed); f0b = c["f0"]; syl = c["syl"]
    out = []; ending = text.rstrip()[-1:] if text.strip() else "."
    chars = [ch for ch in text]
    hang = [i for i, ch in enumerate(chars) if 0xAC00 <= ord(ch) <= 0xD7A3 or ch.isalnum()]
    last = hang[-1] if hang else -1
    for i, ch in enumerate(chars):
        code = ord(ch) - 0xAC00
        if ch in " ": out.append(np.zeros(int(0.045 * SR))); continue
        if ch in ",…~": out.append(np.zeros(int(0.15 * SR))); continue
        if ch in ".!?": out.append(np.zeros(int(0.22 * SR))); continue
        if 0 <= code < 11172: L, V, T = code // 588, (code % 588) // 28, code % 28
        elif ch.isalnum(): L, V, T = 11, 0, 0
        else: continue
        F1, F2 = VOWEL_F[V]; F1 *= 1.45; F2 *= 1.35
        d = syl * r.uniform(0.85, 1.15) * (0.8 if T else 1.0)
        n = int(d * SR); x = np.arange(n) / SR
        f0 = f0b * r.uniform(0.93, 1.08) * (1.06 if ending == "!" else 1.0)
        glide = -0.06 * x / d
        if i == last and ending == "?": glide = 0.25 * x / d
        ph = 2 * np.pi * np.cumsum(f0 * (1 + glide + 0.015 * np.sin(2 * np.pi * 30 * x))) / SR
        K = np.arange(1, int(7000 / f0) + 1)
        amp = np.exp(-((K * f0 - F1) / (F1 * 0.35)) ** 2) + 0.8 * np.exp(-((K * f0 - F2) / (F2 * 0.25)) ** 2) + 0.06 / K
        sig = (amp[:, None] * np.sin(K[:, None] * ph[None, :])).sum(0) / (amp.sum() + 1e-9)
        env = np.minimum(1, x / 0.008) * np.minimum(1, (d - x) / 0.025).clip(0, 1)
        sig = sig * env
        if L in FRIC:
            m = int(0.03 * SR); nz = hp(r.standard_normal(m)) * np.linspace(1, 0, m) * 0.35
            sig = np.concatenate([nz, sig])
        elif L in PLOS:
            m = int(0.006 * SR); sig = np.concatenate([hp(r.standard_normal(m)) * 0.5, sig])
        if T in (4, 16, 21):  # ㄴ ㅁ ㅇ 받침: 콧소리 꼬리
            m = int(0.035 * SR); xx = np.arange(m) / SR
            sig = np.concatenate([sig, np.sin(2 * np.pi * f0 * 0.98 * xx) * np.linspace(0.5, 0, m)])
        out.append(sig)
    a = np.concatenate(out) if out else np.zeros(int(0.3 * SR))
    return a / (np.abs(a).max() + 1e-9) * 0.8

# ── 그림 도구 ────────────────────────────────────────────
def wrap(text, f, maxw):
    lines, cur = [], ""
    for word in text.split(" "):
        test = (cur + " " + word).strip()
        if f.getlength(test) <= maxw or not cur: cur = test
        else: lines.append(cur); cur = word
    if cur: lines.append(cur)
    return lines

def ease_pop(x):
    if x >= 1: return 1.0
    return 1 + 2.2 * (x - 1) ** 3 + 1.2 * (x - 1) ** 2 if x > 0 else 0.0

def draw_bubble(base, text, char, anchor, prog, bounce, top_min):
    c = CHARS[char]; lines = wrap(text, F_BUBBLE, 820); lh = 74
    tw = max(F_BUBBLE.getlength(l) for l in lines)
    bw, bh = int(tw + 90), int(len(lines) * lh + 60)
    ax, ay = anchor
    ax = int(min(max(60, ax), W - 60)); ay = int(min(max(top_min + bh + 80, ay), H - 40))
    bx = ax + 60 if ax < W / 2 else ax - 60 - bw
    bx = int(min(max(40, bx), W - bw - 40))
    by = int(min(max(top_min, ay - bh - 170), H - bh - 60))
    s = ease_pop(prog) * (1 + 0.025 * bounce)
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(layer)
    tx = min(max(bx + 70, ax), bx + bw - 70); ty = by + bh
    tip = (ax, max(ty + 40, ay - 50))
    d.polygon([(tx - 38, ty - 6), (tx + 38, ty - 6), tip], fill=(255, 255, 255, 255))
    d.line([(tx - 38, ty - 2), tip, (tx + 38, ty - 2)], fill=(30, 30, 30, 255), width=6, joint="curve")
    d.rounded_rectangle([bx, by, bx + bw, by + bh], radius=44, fill=(255, 255, 255, 255), outline=(30, 30, 30, 255), width=6)
    d.polygon([(tx - 32, ty - 8), (tx + 32, ty - 8), (tip[0], tip[1] - 12)], fill=(255, 255, 255, 255))
    for i, l in enumerate(lines): d.text((bx + 45, by + 26 + i * lh), l, font=F_BUBBLE, fill=(25, 25, 25, 255))
    nw = int(F_NAME.getlength(c["name"]) + 40)
    d.rounded_rectangle([bx + 26, by - 30, bx + 26 + nw, by + 22], radius=24, fill=c["color"] + (255,), outline=(30, 30, 30, 255), width=4)
    d.text((bx + 46, by - 27), c["name"], font=F_NAME, fill=(255, 255, 255, 255), stroke_width=3, stroke_fill=(30, 30, 30, 255))
    if abs(s - 1) > 0.001:
        cx, cy = tip; layer = layer.resize((max(1, int(W * s)), max(1, int(H * s))), Image.BILINEAR)
        canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0)); canvas.paste(layer, (int(cx - cx * s), int(cy - cy * s))); layer = canvas
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0)); sh.putalpha(layer.split()[3].point(lambda v: int(v * 0.35)).filter(ImageFilter.GaussianBlur(10)))
    base.alpha_composite(sh, (8, 10)); base.alpha_composite(layer)

def draw_caption(base, text, char, prog, bottom=70):
    c = CHARS[char]; d = ImageDraw.Draw(base)
    lines = wrap(text, F_BUBBLE, 1500); y0 = H - bottom - len(lines) * 76; a = int(255 * min(1, prog * 3))
    for i, l in enumerate(lines):
        w = F_BUBBLE.getlength(l)
        d.text(((W - w) / 2, y0 + i * 76), l, font=F_BUBBLE, fill=(255, 255, 255, a), stroke_width=8, stroke_fill=(20, 20, 20, a))
    nm = c["name"]; nw = F_NAME.getlength(nm) + 40
    d.rounded_rectangle([(W - nw) / 2, y0 - 62, (W + nw) / 2, y0 - 10], radius=24, fill=c["color"] + (a,), outline=(30, 30, 30, a), width=4)
    d.text(((W - nw) / 2 + 20, y0 - 59), nm, font=F_NAME, fill=(255, 255, 255, a), stroke_width=3, stroke_fill=(30, 30, 30, a))

def draw_label(base, text, prog):
    d = ImageDraw.Draw(base); a = int(255 * min(1, prog * 4)); w = F_LABEL.getlength(text) + 50
    d.rounded_rectangle([40, 40, 40 + w, 106], radius=20, fill=(20, 20, 20, int(a * 0.75)))
    d.text((65, 50), text, font=F_LABEL, fill=(255, 225, 90, a))

def draw_title(base, lt, lines, sub):
    d = ImageDraw.Draw(base); s = ease_pop(min(1, lt / 0.35))
    cols = [(255, 255, 255), (255, 210, 60)]
    for i, txt in enumerate(lines):
        f = font(int(130 * max(s, 0.05)), 16); w = f.getlength(txt)
        d.text(((W - w) / 2, 250 + i * 160), txt, font=f, fill=cols[i % 2] + (255,), stroke_width=12, stroke_fill=(40, 20, 10, 255))
    if lt > 0.6:
        a = int(255 * min(1, (lt - 0.6) * 3)); w = F_SUB.getlength(sub)
        d.rounded_rectangle([(W - w) / 2 - 30, 600, (W + w) / 2 + 30, 670], radius=30, fill=(255, 120, 150, a))
        d.text(((W - w) / 2, 608), sub, font=F_SUB, fill=(255, 255, 255, a), stroke_width=3, stroke_fill=(120, 30, 60, a))

def draw_end(base, lt, nxt, credits, note=None):
    d = ImageDraw.Draw(base); a = int(255 * min(1, lt * 2)); txt = "끝!"; w = F_END.getlength(txt)
    d.text((W - w - 120, 170), txt, font=F_END, fill=(255, 220, 70, a), stroke_width=12, stroke_fill=(40, 20, 10, a))
    if lt > 0.8:
        b = int(255 * min(1, (lt - 0.8) * 2)); w2 = F_SUB.getlength(nxt)
        d.rounded_rectangle([W - w2 - 160, 330, W - 100, 402], radius=30, fill=(60, 150, 255, b))
        d.text((W - w2 - 130, 338), nxt, font=F_SUB, fill=(255, 255, 255, b), stroke_width=3, stroke_fill=(20, 50, 110, b))
    if lt > 1.2:
        b = int(230 * min(1, (lt - 1.2) * 2)); y = H - 40 - 28 * (len(credits) + 1)
        d.rectangle([0, y - 14, W, H], fill=(0, 0, 0, int(b * 0.55)))
        d.text((40, y), "진짜 햄스터 영상 출처: Wikimedia Commons (위키미디어 공용)" + (f"   ·   {note}" if note else ""), font=F_CREDIT_KO, fill=(255, 255, 255, b))
        for i, cr in enumerate(credits):
            line = f"· {cr['title']} — {cr['artist']} ({cr['license']})"
            d.text((40, y + 28 * (i + 1)), line[:140], font=F_CREDIT, fill=(230, 230, 230, b))

def draw_meter(base, km):
    d = ImageDraw.Draw(base); x1, y1, x2 = W - 470, 40, W - 40
    d.rounded_rectangle([x1, y1, x2, y1 + 150], radius=26, fill=(20, 20, 30, 200), outline=(255, 255, 255, 220), width=4)
    d.text((x1 + 26, y1 + 14), "달린 거리", font=F_METER_S, fill=(200, 220, 255, 255))
    txt = f"{km:5.1f} km"; w = F_METER.getlength(txt)
    d.text((x2 - 26 - w, y1 + 8), txt, font=F_METER, fill=(255, 230, 80, 255), stroke_width=3, stroke_fill=(0, 0, 0, 255))
    bx1, by1, bx2 = x1 + 26, y1 + 96, x2 - 26
    d.rounded_rectangle([bx1, by1, bx2, by1 + 30], radius=15, fill=(70, 70, 90, 255))
    fw = (bx2 - bx1) * min(1, km / 100)
    if fw > 8: d.rounded_rectangle([bx1, by1, bx1 + fw, by1 + 30], radius=15, fill=(80, 220, 120, 255) if km < 100 else (255, 200, 40, 255))
    d.text((bx2 - 58, by1 - 2), "100", font=F_METER_S, fill=(255, 255, 255, 255))

def draw_speedlines(base, fi):
    d = ImageDraw.Draw(base); r = np.random.default_rng(fi)
    for _ in range(26):
        ang = r.uniform(0, 2 * np.pi); r1 = r.uniform(620, 760); r2 = r1 + r.uniform(250, 600)
        cx, cy = W / 2, H / 2
        d.line([(cx + np.cos(ang) * r1 * 1.4, cy + np.sin(ang) * r1), (cx + np.cos(ang) * r2 * 1.4, cy + np.sin(ang) * r2)],
               fill=(255, 255, 255, int(r.uniform(70, 150))), width=int(r.uniform(3, 9)))

CONF = np.random.default_rng(3)
CONF_P = [(CONF.uniform(0, W), CONF.uniform(-600, -20), CONF.uniform(-80, 80), CONF.uniform(250, 520), CONF.uniform(0, 6.28),
           tuple(int(v) for v in CONF.choice([(255, 90, 90), (255, 210, 60), (80, 200, 255), (120, 230, 120), (230, 120, 255)])))
          for _ in range(160)]
def draw_confetti(base, t):
    d = ImageDraw.Draw(base)
    for (x0, y0, vx, vy, ph, col) in CONF_P:
        x = x0 + vx * t + 30 * np.sin(ph + t * 4); y = y0 + vy * t
        if -20 < y < H + 20:
            s = 10 + 6 * np.sin(ph + t * 7)
            d.polygon([(x - s, y), (x, y - 7), (x + s, y), (x, y + 7)], fill=col + (255,))

def draw_banner(base, text, lt):
    d = ImageDraw.Draw(base); s = ease_pop(min(1, lt / 0.3))
    f = font(max(8, int(120 * s)), 16); w = f.getlength(text)
    d.text(((W - w) / 2, H / 2 - 110), text, font=f, fill=(255, 220, 60, 255), stroke_width=14, stroke_fill=(120, 30, 20, 255))


def draw_medal(base, x, y, lt):
    d = ImageDraw.Draw(base); s = ease_pop(min(1, lt / 0.35)); R = int(70 * s)
    if R < 4: return
    y = y + int(8 * np.sin(lt * 3))
    d.polygon([(x - 60 * s, y - 190 * s), (x - 20 * s, y - 190 * s), (x + 10 * s, y - R + 6), (x - 25 * s, y - R + 6)], fill=(220, 50, 60, 255))
    d.polygon([(x + 60 * s, y - 190 * s), (x + 20 * s, y - 190 * s), (x - 10 * s, y - R + 6), (x + 25 * s, y - R + 6)], fill=(40, 90, 210, 255))
    d.ellipse([x - R, y - R, x + R, y + R], fill=(255, 200, 40, 255), outline=(150, 100, 10, 255), width=6)
    d.ellipse([x - R * 0.72, y - R * 0.72, x + R * 0.72, y + R * 0.72], outline=(255, 240, 150, 255), width=4)
    f = font(max(8, int(64 * s)), 16); w = f.getlength("1")
    d.text((x - w / 2, y - 40 * s), "1", font=f, fill=(150, 90, 0, 255))


F_PHONE = font(30, 14); F_PHONE_S = font(24, 6)
def phone_frame(im, box, name, lt):
    """세로 영상을 휴대폰 영상통화 화면처럼 보여 준다. (그림, 원본→화면 좌표 변환 함수)를 돌려준다."""
    bx, by, bw, bh = box
    src = im.crop((bx, by, bx + bw, by + bh))
    # 뒤 배경: 같은 영상을 크게 흐리게
    sc = max(W / bw, H / bh); bg = src.resize((int(bw * sc), int(bh * sc)), Image.BILINEAR)
    bg = bg.crop(((bg.width - W) // 2, (bg.height - H) // 2, (bg.width - W) // 2 + W, (bg.height - H) // 2 + H)).filter(ImageFilter.GaussianBlur(28))
    frame = Image.blend(bg, Image.new("RGB", (W, H), (20, 14, 10)), 0.45).convert("RGBA")
    sh = 720; s = sh / bh; sw = int(bw * s)
    sx, sy = (W - sw) // 2, 112
    d = ImageDraw.Draw(frame)
    d.rounded_rectangle([sx - 26, sy - 96, sx + sw + 26, sy + sh + 96], radius=56, fill=(18, 18, 22, 255), outline=(90, 90, 100, 255), width=5)
    frame.paste(src.resize((sw, sh), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=2, percent=50, threshold=2)), (sx, sy))
    d.rounded_rectangle([sx + sw // 2 - 60, sy - 70, sx + sw // 2 + 60, sy - 52], radius=9, fill=(40, 40, 46, 255))
    d.ellipse([sx + 10, sy - 42, sx + 26, sy - 26], fill=(80, 220, 120, 255))
    d.text((sx + 36, sy - 50), name, font=F_PHONE, fill=(255, 255, 255, 255))
    secs = int(lt) + 3; tm = f"{secs // 60:02d}:{secs % 60:02d}"
    d.text((sx + sw - F_PHONE_S.getlength(tm) - 6, sy - 46), tm, font=F_PHONE_S, fill=(200, 200, 210, 255))
    cx = sx + sw // 2; cy = sy + sh + 48
    d.ellipse([cx - 32, cy - 32, cx + 32, cy + 32], fill=(235, 60, 60, 255))
    d.rounded_rectangle([cx - 18, cy - 5, cx + 18, cy + 5], radius=5, fill=(255, 255, 255, 255))
    return frame, (lambda ax, ay: (int(sx + (ax - bx) * s), int(sy + (ay - by) * s)))


def monitor_frame(im, box, name, lt):
    """가로로 긴 영상을 병원 검사 모니터처럼 보여 준다."""
    bx, by, bw, bh = box
    src = im.crop((bx, by, bx + bw, by + bh))
    sc = max(W / bw, H / bh); bg = src.resize((int(bw * sc), int(bh * sc)), Image.BILINEAR)
    bg = bg.crop(((bg.width - W) // 2, (bg.height - H) // 2, (bg.width - W) // 2 + W, (bg.height - H) // 2 + H)).filter(ImageFilter.GaussianBlur(28))
    frame = Image.blend(bg, Image.new("RGB", (W, H), (10, 30, 34)), 0.55).convert("RGBA")
    mw = 1500; s = mw / bw; mh = int(bh * s); mx, my = (W - mw) // 2, 250
    d = ImageDraw.Draw(frame)
    d.rounded_rectangle([mx - 30, my - 90, mx + mw + 30, my + mh + 200], radius=34, fill=(24, 34, 38, 255), outline=(120, 200, 200, 255), width=5)
    d.text((mx, my - 70), name, font=F_PHONE, fill=(160, 240, 230, 255))
    rec = "● 측정 중"; d.text((mx + mw - F_PHONE.getlength(rec), my - 70), rec, font=F_PHONE, fill=(255, 90, 90, 255) if int(lt * 2) % 2 == 0 else (120, 50, 50, 255))
    frame.paste(src.resize((mw, mh), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2)), (mx, my))
    # 심장 박동 선
    y0 = my + mh + 110; pts = []
    for i in range(0, mw, 6):
        u = (i / mw * 4 + lt * 1.6) % 1.0
        v = -60 if 0.30 < u < 0.33 else (40 if 0.33 <= u < 0.36 else (-10 if 0.36 <= u < 0.40 else 0))
        pts.append((mx + i, y0 + v))
    d.line(pts, fill=(90, 255, 140, 255), width=5)
    return frame, (lambda ax, ay: (int(mx + (ax - bx) * s), int(my + (ay - by) * s)))

# ── 만들기 ───────────────────────────────────────────────
def interp(kfs, ts):
    if ts <= kfs[0][0]: return kfs[0][1:]
    for a, b in zip(kfs, kfs[1:]):
        if a[0] <= ts <= b[0]:
            u = (ts - a[0]) / max(1e-6, b[0] - a[0]); u = u * u * (3 - 2 * u)
            return tuple(a[i] + (b[i] - a[i]) * u for i in range(1, len(a)))
    return kfs[-1][1:]

def lin(kfs, x):
    xs = [k[0] for k in kfs]; ys = [k[1] for k in kfs]
    return float(np.interp(x, xs, ys))

def run(ep, out, preview=False, voice="yuna", web=False):
    work = os.path.join(ROOT, "build", "build_" + ep["id"] + ("_" + voice if voice != "yuna" else "")); os.makedirs(work, exist_ok=True)
    scenes = ep["scenes"]
    # 1) 목소리
    LEAD, GAP, TAIL = 0.45, 0.35, 0.9; t = 0.0
    for si, sc in enumerate(scenes):
        sc["start"] = t; cur = LEAD; sc["items"] = []
        for li, line in enumerate(sc.get("lines", [])):
            char, text = line[0], line[1]
            mode = line[2] if len(line) > 2 else "bubble"
            at = line[3] if len(line) > 3 else 0
            cur = max(cur, at)
            c = CHARS[char]; key = f"{si}_{li}"
            if voice == "babble":
                a = babble(text, char, seed=si * 100 + li)
            else:
                aiff = os.path.join(work, f"v_{key}.aiff"); wav = os.path.join(work, f"v_{key}.wav")
                subprocess.run(["say", "-v", "Yuna", "-r", str(c["rate"]), "-o", aiff, text], check=True)
                subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", aiff, "-af",
                                f"rubberband=pitch={c['pitch']},highpass=f=120,acompressor=threshold=0.1:ratio=3:attack=5:release=80",
                                "-ac", "1", "-ar", str(SR), wav], check=True)
                a = load_wav(wav)
            nz = np.where(np.abs(a) > 0.01)[0]
            if len(nz): a = a[max(0, nz[0] - 600): nz[-1] + 2400]
            a = a / (np.abs(a).max() + 1e-9) * (0.75 if voice == "babble" else 0.9); dur = len(a) / SR
            env = np.array([np.sqrt(np.mean(a[int(i * SR / FPS): int((i + 1) * SR / FPS)] ** 2) + 1e-12) for i in range(int(dur * FPS) + 1)])
            sc["items"].append({"char": char, "text": text, "mode": mode, "audio": a, "env": env / (env.max() + 1e-9), "t": cur, "dur": dur, "li": li})
            cur += dur + GAP
        sc["dur"] = max(sc["base"], cur - GAP + TAIL if sc["items"] else sc["base"])
        t += sc["dur"]
        print(f"[{ep['id']}] {sc['id']:6s} start {sc['start']:5.2f}s dur {sc['dur']:5.2f}s", flush=True)
    total = t; nfr = int(round(total * FPS))
    # 2) 소리
    N = int(total * SR) + SR
    bgm = make_bgm(total, ep.get("key", 0), ep.get("bpm", 112), ep.get("seed", 100))[:N]
    fx = np.zeros(N); vbuf = np.zeros(N); duck = np.zeros(N)
    for si, sc in enumerate(scenes):
        if si > 0: add(fx, sfx("whoosh"), sc["start"] - 0.2)
        for kind, at in sc.get("sfx", []):
            add(fx, sfx(kind, sc["dur"] - at) if kind in ("wheel", "munch") else sfx(kind), sc["start"] + at)
        if "confetti" in sc: add(fx, sfx("fanfare"), sc["start"] + sc["confetti"])
        if "banner" in sc and "confetti" not in sc: add(fx, sfx("sparkle"), sc["start"] + sc["banner"][0])
        for it in sc["items"]:
            at = sc["start"] + it["t"]; add(vbuf, it["audio"], at)
            duck[int(at * SR): int((at + it["dur"]) * SR)] = 1
            if it["mode"] == "bubble": add(fx, sfx("pop"), at - 0.08, 0.6)
            ls = sc.get("line_sfx", {}).get(it["li"])
            if ls: add(fx, sfx(ls), at + it["dur"] * 0.85)
    add(fx, sfx("sparkle"), 0.1); add(fx, sfx("pop"), 0.05); add(fx, sfx("ding"), scenes[-1]["start"] + 0.2)
    k = int(0.12 * SR); duck = np.convolve(duck, np.ones(k) / k, mode="same")
    end_i = int(total * SR); fade = np.ones(N); fl = int(1.5 * SR); fade[end_i - fl: end_i] = np.linspace(1, 0, fl); fade[end_i:] = 0
    mix = (bgm / (np.abs(bgm).max() + 1e-9)) * 0.20 * (1 - 0.55 * duck) + fx * 0.8 + vbuf
    mix = (mix * fade)[:end_i]; mix = mix / (np.abs(mix).max() + 1e-9) * 0.89
    with wave.open(os.path.join(work, "mix.wav"), "wb") as wf:
        wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(SR); wf.writeframes((np.clip(mix, -1, 1) * 32767).astype(np.int16).tobytes())
    # 3) 출처
    used = []
    for sc in scenes:
        if sc["clip"] not in used: used.append(sc["clip"])
    credits = [CREDIT_DB[c] for c in used]
    # 4) 영상
    enc = None
    if not preview:
        enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
                                "-i", "-", "-i", os.path.join(work, "mix.wav")]
                               + (["-vf", "scale=1280:720:flags=lanczos", "-c:v", "libx264", "-preset", "slow", "-crf", "27", "-pix_fmt", "yuv420p",
                                   "-c:a", "aac", "-b:a", "96k"] if web else
                                  ["-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k"])
                               + ["-movflags", "+faststart", "-shortest", out], stdin=subprocess.PIPE)
    prev_frames = set()
    if preview:
        for sc in scenes: prev_frames.add(int((sc["start"] + min(sc["dur"] - 0.2, 2.6)) * FPS))
    g = 0
    for sc in scenes:
        src = os.path.join(CLIPS, sc["clip"]); sw, sh = probe(src)
        bx0, by0, bw0, bh0 = CONTENT.get(sc["clip"], (0, 0, sw, sh))
        speed = sc.get("speed", 1.0)
        n = int(round((sc["start"] + sc["dur"]) * FPS)) - int(round(sc["start"] * FPS))
        vf = f"setpts=PTS/{speed},fps={FPS}" if speed != 1.0 else f"fps={FPS}"
        dec = subprocess.Popen(["ffmpeg", "-v", "error", "-ss", str(sc["t0"]), "-i", src, "-t", str(sc["dur"] * speed + 1), "-vf", vf,
                                "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        fsz = sw * sh * 3; last = None
        for fi in range(n):
            buf = dec.stdout.read(fsz)
            if len(buf) == fsz: last = buf
            lt = fi / FPS; ts = sc["t0"] + lt * speed
            if preview and g not in prev_frames: g += 1; continue
            im = Image.frombuffer("RGB", (sw, sh), last, "raw", "RGB", 0, 1)
            if sc.get("phone") or sc.get("monitor"):
                fn = phone_frame if sc.get("phone") else monitor_frame
                frame, to_out = fn(im, (bx0, by0, bw0, bh0), sc.get("phone") or sc.get("monitor"), lt)
                x0, y0, cw, ch = 0, 0, W, H
            else:
                cx, cy, cw = interp(sc["crop"], ts)
                cw = min(cw, bw0, bh0 * 16 / 9); ch = cw * 9 / 16
                x0 = min(max(bx0, cx - cw / 2), bx0 + bw0 - cw); y0 = min(max(by0, cy - ch / 2), by0 + bh0 - ch)
                frame = im.resize((W, H), Image.LANCZOS, box=(x0, y0, x0 + cw, y0 + ch))
                if cw < 1000: frame = frame.filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
                frame = frame.convert("RGBA")
                to_out = (lambda ax, ay, x0=x0, y0=y0, cw=cw, ch=ch: (int((ax - x0) / cw * W), int((ay - y0) / ch * H)))
            if sc.get("speedlines"): draw_speedlines(frame, g)
            if sc.get("title"):
                frame.alpha_composite(Image.new("RGBA", (W, H), (0, 0, 0, 90))); draw_title(frame, lt, ep["title"], ep["subtitle"])
            if sc.get("end"):
                frame.alpha_composite(Image.new("RGBA", (W, H), (0, 0, 0, int(min(1, lt) * 60)))); draw_end(frame, lt, ep["next"], credits, "이 영상: CC BY-SA 4.0 · 목소리와 음악은 직접 합성" if voice == "babble" else None)
            if sc.get("label"): draw_label(frame, sc["label"], lt)
            if "meter" in sc: draw_meter(frame, lin(sc["meter"], lt))
            if "banner" in sc and sc["banner"][0] <= lt <= sc["banner"][0] + (sc["banner"][2] if len(sc["banner"]) > 2 else 2.0):
                bl = Image.new("RGBA", (W, H), (0, 0, 0, 0)); draw_banner(bl, sc["banner"][1], lt - sc["banner"][0])
                rem = sc["banner"][0] + (sc["banner"][2] if len(sc["banner"]) > 2 else 2.0) - lt
                if rem < 0.3: bl.putalpha(bl.split()[3].point(lambda v, r=rem: int(v * r / 0.3)))
                frame.alpha_composite(bl)
            if "confetti" in sc and lt >= sc["confetti"]: draw_confetti(frame, lt - sc["confetti"])
            if "medal" in sc and lt >= sc["medal"][0]:
                mx, my = to_out(*sc["medal"][1]); draw_medal(frame, mx, my, lt - sc["medal"][0])
            top_min = 175 if (sc.get("label") or "meter" in sc) else 60
            if "meter" in sc: top_min = 215
            for it in sc["items"]:
                a, b = it["t"] - 0.08, it["t"] + it["dur"] + 0.25
                if not (a <= lt <= b): continue
                prog = (lt - a) / 0.22; ei = int((lt - it["t"]) * FPS)
                bounce = it["env"][ei] if 0 <= ei < len(it["env"]) else 0
                if it["mode"] == "caption":
                    if sc.get("title"): continue
                    draw_caption(frame, it["text"], it["char"], prog, (28 * (len(credits) + 1) + 70) if sc.get("end") else 70)
                else:
                    if sc.get("follow") and not (sc.get("phone") or sc.get("monitor")): ax_s, ay_s = interp(sc["crop"], ts)[:2]; ay_s -= 40
                    else: ax_s, ay_s = sc["anchors"][it["char"]]
                    draw_bubble(frame, it["text"], it["char"], to_out(ax_s, ay_s), prog, bounce, top_min)
            rgb = frame.convert("RGB")
            if preview: rgb.resize((960, 540)).save(os.path.join(work, f"prev_{g:05d}.jpg"), quality=85)
            else: enc.stdin.write(rgb.tobytes())
            g += 1
        dec.stdout.close(); dec.wait()
    if enc: enc.stdin.close(); enc.wait()
    print(f"[{ep['id']}] done {total:.1f}s -> {out if not preview else work}", flush=True)
    return work
