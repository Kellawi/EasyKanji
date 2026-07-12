// KanjiVG loading + the self-writing stroke player.
const svgCache = new Map();
const parser = new DOMParser();

export async function fetchKvg(ch) {
  const hex = ch.codePointAt(0).toString(16).padStart(5, "0");
  if (!svgCache.has(hex)) {
    svgCache.set(
      hex,
      fetch(`data/kanjivg/${hex}.svg`).then((r) => {
        if (!r.ok) throw new Error("kanjivg " + r.status);
        return r.text();
      })
    );
  }
  return svgCache.get(hex);
}

function build(text) {
  const doc = parser.parseFromString(text, "image/svg+xml");
  const svg = document.importNode(doc.documentElement, true);
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  svg.classList.add("kvg");
  const groups = [...svg.children].filter((n) => n.tagName === "g");
  const strokesG = groups.find((g) => (g.id || "").includes("StrokePaths"));
  const numsG = groups.find((g) => (g.id || "").includes("StrokeNumbers"));
  if (strokesG) strokesG.removeAttribute("style");
  if (numsG) { numsG.removeAttribute("style"); numsG.classList.add("nums"); }
  const paths = [...svg.querySelectorAll("path")];
  // tag components (direct children groups carrying an element) for colouring
  const root = strokesG && [...strokesG.children].find((n) => n.tagName === "g");
  if (root) {
    let idx = 0;
    const mark = (g) => {
      for (const child of g.children) {
        if (child.tagName !== "g") continue;
        if (child.getAttribute("kvg:element")) {
          child.dataset.kc = idx++ % 5;
        } else mark(child);
      }
    };
    mark(root);
    if (idx === 0) root.dataset.kc = 0;
  }
  return { svg, paths, numsG };
}

/**
 * Mount a kanji into `container`.
 * opts: { autoplay, speed, controls:false, static:false, onDone }
 * Returns a controller { el, replay, setNumbers, setColors, strokeCount, destroy }.
 */
export async function mountKvg(container, ch, opts = {}) {
  const text = await fetchKvg(ch);
  const { svg, paths } = build(text);
  container.innerHTML = "";
  container.appendChild(svg);

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lens = [];
  let cancelled = false;
  let playing = false;
  let speed = opts.speed || 1;

  const prep = () => {
    for (const p of paths) lens.push(p.getTotalLength());
  };
  const showAll = () => {
    paths.forEach((p) => { p.style.strokeDasharray = "none"; p.style.strokeDashoffset = "0"; p.style.opacity = "1"; });
  };
  const hideAll = () => {
    paths.forEach((p, i) => {
      p.style.strokeDasharray = lens[i];
      p.style.strokeDashoffset = lens[i];
      p.style.opacity = "1";
    });
  };
  prep();

  async function play() {
    if (playing) return;
    playing = true;
    hideAll();
    for (let i = 0; i < paths.length; i++) {
      if (cancelled || !playing) break;
      const p = paths[i];
      p.classList.add("writing");
      const dur = Math.max(240, (lens[i] * 11) / speed);
      const anim = p.animate(
        [{ strokeDashoffset: lens[i] }, { strokeDashoffset: 0 }],
        { duration: dur, easing: "ease-in-out", fill: "forwards" }
      );
      try { await anim.finished; } catch { /* cancelled */ }
      p.style.strokeDashoffset = "0";
      p.classList.remove("writing");
      await new Promise((r) => setTimeout(r, 90 / speed));
    }
    playing = false;
    if (!cancelled) opts.onDone?.();
  }

  if (opts.static || reduced) showAll();
  else if (opts.autoplay !== false) requestAnimationFrame(() => play());
  else showAll();

  return {
    el: svg,
    strokeCount: paths.length,
    replay() { playing = false; paths.forEach((p) => p.getAnimations().forEach((a) => a.cancel())); play(); },
    setSpeed(s) { speed = s; },
    setNumbers(on) { svg.classList.toggle("shownums", on); },
    setColors(on) { svg.classList.toggle("colored", on); },
    destroy() { cancelled = true; playing = false; },
  };
}

/** Data for the practice pad: normalised reference strokes in 109×109 space. */
export async function strokeData(ch) {
  const text = await fetchKvg(ch);
  const { svg, paths } = build(text);
  svg.style.position = "absolute";
  svg.style.width = "10px"; svg.style.height = "10px";
  svg.style.opacity = "0"; svg.style.pointerEvents = "none";
  document.body.appendChild(svg);
  const strokes = paths.map((p) => {
    const L = p.getTotalLength();
    const n = Math.max(16, Math.min(40, Math.round(L / 4)));
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const pt = p.getPointAtLength((L * i) / n);
      pts.push([pt.x, pt.y]);
    }
    return { d: p.getAttribute("d"), pts, len: L };
  });
  svg.remove();
  return strokes;
}
