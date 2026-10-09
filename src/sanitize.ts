import type { ScanReport } from "./types.js";

export interface SanitizeOptions {
  /** Wrap blocks with this score or more. Default 0.5. */
  threshold?: number;
}

const INVISIBLE = /[​-‍⁠᠎﻿‪-‮⁦-⁩\u{E0000}-\u{E007F}]/gu;
const tidy = (text: string) => text.replace(INVISIBLE, "").replace(/<(\/?\s*untrusted-data)/gi, "&lt;$1");
const attr = (text: string) => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/**
 * Returns only the visible text of a scanned page, one block per line, in
 * page order. Hidden text is left out. A block that instruction rules flag
 * is wrapped in `<untrusted-data>`, so an agent can treat it as data and not
 * as instructions.
 */
export function sanitize(report: ScanReport, options: SanitizeOptions = {}): string {
  const threshold = options.threshold ?? 0.5;
  return report.blocks.map((b) => {
    const text = tidy(b.text);
    if ((b.score ?? 0) < threshold) return text;
    return `<untrusted-data source="foxshield" reason="${attr(b.reason ?? "")}" score="${b.score}">\n${text}\n</untrusted-data>`;
  }).join("\n");
}
