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
  const skippedFrames = 0;

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

  // ---- Walk ---------------------------------------------------------------
  const SKIP = new Set(["script", "style", "template", "head", "meta", "link", "title", "base"]);
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

  /** Walks the children of a node. Returns the run that text after them goes to. */
  function walk(node: Node, start: Acc, prefix: string, depth: number): Acc {
    let acc = start;
    const seen = new Map<string, number>();
    for (let child = node.firstChild; child; child = child.nextSibling) {
      if (truncated) return acc;
      if (child.nodeType === 3) {
        acc.text += child.nodeValue ?? "";
        acc.spaced += child.nodeValue ?? "";
        continue;
      }
      if (child.nodeType !== 1) continue;
      const el = child as Element;
      const index = (seen.get(el.localName) ?? 0) + 1;
      seen.set(el.localName, index);
      partOf.set(el, `${el.localName}:nth-of-type(${index})`);
      if (SKIP.has(el.localName) || overBudget()) continue;
      if (depth > 900) { truncated = true; return acc; }
      if (!BLOCK.has(el.localName)) {
        acc.spaced += " ";
        acc = walk(el, acc, prefix, depth + 1);
        acc.spaced += " ";
        continue;
      }
      const inner: Acc = { el, text: "", spaced: "", prefix };
      order.push(inner);
      walk(el, inner, prefix, depth + 1);
      // Text after a block belongs to a new run of the outer block, so runs stay in page order.
      acc = { el: acc.el, text: "", spaced: "", prefix: acc.prefix };
      order.push(acc);
    }
    return acc;
  }

  const rootAcc: Acc = { el: doc.body ?? doc.documentElement, text: "", spaced: "", prefix: "" };
  order.push(rootAcc);
  if (rootAcc.el) walk(rootAcc.el, rootAcc, "", 0);
  for (const acc of order) {
    if (squash(acc.text).length === 0) continue;
    blocks.push(checkVisible(acc.text, acc.spaced, selectorOf(acc.el, acc.prefix)));
  }

  findings.sort((a, b) => b.score - a.score);
  return { mode: live ? "live" : "static", findings, blocks, truncated, nodes, ms: Math.round(now() - started), skippedFrames };
}
