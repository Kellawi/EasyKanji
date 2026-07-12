// About: how the method works, data credits, backup.
import { D } from "../data.js";
import { h, eyebrow, toast } from "../ui.js";
import * as srs from "../srs.js";

export function render(root) {
  document.title = "About — EasyKanji";
  root.append(
    h("section", { class: "card pad prose" },
      eyebrow("The method"),
      h("h1", {}, "Kanji aren’t 2,383 pictures. They’re an alphabet of parts."),
      h("p", {}, "Most courses hand you kanji in frequency order, so 曜 (18 strokes) can land in week two. EasyKanji orders every character by what it’s made of: you meet 十, then 古 (十+口), then 苦, 固, 湖 — each new character is one small step from something you already own."),
      h("p", {}, "Every kanji page shows three relationships: what it’s built from, what it leads to, and what it’s easily confused with. That last set matters — 牛 and 午 differ by a single stroke, and seeing them side by side is what makes the difference stick."),
      h("h3", {}, "Two kinds of reading"),
      h("p", { html: "Almost every kanji has an <b>on’yomi (音読み)</b> — a pronunciation borrowed from Chinese, used in compounds — and a <b>kun’yomi (訓読み)</b> — the native Japanese word it was matched to, used when it stands alone. 生 is read <i lang='ja'>セイ</i> in 学生 (student) but <i lang='ja'>い(きる)</i> in 生きる (to live). On this site, ON readings are shown in katakana, KUN readings in hiragana, with the okurigana — the part written in kana after the kanji — dimmed." }),
      h("h3", {}, "Writing and remembering"),
      h("p", {}, "The practice pad checks each stroke against the real stroke-order data — position, shape, and direction — because writing a kanji correctly once beats seeing it twenty times. Everything you learn enters a spaced-repetition deck that schedules each card just before you’d forget it. Your progress lives entirely in this browser; nothing is sent anywhere.")),

    h("section", { class: "card pad prose" },
      eyebrow("Your data"),
      h("p", {}, "Progress is stored locally. Export a backup before switching devices or clearing your browser."),
      h("div", { class: "actions" },
        h("button", { class: "btn", onclick: exportBk }, "Export backup"),
        h("label", { class: "btn ghost" }, "Import backup",
          h("input", { type: "file", accept: "application/json", hidden: true, onchange: importBk })))),

    h("section", { class: "card pad prose" },
      eyebrow("Data & credits"),
      h("p", {}, `EasyKanji is free, open source, and covers ${D.meta.count.toLocaleString()} kanji (all jōyō characters plus the JLPT lists). It’s built on three superb open datasets:`),
      h("ul", { class: "credits" },
        li("KANJIDIC2", "https://www.edrdg.org/wiki/index.php/KANJIDIC_Project", "readings, meanings, grades, JLPT levels — © EDRDG, CC BY-SA 4.0"),
        li("KanjiVG", "https://kanjivg.tagaini.net/", "stroke order and component structure — © Ulrich Apel, CC BY-SA 3.0"),
        li("JMdict", "https://www.edrdg.org/jmdict/j_jmdict.html", "example vocabulary — © EDRDG, CC BY-SA 4.0")),
      h("p", { class: "muted small" }, "Kanji aggregate index via davidluzgouveia/kanji-data. Derived data files in this app inherit the CC BY-SA licences above; the application code is MIT."),
      h("p", { html: `Built by <a href="https://kellawi.com" rel="me">Bashar Kellawi</a> · <a href="https://github.com/Kellawi/EasyKanji">source on GitHub</a> · data built ${D.meta.built}.` }))
  );

  function exportBk() {
    const blob = new Blob([srs.exportBackup()], { type: "application/json" });
    const a = h("a", { href: URL.createObjectURL(blob), download: "easykanji-backup.json" });
    document.body.append(a); a.click(); a.remove();
    toast("Backup downloaded");
  }
  function importBk(e) {
    const f = e.target.files[0];
    if (!f) return;
    f.text().then((t) => { srs.importBackup(t); toast("Backup restored"); })
      .catch((err) => toast(err.message || "Couldn’t read that file"));
  }
  function li(name, href, desc) {
    return h("li", {}, h("a", { href, target: "_blank", rel: "noopener" }, name), " — " + desc);
  }
}
