import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { scanHtml } from "./html.js";
import { sanitize } from "./sanitize.js";
import type { ScanReport } from "./types.js";

export interface Io {
  out(text: string): void;
  err(text: string): void;
}

const USAGE = `Usage: foxshield scan <file.html|url>... [--threshold 0.5] [--json] [--sanitize] [--max-nodes 50000]

Exit codes: 0 no finding reaches the threshold, 1 a finding does, 2 an error.
`;

async function load(source: string): Promise<string> {
  if (!/^https?:\/\//i.test(source)) return readFile(source, "utf8");
  const res = await fetch(source, { headers: { accept: "text/html" }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function describe(source: string, report: ScanReport, threshold: number): string {
  const top = report.findings.filter((f) => f.score >= threshold);
  const lines = [`${source}: ${top.length} of ${report.findings.length} findings at or above ${threshold}${report.truncated ? " (scan stopped early)" : ""}`];
  for (const f of top) lines.push(`  ${f.score.toFixed(2)}  ${f.kind.padEnd(17)} ${f.selector}`, `        ${f.reason}`, `        "${f.text.slice(0, 160)}"`);
  return `${lines.join("\n")}\n`;
}

/** Runs the CLI and returns the exit code. */
export async function main(argv: string[], io: Io): Promise<number> {
  const [command, ...rest] = argv;
  if (command !== "scan") {
    io.err(command && command !== "--help" ? `Unknown command: ${command}\n${USAGE}` : USAGE);
    return 2;
  }
  let args;
  try {
    args = parseArgs({ args: rest, allowPositionals: true, options: {
      threshold: { type: "string", default: "0.5" }, json: { type: "boolean" }, sanitize: { type: "boolean" }, "max-nodes": { type: "string" } } });
  } catch (error) {
    io.err(`${(error as Error).message}\n${USAGE}`);
    return 2;
  }
  const raw = args.values.threshold.trim();
  const threshold = raw === "" ? NaN : Number(raw);
  const maxNodes = args.values["max-nodes"] === undefined ? undefined : Number(args.values["max-nodes"]);
  if (args.positionals.length === 0 || !(threshold >= 0 && threshold <= 1) || (maxNodes !== undefined && !(maxNodes > 0))) {
    io.err(`Give at least one file or URL, a threshold from 0 to 1, and a positive --max-nodes.\n${USAGE}`);
    return 2;
  }
  const results = [];
  let failed: string | null = null;
  for (const source of args.positionals) {
    try {
      const report = scanHtml(await load(source), { maxNodes });
      results.push({ source, flagged: report.findings.filter((f) => f.score >= threshold).length, report });
    } catch (error) {
      failed = `foxshield: cannot read ${source}: ${(error as Error).message}\n`;
      break;
    }
  }
  // Print what was scanned even when a later source failed, then the error.
  if (args.values.json) io.out(`${JSON.stringify({ threshold, results, ...(failed ? { error: failed.trim() } : {}) })}\n`);
  else for (const r of results) io.out(args.values.sanitize ? `${sanitize(r.report, { threshold })}\n` : describe(r.source, r.report, threshold));
  if (failed) {
    io.err(failed);
    return 2;
  }
  return results.some((r) => r.flagged > 0) ? 1 : 0;
}
