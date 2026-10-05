#!/bin/sh
# assets/icon.png, assets/splash.jpg 를 아이폰 프로젝트(Assets.xcassets)에 넣는다.
# android/ 폴더가 있으면 안드로이드 아이콘(적응형 두 겹 + 예전 기기용)과 시작 화면도 넣는다.
# 앱스토어 아이콘은 투명한 부분(알파)이 있으면 안 되므로 JPEG를 거쳐 알파를 없앤 PNG로 넣는다.
# 시작 화면은 1x·2x·3x 크기의 JPEG로 넣어 저장소와 앱을 가볍게 한다.
set -e
cd "$(dirname "$0")/.."
ICONSET=ios/App/App/Assets.xcassets/AppIcon.appiconset
SPLASH=ios/App/App/Assets.xcassets/Splash.imageset
TMP=$(mktemp -d)
sips -s format jpeg -s formatOptions 100 assets/icon.png --out "$TMP/icon.jpg" >/dev/null
sips -s format png "$TMP/icon.jpg" --out "$ICONSET/AppIcon-512@2x.png" >/dev/null
rm -f "$SPLASH"/*.png "$SPLASH"/*.jpg
sips -s format jpeg -s formatOptions 88 -z 911 911 assets/splash.jpg --out "$SPLASH/splash@1x.jpg" >/dev/null
sips -s format jpeg -s formatOptions 88 -z 1822 1822 assets/splash.jpg --out "$SPLASH/splash@2x.jpg" >/dev/null
sips -s format jpeg -s formatOptions 88 assets/splash.jpg --out "$SPLASH/splash@3x.jpg" >/dev/null
cat > "$SPLASH/Contents.json" <<'JSON'
{
  "images" : [
    { "idiom" : "universal", "filename" : "splash@1x.jpg", "scale" : "1x" },
    { "idiom" : "universal", "filename" : "splash@2x.jpg", "scale" : "2x" },
    { "idiom" : "universal", "filename" : "splash@3x.jpg", "scale" : "3x" }
  ],
  "info" : { "version" : 1, "author" : "xcode" }
}
JSON
rm -rf "$TMP"
echo "아이콘·시작 화면을 아이폰 프로젝트에 넣었어"

[ -d android ] || exit 0
RES=android/app/src/main/res
# 밀도별 크기: 아이콘 48dp, 적응형 아이콘 한 겹 108dp
for d in mdpi:48:108 hdpi:72:162 xhdpi:96:216 xxhdpi:144:324 xxxhdpi:192:432; do
  name=${d%%:*}; rest=${d#*:}; icon=${rest%%:*}; layer=${rest#*:}
  dir=$RES/mipmap-$name
  sips -s format png -z "$icon" "$icon" assets/icon.png --out "$dir/ic_launcher.png" >/dev/null
  sips -s format png -z "$icon" "$icon" assets/icon-round.png --out "$dir/ic_launcher_round.png" >/dev/null
  sips -s format png -z "$layer" "$layer" assets/icon-foreground.png --out "$dir/ic_launcher_foreground.png" >/dev/null
  sips -s format png -z "$layer" "$layer" assets/icon-background.png --out "$dir/ic_launcher_background.png" >/dev/null
done
# 시작 화면 (안드로이드 11 이하에서 보임. 12부터는 아이콘 + 배경색 #b9a6ff)
# 정사각형 그림을 긴 쪽에 맞춰 줄이고 가운데를 잘라 낸다
splash() { # 폴더 가로 세로
  long=$(( $2 > $3 ? $2 : $3 ))
  rm -f "$RES/$1/splash.png" "$RES/$1/splash.jpg"
  sips -s format jpeg -s formatOptions 85 -z "$long" "$long" assets/splash.jpg --out "$RES/$1/splash.jpg" >/dev/null
  sips -c "$3" "$2" "$RES/$1/splash.jpg" >/dev/null
}
splash drawable 480 320
for d in mdpi:320:480 hdpi:480:800 xhdpi:720:1280 xxhdpi:960:1600 xxxhdpi:1280:1920; do
  name=${d%%:*}; rest=${d#*:}; w=${rest%%:*}; h=${rest#*:}
  splash "drawable-port-$name" "$w" "$h"
  splash "drawable-land-$name" "$h" "$w"
done
echo "아이콘·시작 화면을 안드로이드 프로젝트에도 넣었어"
