#!/usr/bin/env bash
# Builds the web engine into public/play/dash-overdrive/classic/engine/.
# Needs emsdk (EMSDK=/path/to/emsdk, default /tmp/emsdk).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../.." && pwd)"
emsdk="${EMSDK:-/tmp/emsdk}"
# shellcheck disable=SC1091
source "$emsdk/emsdk_env.sh" >/dev/null 2>&1
build="${BUILD_DIR:-${TMPDIR:-/tmp}/dash-classic-build}"
emcmake cmake -S "$here/engine" -B "$build" -DCMAKE_BUILD_TYPE=Release >/dev/null
cmake --build "$build" -j 8
out="$root/public/play/dash-overdrive/classic/engine"
mkdir -p "$out"
cp "$build/DashClassic.js" "$build/DashClassic.wasm" "$build/DashClassic.data" "$out/"
cp "$here/engine/LICENSE" "$out/LICENSE.txt"
echo "built $(du -h "$out/DashClassic.data" | cut -f1) data, $(du -h "$out/DashClassic.wasm" | cut -f1) wasm"
node "$here/provenance.mjs"
