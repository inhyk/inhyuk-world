import subprocess, sys, os, json
from PIL import Image, ImageDraw, ImageFont
clips = sys.argv[2:]; out = sys.argv[1]
N = 6; TW = 320; TH = 180
font = ImageFont.truetype("/System/Library/Fonts/AppleSDGothicNeo.ttc", 22)
rows = []
for c in clips:
    dur = float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",c]).decode().strip())
    tiles = []
    for k in range(N):
        t = dur*(k+0.5)/N
        p = subprocess.run(["ffmpeg","-v","error","-ss",f"{t:.2f}","-i",c,"-frames:v","1","-vf",f"scale={TW}:{TH}:force_original_aspect_ratio=decrease,pad={TW}:{TH}:(ow-iw)/2:(oh-ih)/2","-f","image2pipe","-vcodec","png","-"],capture_output=True)
        from io import BytesIO
        im = Image.open(BytesIO(p.stdout)).convert("RGB")
        d = ImageDraw.Draw(im); d.text((6,4), f"{t:.0f}s", fill="yellow", font=font, stroke_width=2, stroke_fill="black")
        tiles.append(im)
    rows.append((os.path.basename(c), dur, tiles))
W = 220 + N*(TW+6); H = len(rows)*(TH+8)+8
sheet = Image.new("RGB",(W,H),(30,30,30)); d = ImageDraw.Draw(sheet)
for r,(name,dur,tiles) in enumerate(rows):
    y = 8 + r*(TH+8)
    d.text((10,y+60), f"영상 {r+1}\n{dur:.0f}초", fill="white", font=font)
    for k,im in enumerate(tiles): sheet.paste(im,(220+k*(TW+6), y))
sheet.save(out); print(out)
