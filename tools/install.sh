#!/usr/bin/env bash
# 게임 발행 도구 설치: publish-game 스킬을 어느 폴더에서든 쓸 수 있게 연결합니다.
set -euo pipefail

TOOLS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_SRC="$TOOLS/publish-game"

echo "▶ 게임 발행 도구 설치"
echo "  소스: $SKILL_SRC"

install_skill() {
  local product="$1"
  local skill_root="$2"
  local skill_dst="$skill_root/publish-game"

  mkdir -p "$skill_root"

  if [ -e "$skill_dst" ] && [ ! -L "$skill_dst" ]; then
    echo "  ⚠ $skill_dst 에 이미 폴더가 있어요. 백업합니다."
    mv "$skill_dst" "$skill_dst.backup.$(date +%Y%m%d%H%M%S)"
  fi

  rm -f "$skill_dst"
  if ln -s "$SKILL_SRC" "$skill_dst" 2>/dev/null; then
    echo "  ✓ $product 연결: $skill_dst"
  else
    echo "  $product 심볼릭 링크가 안 돼서 복사합니다"
    cp -R "$SKILL_SRC" "$skill_dst"
    echo "  ✓ $product 복사 완료 (고칠 때마다 ./install.sh 다시 실행 필요)"
  fi
}

install_skill "Claude Code" "$HOME/.claude/skills"
install_skill "Codex" "${CODEX_HOME:-$HOME/.codex}/skills"

echo "▶ 필요한 패키지 설치 (화면 사진 찍기용)"
cd "$TOOLS"
if command -v npm >/dev/null 2>&1; then
  npm install --no-audit --no-fund >/dev/null 2>&1 && echo "  ✓ playwright 설치 완료" \
    || echo "  ⚠ 설치 실패 — 화면 사진은 건너뛰고 이모지로 표시됩니다"
else
  echo "  ⚠ npm 이 없어요"
fi

echo
echo "완료! 게임 폴더에서 Codex에는 \$publish-game, Claude Code에는 /publish-game이라고 입력하세요."
