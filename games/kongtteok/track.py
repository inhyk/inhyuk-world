import subprocess, sys, io
from PIL import Image, ImageDraw, ImageFont
src, out = sys.argv[1], sys.argv[2]
times = [float(x) for x in sys.argv[3].split(",")]
cols = int(sys.argv[4]) if len(sys.argv) > 4 else 5
font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 20)
small = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 13)
TW = 480
tiles = []
for t in times:
    png = subprocess.run(["ffmpeg","-v","error","-ss",str(t),"-i",src,"-frames:v","1","-f","image2pipe","-vcodec","png","-"],capture_output=True).stdout
    im = Image.open(io.BytesIO(png)).convert("RGB")
    W, H = im.size
    th = int(TW * H / W)
    im = im.resize((TW, th))
    d = ImageDraw.Draw(im)
    step = W // 8
    for k in range(1, 8):
        x = k * TW / 8; d.line([(x,0),(x,th)], fill=(0,255,255), width=1); d.text((x+2, th-16), str(k*step), fill=(0,255,255), font=small)
    for k in range(1, 6):
        y = k * th / 6; d.line([(0,y),(TW,y)], fill=(0,255,255), width=1); d.text((2, y+1), str(int(k*H/6)), fill=(0,255,255), font=small)
    d.text((4,4), f"{t:g}s", fill="yellow", font=font, stroke_width=2, stroke_fill="black")
    tiles.append(im)
th = tiles[0].size[1]
rows = (len(tiles)+cols-1)//cols
sheet = Image.new("RGB", (cols*(TW+4), rows*(th+4)), (0,0,0))
for i, im in enumerate(tiles): sheet.paste(im, ((i%cols)*(TW+4), (i//cols)*(th+4)))
sheet.save(out)
