// Practice: write the kanji stroke by stroke on genkō paper, with real checking.
import { K, meaningOf } from "../data.js";
import { h, eyebrow, icon, tile, toast } from "../ui.js";
import { strokeData } from "../stroke.js";
import * as srs from "../srs.js";

const VB = 109; // KanjiVG viewBox
const SVGNS = "http://www.w3.org/2000/svg";

export async function render(root, { char }) {
  const v = K(char);
  if (!v) { location.hash = "#/browse"; return; }
  document.title = `Write ${char} — EasyKanji`;

  let strokes;
  try { strokes = await strokeData(char); }
  catch {
    root.append(h("section", { class: "card pad center" }, h("p", { class: "muted" }, "Stroke data couldn’t load. Check your connection and reload.")));
    return;
  }
  const ref24 = strokes.map((s) => resample(s.pts, 24));

  // ---------- DOM ----------
  const guide = document.createElementNS(SVGNS, "svg");
  guide.setAttribute("viewBox", `0 0 ${VB} ${VB}`);
  guide.setAttribute("class", "guide kvg");
  const gpaths = strokes.map((s) => {
    const p = document.createElementNS(SVGNS, "path");
    p.setAttribute("d", s.d);
    p.setAttribute("class", "pending");
    guide.appendChild(p);
    return p;
  });
  const canvas = h("canvas", { class: "ink" });
  const pad = h("div", { class: "gk pad", role: "img", "aria-label": `Practice pad for ${char}` }, guide, canvas);

  const progress = h("span", { class: "mono" }, "");
  const feedback = h("p", { class: "feedback", html: "&nbsp;" });
  const modeBtns = h("div", { class: "seg" },
    h("button", { class: "on", onclick: (e) => setMode(e, false) }, "Trace"),
    h("button", { onclick: (e) => setMode(e, true) }, "Recall"));

  const hintBtn = h("button", { class: "btn ghost", onclick: () => hint() }, "Hint");
  const undoBtn = h("button", { class: "btn ghost", onclick: () => undo() }, "Undo");
  const clearBtn = h("button", { class: "btn ghost", onclick: () => reset() }, "Clear");
  const doneActions = h("div", { class: "actions center", hidden: true });

  root.append(h("section", { class: "card pad pracwrap" },
    h("div", { class: "prachead" },
      h("a", { class: "iconbtn", href: "#/kanji/" + encodeURIComponent(char), "aria-label": "Back to kanji" }, icon("left", 20)),
      h("div", {}, h("b", { lang: "ja" }, char + " "), h("span", { class: "muted" }, meaningOf(char).toLowerCase())),
      h("div", { class: "spacer" }), modeBtns),
    h("div", { class: "padrow" }, pad),
    h("div", { class: "pracbar" }, progress, h("div", { class: "spacer" }), hintBtn, undoBtn, clearBtn),
    feedback, doneActions));

  // ---------- state ----------
  let idx = 0, fails = 0, recall = false, finished = false;
  const total = strokes.length;

  function setMode(e, r) {
    recall = r;
    [...modeBtns.children].forEach((b) => b.classList.toggle("on", b === e.currentTarget));
    pad.classList.toggle("recall", recall);
    reset();
  }
  function updateHud() {
    progress.textContent = finished ? `${total} / ${total} ✓` : `Stroke ${idx + 1} / ${total}`;
    gpaths.forEach((p, i) => p.setAttribute("class", i < idx ? "done" : "pending"));
  }
  function say(msg, bad = false) {
    feedback.textContent = msg;
    feedback.classList.toggle("bad", bad);
  }
  function reset() {
    idx = 0; fails = 0; finished = false;
    doneActions.hidden = true; doneActions.innerHTML = "";
    pad.classList.remove("celebrate");
    clearInk(); updateHud(); say("Draw stroke 1 — follow the grey guide." + (recall ? " (Guides hidden: recall mode.)" : ""));
  }
  function undo() {
    if (finished || idx === 0) return;
    idx--; fails = 0; clearInk(); updateHud();
  }
  function hint() {
    if (finished) return;
    const p = gpaths[idx];
    p.classList.remove("pending");
    p.classList.add("hint");
    const L = strokes[idx].len;
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      p.style.strokeDasharray = L; p.style.strokeDashoffset = L;
      p.animate([{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: Math.max(400, L * 12), easing: "ease-in-out", fill: "forwards" });
    }
    setTimeout(() => { p.style.strokeDasharray = ""; p.style.strokeDashoffset = ""; p.classList.remove("hint"); updateHud(); }, 1500);
  }
  function complete() {
    finished = true;
    updateHud();
    pad.classList.add("celebrate");
    say("きれい — beautifully written.");
    try { navigator.vibrate?.(20); } catch {}
    doneActions.hidden = false;
    doneActions.append(
      h("button", { class: "btn ghost", onclick: reset }, "Write it again"),
      srs.inSrs(char)
        ? h("button", { class: "btn shu", onclick: () => { srs.rate(char, 2); toast("Marked as reviewed"); } }, icon("check", 18), "Count as review")
        : h("button", { class: "btn shu", onclick: () => { srs.markLearned(char, true); toast("Added to your deck"); } }, icon("check", 18), "Mark learned"));
    const next = (K(char).sm || []).slice(0, 4);
    if (next.length) {
      doneActions.append(h("div", { class: "trow center fullrow" },
        h("span", { class: "eyebrow" }, "Write a look-alike next"),
        ...next.map((c) => {
          const t = tile(c); t.href = "#/practice/" + encodeURIComponent(c); return t;
        })));
    }
  }

  // ---------- ink & checking ----------
  const ctx = canvas.getContext("2d");
  let scale = 1;
  function sizeCanvas() {
    const r = pad.getBoundingClientRect();
    const dpr = devicePixelRatio || 1;
    canvas.width = r.width * dpr; canvas.height = r.height * dpr;
    scale = (r.width * dpr) / VB;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.lineCap = ctx.lineJoin = "round";
  }
  const clearInk = () => ctx.clearRect(0, 0, VB, VB);
  new ResizeObserver(sizeCanvas).observe(pad);
  sizeCanvas();

  let cur = null;
  const toVB = (e) => {
    const r = pad.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * VB, ((e.clientY - r.top) / r.height) * VB];
  };
  pad.addEventListener("pointerdown", (e) => {
    if (finished) return;
    pad.setPointerCapture(e.pointerId);
    cur = [toVB(e)];
    e.preventDefault();
  });
  pad.addEventListener("pointermove", (e) => {
    if (!cur) return;
    const p = toVB(e);
    const last = cur[cur.length - 1];
    cur.push(p);
    ctx.strokeStyle = getComputedStyle(pad).getPropertyValue("--inkcol") || "#1c2733";
    ctx.lineWidth = 5.5;
    ctx.beginPath(); ctx.moveTo(last[0], last[1]); ctx.lineTo(p[0], p[1]); ctx.stroke();
  });
  const finish = () => {
    if (!cur) return;
    const pts = cur; cur = null;
    judge(pts);
  };
  pad.addEventListener("pointerup", finish);
  pad.addEventListener("pointercancel", () => { cur = null; clearInk(); redrawNothing(); });
  function redrawNothing() { /* accepted strokes live on the SVG layer */ }

  function judge(pts) {
    if (polyLen(pts) < 5) { clearInk(); return; } // stray tap
    const user = resample(pts, 24);
    const ref = ref24[idx];
    const fwd = meanDist(user, ref);
    const rev = meanDist(user, [...ref].reverse());
    const endsOK = dist(user[0], ref[0]) < 26 && dist(user[23], ref[23]) < 26;
    if (fwd < 15 && endsOK) {
      idx++; fails = 0;
      clearInk(); updateHud();
      if (idx >= total) complete();
      else say(idx === total - 1 ? "Last stroke!" : goodWord());
    } else {
      fails++;
      pad.classList.add("shake");
      setTimeout(() => pad.classList.remove("shake"), 380);
      setTimeout(clearInk, 260);
      if (rev + 4 < fwd) say("Right shape — wrong direction. Strokes run top→bottom, left→right.", true);
      else say(fails >= 3 ? "Watch the hint, then trace over it." : "Not quite — start and end where the guide does.", true);
      if (fails >= 3) hint();
    }
  }
  reset();
}

// ---------- geometry ----------
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function polyLen(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += dist(pts[i - 1], pts[i]); return L; }
function resample(pts, n) {
  const L = polyLen(pts);
  if (!L) return Array(n).fill(pts[0]);
  const out = [pts[0]];
  const step = L / (n - 1);
  let acc = 0, target = step, i = 1;
  let prev = pts[0];
  while (out.length < n - 1 && i < pts.length) {
    const d = dist(prev, pts[i]);
    if (acc + d >= target) {
      const t = (target - acc) / d;
      const p = [prev[0] + (pts[i][0] - prev[0]) * t, prev[1] + (pts[i][1] - prev[1]) * t];
      out.push(p); prev = p; acc = 0; target = step;
    } else { acc += d; prev = pts[i]; i++; }
  }
  while (out.length < n) out.push(pts[pts.length - 1]);
  return out;
}
function meanDist(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += dist(a[i], b[i]); return s / a.length; }
const GOODS = ["Good.", "Nice line.", "上手 — skilled!", "Clean stroke.", "Keep going."];
const goodWord = () => GOODS[(Math.random() * GOODS.length) | 0];
