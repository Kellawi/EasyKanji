// Review: the spaced-repetition session and the quick quiz.
import { D, K, getWords, meaningOf, levelSet } from "../data.js";
import { h, gk, tile, eyebrow, readingRow, icon, toast } from "../ui.js";
import { mountKvg } from "../stroke.js";
import * as srs from "../srs.js";

const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sample = (arr, n, exclude = new Set()) => shuffle(arr.filter((c) => !exclude.has(c))).slice(0, n);

export function render(root, { path }) {
  document.title = "Review — EasyKanji";
  if (path[1] === "quiz") return quiz(root);
  const due = srs.dueCards();
  if (!due.length) return empty(root);
  session(root, due);
}

function empty(root) {
  const st = srs.stats();
  const next = srs.nextDue();
  root.append(h("section", { class: "card pad center emptyrev" },
    gk("休", "md"),
    h("h1", {}, "Nothing due right now"),
    h("p", { class: "muted" },
      st.total
        ? `All ${st.total} cards are scheduled. ${next ? "Next review " + fmtWhen(next) + "." : ""}`
        : "Your review deck is empty. Learn a few kanji and they’ll appear here on schedule."),
    h("div", { class: "actions center" },
      h("a", { class: "btn shu", href: "#/learn" }, icon("book", 18), "Learn new kanji"),
      h("button", { class: "btn ghost", onclick: () => { location.hash = "#/review/quiz"; } }, "Take a 10-question quiz"))));
}
function fmtWhen(ts) {
  const d = ts - Date.now();
  if (d < 3600000) return "in " + Math.max(1, Math.round(d / 60000)) + " min";
  if (d < 86400000) return "in " + Math.round(d / 3600000) + " h";
  return "in " + Math.round(d / 86400000) + " d";
}

// ---------------- SRS session ----------------
function session(root, queue) {
  let done = 0, again = [];
  const left = h("b", {}, "");
  const head = h("div", { class: "revhead" },
    h("span", { class: "muted" }, "Reviews left: "), left,
    h("div", { class: "spacer" }),
    h("span", { class: "chip" }, `🔥 ${srs.stats().streak} day streak`));
  const stage = h("div", {});
  root.append(h("section", { class: "card pad revwrap" }, head, stage));

  const pump = () => {
    if (!queue.length && again.length) { queue = again; again = []; }
    left.textContent = String(queue.length + again.length);
    if (!queue.length) return finish();
    const c = queue.shift();
    (done % 3 === 2 ? mcq : flash)(c);
  };

  async function flash(c) {
    const v = K(c);
    stage.innerHTML = "";
    const box = h("div", { class: "gk big" });
    const front = h("div", { class: "center" },
      h("span", { class: "tl tl-center" }, "What does it mean? How is it read?"), box);
    const revealBtn = h("button", { class: "btn lg" }, "Show answer");
    const back = h("div", { class: "revback", hidden: true },
      h("h2", { class: "kmeanings" }, v.m.slice(0, 3).join(" · ")),
      readingRow("on", v.on), readingRow("kun", v.ku),
      h("p", { class: "muted small wordslot" }, ""));
    stage.append(front, h("div", { class: "center" }, revealBtn), back);
    getWords(c).then((ws) => {
      const w = ws[0];
      if (w) back.querySelector(".wordslot").textContent = `${w[0]} (${w[1]}) — ${w[2]}`;
    });
    try { const p = await mountKvg(box, c, { static: true }); box.onclick = () => p.replay(); } catch { box.append(h("span", { class: "gkc" }, c)); }
    revealBtn.onclick = () => {
      back.hidden = false; revealBtn.parentElement.remove();
      back.append(gradeRow(c));
      back.querySelector("button.g2")?.focus();
    };
  }

  async function mcq(c) {
    const v = K(c);
    stage.innerHTML = "";
    const opts = shuffle([c, ...sample(pool(), 3, new Set([c]))]);
    const grid = h("div", { class: "mcqgrid" });
    stage.append(
      h("div", { class: "center" },
        h("span", { class: "eyebrow" }, "Pick the kanji"),
        h("h2", { class: "kmeanings" }, v.m[0]),
        v.on[0] ? h("p", { class: "muted", lang: "ja" }, "read " + v.on[0] + (v.ku[0] ? " / " + v.ku[0] : "")) : null),
      grid);
    let locked = false;
    for (const o of opts) {
      const b = h("button", { class: "mcq" }, gk(o, "md"));
      b.onclick = () => {
        if (locked) return; locked = true;
        const right = o === c;
        b.classList.add(right ? "right" : "wrong");
        if (!right) grid.querySelectorAll(".mcq").forEach((x) => { if (x !== b && x.textContent.includes(c)) x.classList.add("right"); });
        srs.rate(c, right ? 2 : 0);
        if (!right) again.push(c);
        setTimeout(() => { done++; pump(); }, right ? 550 : 1300);
      };
      grid.append(b);
    }
  }

  function gradeRow(c) {
    const row = h("div", { class: "grades" });
    srs.GRADES.forEach((label, g) => {
      const b = h("button", { class: "btn grade g" + g },
        h("span", {}, label), h("span", { class: "mono small" }, srs.previewIvl(c, g)));
      b.onclick = () => { srs.rate(c, g); if (g === 0) again.push(c); done++; pump(); };
      row.append(b);
    });
    return row;
  }

  function finish() {
    stage.innerHTML = "";
    stage.append(h("div", { class: "center pad" },
      gk("完", "md"),
      h("h2", {}, "Deck clear"),
      h("p", { class: "muted" }, `${done} reviews done. ${srs.nextDue() ? "Next review " + fmtWhen(srs.nextDue()) + "." : ""}`),
      h("div", { class: "actions center" },
        h("a", { class: "btn shu", href: "#/learn" }, "Learn more kanji"),
        h("a", { class: "btn ghost", href: "#/" }, "Home"))));
  }
  pump();
}

