#!/usr/bin/env bash
# Downloads the raw datasets needed by tools/build_data.py into a cache dir.
set -euo pipefail
CACHE="${1:-$HOME/.easykanji-cache}"
mkdir -p "$CACHE"; cd "$CACHE"

echo "→ KANJIDIC aggregate (davidluzgouveia/kanji-data)"
curl -sSL -o kanji-data.json https://raw.githubusercontent.com/davidluzgouveia/kanji-data/master/kanji.json

echo "→ KanjiVG (stroke order)"
curl -sSL -o kanjivg.tar.gz https://codeload.github.com/KanjiVG/kanjivg/tar.gz/refs/heads/master
tar -xzf kanjivg.tar.gz kanjivg-master/kanji

echo "→ JMdict common words (scriptin/jmdict-simplified latest release)"
TAG=$(curl -sSI https://github.com/scriptin/jmdict-simplified/releases/latest | grep -i '^location:' | sed 's#.*/tag/##' | tr -d '\r\n')
ASSET=$(curl -sSL "https://github.com/scriptin/jmdict-simplified/releases/expanded_assets/$TAG" | grep -oE 'href="[^"]*jmdict-eng-common[^"]*\.json\.zip"' | head -1 | sed 's/href="//;s/"//')
curl -sSL -o jmdict-common.zip "https://github.com$ASSET"

echo "Done. Now run: python3 tools/build_data.py --cache $CACHE"
