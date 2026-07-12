// Kana ⇄ romaji utilities (Hepburn-ish, tuned for dictionary readings + search).

export function toHiragana(s) {
  let out = "";
  for (const c of s) {
    const o = c.codePointAt(0);
    out += o >= 0x30a1 && o <= 0x30f6 ? String.fromCodePoint(o - 0x60) : c;
  }
  return out;
}
export function toKatakana(s) {
  let out = "";
  for (const c of s) {
    const o = c.codePointAt(0);
    out += o >= 0x3041 && o <= 0x3096 ? String.fromCodePoint(o + 0x60) : c;
  }
  return out;
}

const BASE = {
  あ:"a",い:"i",う:"u",え:"e",お:"o",か:"ka",き:"ki",く:"ku",け:"ke",こ:"ko",
  さ:"sa",し:"shi",す:"su",せ:"se",そ:"so",た:"ta",ち:"chi",つ:"tsu",て:"te",と:"to",
  な:"na",に:"ni",ぬ:"nu",ね:"ne",の:"no",は:"ha",ひ:"hi",ふ:"fu",へ:"he",ほ:"ho",
  ま:"ma",み:"mi",む:"mu",め:"me",も:"mo",や:"ya",ゆ:"yu",よ:"yo",
  ら:"ra",り:"ri",る:"ru",れ:"re",ろ:"ro",わ:"wa",ゐ:"i",ゑ:"e",を:"o",ん:"n",
  が:"ga",ぎ:"gi",ぐ:"gu",げ:"ge",ご:"go",ざ:"za",じ:"ji",ず:"zu",ぜ:"ze",ぞ:"zo",
  だ:"da",ぢ:"ji",づ:"zu",で:"de",ど:"do",ば:"ba",び:"bi",ぶ:"bu",べ:"be",ぼ:"bo",
  ぱ:"pa",ぴ:"pi",ぷ:"pu",ぺ:"pe",ぽ:"po",ぁ:"a",ぃ:"i",ぅ:"u",ぇ:"e",ぉ:"o",
  ゃ:"ya",ゅ:"yu",ょ:"yo",ゔ:"vu",ゎ:"wa",
};
const DIGRAPH = {
  きゃ:"kya",きゅ:"kyu",きょ:"kyo",しゃ:"sha",しゅ:"shu",しょ:"sho",
  ちゃ:"cha",ちゅ:"chu",ちょ:"cho",にゃ:"nya",にゅ:"nyu",にょ:"nyo",
  ひゃ:"hya",ひゅ:"hyu",ひょ:"hyo",みゃ:"mya",みゅ:"myu",みょ:"myo",
  りゃ:"rya",りゅ:"ryu",りょ:"ryo",ぎゃ:"gya",ぎゅ:"gyu",ぎょ:"gyo",
  じゃ:"ja",じゅ:"ju",じょ:"jo",ぢゃ:"ja",ぢゅ:"ju",ぢょ:"jo",
  びゃ:"bya",びゅ:"byu",びょ:"byo",ぴゃ:"pya",ぴゅ:"pyu",ぴょ:"pyo",
  てぃ:"ti",でぃ:"di",ふぁ:"fa",ふぃ:"fi",ふぇ:"fe",ふぉ:"fo",
  うぃ:"wi",うぇ:"we",うぉ:"wo",しぇ:"she",ちぇ:"che",じぇ:"je",
};
const VOWELS = "aiueo";

// kana (hiragana or katakana) → romaji. Keeps '.', '-', '〜' markers.
export function romaji(kana) {
  const s = toHiragana(kana);
  let out = "";
  let i = 0;
  while (i < s.length) {
    const two = s.slice(i, i + 2);
    const c = s[i];
    if (c === "っ") {
      const nxt = DIGRAPH[s.slice(i + 1, i + 3)] || BASE[s[i + 1]] || "";
      out += nxt.startsWith("ch") ? "t" : nxt[0] && !VOWELS.includes(nxt[0]) ? nxt[0] : "";
      i++; continue;
    }
    if (c === "ー") {
      const last = out.replace(/[^aiueo]+$/g, "").slice(-1);
      out += last || "";
      i++; continue;
    }
    if (DIGRAPH[two]) { out += DIGRAPH[two]; i += 2; continue; }
    if (BASE[c]) { out += BASE[c]; i++; continue; }
    out += c; i++;
  }
  return out;
}

// romaji → hiragana, for search input. Best effort.
const R2K = (() => {
  const t = {};
  for (const [k, v] of Object.entries(BASE)) if (!(v in t)) t[v] = k;
  for (const [k, v] of Object.entries(DIGRAPH)) if (!(v in t)) t[v] = k;
  Object.assign(t, {
    si:"し", ti:"ち", tu:"つ", hu:"ふ", zi:"じ", di:"ぢ", du:"づ",
    fu:"ふ", vu:"ゔ", wo:"を", nn:"ん",
    kyi:"きぃ", sya:"しゃ", syu:"しゅ", syo:"しょ", tya:"ちゃ", tyu:"ちゅ", tyo:"ちょ",
    jya:"じゃ", jyu:"じゅ", jyo:"じょ", zya:"じゃ", zyu:"じゅ", zyo:"じょ",
  });
  return t;
})();

export function toKana(rom) {
  const s = rom.toLowerCase().replace(/[^a-z'-]/g, "");
  let out = "";
  let i = 0;
  while (i < s.length) {
    const a = s[i], b = s[i + 1];
    if (a === "n" && (i + 1 === s.length || !"aiueoyn'".includes(b))) { out += "ん"; i++; continue; }
    if (a === "'") { i++; continue; }
    if (a === b && !"aiueon".includes(a)) { out += "っ"; i++; continue; }
    let hit = null, len = 0;
    for (const L of [3, 2, 1]) {
      const chunk = s.slice(i, i + L);
      if (R2K[chunk]) { hit = R2K[chunk]; len = L; break; }
    }
    if (hit) { out += hit; i += len; } else { out += a; i++; }
  }
  return out;
}

export const isKana = (s) => /^[\u3040-\u30ffー]+$/.test(s);
export const hasLatin = (s) => /[a-zA-Z]/.test(s);
export const isKanjiChar = (c) =>
  (c >= "\u4e00" && c <= "\u9fff") || (c >= "\u3400" && c <= "\u4dbf");

// Normalise a KANJIDIC reading for matching: strip okurigana dot, affix dashes.
export const normReading = (r) => toHiragana(r).replace(/[.\-〜]/g, "");
