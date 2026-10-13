import type { Block, ScanReport } from "./types.js";

export interface SanitizeOptions {
  /** Wrap blocks with this score or more. Default 0.5. */
  threshold?: number;
}

const INVISIBLE = /[​-‍⁠᠎﻿‪-‮⁦-⁩\u{E0000}-\u{E007F}]/gu;
const tidy = (text: string) => text.replace(INVISIBLE, "").replace(/<(\s*\/?\s*untrusted-data)/gi, "&lt;$1");
/** Page text cannot fake the S8 marker: "[untrusted-data" reads "\[untrusted-data" (S12). Runs after the "\" escape. */
const unmark = (text: string) => text.replace(/[[［]\s*untrusted-data/gi, (m) => `\\${m}`);
const attr = (text: string) => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** The column of a flagged cell in a joined row; its text follows the row, wrapped (S8). */
const FLAGGED_CELL = "[untrusted-data, below]";

/** A block that is a table cell itself: the row's selector, the cell's tag and its place among its kind (S7). */
const CELL = /^(.+) > (td|th):nth-of-type\((\d+)\)$/;

/**
 * Returns only the visible text of a scanned page, one block per line, in
 * page order. Hidden text is left out. A block that instruction rules flag
 * is wrapped in `<untrusted-data>`, so an agent can treat it as data and not
 * as instructions. The cells of one table row are one line, joined with
 * " | ", and an empty cell between two cells is an empty column (S7). In a
 * cell, "\" reads "\\", and "|", "｜" and "│" read "\|" (S10, S11). In a
 * row with a flagged cell, the cell reads "[untrusted-data, below]" and its
 * wrapped text follows the row, so the other cells keep their columns (S8).
 * Page text that holds the marker reads "\[untrusted-data" (S12).
 */
export function sanitize(report: ScanReport, options: SanitizeOptions = {}): string {
  const threshold = options.threshold ?? 0.5;
  const flagged = (b: Block) => (b.score ?? 0) >= threshold;
  const one = (b: Block) => {
    const text = unmark(tidy(b.text));
    if (!flagged(b)) return text;
    return `<untrusted-data source="foxshield" reason="${attr(b.reason ?? "")}" score="${b.score}">\n${text}\n</untrusted-data>`;
  };
  const lines: string[] = [];
  const blocks = report.blocks;
  for (let i = 0; i < blocks.length; ) {
    const row = CELL.exec(blocks[i]!.selector)?.[1];
    let end = i + 1;
    if (row !== undefined) while (end < blocks.length && CELL.exec(blocks[end]!.selector)?.[1] === row) end += 1;
    const cells = blocks.slice(i, end);
    if (row === undefined || cells.length < 2) {
      lines.push(...cells.map(one));
    } else {
      // Empty cells leave no block: their places in the selectors give the columns back.
      // nth-of-type counts each tag apart, so the gap is from the last cell of the same tag:
      // an empty td after a th keeps its column (S10).
      const out: string[] = [];
      const seen = new Map<string, number>();
      for (const cell of cells) {
        const [, , tag, at] = CELL.exec(cell.selector)!;
        const place = Number(at);
        const gap = place - (seen.get(tag!) ?? 0) - 1;
        for (let k = 0; k < gap; k++) out.push("");
        // A flagged cell keeps its column with a marker; its text goes below the row, wrapped (S8).
        // In other cells a "\" and then a "|" are escaped, so cell text cannot add a column or fake an
        // escape; the full-width "｜" and the box-drawing "│" read as "\|" too (S10, S11), and the
        // marker reads "\[untrusted-data" (S12).
        out.push(flagged(cell) ? FLAGGED_CELL : unmark(tidy(cell.text).replace(/\s*\n\s*/g, " ").trim().replace(/\\/g, "\\\\").replace(/[|｜│]/g, "\\|")));
        seen.set(tag!, place);
      }
      lines.push(out.join(" | "), ...cells.filter(flagged).map(one));
    }
    i = end;
  }
  return lines.join("\n");
}
