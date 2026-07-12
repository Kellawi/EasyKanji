#!/usr/bin/env python3
"""
EasyKanji data pipeline.

Builds the site's data files from three open sources:
  1. KANJIDIC2 (via davidluzgouveia/kanji-data)  - readings, meanings, grade, JLPT, frequency
  2. KanjiVG                                     - stroke order SVGs + component decomposition
  3. JMdict (common words, via jmdict-simplified) - example vocabulary

Outputs (relative to repo root):
  data/kanji.json        core index: readings, meanings, meta, component graph, similar kanji, learn order
  data/words/w{N}.json   example words, sharded by codepoint % 12
  data/kanjivg/{hex}.svg cleaned stroke-order SVGs for every kanji in the set

Usage:
  python3 tools/build_data.py --cache /path/to/cache
The cache dir must contain: kanji-data.json, jmdict-common.zip (or .json), kanjivg-master/kanji/*.svg
Run tools/fetch_sources.sh first to populate the cache.

Licences of the generated data: CC BY-SA (see ATTRIBUTION.md).
"""
import argparse, json, os, re, sys, zipfile, heapq, unicodedata
import xml.etree.ElementTree as ET
from collections import defaultdict

KVG_NS = "{http://kanjivg.tagaini.net}"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Well-known visually confusable pairs, force-included in "similar".
CONFUSABLES = [
    "土士", "千干", "牛午", "未末", "人入", "木本", "大太", "大犬", "王玉", "白百",
    "目自", "田由", "田甲", "由甲", "貝見", "天夫", "矢失", "刀力", "九丸", "万方",
    "島鳥", "持特", "待侍", "拾捨", "眠眼", "材村", "復複", "績積", "講構", "権観",
    "勧歓", "緑縁", "微徴", "概慨", "冶治", "石右", "名各", "休体", "問間", "干于",
    "士仕", "小少", "考老", "科料", "俳排", "遣遺", "職識", "織識", "測側", "億憶",
    "日目", "綱網", "幸辛", "貧貪", "陽場", "湯場", "防妨", "紛粉", "侯候", "壊懐",
]

def hira_to_kata(s):
    return "".join(chr(ord(c) + 0x60) if "ぁ" <= c <= "ゖ" else c for c in s)

def is_kanji(c):
    return "\u4e00" <= c <= "\u9fff" or "\u3400" <= c <= "\u4dbf"

def load_kanjidic(cache):
    raw = json.load(open(os.path.join(cache, "kanji-data.json"), encoding="utf-8"))
    sel = {}
    for ch, v in raw.items():
        g = v.get("grade")
        j = v.get("jlpt_new")
        if (g is not None and g <= 8) or j:
            sel[ch] = {
                "s": v.get("strokes") or 0,
                "g": g or 0,
                "j": j or 0,
                "f": v.get("freq") or 0,
                "m": v.get("meanings") or [],
                "on": [hira_to_kata(r) for r in (v.get("readings_on") or [])],
                "ku": v.get("readings_kun") or [],
            }
    return sel

# ---------------- KanjiVG parsing ----------------

def parse_svg(path):
    """Return (direct_element_tree_root, stroke_type_seq, cleaned_svg_text)."""
    text = open(path, encoding="utf-8").read()
    body = re.sub(r"<!--.*?-->", "", text, flags=re.S)
    body = re.sub(r"<!DOCTYPE.*?\]>", "", body, flags=re.S)
    if "xmlns:kvg" not in body:
        body = body.replace("<svg ", '<svg xmlns:kvg="http://kanjivg.tagaini.net" ', 1)
    root = ET.fromstring(body)
    # cleaned output: drop width/height for responsive scaling, add short credit
    out = re.sub(r'(<svg[^>]*?)\s+width="\d+"\s+height="\d+"', r"\1", body, count=1)
    out = out.replace("<?xml version=\"1.0\" encoding=\"UTF-8\"?>", "").strip()
    out = "<!-- KanjiVG (kanjivg.tagaini.net), CC BY-SA 3.0 -->\n" + out
    seq = []
    for p in root.iter("{http://www.w3.org/2000/svg}path"):
        t = p.get(KVG_NS + "type") or "?"
        seq.append(t[0])
    return root, "".join(seq), out

def element_of(g, universe):
    """Effective element of a group: prefer kvg:original (radical variants map to base kanji)."""
    el = g.get(KVG_NS + "element")
    if el and el in universe:
        return el
    orig = g.get(KVG_NS + "original")
    if orig and orig in universe:
        return orig
    return el

