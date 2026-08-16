#!/usr/bin/env bash
# 게임 발행 도구 설치: /publish-game 을 어느 폴더에서든 쓸 수 있게 연결합니다.
set -euo pipefail

TOOLS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_SRC="$TOOLS/publish-game"
SKILL_DST="$HOME/.claude/skills/publish-game"

echo "▶ 게임 발행 도구 설치"
echo "  소스: $SKILL_SRC"

mkdir -p "$HOME/.claude/skills"

if [ -e "$SKILL_DST" ] && [ ! -L "$SKILL_DST" ]; then
  echo "  ⚠ $SKILL_DST 에 이미 폴더가 있어요. 백업합니다."
  mv "$SKILL_DST" "$SKILL_DST.backup.$(date +%Y%m%d%H%M%S)"
fi

rm -f "$SKILL_DST"
if ln -s "$SKILL_SRC" "$SKILL_DST" 2>/dev/null; then
  echo "  ✓ 심볼릭 링크 연결: $SKILL_DST"
else
  echo "  심볼릭 링크가 안 돼서 복사합니다"
  cp -R "$SKILL_SRC" "$SKILL_DST"
  echo "  ✓ 복사 완료 (고칠 때마다 ./install.sh 다시 실행 필요)"
fi

echo "▶ 필요한 패키지 설치 (화면 사진 찍기용)"
cd "$TOOLS"
if command -v npm >/dev/null 2>&1; then
  npm install --no-audit --no-fund >/dev/null 2>&1 && echo "  ✓ playwright 설치 완료" \
    || echo "  ⚠ 설치 실패 — 화면 사진은 건너뛰고 이모지로 표시됩니다"
else
  echo "  ⚠ npm 이 없어요"
fi

echo
echo "완료! 이제 게임 폴더에서 Claude Code를 열고 /publish-game 이라고 치면 돼요."
