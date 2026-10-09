// The E2E test: run scanDocument (from dist/) in a real Firefox on the
// hiding-technique page, check each technique, and write
// artifacts/e2e-<date>.json.
// Usage: pnpm e2e [--headed]. Env: FIREFOX (the Firefox binary).
import { launch, serve, writeArtifact } from "create-foxkit/e2e";
import { scanDocument } from "../dist/index.js";

const record = { startedAt: new Date().toISOString(), checks: [] };
const check = (name, expected, actual) => record.checks.push({ name, expected, actual, ok: actual === expected });

// Two servers on two ports are two origins, so the second one gives a cross-origin frame.
const site = await serve("e2e/site");
const other = await serve("e2e/site");
let fox;
try {
  fox = await launch({ extension: "dist-ext", headless: !process.argv.includes("--headed") });
  record.firefox = await fox.browser.version();

  const page = await fox.open(`${site.url}/techniques.html?cross=${encodeURIComponent(`${other.url}/frame.html`)}`);
  await new Promise((r) => setTimeout(r, 800)); // let the late <style> (H15) and the frames arrive
  const report = await page.evaluate(scanDocument, {});
  record.techniques = { mode: report.mode, nodes: report.nodes, ms: report.ms, skippedFrames: report.skippedFrames, findings: report.findings };
  const has = (kind, id) => report.findings.some((f) => f.kind === kind && f.selector.includes(id));
  check("scan runs in live mode", "live", report.mode);
  for (const [kind, id] of [
    ["display-none", "#h-none"], ["display-none", "#h-attr"], ["visibility-hidden", "#h-vis"], ["opacity-zero", "#h-opacity"],
    ["offscreen", "#h-offscreen"], ["offscreen", "#h-indent"], ["clipped", "#h-clip"], ["clipped", "#h-clippath"],
    ["tiny-font", "#h-tiny"], ["low-contrast", "#h-contrast"], ["pseudo-content", "#h-pseudo"],
  ]) check(`${kind} found on ${id}`, true, has(kind, id));
  check("H2 visible child of a hidden parent is not hidden", false, report.findings.some((f) => f.text.includes("I am visible again")));
  check("H13 open shadow root is scanned", true, report.findings.some((f) => f.selector.includes("#h-shadow >>> ") && f.score >= 0.5));
  check("H14 same-origin iframe is scanned", true, report.findings.some((f) => f.selector.includes("#h-frame >>> ") && f.score >= 0.5));
  check("H14 cross-origin iframe is counted as skipped", 1, report.skippedFrames);
  check("H15 late CSS: the instruction is still flagged", true, report.findings.some((f) => f.selector.includes("#h-late") && f.score >= 0.5));
  check("visible legit text and the Ignore button are not flagged", false, report.findings.some((f) => f.selector.includes("#legit") && f.score >= 0.5));
} catch (error) {
  record.error = error instanceof Error ? error.message : String(error);
} finally {
  await fox?.close();
  await site.close();
  await other.close();
}
record.passed = !record.error && record.checks.length > 0 && record.checks.every((c) => c.ok);
const path = writeArtifact("artifacts", "e2e", record);
for (const c of record.checks) console.log(`${c.ok ? "ok " : "BAD"} ${c.name}: ${JSON.stringify(c.actual)}`);
console.log(`${record.passed ? "PASS" : "FAIL"}${record.error ? `: ${record.error}` : ""} | ${path}`);
process.exitCode = record.passed ? 0 : 1;