function pool() {
  const learned = D.chars.filter(srs.isLearned);
  return learned.length >= 24 ? learned : [...new Set([...learned, ...levelSet(5), ...levelSet(4)])];
}

// ---------------- quiz ----------------
function quiz(root) {
  document.title = "Quiz — EasyKanji";
  const qs = sample(pool(), 10);
  if (qs.length < 4) {
    root.append(h("section", { class: "card pad center" }, h("p", { class: "muted" }, "Learn a few kanji first, then come back for a quiz."), h("a", { class: "btn", href: "#/learn" }, "Start learning")));
    return;
  }
  let i = 0, score = 0; const misses = [];
  const stage = h("div", {});
  const posEl = h("span", { class: "muted mono" }, "");
  root.append(h("section", { class: "card pad revwrap" },
    h("div", { class: "revhead" }, h("b", {}, "Quiz"), h("div", { class: "spacer" }), posEl), stage));

  function next() {
    if (i >= qs.length) return end();
    posEl.textContent = `${i + 1} / ${qs.length}`;
    const c = qs[i];
    const type = i % 2; // 0: kanji→meaning, 1: meaning→kanji
    stage.innerHTML = "";
    let locked = false;
    const after = (right, revealFix) => {
      if (right) score++; else misses.push(c);
      setTimeout(() => { i++; next(); }, right ? 500 : 1200);
    };
    if (type === 0) {
      const box = h("div", { class: "gk lg" });
      const options = shuffle([c, ...sample(pool(), 3, new Set([c]))]);
      const list = h("div", { class: "optlist" });
      for (const o of options) {
        const b = h("button", { class: "btn opt" }, meaningOf(o));
        b.onclick = () => {
          if (locked) return; locked = true;
          const right = o === c;
          b.classList.add(right ? "okstate" : "badstate");
          if (!right) [...list.children].find((x) => x.textContent === meaningOf(c))?.classList.add("okstate");
          after(right);
        };
        list.append(b);
      }
      stage.append(h("div", { class: "center" }, h("span", { class: "eyebrow" }, "What does it mean?"), box), list);
      mountKvg(box, c, { static: true }).catch(() => box.append(h("span", { class: "gkc" }, c)));
    } else {
      const options = shuffle([c, ...sample(pool(), 3, new Set([c]))]);
      const grid = h("div", { class: "mcqgrid" });
      stage.append(h("div", { class: "center" }, h("span", { class: "eyebrow" }, "Pick the kanji"), h("h2", { class: "kmeanings" }, meaningOf(c))), grid);
      for (const o of options) {
        const b = h("button", { class: "mcq" }, gk(o, "md"));
        b.onclick = () => {
          if (locked) return; locked = true;
          const right = o === c;
          b.classList.add(right ? "right" : "wrong");
          if (!right) [...grid.children].find((x) => x.textContent.includes(c))?.classList.add("right");
          after(right);
        };
        grid.append(b);
      }
    }
  }
  function end() {
    stage.innerHTML = "";
    stage.append(h("div", { class: "center pad" },
      h("h2", {}, `${score} / ${qs.length}`),
      h("p", { class: "muted" }, score === qs.length ? "Perfect — 素晴らしい!" : "Tap the ones you missed to revisit their maps."),
      misses.length ? h("div", { class: "trow center" }, ...misses.map((c) => tile(c))) : null,
      h("div", { class: "actions center" },
        h("button", { class: "btn shu", onclick: () => { root.innerHTML = ""; quiz(root); } }, "Another round"),
        h("a", { class: "btn ghost", href: "#/review" }, "Back to reviews"))));
  }
  next();
}
