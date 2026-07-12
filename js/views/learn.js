// Learn: the components-first path, in lessons of ten, plus level sets.
import { D, K, getWords, levelSet, gradeSet, meaningOf } from "../data.js";
import { h, tile, gk, eyebrow, readingRow, icon, toast, chip } from "../ui.js";
import { mountKvg } from "../stroke.js";
import * as srs from "../srs.js";

export const LESSON = 10;
export const lessonCount = () => Math.ceil(D.order.length / LESSON);
export const lessonChars = (n) => D.order.slice((n - 1) * LESSON, n * LESSON);
export function currentLesson() {
  for (let n = 1; n <= lessonCount(); n++) {
    if (lessonChars(n).some((c) => !srs.isLearned(c))) return n;
  }
  return lessonCount();
}

export function render(root, { path }) {
  if (path[1]) return renderLesson(root, Number(path[1]));
  document.title = "Learn — EasyKanji";
  const learned = srs.stats().learned;
  const total = D.order.length;
  const cur = currentLesson();

  root.append(h("section", { class: "card pad" },
    eyebrow("The path"),
    h("h1", {}, "Simple shapes first. Always."),
    h("p", { class: "muted" },
      "This order is computed from the map itself: a kanji never appears before the pieces it’s built from, and within that rule the most useful characters come first."),
    h("div", { class: "progress" }, h("div", { class: "bar", style: `width:${(100 * learned / total).toFixed(1)}%` })),
    h("p", { class: "muted small" }, `${learned.toLocaleString()} of ${total.toLocaleString()} kanji learned`),
    h("a", { class: "btn shu lg", href: "#/learn/" + cur }, `Continue — Lesson ${cur}`)));

  // level sets
  const sets = [
    ...[5, 4, 3, 2, 1].map((n) => ({ name: `JLPT N${n}`, chars: levelSet(n), href: `#/browse?j=${n}` })),
    ...[1, 2, 3, 4, 5, 6].map((g) => ({ name: `School grade ${g}`, chars: gradeSet(g), href: `#/browse?g=${g}` })),
  ];
  const grid = h("div", { class: "setgrid" });
  for (const s of sets) {
    const done = s.chars.filter(srs.isLearned).length;
    grid.append(h("a", { class: "card pad set", href: s.href },
      h("h3", {}, s.name),
      h("div", { class: "progress sm" }, h("div", { class: "bar", style: `width:${s.chars.length ? (100 * done / s.chars.length).toFixed(1) : 0}%` })),
      h("span", { class: "muted small" }, `${done} / ${s.chars.length}`)));
  }
  root.append(h("section", {}, eyebrow("Level sets"), grid));

  // lessons list (windowed)
  const list = h("div", { class: "lessonlist" });
  const totalLessons = lessonCount();
  let rendered = 0;
  const renderMore = (n = 24) => {
    const frag = document.createDocumentFragment();
    for (let i = rendered + 1; i <= Math.min(totalLessons, rendered + n); i++) {
      const chars = lessonChars(i);
      const done = chars.filter(srs.isLearned).length;
      frag.append(h("a", { class: "lesson card" + (done === chars.length ? " done" : ""), href: "#/learn/" + i },
        h("span", { class: "lno mono" }, String(i).padStart(3, "0")),
        h("span", { class: "lchars", lang: "ja" }, chars.join("")),
        h("span", { class: "lstat muted small" }, done === chars.length ? "✓ done" : `${done}/${chars.length}`)));
    }
    list.append(frag);
    rendered = Math.min(totalLessons, rendered + n);
  };
  renderMore(Math.max(24, cur + 6));
  const moreBtn = h("button", { class: "btn ghost", onclick: () => { renderMore(48); if (rendered >= totalLessons) moreBtn.remove(); } }, "Show more lessons");
  root.append(h("section", {}, eyebrow(`All ${totalLessons} lessons`), list, rendered < totalLessons ? moreBtn : null));
}

