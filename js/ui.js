// Shared UI building blocks.
import { meaningOf, K } from "./data.js";
import { romaji } from "./kana.js";
import { isLearned } from "./srs.js";

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "html") el.innerHTML = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "dataset") Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(c));
  }
  return el;
}

export const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// A kanji inside a genkō-yōshi practice cell.
export function gk(ch, cls = "") {
  return h("span", { class: `gk ${cls}`, lang: "ja" }, h("span", { class: "gkc" }, ch));
}

// Clickable kanji tile: meaning label above the cell, like a worksheet.
export function tile(ch, opts = {}) {
  const { size = "", label = true, current = false } = opts;
  const cell = gk(ch, size + (isLearned(ch) ? " done" : ""));
  const kids = [];
  if (label) kids.push(h("span", { class: "tl" }, opts.label || meaningOf(ch)));
  kids.push(cell);
  if (current) return h("span", { class: "tile is-current" }, ...kids);
  return h("a", { class: "tile", href: "#/kanji/" + encodeURIComponent(ch), "aria-label": `${ch} — ${meaningOf(ch)}` }, ...kids);
}

export function jlptBadge(j) {
  return j ? h("span", { class: `badge n${j}` }, `N${j}`) : h("span", { class: "badge nx" }, "N1+");
}
export function chip(text, cls = "") { return h("span", { class: "chip " + cls }, text); }
export function eyebrow(text) { return h("div", { class: "eyebrow" }, text); }

// kun reading with okurigana dimmed:  い.きる → い(stem) + きる(oku)
export function kunHTML(r) {
  const affix = (s) => s.replace(/-/g, "〜");
  const [stem, ...rest] = r.split(".");
  let out = `<span class="stem">${esc(affix(stem))}</span>`;
  if (rest.length) out += `<span class="oku">${esc(affix(rest.join(".")))}</span>`;
  return out;
}
export function readingRow(kind, list) {
  if (!list.length) return null;
  const wrap = h("div", { class: "rrow" },
    h("span", { class: "rkind" }, kind === "on" ? "ON — 音読み" : "KUN — 訓読み"));
  const items = h("div", { class: "ritems" });
  for (const r of list) {
    items.append(
      h("span", { class: "reading", lang: "ja" },
        h("span", { class: "kana", html: kind === "kun" ? kunHTML(r) : esc(r) }),
        h("span", { class: "rom mono" }, romaji(r))
      )
    );
  }
  wrap.append(items);
  return wrap;
}

let toastTimer;
export function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

const ICONS = {
  home: "M4 11.5 12 4l8 7.5M6 10.5V20h4.5v-5h3v5H18v-9.5",
  map: "M5 5.5h3v3H5zM16 4h3v3h-3zM16 12.5h3v3h-3zM16 19h3v3h-3zM8 7l8-1.4M8 7l8 7M8 7l8 13",
  grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  book: "M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 3zM5 4v16M18 17H8",
  loop: "M4 12a8 8 0 0 1 13.6-5.7L20 8.5M20 3.5v5h-5M20 12a8 8 0 0 1-13.6 5.7L4 15.5M4 20.5v-5h5",
  play: "M8 5.5v13l11-6.5z",
  pause: "M7 5h3.5v14H7zM13.5 5H17v14h-3.5z",
  search: "M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM15.5 15.5 20 20",
  moon: "M20 13.5A8 8 0 0 1 10.5 4 8 8 0 1 0 20 13.5z",
  pen: "M14.5 5 19 9.5 8.5 20H4v-4.5zM12.5 7 17 11.5",
  check: "M4.5 12.5 10 18 19.5 6.5",
  x: "M6 6l12 12M18 6 6 18",
  left: "M14.5 5.5 8 12l6.5 6.5",
};
export function icon(name, size = 22) {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("width", size); s.setAttribute("height", size);
  s.setAttribute("fill", "none"); s.setAttribute("aria-hidden", "true");
  s.innerHTML = `<path d="${ICONS[name]}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
  return s;
}

// Ink connector wires between tiles inside a positioned container.
export function drawWires(container, pairs) {
  let svg = container.querySelector(":scope > svg.wires");
  if (!svg) {
    svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "wires");
    container.prepend(svg);
  }
  const cr = container.getBoundingClientRect();
  if (cr.width < 700) { svg.innerHTML = ""; return; }
  svg.setAttribute("viewBox", `0 0 ${cr.width} ${cr.height}`);
  let d = "";
  for (const [a, b] of pairs) {
    if (!a?.isConnected || !b?.isConnected) continue;
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    const x1 = ra.right - cr.left, y1 = ra.top + ra.height / 2 - cr.top;
    const x2 = rb.left - cr.left, y2 = rb.top + rb.height / 2 - cr.top;
    const mx = (x1 + x2) / 2;
    d += `M${x1.toFixed(1)} ${y1.toFixed(1)} C${mx.toFixed(1)} ${y1.toFixed(1)}, ${mx.toFixed(1)} ${y2.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)} `;
  }
  svg.innerHTML = d ? `<path d="${d}"/>` : "";
}

export function metaChips(c) {
  const v = K(c);
  const wrap = h("div", { class: "meta" });
  wrap.append(jlptBadge(v.j));
  if (v.g) wrap.append(chip(v.g <= 6 ? `Grade ${v.g}` : v.g <= 8 ? "Secondary school" : "Names"));
  wrap.append(chip(`${v.s} stroke${v.s === 1 ? "" : "s"}`));
  if (v.f) wrap.append(chip(`#${v.f} most used`));
  return wrap;
}

export function skeleton(lines = 3) {
  const el = h("div", { class: "skel" });
  for (let i = 0; i < lines; i++) el.append(h("div", { class: "skl" }));
  return el;
}
