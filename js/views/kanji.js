// Kanji page: connection map around the stroke player + full dictionary detail.
import { K, usedIn, getWords, meaningOf } from "../data.js";
import { h, tile, gk, eyebrow, drawWires, metaChips, readingRow, toast, icon, chip, skeleton, esc } from "../ui.js";
import { mountKvg } from "../stroke.js";
import { romaji } from "../kana.js";
import * as srs from "../srs.js";

let cleanup = [];
function on(target, ev, fn) { target.addEventListener(ev, fn); cleanup.push(() => target.removeEventListener(ev, fn)); }

export async function render(root, { char }) {
  cleanup.forEach((f) => f()); cleanup = [];
  const v = K(char);
  if (!v) {
    root.append(h("section", { class: "card pad center" },
      h("p", {}, `“${char}” isn’t in the EasyKanji set (jōyō + JLPT kanji).`),
      h("a", { class: "btn", href: "#/browse" }, "Browse all kanji")));
    return;
  }
  document.title = `${char} ${meaningOf(char)} — EasyKanji`;

  // ---------- connection map ----------
  const comps = v.c;
  const kidsAll = usedIn(char);
  const sims = v.sm;

  const centerBox = h("div", { class: "gk big", id: "playerbox" });
  const strokeInfo = h("span", { class: "muted mono" }, "…");
  const ctl = h("div", { class: "pctl" },
    h("button", { class: "iconbtn", title: "Replay strokes", onclick: () => player?.replay() }, icon("loop", 19), h("span", {}, "Replay")),
    h("button", { class: "iconbtn tgl", title: "Stroke numbers", onclick: (e) => { e.currentTarget.classList.toggle("on"); player?.setNumbers(e.currentTarget.classList.contains("on")); } }, h("span", { class: "mono" }, "1 2 3")),
    h("button", { class: "iconbtn tgl", title: "Colour the parts", onclick: (e) => { e.currentTarget.classList.toggle("on"); player?.setColors(e.currentTarget.classList.contains("on")); } }, h("span", {}, "Parts")),
    strokeInfo
  );

  const centerCol = h("div", { class: "col col-center" },
    h("span", { class: "tl tl-center" }, meaningOf(char)),
    centerBox, ctl,
    h("a", { class: "btn shu", href: "#/practice/" + encodeURIComponent(char) }, icon("pen", 18), "Practice writing")
  );

  const fromTiles = comps.map((c) => tile(c));
  const fromCol = h("div", { class: "col col-from" },
    eyebrow("Built from"),
    comps.length
      ? h("div", { class: "tstack" }, ...fromTiles)
      : h("p", { class: "muted atom" }, "An elemental character — drawn from strokes alone.")
  );

  const SHOW = 12;
  const kidTiles = kidsAll.slice(0, SHOW).map((c) => tile(c));
  const toGrid = h("div", { class: "tgrid" }, ...kidTiles);
  const toCol = h("div", { class: "col col-to" }, eyebrow("Leads to"), toGrid);
  if (!kidsAll.length) toCol.append(h("p", { class: "muted atom" }, "No jōyō kanji build on this one."));
  if (kidsAll.length > SHOW) {
    const more = h("button", { class: "chip morebtn" }, `+${kidsAll.length - SHOW} more`);
    on(more, "click", () => {
      for (const c of kidsAll.slice(SHOW)) { const t = tile(c); kidTiles.push(t); toGrid.append(t); }
      more.remove();
      queueMicrotask(wire);
    });
    toCol.append(more);
  }

  const kmap = h("div", { class: "kmap" }, fromCol, centerCol, toCol);
  const mapCard = h("section", { class: "card mapcard" }, kmap);
  if (sims.length) {
    mapCard.append(h("div", { class: "simrow" },
      eyebrow("Easily confused with"),
      h("div", { class: "trow" }, ...sims.map((c) => tile(c)))));
  }
  root.append(mapCard);

  const wire = () => drawWires(kmap, [
    ...fromTiles.map((t) => [t.querySelector(".gk"), centerBox]),
    ...kidTiles.map((t) => [centerBox, t.querySelector(".gk")]),
  ]);
  on(window, "resize", wire);

  // ---------- detail ----------
  const learnedBtn = h("button", { class: "btn ghost" });
  const syncLearned = () => {
    const onIt = srs.isLearned(char);
    learnedBtn.innerHTML = "";
    learnedBtn.append(icon(onIt ? "check" : "book", 18), onIt ? "Learned" : "Mark as learned");
    learnedBtn.classList.toggle("okstate", onIt);
  };
  syncLearned();
  on(learnedBtn, "click", () => { srs.markLearned(char, !srs.isLearned(char)); syncLearned(); toast(srs.isLearned(char) ? `${char} added to your reviews` : `${char} removed from learned`); });

  const copyBtn = h("button", { class: "btn ghost", onclick: async () => { try { await navigator.clipboard.writeText(char); toast("Copied " + char); } catch { toast("Couldn’t copy"); } } }, "Copy 字");

  const infoCard = h("section", { class: "card pad" },
    h("div", { class: "kansum" },
      h("h1", { class: "kmeanings" }, v.m.join(" · ")),
      metaChips(char)),
    readingRow("on", v.on),
    readingRow("kun", v.ku),
    h("p", { class: "muted small readnote" },
      "音読み on’yomi — the reading borrowed from Chinese, common in compounds. 訓読み kun’yomi — the native Japanese reading, used when the kanji stands alone."),
    h("div", { class: "actions" }, learnedBtn, copyBtn)
  );
  root.append(infoCard);

  // ---------- example words ----------
  const wordsBody = h("div", {}, skeleton(3));
  root.append(h("section", { class: "card pad" }, eyebrow("In real words"), wordsBody));
  getWords(char).then((words) => {
    wordsBody.innerHTML = "";
    if (!words.length) {
      wordsBody.append(h("p", { class: "muted" }, "This kanji rarely appears in everyday vocabulary — it’s one to recognise rather than build words with."));
      return;
    }
    const list = h("ul", { class: "wordlist" });
    for (const [w, r, g] of words) {
      const wHTML = [...w].map((c) => (c === char ? `<em>${esc(c)}</em>` : esc(c))).join("");
      list.append(h("li", {},
        h("span", { class: "w", lang: "ja", html: wHTML }),
        h("span", { class: "wr" },
          h("span", { class: "kana", lang: "ja" }, r),
          h("span", { class: "rom mono" }, romaji(r))),
        h("span", { class: "wg" }, g)));
    }
    wordsBody.append(list);
  }).catch(() => { wordsBody.innerHTML = ""; wordsBody.append(h("p", { class: "muted" }, "Couldn’t load example words. Check your connection and reload.")); });

  // ---------- mount player ----------
  let player = null;
  try {
    player = await mountKvg(centerBox, char, { autoplay: true });
    strokeInfo.textContent = player.strokeCount + " strokes";
    cleanup.push(() => player.destroy());
  } catch {
    centerBox.append(h("span", { class: "gkc" }, char));
    strokeInfo.textContent = v.s + " strokes";
  }
  requestAnimationFrame(wire);
}
