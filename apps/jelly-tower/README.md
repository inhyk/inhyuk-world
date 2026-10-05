# 젤리 타워 아이폰 앱

`games/puyo-puyo`의 웹 게임을 [Capacitor 8](https://capacitorjs.com)로 감싸서 아이폰·아이패드 앱으로 만든다. 게임 코드는 하나라서, 게임을 고치면 웹사이트와 앱이 같이 바뀐다. 앱에서만 다른 일(진동, 기기 저장소, 시작 그림)은 `games/puyo-puyo/platform.mjs`에 있다.

- 앱 이름: 젤리 타워
- 번들 ID: `dev.seonn.jellytower`
- 최소 iOS: 15
- 기기: 아이폰, 아이패드 (세로·가로)

## 준비물

- macOS와 Xcode 16 이상 (지금 이 맥: Xcode 16.3)
- Node 20 이상
- 처음 한 번: 저장소 맨 위에서 `npm ci`, 그리고 이 폴더에서 `npm install`

## 게임을 고친 다음 앱에 넣기

```bash
cd apps/jelly-tower
npm run sync   # 게임을 www/에 빌드하고 → ios 프로젝트에 복사 (npx cap sync ios)
npm run open   # Xcode 열기
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
./scripts/install-art.sh                       # Xcode 프로젝트에 넣기 (아이콘은 투명 부분 없이)
```

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

## 심사에서 볼 만한 것과 이미 해 둔 것

- 다른 회사 이름 쓰지 않기 (가이드라인 5.2): 원래 이름 "뿌요뿌요 타워"를 "젤리 타워"로 바꾸고 게임 안의 "뿌요"를 모두 "젤리"로 바꿨다. 키워드에도 넣지 않는다.
- 앱 안에서 계정 지우기 (5.1.1): 내 정보 맨 아래 "계정 지우기".
- 개인정보: 수집하는 데이터가 없고, `ios/App/App/PrivacyInfo.xcprivacy`에 추적 없음과 기기 저장소(UserDefaults) 사용 이유(CA92.1)를 적었다.
- 암호화 질문: `ITSAppUsesNonExemptEncryption = NO` (일반 HTTPS·WebRTC만 씀).
- 인터넷 없이도 된다: 글꼴(Jua)까지 앱 안에 들어 있다. 온라인 대전만 인터넷이 필요하다.
- 앱에는 돌아갈 사이트가 없으므로 「← 인혁 월드」 링크를 숨긴다. seonn 안내의 단추는 사파리로 열린다.
- 친구 우체통: 앱은 `https://seonn.dev/api/jelly-mail`을 부른다 (사이트가 `capacitor://localhost`를 CORS로 허용). 게임을 꺼 둔 친구에게 보낸 메시지를 서버(Vercel Blob 비공개 저장소)에 잠깐 맡기므로 개인정보 매니페스트와 앱스토어 개인정보 라벨에 "문자 메시지·사용자 ID 수집(앱 기능, 추적 안 함)"을 적었다.

## 확인 방법

```bash
npm run test:puyo-puyo                                        # 저장소 맨 위에서, 규칙·연습 판정 테스트
PUYO_URL=http://127.0.0.1:5190/ node games/puyo-puyo/app-browser-check.mjs       # 앱 전용 기능 (가짜 Capacitor)
PUYO_URL=http://127.0.0.1:5190/ node games/puyo-puyo/practice-browser-check.mjs  # 연습하기 끝까지
```

시뮬레이터에서는 Xcode 콘솔에 `⚡️ To Native -> Preferences get`, `SplashScreen hide`, `Haptics impact` 같은 줄이 보이면 앱 기능이 제대로 불린 것이다.
