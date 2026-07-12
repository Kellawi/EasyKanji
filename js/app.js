// App shell: routing, chrome, global search, theme.
import { loadData, searchKanji, meaningOf, D } from "./data.js";
import { h, icon, tile, toast } from "./ui.js";
import * as srs from "./srs.js";

const routes = {
  "": () => import("./views/home.js"),
  kanji: () => import("./views/kanji.js"),
  browse: () => import("./views/browse.js"),
  learn: () => import("./views/learn.js"),
  review: () => import("./views/review.js"),
  practice: () => import("./views/practice.js"),
  about: () => import("./views/about.js"),
};

const view = document.getElementById("view");

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, "");
  const [pathStr, queryStr] = raw.split("?");
  const path = pathStr.split("/").filter(Boolean).map(decodeURIComponent);
  const query = Object.fromEntries(new URLSearchParams(queryStr || ""));
  return { path, query };
}

let navToken = 0;
async function route() {
  const token = ++navToken;
  const { path, query } = parseHash();
  const name = path[0] || "";
  const loader = routes[name] || routes[""];
  setActiveTab(name || "home");
  view.innerHTML = "";
  view.append(h("div", { class: "loading" }, h("span", { class: "gk sm pulse" }, h("span", { class: "gkc" }, "字"))));
  try {
    await loadData();
    const mod = await loader();
    if (token !== navToken) return;
    view.innerHTML = "";
    await mod.render(view, { path, query, char: path[1] || "" });
    window.scrollTo({ top: 0 });
  } catch (err) {
    if (token !== navToken) return;
    console.error(err);
    view.innerHTML = "";
    view.append(h("section", { class: "card pad center" },
      h("h2", {}, "Couldn’t load"),
      h("p", { class: "muted" }, "The kanji data didn’t load — check your connection, then reload."),
      h("button", { class: "btn", onclick: () => location.reload() }, "Reload")));
  }
}

// ---------- chrome ----------
const TABS = [
  ["home", "", "Home", "home"],
  ["kanji", "kanji/" + encodeURIComponent("十"), "Map", "map"],
  ["browse", "browse", "Browse", "grid"],
  ["learn", "learn", "Learn", "book"],
  ["review", "review", "Review", "loop"],
];
let badgeEls = [];

function buildChrome() {
  const brand = h("a", { class: "brand", href: "#/" },
    h("span", { class: "gk logo" }, h("span", { class: "gkc" }, "字")),
    h("span", { class: "wordmark" }, "Easy", h("b", {}, "Kanji")));
  const nav = h("nav", { class: "mainnav", "aria-label": "Primary" });
  const tabbar = h("nav", { class: "tabbar", "aria-label": "Primary" });
  badgeEls = [];
  for (const [key, href, label, ic] of TABS) {
    const navBadge = key === "review" ? h("i", { class: "navbadge", hidden: true }) : null;
    const tabBadge = key === "review" ? h("i", { class: "navbadge", hidden: true }) : null;
    nav.append(h("a", { href: "#/" + href, dataset: { tab: key } }, label, navBadge));
    tabbar.append(h("a", { href: "#/" + href, dataset: { tab: key } }, icon(ic, 22), h("span", {}, label), tabBadge));
    if (navBadge) badgeEls.push(navBadge);
    if (tabBadge) badgeEls.push(tabBadge);
  }
  const searchBtn = h("button", { class: "iconbtn", "aria-label": "Search kanji ( / )", onclick: openSearch }, icon("search", 20));
  const themeBtn = h("button", { class: "iconbtn", "aria-label": "Toggle dark mode", onclick: toggleTheme }, icon("moon", 20));
  document.querySelector("header.top").append(brand, nav, h("div", { class: "spacer" }), searchBtn, themeBtn);
  document.body.append(tabbar);
  updateBadge();
}

function setActiveTab(name) {
  const key = name === "" ? "home" : name === "practice" ? "kanji" : name;
  document.querySelectorAll("[data-tab]").forEach((a) => a.classList.toggle("on", a.dataset.tab === key));
}

function updateBadge() {
  const n = srs.stats().due;
  badgeEls.forEach((b) => { b.hidden = !n; b.textContent = n > 99 ? "99+" : n; });
}
srs.onChange(updateBadge);
setInterval(updateBadge, 60000);

// ---------- theme ----------
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t === "dark" ? "#10151b" : "#f2f5f8");
}
function toggleTheme() {
  const cur = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const next = cur === "dark" ? "light" : "dark";
  localStorage.setItem("ek.theme", next);
  applyTheme(next);
}
applyTheme(localStorage.getItem("ek.theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));

// ---------- global search ----------
let overlay = null;
function openSearch() {
  if (overlay) return;
  const input = h("input", { class: "search", type: "search", placeholder: "水, mizu, or “water”…", autocomplete: "off" });
  const results = h("div", { class: "sresults" });
  overlay = h("div", { class: "overlay", onclick: (e) => { if (e.target === overlay) closeSearch(); } },
    h("div", { class: "sheet card" },
      h("div", { class: "searchwrap" }, icon("search", 18), input,
        h("button", { class: "iconbtn", onclick: closeSearch, "aria-label": "Close search" }, icon("x", 18))),
      results));
  document.body.append(overlay);
  document.body.classList.add("noscroll");
  input.focus();
  let first = null;
  input.addEventListener("input", () => {
    const q = input.value.trim();
    results.innerHTML = "";
    first = null;
    if (!q) return;
    const hits = searchKanji(q, 12);
    if (!hits.length) { results.append(h("p", { class: "muted pad" }, "No matches — try romaji or English.")); return; }
    for (const c of hits) {
      const a = h("a", { class: "srow", href: "#/kanji/" + encodeURIComponent(c), onclick: closeSearch },
        h("span", { class: "gk sm" }, h("span", { class: "gkc" }, c)),
        h("span", { class: "sm-meta" }, h("b", {}, meaningOf(c)), h("span", { class: "muted small" }, readingLine(c))));
      first = first || a;
      results.append(a);
    }
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSearch();
    if (e.key === "Enter" && first) { location.hash = first.getAttribute("href"); closeSearch(); }
  });
}
function readingLine(c) {
  const { on = [], ku = [] } = D.kanji[c] || {};
  return [...on.slice(0, 2), ...ku.slice(0, 2)].join("・");
}
function closeSearch() { overlay?.remove(); overlay = null; document.body.classList.remove("noscroll"); }
document.addEventListener("keydown", (e) => {
  if (e.key === "/" && !/input|textarea|select/i.test(document.activeElement?.tagName || "")) {
    e.preventDefault(); openSearch();
  }
});

// ---------- boot ----------
buildChrome();
window.addEventListener("hashchange", route);
route();

if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
