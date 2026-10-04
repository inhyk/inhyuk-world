#!/bin/sh
# assets/icon.png, assets/splash.jpg 를 아이폰 프로젝트(Assets.xcassets)에 넣는다.
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
