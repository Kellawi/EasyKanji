// Browse: the full searchable dictionary grid.
import { D, K, searchKanji } from "../data.js";
import { h, tile, icon } from "../ui.js";

const SORTS = {
  freq: ["Most used first", (a, b) => (K(a).f || 9e4) - (K(b).f || 9e4)],
  jlpt: ["JLPT (easy → hard)", (a, b) => (K(b).j - K(a).j) || ((K(a).f || 9e4) - (K(b).f || 9e4))],
  strokes: ["Fewest strokes", (a, b) => K(a).s - K(b).s || ((K(a).f || 9e4) - (K(b).f || 9e4))],
  order: ["Learn order", (a, b) => ORD.get(a) - ORD.get(b)],
};
let ORD;

export function render(root, { query = {} }) {
  ORD = ORD || new Map(D.order.map((c, i) => [c, i]));
  document.title = "Browse kanji — EasyKanji";
  let q = query.q ? decodeURIComponent(query.q) : "";
  let jlpt = query.j ? Number(query.j) : 0; // 0 = all
  let grade = query.g ? Number(query.g) : 0;
  let sort = "freq";

  const input = h("input", {
    class: "search", type: "search", value: q, autocomplete: "off",
    placeholder: "Search meaning, reading (romaji is fine), or paste a kanji…",
  });
  const count = h("span", { class: "muted count" });
  const sortSel = h("select", { class: "select", "aria-label": "Sort" },
    ...Object.entries(SORTS).map(([k, [label]]) => h("option", { value: k }, label)));
  const chipsWrap = h("div", { class: "filterchips" });
  const grid = h("div", { class: "kgrid" });
  const sentinel = h("div", { class: "sentinel" });

  const mkChip = (label, val) => {
    const b = h("button", { class: "chip filter" + (jlpt === val ? " on" : ""), dataset: { j: val } }, label);
    b.addEventListener("click", () => { jlpt = val; grade = 0; refreshChips(); apply(); });
    return b;
  };
  const refreshChips = () => {
    chipsWrap.innerHTML = "";
    chipsWrap.append(mkChip("All", 0), ...[5, 4, 3, 2, 1].map((n) => mkChip("N" + n, n)));
    if (grade) chipsWrap.append(h("span", { class: "chip on" }, grade <= 6 ? `Grade ${grade}` : "Secondary"));
  };
  refreshChips();

  let list = [], shown = 0;
  const CHUNK = 96;
  const appendChunk = () => {
    const frag = document.createDocumentFragment();
    for (const c of list.slice(shown, shown + CHUNK)) frag.append(tile(c));
    grid.append(frag);
    shown = Math.min(list.length, shown + CHUNK);
  };
  const io = new IntersectionObserver((es) => { if (es[0].isIntersecting && shown < list.length) appendChunk(); });
  io.observe(sentinel);

  function apply() {
    const qv = input.value.trim();
    list = qv ? searchKanji(qv, 4000) : [...D.chars];
    if (jlpt) list = list.filter((c) => K(c).j === jlpt);
    if (grade) list = list.filter((c) => K(c).g === grade);
    if (!qv) list.sort(SORTS[sort][1]);
    grid.innerHTML = ""; shown = 0;
    count.textContent = `${list.length.toLocaleString()} kanji`;
    if (!list.length) grid.append(h("p", { class: "muted pad" }, "Nothing matches. Try romaji (“mizu”), English (“water”), or a kanji character."));
    appendChunk();
  }

  let t;
  input.addEventListener("input", () => { clearTimeout(t); t = setTimeout(apply, 140); });
  sortSel.addEventListener("change", () => { sort = sortSel.value; apply(); });

  root.append(
    h("section", { class: "toolbar card" },
      h("div", { class: "searchwrap" }, icon("search", 18), input),
      h("div", { class: "toolrow" }, chipsWrap, h("div", { class: "spacer" }), count, sortSel)),
    grid, sentinel
  );
  apply();
  if (!q) queueMicrotask(() => input.focus({ preventScroll: true }));
}
