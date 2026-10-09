// Every helper lives inside scanDocument on purpose: the function must be
// self-contained for scripting.executeScript. So this rule is off here.
// oxlint-disable unicorn/consistent-function-scoping
import type { Block, Finding, FindingKind, ScanOptions, ScanReport } from "./types.js";

/**
 * Scans a document for text that a person cannot see but an agent reads, and
 * for text that looks like instructions to an agent.
 *
 * The function is self-contained: it uses no names from outside its body. So
 * an extension can run it in a tab with
 * `scripting.executeScript({ func: scanDocument, args: [options] })`.
 * Called with no document, it scans the global `document`.
 */
export function scanDocument(target?: Document | ScanOptions, maybeOptions?: ScanOptions): ScanReport {
  const isDoc = (v: unknown): v is Document => !!v && (v as Node).nodeType === 9;
  const doc: Document = isDoc(target) ? target : document;
  const options: ScanOptions = (isDoc(target) ? maybeOptions : target) ?? {};
  const maxNodes = options.maxNodes ?? 50000;
  const maxMs = options.maxMs ?? 3000;
  const now = () => (typeof performance === "undefined" ? Date.now() : performance.now());
  const started = now();
  const view = doc.defaultView;
  const live = options.mode ? options.mode === "live"
    : !!view && typeof view.getComputedStyle === "function" && typeof doc.documentElement?.getClientRects === "function";
  const findings: Finding[] = [];
  const blocks: Block[] = [];
  let nodes = 0;
  let truncated = false;
  let skippedFrames = 0;

  // ---- Text rules -------------------------------------------------------
  const VISIBLE_MIN = 0.3;
  const RULES: [string, RegExp, number][] = [
    ["ignore-previous", /\b(ignore|disregard|forget|override|skip)\b[^.!?\n]{0,40}?\b(previous|prior|above|earlier|preceding|any|your|other|original|system)\b[^.!?\n]{0,30}?\b(instructions?|prompts?|rules|directions|guidelines|context)\b/i, 0.9],
    ["system-lookalike", /\[\s*(system|developer|admin)\b[^\]\n]{0,60}\]|<\|?\s*(system|im_start|im_end|endoftext)\s*\|?>|^\s*#{1,3}\s*(system|instructions?)\b|\b(system|developer)\s+(message|prompt|note|instruction)s?\b|\[\/?INST\]/im, 0.6],
    ["addressed-to-ai", /\b(note|message|instructions?|attention|notice|reminder|directive)s?\s+(for|to)\s+(the\s+|all\s+|any\s+)?(AI|LLM|automated|autonomous|virtual|language[- ]model)\b|\b(to|dear|hey|attention)\s*:?\s+(the\s+)?(AI|LLM)\s+(\w+\s+)?(assistants?|agents?|models?|bots?)\b|\bif you are an?\s+(AI|LLM|language model|automated|bot|assistant|agent)\b|\b(AI|LLM)\s+(\w+\s+)?(assistants?|agents?)\s+(must|should|need to|are required to)\b/i, 0.5],
    ["secrecy", /\b(do not|don'?t|never|without)\s+(tell(ing)?|mention(ing)?|inform(ing)?|reveal(ing)?|show(ing)?|ask(ing)?|notify(ing)?|alert(ing)?)\b[^.!?\n]{0,40}?\b(user|customer|human|owner|person|them)\b/i, 0.4],
    ["false-consent", /\b(user|customer|owner|client)s?\b[^.!?\n]{0,25}?\b(already|has|have|previously)\s+(approved|agreed|authori[sz]ed|consented|confirmed|allowed)\b|\bthey (have )?already (agreed|approved|consented)\b|\bstanding order\b/i, 0.4],
    ["override", /\b(priority override|before you do anything else|new instructions|updated instructions|instead of (the|what) (user|address|customer|person)|from now on,? you|you are now (in|an?|the)\b|developer mode|admin mode)/i, 0.3],
    ["exfiltrate", /\b(send|forward|email|e-mail|mail|post|upload|submit|copy|paste|share|transfer|leak|add|append)\b[^.!?\n]{0,80}?\b(to|into|at|with)\s+(\S+@[\w-]+(\.[\w-]+)+|https?:\/\/\S+)/i, 0.35],
    ["inject-value", /\b(type|enter|put|write|fill in|use)\s+\S+@[\w-]+(\.[\w-]+)+\s+(in|into|as)\b/i, 0.35],
    ["credentials", /\b(passwords?|passcodes?|api[- ]?keys?|access tokens?|credit card|card numbers?|cvv|one[- ]time (code|password)|seed phrase|private key)\b/i, 0.15],
    ["tool-call", /<\/?\s*(tool_call|function_call|tool_use|invoke|function_calls)\b|"(name|tool|function)"\s*:\s*"[\w.-]+"\s*,\s*"(arguments|args|parameters|input)"\s*:|\b(call|use|run|invoke)\s+the\s+[\w-]+\s+(tool|function)\b/i, 0.5],
  ];
  const ZERO_WIDTH = /[​⁠᠎]|(?!^)﻿|[‌‍]{2,}|[\u{E0000}-\u{E007F}]/u;
  const ALL_INVISIBLE = /[​-‍⁠᠎﻿]/g;
  const TAG_CHARS = /[\u{E0000}-\u{E007F}]/gu;
  const BIDI = /[‪-‮⁦-⁩]/;
  const BIDI_ALL = /[‪-‮⁦-⁩]/g;
  const CONFUSABLE: Record<string, string> = {
    "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "у": "y", "х": "x", "і": "i", "ј": "j", "ѕ": "s", "ԁ": "d", "һ": "h", "ӏ": "l",
    "А": "A", "В": "B", "Е": "E", "К": "K", "М": "M", "Н": "H", "О": "O", "Р": "P", "С": "C", "Т": "T", "Х": "X", "У": "Y",
    "α": "a", "ο": "o", "ε": "e", "ι": "i", "κ": "k", "ν": "v", "ρ": "p", "τ": "t", "υ": "u", "χ": "x",
    "Α": "A", "Β": "B", "Ε": "E", "Ζ": "Z", "Η": "H", "Ι": "I", "Κ": "K", "Μ": "M", "Ν": "N", "Ο": "O", "Ρ": "P", "Τ": "T", "Υ": "Y", "Χ": "X",
  };
  const MIXED_WORD = /\p{L}*(?:[A-Za-z]\p{L}*[Ͱ-ϿЀ-ӿ]|[Ͱ-ϿЀ-ӿ]\p{L}*[A-Za-z])\p{L}*/u;

  const combine = (...ps: number[]) => 1 - ps.reduce((left, p) => left * (1 - p), 1);
  const round = (n: number) => Math.round(n * 100) / 100;
  const cut = (text: string) => (text.length > 500 ? `${text.slice(0, 497)}...` : text);
  const squash = (text: string) => text.replace(/\s+/g, " ").trim();
  /** Decodes tag characters, drops other invisible characters, and maps look-alike letters to Latin. */
  const clean = (text: string) => text
    .replace(TAG_CHARS, (c) => { const n = (c.codePointAt(0) ?? 0) - 0xe0000; return n >= 0x20 && n < 0x7f ? String.fromCharCode(n) : ""; })
    .replace(ALL_INVISIBLE, "").replace(BIDI_ALL, "")
    .replace(/[Ͱ-ϿЀ-ӿ]/g, (c) => CONFUSABLE[c] ?? c);
  const rules = (text: string) => {
    const hits = RULES.filter(([, re]) => re.test(text));
    return { score: combine(...hits.map(([, , w]) => w)), names: hits.map(([name]) => name) };
  };
  const best = (a: { score: number; names: string[] }, b: { score: number; names: string[] }) => (b.score > a.score ? b : a);
  const add = (kind: FindingKind, text: string, selector: string, reason: string[], score: number) => {
    findings.push({ kind, text: cut(squash(text)), selector, reason: reason.join(", "), score: round(score) });
  };

  /** Checks one run of visible text, adds its findings, and returns its block. */
  function checkVisible(raw: string, spaced: string, selector: string): Block {
    const text = squash(raw);
    const block: Block = { selector, text };
    const plain = clean(raw);
    const r = best(rules(plain), rules(clean(spaced)));
    if (ZERO_WIDTH.test(raw)) {
      const tags = raw.match(TAG_CHARS) ? squash(clean((raw.match(TAG_CHARS) ?? []).join(""))) : "";
      const inner = rules(tags || plain);
      add("invisible-chars", tags || text, selector, ["zero-width or tag characters", ...inner.names], combine(0.3, inner.score));
    }
    if (BIDI.test(raw)) add("bidi", text, selector, ["bidi control characters", ...r.names], combine(0.3, r.score));
    const mixed = raw.replace(ALL_INVISIBLE, "").match(MIXED_WORD);
    if (mixed) add("homoglyph", text, selector, [`look-alike letters in "${mixed[0]}"`, ...r.names], combine(0.35, r.score));
    if (r.score >= VISIBLE_MIN) {
      add("instruction", plain, selector, r.names, r.score);
      block.score = round(r.score);
      block.reason = r.names.join(", ");
    }
    return block;
  }

  // ---- Selectors ----------------------------------------------------------
  const SIMPLE_ID = /^[A-Za-z][\w-]*$/;
  /** Each visited element's `name:nth-of-type(n)`, counted during the walk so long sibling lists stay fast. */
  const partOf = new WeakMap<Element, string>();
  function selectorOf(el: Element, prefix: string): string {
    const root = el.getRootNode() as Document | ShadowRoot;
    const parts: string[] = [];
    let e: Element | null = el;
    while (e && e.nodeType === 1) {
      if (e.id && SIMPLE_ID.test(e.id) && typeof root.getElementById === "function" && root.getElementById(e.id) === e) {
        parts.unshift(`#${e.id}`);
        break;
      }
      if (e.localName === "body") { parts.unshift("body"); break; }
      const parent: Element | null = e.parentElement;
      let part = partOf.get(e);
      if (!part) {
        let index = 1;
        for (let s = e.previousElementSibling; s; s = s.previousElementSibling) if (s.localName === e.localName) index += 1;
        part = `${e.localName}:nth-of-type(${index})`;
      }
      parts.unshift(part);
      e = parent;
    }
    return prefix + parts.join(" > ");
  }

  // ---- Styles -------------------------------------------------------------
  type RGBA = [number, number, number, number];
  /** What the walk carries down: inherited style and the hiding state of the parent. */
  type Ctx = { prefix: string; vis: string; font: number; color: RGBA | null; bg: RGBA | null; opacity: number; aria: Element | null };
  type Look = { display: string; vis: string; opacity: number; font: number; color: RGBA | null; bg: RGBA | null; offscreen: boolean; clipped: boolean; unrendered: boolean };
  const NAMED: Record<string, RGBA> = { white: [255, 255, 255, 1], black: [0, 0, 0, 1], transparent: [0, 0, 0, 0], snow: [255, 250, 250, 1],
    whitesmoke: [245, 245, 245, 1], ivory: [255, 255, 240, 1], gray: [128, 128, 128, 1], grey: [128, 128, 128, 1], silver: [192, 192, 192, 1] };
  function parseColor(value: string | undefined): RGBA | null {
    const v = (value ?? "").trim().toLowerCase();
    if (NAMED[v]) return NAMED[v];
    const hex = v.match(/^#([0-9a-f]{3,8})$/);
    if (hex) {
      const h = hex[1]!.length <= 4 ? [...hex[1]!].map((c) => c + c).join("") : hex[1]!;
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1];
    }
    const fn = v.match(/^rgba?\(([^)]+)\)$/);
    if (!fn) return null;
    const n = fn[1]!.split(/[\s,/]+/).filter(Boolean).map((x) => (x.endsWith("%") ? parseFloat(x) / 100 : parseFloat(x)));
    return n.length >= 3 ? [n[0]!, n[1]!, n[2]!, n[3] ?? 1] : null;
  }
  const over = (top: RGBA, under: RGBA): RGBA => [0, 1, 2].map((i) => top[i]! * top[3] + under[i]! * (1 - top[3])).concat(1) as RGBA;
  const luminance = (c: RGBA) => {
    const [r, g, b] = c.slice(0, 3).map((x) => { const s = x / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  const contrast = (a: RGBA, b: RGBA) => { const [x, y] = [luminance(a), luminance(b)].toSorted((p, q) => q - p); return (x! + 0.05) / (y! + 0.05); };
  const px = (v: string | undefined, base = 16) => {
    const m = (v ?? "").trim().match(/^(-?[\d.]+)(px|em|rem|%)?$/);
    if (!m) return NaN;
    const n = parseFloat(m[1]!);
    return m[2] === "em" ? n * base : m[2] === "rem" ? n * 16 : m[2] === "%" ? (n * base) / 100 : n;
  };
  /** True when a clip-path value leaves (almost) no area: inset that meets in the middle, a flat polygon, a zero circle. */
  function clipNone(value: string | undefined): boolean {
    const v = (value ?? "").toLowerCase();
    if (/circle\(\s*0(px|%)?\b|ellipse\(\s*0(px|%)?\s/.test(v)) return true;
    const inset = v.match(/inset\(([^)]*)\)/);
    if (inset) {
      const n = inset[1]!.split(/\s+round\s+/)[0]!.trim().split(/\s+/).map((x) => (x.endsWith("%") ? parseFloat(x) : 0)); // px cannot be compared with the box here: count it as 0
      const [t = 0, r = t, b = t, l = r] = n;
      return t + b >= 99 || l + r >= 99;
    }
    const poly = v.match(/polygon\(([^)]*)\)/);
    if (!poly) return false;
    const pts = poly[1]!.replace(/^\s*(nonzero|evenodd)\s*,/, "").split(",").map((p) => p.trim().split(/\s+/).map((x) => parseFloat(x)));
    if (pts.length < 3 || pts.some((p) => p.length !== 2 || p.some(Number.isNaN))) return false;
    let area = 0;
    pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length]!; area += p[0]! * q[1]! - q[0]! * p[1]!; });
    return Math.abs(area) / 2 < 1;
  }
  const filterOpacity = (v: string | undefined) => {
    let o = 1;
    for (const m of (v ?? "").matchAll(/opacity\(\s*([\d.]+)(%?)\s*\)/g)) o *= m[2] ? parseFloat(m[1]!) / 100 : parseFloat(m[1]!);
    return o;
  };
  const SVG_NS = "http://www.w3.org/2000/svg";
  /** The color that paints the text: text-fill-color, or fill and fill-opacity for SVG, or color. */
  const paint = (el: Element, color: string | undefined, fill: string | undefined, fillOpacity: string | undefined, textFill: string | undefined) => {
    const svg = el.namespaceURI === SVG_NS || (/^(text|tspan|textpath)$/i.test(el.localName) && !!el.closest?.("svg"));
    const c = svg && fill && fill !== "none" ? parseColor(fill) : parseColor(textFill) ?? parseColor(color);
    if (c && svg && fillOpacity) c[3] = c[3] * (parseFloat(fillOpacity) || 0);
    return c;
  };
  const CLIP_RECT = /rect\(\s*0(px)?[\s,]+0(px)?[\s,]+0(px)?[\s,]+0(px)?\s*\)|rect\(\s*1px[\s,]+1px/;

  let sheet: [string, Record<string, string>][] | null = null;
  const customs: Record<string, string> = {};
  const parseDecls = (text: string) => {
    const out: Record<string, string> = {};
    for (const part of text.split(";")) {
      const i = part.indexOf(":");
      if (i > 0) out[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).replace(/!important/i, "").trim().toLowerCase();
    }
    return out;
  };
  /** Static mode: `<style>` rules (no @media blocks) and the inline style, later rules first-come. */
  function declsOf(el: Element): Record<string, string> {
    if (!sheet) {
      const css = Array.from(doc.querySelectorAll("style"), (s) => s.textContent ?? "").join("\n")
        .replace(/\/\*[\s\S]*?\*\//g, "").replace(/@[^{;]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");
      sheet = Array.from(css.matchAll(/([^{}]+)\{([^{}]*)\}/g), (m) => [m[1]!.trim(), parseDecls(m[2]!)] as [string, Record<string, string>]);
      // Custom properties, page-wide: the last one set in a <style> rule wins. Ancestors' inline ones are not tracked.
      for (const [, decls] of sheet) for (const [k, v] of Object.entries(decls)) if (k.startsWith("--")) customs[k] = v;
    }
    const d: Record<string, string> = {};
    for (const [sel, decls] of sheet) {
      try { if (el.matches(sel)) Object.assign(d, decls); } catch { /* a selector this parser does not know */ }
    }
    Object.assign(d, parseDecls(el.getAttribute("style") ?? ""));
    if (!d.display && el.hasAttribute("hidden")) d.display = "none";
    // SVG <title> and <desc> are never drawn (outside <head>; <head> is skipped).
    if (/^(title|desc)$/.test(el.localName)) d.display = "none";
    for (const [k, v] of Object.entries(d)) {
      if (v.includes("var(")) d[k] = v.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*))?\)/g, (_, name: string, fallback?: string) => customs[name] ?? fallback ?? "");
    }
    return d;
  }
  function lookOf(el: Element, ctx: Ctx): Look {
    const win = el.ownerDocument.defaultView;
    if (live && win) {
      const cs = win.getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const box = (r.width <= 1 || r.height <= 1) && /hidden|clip/.test(`${cs.overflowX} ${cs.overflowY}`);
      // A box with no area that still has client rects (scale(0), zero size): check that its text paints nowhere,
      // so a zero-height parent of floated children is not called hidden.
      let flat = false;
      if (r.width * r.height < 1 && cs.display !== "contents" && el.getClientRects().length > 0 && el.textContent?.trim()) {
        const range = el.ownerDocument.createRange();
        range.selectNodeContents(el);
        const t = range.getBoundingClientRect();
        flat = t.width * t.height < 1;
      }
      const bg = parseColor(cs.backgroundColor);
      return {
        display: cs.display, vis: cs.visibility, opacity: (parseFloat(cs.opacity) || 0) * filterOpacity(cs.filter), font: parseFloat(cs.fontSize),
        color: paint(el, cs.color, cs.getPropertyValue("fill"), cs.getPropertyValue("fill-opacity"), cs.getPropertyValue("-webkit-text-fill-color")),
        bg: cs.backgroundImage !== "none" ? null : bg && bg[3] > 0 && ctx.bg ? over(bg, ctx.bg) : ctx.bg,
        offscreen: r.right + win.scrollX <= 0 || r.bottom + win.scrollY <= 0 || px(cs.textIndent) <= -500
          || (/absolute|fixed/.test(cs.position) && px(cs.left) >= 5000),
        clipped: box || flat || clipNone(cs.clipPath) || CLIP_RECT.test(cs.clip),
        unrendered: el.getClientRects().length === 0 && cs.display !== "contents",
      };
    }
    const d = declsOf(el);
    const font = d["font-size"] ? px(d["font-size"], ctx.font) : ctx.font;
    const ownBg = /url\(|gradient/.test(d.background ?? "") ? undefined : parseColor(d["background-color"] ?? d.background?.split(/\s+/)[0]);
    const far = (k: string) => px(d[k]) <= -500;
    const tiny = (k: string) => px(d[k]) <= 1;
    return {
      display: d.display ?? "", vis: d.visibility ?? ctx.vis, opacity: (d.opacity ? parseFloat(d.opacity) : 1) * filterOpacity(d.filter),
      font: Number.isNaN(font) ? ctx.font : font,
      color: paint(el, d.color, d.fill ?? el.getAttribute("fill") ?? undefined, d["fill-opacity"] ?? el.getAttribute("fill-opacity") ?? undefined, d["-webkit-text-fill-color"])
        ?? ctx.color,
      bg: /url\(|gradient/.test(`${d.background ?? ""} ${d["background-image"] ?? ""}`) ? null : ownBg && ownBg[3] > 0 && ctx.bg ? over(ownBg, ctx.bg) : ctx.bg,
      offscreen: (/absolute|fixed|relative/.test(d.position ?? "") && (far("left") || far("top") || far("right")))
        || far("text-indent") || px(d["margin-left"]) <= -1000 || /translate[xy]?\(\s*-\d{3,}/.test(d.transform ?? ""),
      clipped: ((tiny("width") || tiny("height") || tiny("max-height")) && /hidden|clip/.test(d.overflow ?? d["overflow-x"] ?? d["overflow-y"] ?? ""))
        || clipNone(d["clip-path"]) || CLIP_RECT.test(d.clip ?? "") || /scale[xy]?\(\s*0(\.0*)?\s*[,)]/.test(d.transform ?? ""),
      unrendered: false,
    };
  }

  // ---- Hidden text --------------------------------------------------------
  const BASE: Partial<Record<FindingKind, number>> = { "display-none": 0.15, "not-rendered": 0.1, "visibility-hidden": 0.15, "opacity-zero": 0.25,
    offscreen: 0.25, clipped: 0.2, "tiny-font": 0.3, "low-contrast": 0.35, "aria-hidden": 0.05, comment: 0.1, noscript: 0.1, attribute: 0.05, "pseudo-content": 0.1, covered: 0.3 };
  const ADDRESS = /\S+@[\w-]+\.[\w.-]+|https?:\/\/|\bwww\.|\b[a-z0-9-]+\.[a-z]{2,}\//i;
  function hidden(kind: FindingKind, raw: string, selector: string, extra: string[] = [], links = "") {
    if (squash(raw).replace(/[^\p{L}\p{N}]/gu, "").length < 3) return;
    const plain = clean(raw);
    const r = rules(plain);
    const address = ADDRESS.test(`${plain} ${links}`);
    add(kind, plain, selector, [kind, ...extra, ...r.names, ...(address ? ["address in hidden text"] : [])], combine(BASE[kind] ?? 0.1, r.score, address ? 0.2 : 0));
  }
  /** The text of a subtree, without scripts and styles, and the hrefs of its links. */
  function textOf(el: Element): [string, string] {
    let text = "";
    const links: string[] = [];
    const visit = (n: Node) => {
      for (let c = n.firstChild; c && text.length < 5000; c = c.nextSibling) {
        if (c.nodeType === 3) text += c.nodeValue ?? "";
        else if (c.nodeType === 1 && !SKIP.has((c as Element).localName)) {
          const href = (c as Element).getAttribute("href");
          if (href) links.push(href);
          text += " ";
          visit(c);
        }
      }
    };
    visit(el);
    return [text, links.join(" ")];
  }
  /** The hiding kind for text directly inside an element, from its own style. */
  const scrolled = new Map<Window, [number, number]>();
  /** Live mode: is an opaque box drawn over the middle of this element's text? Only text in the viewport can be checked. */
  function covered(el: Element): FindingKind | null {
    let text = false;
    for (let c = el.firstChild; c && !text; c = c.nextSibling) text = c.nodeType === 3 && /\S/.test(c.nodeValue ?? "");
    if (!text) return null;
    const win = el.ownerDocument.defaultView;
    if (!win) return null;
    let r = el.getBoundingClientRect();
    if (r.top < 0 || r.top + 10 >= win.innerHeight) {
      // Hit tests work only in the viewport. Scroll there now; the scroll goes back before the scan returns,
      // in the same task, so the page never paints the moved position.
      if (!scrolled.has(win)) scrolled.set(win, [win.scrollX, win.scrollY]);
      win.scrollTo({ left: win.scrollX, top: Math.max(0, r.top + win.scrollY - win.innerHeight / 3), behavior: "instant" });
      r = el.getBoundingClientRect();
    }
    const x = r.left + r.width / 2;
    const y = r.top + Math.min(r.height / 2, 10);
    if (x < 0 || y < 0 || x >= win.innerWidth || y >= win.innerHeight) return null;
    const root = el.getRootNode() as Document | ShadowRoot;
    const hit = root.elementFromPoint(x, y);
    if (!hit || hit === el || el.contains(hit) || hit.contains(el)) return null;
    const cs = win.getComputedStyle(hit);
    const bg = parseColor(cs.backgroundColor);
    const opaque = (bg !== null && bg[3] >= 0.9) || cs.backgroundImage !== "none" || /^(img|video|canvas|iframe|object|embed)$/.test(hit.localName);
    return opaque && (parseFloat(cs.opacity) || 0) >= 0.9 ? "covered" : null;
  }
  function ownerKind(ctx: Ctx): FindingKind | null {
    if (/hidden|collapse/.test(ctx.vis)) return "visibility-hidden";
    if (ctx.opacity <= 0.05) return "opacity-zero";
    if (ctx.font < 4) return "tiny-font";
    if (ctx.color && ctx.bg && (ctx.color[3] <= 0.05 || contrast(over(ctx.color, ctx.bg), ctx.bg) < 1.5)) return "low-contrast";
    return null;
  }
  const groups = new Map<Element, { kind: FindingKind; text: string; prefix: string; aria: boolean }>();
  const arias = new Map<Element, { text: string; prefix: string }>();
  const pseudo = (el: Element, which: string) => {
    const c = el.ownerDocument.defaultView?.getComputedStyle(el, which).content ?? "none";
    return Array.from(c.matchAll(/"((?:[^"\\]|\\.)*)"/g), (m) => m[1]!.replace(/\\([0-9a-f]{1,6})\s?/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16))).replace(/\\(.)/g, "$1")).join("");
  };

  // ---- Walk ---------------------------------------------------------------
  // <title> is not here: the one in <head> is skipped with <head>, and an SVG <title> must be read.
  const SKIP = new Set(["script", "style", "template", "head", "meta", "link", "base"]);
  const BLOCK = new Set(["address", "article", "aside", "blockquote", "body", "button", "caption", "dd", "details", "dialog", "div",
    "dl", "dt", "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header", "html", "label",
    "legend", "li", "main", "nav", "ol", "option", "p", "pre", "section", "select", "summary", "table", "tbody", "td", "textarea",
    "tfoot", "th", "thead", "tr", "ul"]);
  /** A run of text. `spaced` puts a space at each element edge, so words in two elements do not join. */
  type Acc = { el: Element; text: string; spaced: string; prefix: string };
  const order: Acc[] = [];

  const overBudget = () => {
    if (truncated) return true;
    nodes += 1;
    if (nodes > maxNodes || (nodes % 128 === 0 && now() - started > maxMs)) truncated = true;
    return truncated;
  };

  /** Walks the children of a node (an element or a shadow root). Returns the run that text after them goes to. */
  function walk(node: Element | ShadowRoot, start: Acc, ctx: Ctx, depth: number): Acc {
    let acc = start;
    const owner = node.nodeType === 1 ? (node as Element) : (node as ShadowRoot).host;
    const kind = ownerKind(ctx) ?? (live && node.nodeType === 1 ? covered(node as Element) : null);
    const seen = new Map<string, number>();
    for (let child = node.firstChild; child; child = child.nextSibling) {
      if (truncated) return acc;
      if (child.nodeType === 3) {
        const value = child.nodeValue ?? "";
        if (kind) {
          const g = groups.get(owner) ?? { kind, text: "", prefix: ctx.prefix, aria: !!ctx.aria };
          g.text += value;
          groups.set(owner, g);
          continue;
        }
        acc.text += value;
        acc.spaced += value;
        if (ctx.aria) arias.get(ctx.aria)!.text += value;
        continue;
      }
      if (child.nodeType === 8) {
        if (squash(child.nodeValue ?? "").length >= 15) hidden("comment", child.nodeValue ?? "", selectorOf(owner, ctx.prefix));
        continue;
      }
      if (child.nodeType !== 1) continue;
      const el = child as Element;
      const name = el.localName;
      const index = (seen.get(name) ?? 0) + 1;
      seen.set(name, index);
      partOf.set(el, `${name}:nth-of-type(${index})`);
      if (SKIP.has(name) || overBudget()) continue;
      if (depth > 900) { truncated = true; return acc; }
      if (name === "noscript") {
        hidden("noscript", (el.textContent ?? "").replace(/<[^>]*>/g, " "), selectorOf(el, ctx.prefix));
        continue;
      }
      const look = lookOf(el, ctx);
      const aria = ctx.aria ?? (el.getAttribute("aria-hidden") === "true" ? el : null);
      const terminal: FindingKind | null = look.display === "none" ? "display-none"
        : look.unrendered && !/^(option|optgroup|area|map)$/.test(name) ? "not-rendered"
        : look.offscreen ? "offscreen" : look.clipped ? "clipped" : null;
      if (terminal) {
        const [text, links] = textOf(el);
        hidden(terminal, text, selectorOf(el, ctx.prefix), aria ? ["aria-hidden"] : [], links);
        continue;
      }
      if (aria === el) arias.set(el, { text: "", prefix: ctx.prefix });
      const inner: Ctx = { prefix: ctx.prefix, vis: look.vis, font: look.font, color: look.color, bg: look.bg, opacity: ctx.opacity * look.opacity, aria };
      for (const attr of ["alt", "title", "aria-label"]) {
        const value = squash(el.getAttribute(attr) ?? "");
        if (value.length >= 15 && !squash(el.textContent ?? "").includes(value)) hidden("attribute", value, selectorOf(el, ctx.prefix), [`${attr} text`]);
      }
      if (live && !ownerKind(inner)) {
        const extra = pseudo(el, "::before") + pseudo(el, "::after");
        if (extra) hidden("pseudo-content", extra, selectorOf(el, ctx.prefix));
      }
      if (name === "iframe") {
        let sub: Document | null = null;
        try { sub = (el as HTMLIFrameElement).contentDocument; } catch { sub = null; }
        if (!sub?.body) { if (el.getAttribute("src") || el.getAttribute("srcdoc")) skippedFrames += 1; continue; }
        const frameAcc: Acc = { el: sub.body, text: "", spaced: "", prefix: `${selectorOf(el, ctx.prefix)} >>> ` };
        order.push(frameAcc);
        walk(sub.body, frameAcc, { ...ROOT, prefix: frameAcc.prefix }, depth + 1);
        continue;
      }
      let next: Acc = acc;
      if (BLOCK.has(name)) {
        next = { el, text: "", spaced: "", prefix: ctx.prefix };
        order.push(next);
      } else acc.spaced += " ";
      next = walk(el, next, inner, depth + 1);
      const open = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
      if (open) next = walk(open, next, { ...inner, prefix: `${selectorOf(el, ctx.prefix)} >>> ` }, depth + 1);
      if (!BLOCK.has(name)) {
        acc = next;
        acc.spaced += " ";
        continue;
      }
      // Text after a block belongs to a new run of the outer block, so runs stay in page order.
      acc = { el: acc.el, text: "", spaced: "", prefix: acc.prefix };
      order.push(acc);
    }
    return acc;
  }

  const ROOT: Ctx = { prefix: "", vis: "visible", font: 16, color: [0, 0, 0, 1], bg: [255, 255, 255, 1], opacity: 1, aria: null };
  const body = doc.body ?? doc.documentElement;
  if (body) {
    const rootAcc: Acc = { el: body, text: "", spaced: "", prefix: "" };
    order.push(rootAcc);
    const look = lookOf(body, ROOT);
    walk(body, rootAcc, { ...ROOT, vis: look.vis, font: look.font, color: look.color, bg: look.bg ?? ROOT.bg }, 0);
  }
  for (const [win, [x, y]] of scrolled) win.scrollTo({ left: x, top: y, behavior: "instant" });
  for (const acc of order) {
    if (squash(acc.text).length === 0) continue;
    blocks.push(checkVisible(acc.text, acc.spaced, selectorOf(acc.el, acc.prefix)));
  }
  for (const [el, g] of groups) hidden(g.kind, g.text, selectorOf(el, g.prefix), g.aria ? ["aria-hidden"] : []);
  for (const [el, a] of arias) hidden("aria-hidden", a.text, selectorOf(el, a.prefix));

  findings.sort((a, b) => b.score - a.score);
  return { mode: live ? "live" : "static", findings, blocks, truncated, nodes, ms: Math.round(now() - started), skippedFrames };
}
