import { parseHTML } from "linkedom";
import { scanDocument } from "./page.js";
import type { ScanOptions, ScanReport } from "./types.js";

/**
 * Scans an HTML string in Node, with no browser. It reads inline styles and
 * `<style>` rules, but it has no layout, so it cannot see what external CSS
 * or scripts do. Use scanDocument() in a browser for that.
 */
export function scanHtml(html: string, options: ScanOptions = {}): ScanReport {
  const { document } = parseHTML(html);
  return scanDocument(document, { ...options, mode: "static" });
}
