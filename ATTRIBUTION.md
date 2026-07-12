# Data attribution

EasyKanji is built on three open datasets. The generated files under `/data`
are derivative works and are distributed under the same ShareAlike licences.

| Dataset | Used for | Author / Licence |
|---|---|---|
| [KANJIDIC2](https://www.edrdg.org/wiki/index.php/KANJIDIC_Project) | readings, meanings, grades, JLPT, frequency | © [EDRDG](https://www.edrdg.org/), [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| [KanjiVG](https://kanjivg.tagaini.net/) | stroke order SVGs (`data/kanjivg/`), component decomposition | © Ulrich Apel, [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| [JMdict](https://www.edrdg.org/jmdict/j_jmdict.html) | example vocabulary (`data/words/`), via [jmdict-simplified](https://github.com/scriptin/jmdict-simplified) | © EDRDG, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |

KANJIDIC fields are consumed through the aggregate index in
[davidluzgouveia/kanji-data](https://github.com/davidluzgouveia/kanji-data).

The similarity graph, learn order and per-kanji example selections in
`data/kanji.json` and `data/words/` are computed by `tools/build_data.py`.
