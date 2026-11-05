# 콩떡이 햄찌 동영상

진짜 햄스터 동영상(위키미디어 공용, 자유 이용 허락)을 잘라 말풍선, 햄스터 말소리, 배경 음악을 입힌 1~10화 동영상입니다 (시즌 1: 1~5화, 시즌 2: 6~10화).
완성본은 `public/play/kongtteok/videos/`, 보는 페이지는 `public/play/kongtteok/index.html` (`/play/kongtteok`).

- `episodes.py`: 1~10화 대본 (장면마다 쓸 영상, 자르는 위치, 말풍선 대사)
- `engine.py`: 영상 엔진 (자르기, 말풍선, 음악과 효과음 합성, 햄스터 말소리 합성)
- `credits_db.json`: 쓴 영상의 제목, 만든 사람, 라이선스 (영상 끝 화면과 페이지에 표시)
- `fetch_more.py`: 시즌 2 에 쓴 영상(c20~c35)을 하나씩 받는 도구 (`python fetch_more.py clips`)
- 세로 영상은 `"phone"` 장면(휴대폰 영상통화 화면), 아주 긴 가로 영상은 `"monitor"` 장면(검사 모니터)으로 보여 줍니다.
- `track.py`, `sheet.py`: 영상에서 햄스터 위치를 찾을 때 쓰는 장면 모음 만들기

## 다시 만들기

원본 햄스터 영상(c01~c35)은 저장소에 넣지 않았습니다. `credits_db.json` 의 제목으로 위키미디어 공용에서 받아
`clips/` 에 같은 이름(c01.webm 등)으로 둡니다. 원본 파일은 요청이 많으면 막히니, 한 번에 하나씩 `transcoded/.../<이름>.480p.vp9.webm` 를 받습니다.

    python episodes.py ep5 ep5.mp4 --babble --web   # 사이트용 (햄스터 말소리, 1280x720)
    python episodes.py ep5 --preview --babble       # 장면 몇 장만 jpg 로

`--babble` 없이 만들면 맥의 "유나" 목소리를 씁니다. 맥 시스템 목소리는 개인 감상용으로만 쓸 수 있어서 사이트에는 올리지 않습니다.

## 라이선스

영상에 CC BY-SA 4.0 햄스터 영상이 들어 있어서, 완성된 동영상도 CC BY-SA 4.0 으로 공개합니다. 출처는 각 영상 끝과 페이지 아래에 있습니다.
