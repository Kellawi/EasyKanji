// Smoke test: boot the real app in jsdom, visit every route, fail on runtime errors.
// Run: npm test   (from the repo root)
import { JSDOM } from "jsdom";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(ROOT);

const dom = new JSDOM(
  `<!doctype html><html><head><meta name="theme-color" content="#fff"></head>
   <body><header class="top"></header><main id="view"></main><div id="toast"></div></body></html>`,
  { url: "http://localhost:8080/", pretendToBeVisual: true }
);
const { window } = dom;

// ---- expose browser globals to the modules ----
const G = [
  "document", "location", "navigator", "localStorage", "DOMParser", "Node", "Event",
  "EventTarget", "CustomEvent", "HTMLElement", "SVGElement", "Element", "URLSearchParams",
  "getComputedStyle", "MutationObserver", "history", "Blob", "URL", "FileReader",
  "requestAnimationFrame", "cancelAnimationFrame",
];
for (const k of G) {
  if (window[k] === undefined) continue;
  try { globalThis[k] = window[k]; }
  catch { Object.defineProperty(globalThis, k, { value: window[k], configurable: true, writable: true }); }
}
globalThis.window = window;
globalThis.devicePixelRatio = 1;
globalThis.scrollTo = window.scrollTo = () => {};
globalThis.matchMedia = window.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {} });
globalThis.IntersectionObserver = window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
globalThis.ResizeObserver = window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
window.SVGElement.prototype.getTotalLength = function () { return 120; };
window.SVGElement.prototype.getPointAtLength = function (l) { return { x: 10 + (l % 90), y: 10 + ((l * 0.61) % 90) }; };
window.Element.prototype.animate = function () { return { finished: Promise.resolve(), cancel() {}, onfinish: null }; };
window.Element.prototype.getAnimations = function () { return []; };
window.HTMLCanvasElement.prototype.getContext = function () {
  return new Proxy({}, { get: () => () => {}, set: () => true });
};
window.HTMLElement.prototype.focus = function () {};
window.navigator.vibrate = () => {};

// fetch from disk relative to repo root
globalThis.fetch = window.fetch = async (input) => {
  const u = new URL(String(input), "http://localhost:8080/");
  const p = decodeURIComponent(u.pathname).replace(/^\//, "") || "index.html";
  try {
    const buf = await fs.readFile(path.join(ROOT, p));
    return {
      ok: true, status: 200,
      json: async () => JSON.parse(buf.toString()),
      text: async () => buf.toString(),
    };
  } catch {
    return { ok: false, status: 404, json: async () => { throw new Error("404 " + p); }, text: async () => { throw new Error("404 " + p); } };
  }
};

// ---- error capture ----
const errors = [];
process.on("unhandledRejection", (e) => errors.push(["unhandledRejection", e]));
process.on("uncaughtException", (e) => errors.push(["uncaughtException", e]));
window.addEventListener("error", (e) => errors.push(["window.error", e.error || e.message]));
const realErr = console.error;
console.error = (...a) => { errors.push(["console.error", a.map(String).join(" ")]); realErr(...a); };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const view = window.document.getElementById("view");

// ---- boot the real app ----
await import(path.join(ROOT, "js/app.js"));
await sleep(900); // initial route + data load

const ROUTES = [
  ["#/", "home", /Kanji, ?/],
  ["#/kanji/" + encodeURIComponent("十"), "kanji 十", /Leads to|Built from/],
  ["#/kanji/" + encodeURIComponent("語"), "kanji 語", /Built from/],
  ["#/browse", "browse", /kanji/],
  ["#/browse?j=5", "browse N5", /kanji/],
  ["#/learn", "learn path", /Lesson|path/i],
  ["#/learn/1", "lesson 1", /Lesson 1/],
  ["#/review", "review (empty)", /Nothing due|Reviews left/],
  ["#/review/quiz", "quiz", /Quiz|Learn a few/],
  ["#/practice/" + encodeURIComponent("十"), "practice 十", /Stroke 1/],
  ["#/about", "about", /alphabet of parts|credits/i],
];

let pass = 0, fail = 0;
for (const [hash, name, expect] of ROUTES) {
  const before = errors.length;
  window.location.hash = hash;
  window.dispatchEvent(new window.Event("hashchange"));
  await sleep(750);
  const html = view.innerHTML;
  const ok = html.length > 150 && expect.test(view.textContent) && errors.length === before;
  if (ok) { pass++; console.log(`  ✓ ${name}`); }
  else {
    fail++;
    console.log(`  ✗ ${name}  (len=${html.length}, expectMatch=${expect.test(view.textContent)})`);
    for (const e of errors.slice(before)) console.log("     ↳", e[0], e[1]?.stack || e[1]);
  }
}

// interaction probes ------------------------------------------------
// 1) search overlay
const before = errors.length;
window.document.querySelector('button[aria-label^="Search"]').click();
await sleep(50);
const inp = window.document.querySelector(".overlay .search");
inp.value = "mizu";
inp.dispatchEvent(new window.Event("input", { bubbles: true }));
await sleep(250);
const hits = window.document.querySelectorAll(".overlay .srow").length;
if (hits > 0 && errors.length === before) { pass++; console.log(`  ✓ search overlay ("mizu" → ${hits} hits)`); }
else { fail++; console.log(`  ✗ search overlay (hits=${hits})`); }
window.document.querySelector('.overlay button[aria-label="Close search"]')?.click();

// 2) lesson "Got it" marks learned and SRS picks it up
window.location.hash = "#/learn/1";
window.dispatchEvent(new window.Event("hashchange"));
await sleep(700);
const got = [...view.querySelectorAll("button")].find((b) => b.textContent.includes("Got it"));
got?.click();
await sleep(400);
const srs = await import(path.join(ROOT, "js/srs.js"));
if (srs.stats().learned >= 1 && srs.dueCards().length >= 1) { pass++; console.log(`  ✓ SRS: learned=${srs.stats().learned}, due=${srs.dueCards().length}`); }
else { fail++; console.log(`  ✗ SRS pipeline (learned=${srs.stats().learned}, due=${srs.dueCards().length})`); }

// 3) review session now renders a card with Show answer → grades
window.location.hash = "#/review";
window.dispatchEvent(new window.Event("hashchange"));
await sleep(700);
const show = [...view.querySelectorAll("button")].find((b) => b.textContent === "Show answer");
show?.click();
await sleep(80);
const grades = view.querySelectorAll(".grades .btn").length;
if (grades === 4) {
  view.querySelectorAll(".grades .btn")[2].click(); // Good
  await sleep(300);
  pass++; console.log("  ✓ review flashcard flow (4 grades, rated Good)");
} else { fail++; console.log(`  ✗ review flashcard flow (grades=${grades})`); }

console.log(`\n${pass} passed, ${fail} failed${errors.length ? `, ${errors.length} captured errors` : ""}`);
if (fail || errors.length) {
  for (const e of errors) console.log("ERR:", e[0], e[1]?.stack || e[1]);
  process.exit(1);
}
process.exit(0);
