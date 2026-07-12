// Home: the pitch, your progress, and good places to start.
import { D } from "../data.js";
import { h, tile, icon, eyebrow } from "../ui.js";
import { mountKvg } from "../stroke.js";
import * as srs from "../srs.js";
import { currentLesson } from "./learn.js";

const STARTERS = ["一", "二", "三", "人", "日", "月", "木", "山", "口", "田", "水", "火"];
const HERO_LOOP = ["十", "古", "語", "海", "道"];

export function render(root) {
  document.title = "EasyKanji — Kanji, connected";
  const st = srs.stats();

  const heroBox = h("div", { class: "gk big hero-gk" });
  const heroMeaning = h("span", { class: "tl tl-center" }, " ");
  const hero = h("section", { class: "hero" },
    h("div", { class: "hero-copy" },
      h("p", { class: "eyebrow" }, "A visual map of 2,383 kanji"),
      h("h1", { class: "display" }, "Kanji, ", h("span", { class: "shu-ink" }, "connected"), "."),
      h("p", { class: "lede" },
        "Every character is built from ones you already know. Follow the map from simple to complex, watch each stroke draw itself, then keep it for good with spaced review."),
      h("div", { class: "cta" },
        h("a", { class: "btn shu lg", href: "#/kanji/" + encodeURIComponent("十") }, "Start with 十 “ten”"),
        h("a", { class: "btn ghost lg", href: "#/browse" }, "Browse the dictionary"))),
    h("div", { class: "hero-box" }, heroMeaning, heroBox,
      h("p", { class: "muted small center" }, "Real stroke order, drawn live — tap any kanji to see its map.")));
  root.append(hero);

  // rotating hero kanji
  let i = 0, ctrl = null, alive = true;
  const cycle = async () => {
    if (!alive || !heroBox.isConnected) return;
    const ch = HERO_LOOP[i % HERO_LOOP.length]; i++;
    heroMeaning.textContent = `${ch} — ${D.kanji[ch].m[0].toLowerCase()}`;
    ctrl?.destroy();
    try {
      ctrl = await mountKvg(heroBox, ch, { autoplay: true, onDone: () => setTimeout(cycle, 1600) });
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) return; // show once, static
    } catch { /* offline before cache */ }
  };
  cycle();
  const mo = new MutationObserver(() => { if (!heroBox.isConnected) { alive = false; ctrl?.destroy(); mo.disconnect(); } });
  mo.observe(document.getElementById("view"), { childList: true });

  // progress strip
  if (st.total || st.learned) {
    const lesson = currentLesson();
    root.append(h("section", { class: "card pad strip" },
      h("div", { class: "stat" }, h("b", {}, String(st.due)), h("span", {}, "reviews due")),
      h("div", { class: "stat" }, h("b", {}, String(st.learned)), h("span", {}, "kanji learned")),
      h("div", { class: "stat" }, h("b", {}, String(st.streak)), h("span", {}, "day streak")),
      h("div", { class: "spacer" }),
      st.due ? h("a", { class: "btn", href: "#/review" }, icon("loop", 18), "Review now")
             : h("a", { class: "btn", href: "#/learn/" + lesson }, icon("book", 18), "Continue lesson " + lesson)));
  }

  // method
  root.append(h("section", { class: "trio" },
    card("See the map", "十 sits inside 古, 古 inside 湖. Learn the pieces once and long kanji stop being random — they become sentences of shapes.", "map"),
    card("Write every stroke", "Each kanji draws itself in true stroke order. Trace it on the practice pad and your hand learns what your eyes saw.", "pen"),
    card("Review on schedule", "A built-in spaced-repetition deck resurfaces each kanji right before you’d forget it. A few minutes a day is enough.", "loop")));

  // starters
  root.append(h("section", { class: "card pad" },
    eyebrow("Good places to start"),
    h("div", { class: "trow wrap" }, ...STARTERS.map((c) => tile(c)))));

  root.append(h("footer", { class: "foot" },
    h("span", {}, "EasyKanji — free & open source."),
    h("a", { href: "#/about" }, "How it works & data credits")));
}

function card(title, body, ic) {
  return h("div", { class: "card pad method" },
    h("div", { class: "mic" }, icon(ic, 22)),
    h("h3", {}, title),
    h("p", { class: "muted" }, body));
}
