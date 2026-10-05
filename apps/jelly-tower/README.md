# 젤리 타워 아이폰·안드로이드 앱

`games/puyo-puyo`의 웹 게임을 [Capacitor 8](https://capacitorjs.com)로 감싸서 아이폰·아이패드 앱과 안드로이드 앱으로 만든다. 게임 코드는 하나라서, 게임을 고치면 웹사이트와 앱이 같이 바뀐다. 앱에서만 다른 일(진동, 기기 저장소, 시작 그림, 안드로이드 뒤로 가기 단추)은 `games/puyo-puyo/platform.mjs`에 있다.

- 앱 이름: 젤리 타워
- 번들 ID: `dev.seonn.jellytower`
- 최소 iOS: 15
- 기기: 아이폰, 아이패드 (세로·가로)
- 안드로이드: 패키지 이름 `dev.seonn.jellytower`, 최소 안드로이드 7.0(API 24), 타깃 API 36 (아래 [안드로이드 / 구글 플레이](#안드로이드--구글-플레이))

## 준비물

- macOS와 Xcode 16 이상 (지금 이 맥: Xcode 16.3)
- Node 20 이상
- 처음 한 번: 저장소 맨 위에서 `npm ci`, 그리고 이 폴더에서 `npm install`

## 게임을 고친 다음 앱에 넣기

```bash
cd apps/jelly-tower
npm run sync           # 게임을 www/에 빌드하고 → ios, android 프로젝트에 모두 복사
npm run sync:ios       # 아이폰만 (npx cap sync ios)
npm run sync:android   # 안드로이드만 (npx cap sync android)
npm run open           # Xcode 열기
npm run open:android   # Android Studio 열기
```

Xcode 위쪽에서 기기를 고르고 ▶를 누르면 실행된다. 시뮬레이터(예: iPhone 16 Pro)를 고르면 이 맥 안에서 바로 볼 수 있다.

명령으로만 해 보고 싶으면:

```bash
cd ios/App
xcodebuild -project App.xcodeproj -scheme App -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro' -derivedDataPath /tmp/jelly-build build
xcrun simctl boot 'iPhone 16 Pro'; open -a Simulator
xcrun simctl install booted /tmp/jelly-build/Build/Products/Debug-iphonesimulator/App.app
xcrun simctl launch booted dev.seonn.jellytower
```

## 우리 집 아이폰에 설치해 보기 (무료, 7일)

애플 개발자 프로그램에 가입하지 않아도 Xcode의 무료 "Personal Team"으로 집 아이폰에 설치할 수 있다. 7일이 지나면 다시 설치해야 한다.

1. 아이폰을 맥에 케이블로 연결하고 "이 컴퓨터를 신뢰"를 누른다.
2. 아이폰 설정 → 개인정보 보호 및 보안 → 개발자 모드를 켠다 (재시동됨).
3. Xcode에서 App 프로젝트 → Signing & Capabilities → Team을 "Inkeun Seo (Personal Team)"으로 고른다. 번들 ID가 이미 쓰인다고 나오면 끝에 `.test`를 붙여도 된다 (앱스토어용이 아님).
4. 위쪽 기기 목록에서 그 아이폰을 고르고 ▶.
5. 처음에는 아이폰 설정 → 일반 → VPN 및 기기 관리에서 개발자 앱을 신뢰해야 열린다.

## 앱 아이콘과 시작 화면 다시 그리기

아이콘(1024)과 시작 화면(2732)은 게임의 젤리 그림 코드로 그린다.

```bash
npm run puyo-puyo:dev                          # 저장소 맨 위에서, 게임 개발 서버 켜기
PUYO_URL=http://127.0.0.1:5190/ node scripts/make-art.mjs   # assets/icon.png, assets/splash.jpg
./scripts/install-art.sh                       # Xcode·안드로이드 프로젝트에 넣기 (아이폰 아이콘은 투명 부분 없이)
```

`make-art.mjs`는 안드로이드용 그림도 같이 그린다: 적응형 아이콘의 뒤 겹(`assets/icon-background.png`, 하늘)과 앞 겹(`assets/icon-foreground.png`, 젤리 탑을 가운데 안전 구역 안에), 동그란 아이콘(`assets/icon-round.png`), 구글 플레이 대표 그림(`store/feature-graphic.jpg`, 1024×500). `install-art.sh`는 `android/` 폴더가 있으면 밀도별 아이콘(`mipmap-*`)과 세로·가로 시작 그림(`drawable-*/splash.jpg`)도 넣는다. 안드로이드 12부터는 시작 그림 대신 아이콘이 배경색 `#b9a6ff` 위에 뜬다.

## 앱스토어에 올리기 (부모님이 해야 하는 일)

앱스토어 계정은 어른만 만들 수 있다. 그래서 아래는 부모님과 같이 한다. 글과 사진은 [store/listing.md](store/listing.md)에 다 준비해 두었다.

1. **애플 개발자 프로그램 가입**: https://developer.apple.com/programs/enroll/ 에서 부모님 Apple 계정으로 개인 가입 (1년 99달러, 한국에서는 약 13만 원). 승인까지 하루에서 이틀.
2. **Xcode에 팀 넣기**: Xcode → 설정 → Accounts에 그 Apple 계정을 넣고, App 프로젝트 → Signing & Capabilities → Team을 새 팀으로 바꾼다. "Automatically manage signing"을 켜 둔다.
3. **App Store Connect에서 앱 만들기**: https://appstoreconnect.apple.com → 앱 → ＋ → 새로운 앱. 플랫폼 iOS, 이름 "젤리 타워: 연쇄 퍼즐", 기본 언어 한국어, 번들 ID `dev.seonn.jellytower`, SKU `jellytower-ios-1`.
4. **사이트 먼저 배포**: 지원 주소 https://seonn.dev/jelly-tower 와 개인정보 주소 https://seonn.dev/jelly-tower/privacy 가 열리는지 확인한다.
5. **올리기**: `npm run sync` → Xcode 위쪽 기기에서 "Any iOS Device (arm64)" → Product → Archive → Distribute App → App Store Connect → Upload. 같은 버전을 다시 올릴 때는 Build 숫자(CURRENT_PROJECT_VERSION)를 1씩 올린다.
6. **먼저 친구들과 해 보기 (선택)**: App Store Connect → TestFlight에서 테스터 이메일을 넣으면 TestFlight 앱으로 미리 받아서 해 볼 수 있다.
7. **등록 정보 채우기**: `store/listing.md`의 이름·부제·설명·키워드·주소·연령 등급·개인정보 답을 붙여 넣고, `store/screenshots/` 사진을 아이폰 6.9인치 칸과 아이패드 13인치 칸에 올린다. 심사 메모에는 영어 메모와 제작자 모드 비밀번호(7777777)를 넣고, 연락처는 부모님 것을 쓴다.
8. **심사 제출**: 보통 하루에서 이틀 걸린다. 거절되면 이유를 읽고 고쳐서 다시 낸다.

## 안드로이드 / 구글 플레이

### 준비물 (처음 한 번)

이 맥에는 Homebrew로 아래를 깔아 두었다. Android Studio를 깔아도 된다 (그러면 아래 SDK도 같이 들어온다).

```bash
brew install openjdk@21                        # Capacitor 8은 자바 21이 필요하다
brew install --cask android-commandlinetools   # sdkmanager
export JAVA_HOME=/opt/homebrew/opt/openjdk@21
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
yes | sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0"
# 에뮬레이터를 쓰려면
sdkmanager "emulator" "system-images;android-36;google_apis;arm64-v8a"
avdmanager create avd -n jelly -k "system-images;android-36;google_apis;arm64-v8a" -d pixel_8
```

`export` 세 줄은 `~/.zshrc`에 넣어 두면 터미널을 새로 열어도 된다.

### 에뮬레이터나 안드로이드 폰에서 해 보기

```bash
cd apps/jelly-tower
npm run sync:android
cd android && ./gradlew assembleDebug           # app/build/outputs/apk/debug/app-debug.apk
emulator -avd jelly &                            # 에뮬레이터 켜기 (폰이면 이 줄 대신 케이블 연결)
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n dev.seonn.jellytower/.MainActivity
```

진짜 폰에 넣으려면 폰의 설정 → 휴대전화 정보 → 빌드 번호를 일곱 번 눌러 개발자 옵션을 켜고, 개발자 옵션 → USB 디버깅을 켠 다음 케이블로 연결한다. `adb devices`에 폰이 보이면 위의 `adb install`이 된다. Android Studio로 하려면 `npm run open:android` 후 ▶.

앱 안에서 Chrome으로 들여다보려면 컴퓨터 Chrome에서 `chrome://inspect`를 연다 (디버그 빌드만).

### 뒤로 가기 단추

안드로이드의 뒤로 가기(제스처나 ◁ 단추)는 앱을 바로 끄지 않고 한 칸씩 돌아간다: 광고·엔딩·대사·결과 창 닫기 → 게임 중이면 멈춤(한 번 더 누르면 계속, 온라인 대전은 나갈지 물어봄) → 각 화면에서는 메뉴로 → 로그인의 가입·불러오기 칸에서는 첫 칸으로. 메뉴나 로그인 첫 화면에서 누를 때만 앱이 꺼진다. 코드는 `games/puyo-puyo/main.js`의 `handleBack`과 `platform.mjs`의 `onBackButton`이다 (`@capacitor/app` 플러그인).

### 앱 서명 (부모님이 한 번 만들기)

구글 플레이는 **Play 앱 서명**을 쓴다. 진짜 앱 서명 키는 구글이 보관하고, 우리는 "업로드 키"로 서명해서 올리기만 한다. 업로드 키를 잃어버려도 Play Console에서 새 키로 바꿔 달라고 요청할 수 있다.

1. 업로드 키 만들기 (저장소 **밖**에 둔다):

   ```bash
   mkdir -p ~/keys
   keytool -genkeypair -v -keystore ~/keys/jelly-tower-upload.jks -alias upload \
     -keyalg RSA -keysize 2048 -validity 10000
   ```

   비밀번호와 이름(CN)을 물어본다. 비밀번호는 비밀번호 관리 앱에 적어 두고, `.jks` 파일은 따로 백업한다.

2. `apps/jelly-tower/android/keystore.properties` 파일을 만든다. 이 파일과 `*.jks`, `*.keystore`는 `.gitignore`에 들어 있어서 저장소에 올라가지 않는다. **절대 커밋하지 않는다.**

   ```properties
   storeFile=/Users/<내 이름>/keys/jelly-tower-upload.jks
   storePassword=<비밀번호>
   keyAlias=upload
   keyPassword=<비밀번호>
   ```

3. 올릴 파일(AAB) 만들기:

   ```bash
   cd apps/jelly-tower && npm run sync:android
   cd android && ./gradlew bundleRelease          # app/build/outputs/bundle/release/app-release.aab
   ```

   `keystore.properties`가 없으면 서명 없는 AAB가 나오고, 플레이에는 올릴 수 없다.

4. 다시 올릴 때는 `android/app/build.gradle`의 `versionCode`를 1씩 올린다 (`versionName`은 사람이 보는 버전, 아이폰 버전과 맞춘다).

### 구글 플레이에 올리기 (부모님이 해야 하는 일)

글과 그림은 [store/listing.md](store/listing.md)의 "구글 플레이" 부분에 준비해 두었다.

1. **개발자 계정 만들기**: https://play.google.com/console/signup 에서 부모님 구글 계정으로 "개인" 계정을 만든다. 한 번만 내는 등록비 25달러. 신분증으로 본인 확인을 하고, 안드로이드 폰으로 연락처 확인도 한다. 확인까지 며칠 걸릴 수 있다.
2. **앱 만들기**: Play Console → 앱 만들기. 앱 이름 "젤리 타워: 연쇄 퍼즐", 기본 언어 한국어, "앱 또는 게임"은 게임, 무료.
3. **비공개 테스트 먼저 (새 개인 계정은 꼭 해야 함)**: 새로 만든 개인 계정은 프로덕션(모두에게 공개)으로 내기 전에 **테스터 12명 이상이 14일 동안 계속 참여한 비공개 테스트**를 해야 한다 (구글 도움말 "Testing requirements for new personal developer accounts", 2026-10-05 확인). 테스트 → 비공개 테스트 → 트랙 만들기 → 테스터 이메일 목록(가족·친구 구글 계정) → AAB 올리기 → 출시. 테스터는 받은 링크로 참여하고 앱을 깐다. 중간에 빠졌다가 다시 들어오면 14일이 처음부터 다시 센다. 14일이 지나면 대시보드에서 "프로덕션 액세스 신청"을 누르고 테스트에 대한 질문에 답한다.
4. **앱 콘텐츠 채우기** (Play Console → 정책 → 앱 콘텐츠):
   - 개인정보처리방침: https://seonn.dev/jelly-tower/privacy
   - 광고: "광고 없음" (게임 안의 seonn 안내는 우리 사이트를 알리는 자체 안내이고, 광고 SDK가 없다. 다만 화면에 "📢 광고"라고 써 있으므로 심사에서 물어보면 그렇게 설명한다.)
   - 앱 액세스: 로그인 없이 다 쓸 수 있음 ("손님으로 하기"). 제작자 모드 비밀번호(7777777)는 안내란에 적어 준다.
   - 콘텐츠 등급(IARC 설문): 카테고리 "게임". 폭력·공포·성적 내용·욕설·약물·실제 돈 도박 없음, 사용자끼리 대화 없음, 사용자 제작 콘텐츠 공유 없음, 위치 공유 없음, 디지털 상품 구매 없음. 온라인 대전은 방 코드를 아는 친구끼리 게임 움직임만 주고받는다. 보통 "전체 이용가(3세 이상)"가 나온다.
   - 데이터 보안(Data safety): 아래 표.
   - 타겟층 및 콘텐츠: 아래 "어린이를 고르면" 참고.
   - 정부 앱 아님, 금융 기능 없음, 건강 앱 아님, 뉴스 앱 아님.
5. **스토어 등록정보**: 짧은 설명, 자세한 설명, 아이콘 512×512, 대표 그림 1024×500(`store/feature-graphic.jpg`), 휴대전화 스크린샷 2장 이상. 아이폰 사진은 긴 쪽이 짧은 쪽의 2배를 넘어서 못 쓴다. 에뮬레이터에서 찍어 1080 × 1920으로 자르는 법은 `store/listing.md`에 있다.
6. **프로덕션 출시**: 프로덕션 → 새 버전 → AAB 올리기 → 검토 제출. 검토는 며칠 걸릴 수 있다.

### 데이터 보안(Data safety) 답

아이폰의 "데이터를 수집하지 않음"과 같은 내용이다.

| 질문 | 답 |
|---|---|
| 필수 사용자 데이터 유형을 수집하거나 공유하나요? | 아니요 |
| 이유 | 계정(닉네임, 비밀번호 확인용 해시)과 게임 기록은 기기 안에만 저장되고 개발자에게 보내지 않는다. 광고, 분석, 추적 SDK가 없다. |
| 온라인 대전 | 두 기기를 PeerJS·WebRTC로 직접 잇는다. 연결 서버(0.peerjs.com, stun.l.google.com, turn.peerjs.com)가 연결을 위해 IP를 잠깐 쓸 수 있지만 개발자가 받거나 저장하지 않는다. 구글 기준의 "수집"(기기 밖으로 개발자나 제3자에게 전송)에 해당하는지 애매하면 확인 필요. iOS 답과 같게 "수집 안 함"으로 두었다. |
| 전송 중 암호화 | 예 (HTTPS, WebRTC는 늘 암호화) |
| 데이터 삭제 요청 방법 | 앱 안 내 정보 → 계정 지우기, 또는 앱 삭제. 서버에 남는 데이터가 없다. |

앱에서 계정을 만들 수 있는 앱은 "계정 삭제 URL"을 내라고 할 수 있다. 계정이 기기 안에만 있다는 설명과 함께 개인정보처리방침 주소를 적는다 (요구 여부는 등록할 때 화면을 보고 확인 필요).

### 어린이를 고르면 (가족 정책)

"타겟 연령"에 13세 미만 연령대를 하나라도 고르면 구글의 **가족 정책(Families Policy)** 을 따라야 한다.

- 개인정보처리방침이 있어야 하고, 어린이의 개인정보를 모으면 안 된다 (지금도 안 모은다).
- 광고를 넣으려면 가족용 인증 광고 SDK만 써야 한다 (지금은 광고 SDK가 없다).
- 앱 안의 바깥 링크는 어린이가 실수로 나가지 않게 해야 한다는 기준이 있다. seonn 안내의 "seonn.dev 구경하러 가기"는 브라우저로 나가므로, 심사에서 문제가 되면 부모 확인을 넣거나 안드로이드에서는 단추를 숨기는 것을 생각한다 (확인 필요).
- 심사가 더 꼼꼼해서 시간이 조금 더 걸릴 수 있다.

아이와 가족이 함께 하는 게임이라 13세 이상만 고르면 가족 정책은 피할 수 있지만, 실제로 어린이가 많이 하는 게임이면 구글이 다르게 판단할 수 있다. 정직하게 "6~8세, 9~12세, 13~15세"처럼 실제 대상 연령을 고르는 것을 권한다.

## 심사에서 볼 만한 것과 이미 해 둔 것

- 다른 회사 이름 쓰지 않기 (가이드라인 5.2): 원래 이름 "뿌요뿌요 타워"를 "젤리 타워"로 바꾸고 게임 안의 "뿌요"를 모두 "젤리"로 바꿨다. 키워드에도 넣지 않는다.
- 앱 안에서 계정 지우기 (5.1.1): 내 정보 맨 아래 "계정 지우기".
- 개인정보: 수집하는 데이터가 없고, `ios/App/App/PrivacyInfo.xcprivacy`에 추적 없음과 기기 저장소(UserDefaults) 사용 이유(CA92.1)를 적었다.
- 암호화 질문: `ITSAppUsesNonExemptEncryption = NO` (일반 HTTPS·WebRTC만 씀).
- 인터넷 없이도 된다: 글꼴(Jua)까지 앱 안에 들어 있다. 온라인 대전만 인터넷이 필요하다.
- 앱에는 돌아갈 사이트가 없으므로 「← 인혁 월드」 링크를 숨긴다. seonn 안내의 단추는 사파리(안드로이드는 기본 브라우저)로 열린다.
- 안드로이드 권한은 인터넷과 진동뿐이다. 평문 HTTP는 꺼 두었다 (`usesCleartextTraffic="false"`).
- 친구 우체통: 앱은 `https://seonn.dev/api/jelly-mail`을 부른다 (사이트가 `capacitor://localhost`를 CORS로 허용). 게임을 꺼 둔 친구에게 보낸 메시지를 서버(Vercel Blob 비공개 저장소)에 잠깐 맡기므로 개인정보 매니페스트와 앱스토어 개인정보 라벨에 "문자 메시지·사용자 ID 수집(앱 기능, 추적 안 함)"을 적었다.

## 확인 방법

```bash
npm run test:puyo-puyo                                        # 저장소 맨 위에서, 규칙·연습 판정 테스트
PUYO_URL=http://127.0.0.1:5190/ node games/puyo-puyo/app-browser-check.mjs       # 앱 전용 기능 (가짜 Capacitor)
PUYO_URL=http://127.0.0.1:5190/ node games/puyo-puyo/practice-browser-check.mjs  # 연습하기 끝까지
```

`app-browser-check.mjs`는 가짜 안드로이드로 뒤로 가기 단추도 확인한다.

시뮬레이터에서는 Xcode 콘솔에 `⚡️ To Native -> Preferences get`, `SplashScreen hide`, `Haptics impact` 같은 줄이 보이면 앱 기능이 제대로 불린 것이다.
