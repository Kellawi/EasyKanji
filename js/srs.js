// Lightweight SM-2-style spaced repetition, persisted in localStorage.
const KEY = "ek.srs.v1";
const LEARNED = "ek.learned.v1";
const STREAK = "ek.streak.v1";
const DAY = 86400000;

const load = (k, d) => {
  try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; }
};
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

let cards = load(KEY, {});
let learned = new Set(load(LEARNED, []));

export const GRADES = ["Again", "Hard", "Good", "Easy"];

export function card(c) { return cards[c] || null; }
export function inSrs(c) { return !!cards[c]; }
export function isLearned(c) { return learned.has(c); }

export function addCard(c) {
  if (!cards[c]) {
    cards[c] = { ivl: 0, ef: 2.5, due: Date.now(), reps: 0, lapses: 0, st: "new" };
    save(KEY, cards);
    emit();
  }
}
export function removeCard(c) { delete cards[c]; save(KEY, cards); emit(); }

export function markLearned(c, on = true) {
  on ? learned.add(c) : learned.delete(c);
  save(LEARNED, [...learned]);
  if (on) addCard(c);
  emit();
}

export function rate(c, g) { // g: 0 again 1 hard 2 good 3 easy
  const k = cards[c] || (cards[c] = { ivl: 0, ef: 2.5, due: 0, reps: 0, lapses: 0, st: "new" });
  const now = Date.now();
  if (g === 0) {
    k.lapses += k.st === "rev" ? 1 : 0;
    k.ef = Math.max(1.3, k.ef - 0.2);
    k.ivl = 0; k.st = "learn";
    k.due = now + 10 * 60000;
  } else if (k.st !== "rev" || k.ivl < 1) {
    k.ivl = g === 3 ? 3 : g === 2 ? 1 : 0.5;
    k.st = "rev";
    k.due = now + k.ivl * DAY;
  } else {
    if (g === 1) { k.ivl *= 1.2; k.ef = Math.max(1.3, k.ef - 0.05); }
    if (g === 2) { k.ivl *= k.ef; }
    if (g === 3) { k.ivl *= k.ef * 1.4; k.ef += 0.05; }
    k.ivl = Math.min(365, Math.round(k.ivl * 10) / 10);
    k.due = now + k.ivl * DAY;
  }
  k.reps++;
  learned.add(c);
  save(KEY, cards); save(LEARNED, [...learned]);
  bumpStreak();
  emit();
}

export function previewIvl(c, g) {
  const k = cards[c] || { ivl: 0, ef: 2.5, st: "new" };
  if (g === 0) return "10m";
  let d;
  if (k.st !== "rev" || k.ivl < 1) d = g === 3 ? 3 : g === 2 ? 1 : 0.5;
  else d = g === 1 ? k.ivl * 1.2 : g === 2 ? k.ivl * k.ef : k.ivl * k.ef * 1.4;
  return d < 1 ? Math.round(d * 24) + "h" : Math.round(d) + "d";
}

export function dueCards(now = Date.now()) {
  return Object.entries(cards)
    .filter(([, k]) => k.due <= now)
    .sort((a, b) => a[1].due - b[1].due)
    .map(([c]) => c);
}
export function nextDue() {
  const t = Object.values(cards).map((k) => k.due).filter((d) => d > Date.now());
  return t.length ? Math.min(...t) : null;
}
export function stats() {
  const due = dueCards().length;
  return { due, total: Object.keys(cards).length, learned: learned.size, streak: streak().n };
}

function today() { return new Date().toISOString().slice(0, 10); }
export function streak() { return load(STREAK, { last: "", n: 0 }); }
function bumpStreak() {
  const s = streak();
  const t = today();
  if (s.last === t) return;
  const y = new Date(Date.now() - DAY).toISOString().slice(0, 10);
  s.n = s.last === y ? s.n + 1 : 1;
  s.last = t;
  save(STREAK, s);
}

// backup
export function exportBackup() {
  return JSON.stringify({ v: 1, cards, learned: [...learned], streak: streak() }, null, 1);
}
export function importBackup(text) {
  const j = JSON.parse(text);
  if (!j || j.v !== 1 || typeof j.cards !== "object") throw new Error("Not an EasyKanji backup file");
  cards = j.cards;
  learned = new Set(j.learned || []);
  save(KEY, cards); save(LEARNED, [...learned]);
  if (j.streak) save(STREAK, j.streak);
  emit();
}

// change events (nav badge etc.)
const bus = new EventTarget();
export const onChange = (fn) => bus.addEventListener("change", fn);
function emit() { bus.dispatchEvent(new Event("change")); }