def walk_components(g, universe, self_char, direct, allset, depth=0):
    """Collect in-set direct components (stop descent when found) and all nested elements."""
    for child in list(g):
        if not child.tag.endswith("}g"):
            continue
        el = element_of(child, universe)
        raw = child.get(KVG_NS + "element") or child.get(KVG_NS + "original")
        if raw:
            allset.add(raw)
            o = child.get(KVG_NS + "original")
            if o:
                allset.add(o)
        if el and el in universe and el != self_char:
            direct.append(el)
            # still record nested elements for the similarity signature
            collect_all(child, allset)
        else:
            walk_components(child, universe, self_char, direct, allset, depth + 1)

def collect_all(g, allset):
    for child in g.iter():
        if child.tag.endswith("}g"):
            for key in ("element", "original"):
                v = child.get(KVG_NS + key)
                if v:
                    allset.add(v)

def banded_lev(a, b, band=3):
    la, lb = len(a), len(b)
    if abs(la - lb) > band:
        return band + 1
    prev = list(range(lb + 1))
    for i in range(1, la + 1):
        cur = [i] + [0] * lb
        lo, hi = max(1, i - band), min(lb, i + band)
        if lo > 1:
            cur[lo - 1] = band + 1
        for j in range(lo, hi + 1):
            cur[j] = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] != b[j - 1]))
        if hi < lb:
            cur[hi + 1:] = [band + 1] * (lb - hi)
        prev = cur
    return prev[lb]

# ---------------- JMdict examples ----------------

def load_jmdict(cache):
    zp = os.path.join(cache, "jmdict-common.zip")
    if os.path.exists(zp):
        z = zipfile.ZipFile(zp)
        return json.loads(z.read(z.namelist()[0]))
    return json.load(open(os.path.join(cache, "jmdict-common.json"), encoding="utf-8"))

def build_examples(jm, universe):
    per = defaultdict(list)
    for w in jm["words"]:
        if not w["kanji"]:
            continue
        kf = next((k for k in w["kanji"] if k["common"]), w["kanji"][0])
        text = kf["text"]
        if len(text) > 6 or "ateji" in kf.get("tags", []):
            continue
        kana = None
        for ka in w["kana"]:
            ap = ka.get("appliesToKanji", ["*"])
            if "*" in ap or text in ap:
                kana = ka["text"]
                if ka["common"]:
                    break
        if not kana:
            continue
        sense = w["sense"][0]
        gloss = "; ".join(g["text"] for g in sense["gloss"][:3] if g.get("lang") in (None, "eng"))
        if len(gloss) > 78:
            gloss = gloss[:75] + "…"
        kcount = sum(1 for c in text if is_kanji(c))
        item = (text, kana, gloss, kf["common"], kcount)
        for c in set(text):
            if c in universe:
                per[c].append(item)
    out = {}
    for c, items in per.items():
        seen, solo, comp = set(), [], []
        items.sort(key=lambda t: (not t[3], len(t[0]), t[1]))
        for t in items:
            if t[0] in seen:
                continue
            seen.add(t[0])
            (solo if t[4] == 1 else comp).append(t)
        pick = solo[:2] + comp[:6]
        pick = pick[:7]
        out[c] = [[t[0], t[1], t[2]] for t in pick]
    return out

# ---------------- learn order ----------------

def learn_order(chars, info, comps):
    def prio(c):
        v = info[c]
        return (-v["j"], v["g"] or 9, v["f"] or 9999, v["s"], c)
    indeg = {c: 0 for c in chars}
    dependents = defaultdict(list)
    for c in chars:
        deps = [d for d in comps[c] if d != c]
        indeg[c] = len(deps)
        for d in deps:
            dependents[d].append(c)
    heap = [(prio(c), c) for c in chars if indeg[c] == 0]
    heapq.heapify(heap)
    order, done = [], set()
    while heap:
        _, c = heapq.heappop(heap)
        if c in done:
            continue
        done.add(c)
        order.append(c)
        for d in dependents[c]:
            indeg[d] -= 1
            if indeg[d] == 0:
                heapq.heappush(heap, (prio(d), d))
    for c in chars:  # safety: cycles (shouldn't happen)
        if c not in done:
            order.append(c)
    return order

