# EasyKanji — Kanji, connected

**Live app:** https://kellawi.github.io/EasyKanji/ 

Most courses hand you kanji in frequency order, so an 18-stroke character can land in week two.
EasyKanji orders and displays all **2,383 kanji** (full jōyō set + JLPT lists) by **what they're made of**:
you meet 十, then 古 (十+口), then 苦, 固, 湖 — every new character is one small step from something you already own.

No accounts, no backend, no tracking. A fully static PWA: your progress lives in your browser (with export/import backup).

## Features

- **The kanji map** — every kanji page shows what it's *built from*, what it *leads to*, and what it's
  *easily confused with* (牛/午, 土/士…), rendered as connected genkō-yōshi practice cells. Tap any node to travel the map.
- **Self-writing kanji** — real stroke order from KanjiVG, animated stroke by stroke, with stroke numbers
  and per-component colouring toggles.
- **Full dictionary detail** — meanings, on'yomi (音読み) in katakana and kun'yomi (訓読み) in hiragana with
  okurigana dimmed, romaji for everything, JLPT level, school grade, stroke count, newspaper frequency rank.
- **Real example words** — the most common JMdict vocabulary for each kanji, with readings, romaji and glosses,
  the target kanji highlighted in vermilion.
- **Handwriting practice pad** — draw on genkō paper with your finger or mouse; every stroke is checked against
  the real stroke data for **position, shape and direction** ("right shape — wrong direction"), with hints,
  trace and recall modes.
- **A components-first learn path** — 239 lessons of ten, computed so a kanji never appears before its parts,
  and the most useful characters come first within that rule.
- **Built-in spaced repetition** — an SM-2 style deck with Again/Hard/Good/Easy grading, interval previews,
  pick-the-kanji rounds, due badges, streaks, and a 10-question quiz mode.
- **Search that meets you where you are** — English ("water"), romaji ("mizu"), kana (みず), or paste 水. Press `/` anywhere.
- **PWA** — installable, works offline after first visit (visited kanji are cached), dark mode, keyboard-focus visible,
  `prefers-reduced-motion` respected, mobile-first.

## Run it locally

It's a static site — any file server works:

```bash
git clone https://github.com/Kellawi/EasyKanji.git
cd EasyKanji
python3 -m http.server 8080        # or: npx serve
# open http://localhost:8080
```

There's also a headless smoke test that boots the app in jsdom and visits every route:
`npm install && npm test`.

## Deploy

Pushing to `main` triggers `.github/workflows/deploy.yml`, which publishes the repo to GitHub Pages.
One-time setup: **Repo → Settings → Pages → Source: GitHub Actions.**

## Rebuilding the data

All JSON/SVG under `data/` is generated. To refresh from the latest upstream datasets:

```bash
tools/fetch_sources.sh ~/.easykanji-cache     # downloads KANJIDIC index, KanjiVG, JMdict
python3 tools/build_data.py --cache ~/.easykanji-cache
```

The pipeline selects the kanji set, parses KanjiVG for components + stroke sequences, computes the
similarity graph (component overlap + stroke-sequence edit distance + curated confusables), extracts
top example words from JMdict, and computes the components-first learn order (priority topological sort).

## Structure

```
index.html            app shell (hash-routed SPA, no build step)
css/style.css         design system — genkō cells, ink palette, dark mode
js/app.js             router, chrome, global search, theme, SW registration
js/data.js            index loading, used-in graph inversion, search
js/stroke.js          KanjiVG loader + stroke player + practice stroke data
js/kana.js            kana ⇄ romaji
js/srs.js             spaced repetition + streaks + backup
js/views/*.js         home · kanji (map+detail) · browse · learn · review · practice · about
data/kanji.json       core index: readings, meanings, graph, learn order (~0.4 MB)
data/words/w*.json    example words, 12 shards, lazy-loaded
data/kanjivg/*.svg    2,383 stroke-order SVGs, fetched per kanji, SW-cached
tools/                data pipeline
```

## Data & licences

Application code is MIT © 2026 [Bashar Kellawi](https://kellawi.com).
Kanji data derives from **KANJIDIC2** and **JMdict** (© EDRDG, CC BY-SA 4.0) and **KanjiVG**
(© Ulrich Apel, CC BY-SA 3.0) — generated files under `data/` inherit those licences.
Full details in [ATTRIBUTION.md](ATTRIBUTION.md).

## Roadmap ideas

Kana charts for absolute beginners · radical name glossary · sentence examples (Tatoeba) ·
Anki export · vocabulary decks per JLPT level · handwriting recognition without guides.
