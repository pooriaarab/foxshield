import { parseHTML } from "linkedom";
import { scanDocument } from "./page.js";
import type { ScanOptions, ScanReport } from "./types.js";

/**
 * Scans an HTML string in Node, with no browser. It reads inline styles and
 * `<style>` rules, but it has no layout, so it cannot see what external CSS
 * or scripts do. Use scanDocument() in a browser for that. A fragment with
 * no `<html>` or `<body>` is scanned as the body of a page.
 */
export function scanHtml(html: string, options: ScanOptions = {}): ScanReport {
  // linkedom gives a fragment no body, so wrap it the way a browser would.
  const whole = /<(html|body)[\s>]/i.test(html) ? html : `<!doctype html><html><head></head><body>${html}</body></html>`;
  const { document } = parseHTML(whole);
  return scanDocument(document, { ...options, mode: "static" });
}