# ---------------- main ----------------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", default=os.path.expanduser("~/cache"))
    args = ap.parse_args()
    cache = args.cache

    print("Loading KANJIDIC…")
    info = load_kanjidic(cache)
    universe = set(info)
    print(f"  {len(universe)} kanji selected (jōyō + JLPT)")

    print("Parsing KanjiVG…")
    comps, sigs, seqs = {}, {}, {}
    outdir = os.path.join(ROOT, "data", "kanjivg")
    os.makedirs(outdir, exist_ok=True)
    for ch in universe:
        path = os.path.join(cache, "kanjivg-master", "kanji", f"{ord(ch):05x}.svg")
        root, seq, cleaned = parse_svg(path)
        with open(os.path.join(outdir, f"{ord(ch):05x}.svg"), "w", encoding="utf-8") as f:
            f.write(cleaned)
        # root char group = first g with kvg:element inside StrokePaths
        strokes_g = root[0]
        char_g = next(g for g in strokes_g if g.tag.endswith("}g"))
        direct, allset = [], set()
        walk_components(char_g, universe, ch, direct, allset)
        seen = set()
        comps[ch] = [c for c in direct if not (c in seen or seen.add(c))]
        allset.discard(ch)
        sigs[ch] = allset
        seqs[ch] = seq

    # flatten in-set containment (for similar-exclusion)
    def flat(ch, acc=None, depth=0):
        if acc is None:
            acc = set()
        if depth > 8:
            return acc
        for c in comps[ch]:
            if c not in acc:
                acc.add(c)
                flat(c, acc, depth + 1)
        return acc
    flats = {c: flat(c) for c in universe}

    print("Computing similarity graph…")
    inv = defaultdict(set)
    for c, s in sigs.items():
        for e in s:
            inv[e].add(c)
    cand = defaultdict(set)
    for e, group in inv.items():
        if len(group) > 400:
            continue
        gl = sorted(group)
        for i, a in enumerate(gl):
            for b in gl[i + 1:]:
                cand[a].add(b)
    by_strokes = defaultdict(list)
    for c in universe:
        by_strokes[len(seqs[c])].append(c)
    for n, group in by_strokes.items():
        if n > 12:
            continue
        pool = group + by_strokes.get(n + 1, [])
        for i, a in enumerate(group):
            for b in pool:
                if a < b:
                    cand[a].add(b)

    scores = defaultdict(dict)
    for a, bs in cand.items():
        sa, qa = sigs[a], seqs[a]
        for b in bs:
            if b in flats[a] or a in flats[b]:
                continue
            sb, qb = sigs[b], seqs[b]
            un = len(sa | sb)
            jac = (len(sa & sb) / un) if un else 0.0
            seqsim = 0.0
            if abs(len(qa) - len(qb)) <= 2 and max(len(qa), len(qb)) <= 14:
                d = banded_lev(qa, qb)
                if d <= 3:
                    seqsim = 1 - d / max(len(qa), len(qb), 1)
            ml = max(len(qa), len(qb))
            wseq = 0.78 if ml <= 4 else (0.6 if ml <= 7 else 0.5)
            sc = 0.62 * jac + wseq * seqsim
            if sc >= 0.45:
                scores[a][b] = sc
                scores[b][a] = sc
    for pair in CONFUSABLES:
        a, b = pair[0], pair[1]
        if a in universe and b in universe:
            scores[a][b] = max(scores[a].get(b, 0), 0.99)
            scores[b][a] = scores[a][b]
    similar = {c: [b for b, _ in sorted(scores[c].items(), key=lambda kv: -kv[1])[:8]] for c in universe}

    print("Building examples from JMdict…")
    jm = load_jmdict(cache)
    examples = build_examples(jm, universe)
    covered = sum(1 for c in universe if examples.get(c))
    print(f"  {covered}/{len(universe)} kanji have example words")

    print("Computing learn order…")
    order = learn_order(sorted(universe), info, comps)

    print("Writing data files…")
    kanji = {}
    for c in sorted(universe):
        v = dict(info[c])
        v["c"] = comps[c]
        v["sm"] = similar.get(c, [])
        kanji[c] = v
    payload = {
        "meta": {
            "count": len(kanji),
            "built": __import__("datetime").date.today().isoformat(),
            "sources": ["KANJIDIC2 (EDRDG, CC BY-SA 4.0)", "KanjiVG (Ulrich Apel, CC BY-SA 3.0)", "JMdict (EDRDG, CC BY-SA 4.0)"],
        },
        "order": order,
        "kanji": kanji,
    }
    os.makedirs(os.path.join(ROOT, "data", "words"), exist_ok=True)
    with open(os.path.join(ROOT, "data", "kanji.json"), "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    shards = defaultdict(dict)
    for c, words in examples.items():
        shards[ord(c) % 12][c] = words
    for n in range(12):
        with open(os.path.join(ROOT, "data", "words", f"w{n}.json"), "w", encoding="utf-8") as f:
            json.dump(shards.get(n, {}), f, ensure_ascii=False, separators=(",", ":"))
    total = os.path.getsize(os.path.join(ROOT, "data", "kanji.json"))
    print(f"  data/kanji.json = {total/1024:.0f} KB")
    print("Done.")

if __name__ == "__main__":
    main()