// ---------------- one lesson, as a stepper ----------------
async function renderLesson(root, n) {
  const chars = lessonChars(n);
  if (!chars.length) { location.hash = "#/learn"; return; }
  document.title = `Lesson ${n} — EasyKanji`;
  let i = 0;
  const got = new Set(chars.filter(srs.isLearned));

  const head = h("div", { class: "lessonhead" },
    h("a", { class: "iconbtn", href: "#/learn", "aria-label": "Back to path" }, icon("left", 20)),
    h("b", {}, `Lesson ${n}`),
    h("span", { class: "muted mono", id: "lpos" }, ""),
    h("div", { class: "dots" }, ...chars.map((c, idx) => h("i", { class: "dot", dataset: { i: idx } }))));
  const stage = h("div", {});
  root.append(h("section", { class: "card pad lessonwrap" }, head, stage));

  const dots = [...head.querySelectorAll(".dot")];
  const setDots = () => dots.forEach((d, idx) => {
    d.className = "dot" + (idx === i ? " cur" : "") + (got.has(chars[idx]) ? " ok" : "");
  });

  async function show() {
    if (i >= chars.length) return finish();
    const c = chars[i];
    head.querySelector("#lpos").textContent = `${i + 1} / ${chars.length}`;
    setDots();
    const v = K(c);
    stage.innerHTML = "";
    const box = h("div", { class: "gk big" });
    const compRow = v.c.length
      ? h("p", { class: "muted" }, "Built from ",
          ...v.c.flatMap((p, idx) => [idx ? " + " : "", h("a", { href: "#/kanji/" + encodeURIComponent(p), lang: "ja" }, `${p} (${meaningOf(p).toLowerCase()})`)]))
      : h("p", { class: "muted" }, "An elemental shape — this one is a building block itself.");
    const words = h("ul", { class: "wordlist compact" });
    const card = h("div", { class: "lessoncard" },
      h("div", { class: "lc-left" }, h("span", { class: "tl tl-center" }, meaningOf(c)), box),
      h("div", { class: "lc-right" },
        h("h2", { class: "kmeanings" }, v.m.slice(0, 3).join(" · ")),
        readingRow("on", v.on), readingRow("kun", v.ku),
        compRow, words));
    const actions = h("div", { class: "actions center" },
      h("button", { class: "btn ghost", onclick: () => { i++; show(); } }, "Skip for now"),
      h("button", { class: "btn shu lg", onclick: () => { srs.markLearned(c, true); got.add(c); i++; show(); } }, icon("check", 18), "Got it — next"),
      h("a", { class: "btn ghost", href: "#/practice/" + encodeURIComponent(c) }, icon("pen", 18), "Write it"));
    stage.append(card, actions);
    getWords(c).then((ws) => {
      for (const [w, r, g] of ws.slice(0, 2)) {
        words.append(h("li", {}, h("span", { class: "w", lang: "ja" }, w), h("span", { class: "wr" }, h("span", { class: "kana", lang: "ja" }, r)), h("span", { class: "wg" }, g)));
      }
    });
    try { const p = await mountKvg(box, c, { autoplay: true }); box.onclick = () => p.replay(); } catch {}
  }

  function finish() {
    setDots();
    stage.innerHTML = "";
    stage.append(
      h("div", { class: "center pad" },
        h("h2", {}, got.size === chars.length ? "Lesson complete. きれい!" : "End of lesson"),
        h("p", { class: "muted" }, `${got.size} of ${chars.length} marked learned — they’re in your review deck now.`),
        h("div", { class: "trow center" }, ...chars.map((c) => tile(c))),
        h("div", { class: "actions center" },
          h("a", { class: "btn ghost", href: "#/review" }, "Review deck"),
          n < lessonCount() ? h("a", { class: "btn shu", href: "#/learn/" + (n + 1), onclick: () => toast("Lesson " + (n + 1)) }, "Next lesson →") : null)));
  }
  show();
}
