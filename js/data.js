// Data layer: kanji index, graph inversion, search, lazy example-word shards.
import { normReading, toKana, hasLatin, isKana, toHiragana, isKanjiChar } from "./kana.js";

export const D = {
  ready: null,
  meta: null,
  kanji: {},     // char → {s,g,j,f,m,on,ku,c,sm}
  order: [],     // learn order
  usedIn: {},    // char → [chars that contain it], sorted by usefulness
  chars: [],     // all chars
};

const wordShards = new Map(); // shardId → Promise<obj>

export function loadData() {
  if (D.ready) return D.ready;
  D.ready = fetch("data/kanji.json")
    .then((r) => {
      if (!r.ok) throw new Error("kanji.json " + r.status);
      return r.json();
    })
    .then((j) => {
      D.meta = j.meta;
      D.kanji = j.kanji;
      D.order = j.order;
      D.chars = Object.keys(j.kanji);
      const inv = {};
      for (const [c, v] of Object.entries(j.kanji)) {
        for (const p of v.c) (inv[p] || (inv[p] = [])).push(c);
      }
      const rank = (c) => {
        const v = j.kanji[c];
        return (v.f || 3000) + (v.j ? 0 : 1500);
      };
      for (const p of Object.keys(inv)) inv[p].sort((a, b) => rank(a) - rank(b));
      D.usedIn = inv;
      // search strings
      for (const [c, v] of Object.entries(j.kanji)) {
        v._m = v.m.join(" ; ").toLowerCase();
        v._r = [...v.on, ...v.ku].map(normReading);
      }
      return D;
    });
  return D.ready;
}

export const K = (c) => D.kanji[c];
export const meaningOf = (c) => (D.kanji[c]?.m[0] || "");
export const usedIn = (c) => D.usedIn[c] || [];

export async function getWords(c) {
  const shard = c.codePointAt(0) % 12;
  if (!wordShards.has(shard)) {
    wordShards.set(
      shard,
      fetch(`data/words/w${shard}.json`).then((r) => (r.ok ? r.json() : {}))
    );
  }
  const obj = await wordShards.get(shard);
  return obj[c] || [];
}

// ---- search -------------------------------------------------------------
export function searchKanji(qRaw, limit = 60) {
  const q = qRaw.trim();
  if (!q) return [];
  const results = [];
  // direct kanji characters
  for (const ch of q) {
    if (isKanjiChar(ch) && D.kanji[ch]) results.push({ c: ch, s: 0 });
  }
  if (results.length) return results.slice(0, limit).map((r) => r.c);

  const qLower = q.toLowerCase();
  const kana = isKana(q) ? toHiragana(q) : hasLatin(q) ? toKana(qLower) : "";
  for (const c of D.chars) {
    const v = D.kanji[c];
    let score = -1;
    if (kana) {
      for (const r of v._r) {
        if (r === kana) { score = Math.max(score, 100); break; }
        if (r.startsWith(kana)) score = Math.max(score, 60 - (r.length - kana.length));
      }
    }
    if (qLower.length >= 2 && v._m.includes(qLower)) {
      const exact =
        v.m.some((m) => m.toLowerCase() === qLower) ? 90 :
        v._m.startsWith(qLower) ? 70 : 40;
      score = Math.max(score, exact);
    }
    if (score >= 0) results.push({ c, s: score + (v.j || 0) * 2 - (v.f || 2600) / 4000 });
  }
  results.sort((a, b) => b.s - a.s);
  return results.slice(0, limit).map((r) => r.c);
}

// ---- level sets ---------------------------------------------------------
export function levelSet(j) {
  return D.chars.filter((c) => D.kanji[c].j === j);
}
export function gradeSet(g) {
  return D.chars.filter((c) => D.kanji[c].g === g);
}
