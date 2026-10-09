// The E2E test, in a real Firefox:
// 1. runs scanDocument on the hiding-technique page (H1-H16);
// 2. scans every foxbench page through the demo extension ("Scan this page"),
//    and reports precision and recall against foxbench's four traps (X1, X3, H17);
// 3. checks the highlight overlay (X2) and the popup list;
// 4. scans the same pages with scanHtml in Node, for the static table.
// It writes artifacts/e2e-<date>.json.
// Usage: pnpm e2e [--headed] [--screenshots <dir>]. Env: FIREFOX.
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { launch, poll, serve, writeArtifact } from "create-foxkit/e2e";
import { scanDocument, scanHtml } from "../dist/index.js";
import { score, table } from "./score.mjs";

const THRESHOLD = 0.5;
const median = (xs) => xs.toSorted((a, b) => a - b)[Math.floor(xs.length / 2)];
const shotsAt = process.argv.indexOf("--screenshots");
const shots = shotsAt > 0 ? process.argv[shotsAt + 1] : null;
const record = { startedAt: new Date().toISOString(), threshold: THRESHOLD, checks: [] };
const check = (name, expected, actual) => record.checks.push({ name, expected, actual, ok: actual === expected });
const FIXTURES = "e2e/fixtures/generated/foxbench";
const { source, pages } = JSON.parse(readFileSync(`${FIXTURES}/pages.json`, "utf8"));
record.foxbench = source;

// BiDi cannot capture a moz-extension: page. So this serves the built popup
// over http with a stub `browser` that answers with a real scan result.
async function popupShot(result, path, network = null) {
  const dir = mkdtempSync(join(tmpdir(), "fsh-popup-"));
  cpSync("dist-ext", dir, { recursive: true });
  const stub = `<script>window.browser={tabs:{query:async()=>[{id:1,url:"x"}]},storage:{local:{get:async()=>({networkScan:true}),set:async()=>{}}},runtime:{sendMessage:async(m)=>m.type==="scan"?${JSON.stringify(result).replace(/</g, "\\u003c")}:m.type==="network"?${JSON.stringify(network)}:0}};</script>`;
  writeFileSync(join(dir, "index.html"), readFileSync(join(dir, "popup.html"), "utf8").replace("<script", () => `${stub}<script`));
  const server = await serve(dir);
  try {
    const shot = await fox.open(`${server.url}/index.html`);
    await shot.setViewport({ width: 420, height: 560 });
    await shot.evaluate(() => document.getElementById("scan").click());
    await poll(shot, () => document.querySelectorAll("#findings li").length);
    await shot.screenshot({ path });
    await shot.close();
  } finally {
    await server.close();
  }
}

// Two servers on two ports are two origins, so the second one gives a cross-origin frame.
const site = await serve("e2e/site");
const other = await serve("e2e/site");
const bench = await serve(FIXTURES);
let fox;
let shopResult = null;
try {
  fox = await launch({ extension: "dist-ext", headless: !process.argv.includes("--headed") });
  record.firefox = await fox.browser.version();

  // 1. Hiding techniques, with the library function run straight in the page.
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
  check("H13 open shadow root is scanned", true, report.findings.some((f) => f.selector.includes("#h-shadow >>> ") && f.score >= THRESHOLD));
  check("H14 same-origin iframe is scanned", true, report.findings.some((f) => f.selector.includes("#h-frame >>> ") && f.score >= THRESHOLD));
  check("H14 cross-origin iframe is counted as skipped", 1, report.skippedFrames);
  check("H15 late CSS: the instruction is still flagged", true, report.findings.some((f) => f.selector.includes("#h-late") && f.score >= THRESHOLD));
  check("visible legit text and the Ignore button are not flagged", false, report.findings.some((f) => f.selector.includes("#legit") && f.score >= THRESHOLD));

  // 2. Every foxbench page through the extension: the popup page sends "scan" for a tab.
  const control = await fox.openExtensionPage("popup.html");
  const tabIdOf = (url) => control.evaluate(async (u) => (await browser.tabs.query({})).find((t) => t.url === u)?.id, url);
  const scanTab = (tabId) => control.evaluate((id) => browser.runtime.sendMessage({ type: "scan", tabId: id }), tabId);
  const live = [];
  for (const p of pages) {
    const url = `${bench.url}/${p.name}.html`;
    const tab = await fox.open(url);
    const result = await scanTab(await tabIdOf(url));
    if (!result?.report) throw new Error(`${p.name}: ${result?.error ?? "no report"}`);
    live.push({ page: p, report: result.report, boxes: result.boxes });
    if (p.name === "trap-shop-mug") {
      // 3. The overlay: one host, a closed shadow root, one box per flagged finding.
      const seen = await tab.evaluate(() => {
        const hosts = document.querySelectorAll("[data-foxshield-overlay]");
        return { hosts: hosts.length, closed: hosts[0]?.shadowRoot === null, leaks: hosts[0]?.textContent ?? "" };
      });
      check("X2 overlay has one host", 1, seen.hosts);
      check("X2 overlay shadow root is closed to the page", true, seen.closed);
      check("X2 overlay text is not readable from the page", "", seen.leaks);
      check("X2 overlay draws a box for each flagged finding", result.report.findings.filter((f) => f.score >= THRESHOLD).length, result.boxes);
      if (shots) await tab.screenshot({ path: `${shots}/overlay-trap-shop-mug.png` });
      const id = await tabIdOf(url);
      await control.evaluate((tabId) => browser.runtime.sendMessage({ type: "clear", tabId }), id);
      check("X2 clear removes the overlay", 0, await tab.evaluate(() => document.querySelectorAll("[data-foxshield-overlay]").length));
      // The popup: "Scan this page" lists the findings.
      const popup = await fox.openExtensionPage(`popup.html?tab=${id}`);
      await popup.evaluate(() => document.getElementById("scan").click());
      check("popup lists the flagged finding", "low-contrast", await poll(popup, () => document.querySelector("#findings li.high .kind")?.textContent));
      await popup.close();
      if (shots) await popupShot(result, `${shots}/popup-trap-shop-mug.png`);
      shopResult = result;
    }
    await tab.close();
  }
  record.live = score(live, THRESHOLD);
  check("X3 the scan runs through scripting.executeScript", true, live.every((r) => r.report.mode === "live"));
  check("X1 all four trap pages are caught", 4, record.live.summary.trapsCaught);
  check("H17 no flagged finding on a normal page", 0, record.live.summary.normalPagesFlagged);

  // 5. The optional network filter: it reads HTML as it arrives and passes the bytes through (N1, N2).
  const load = async (url) => {
    const tab = await fox.open(url);
    const seen = await tab.evaluate(() => ({ ms: performance.getEntriesByType("navigation")[0].duration, html: document.documentElement.outerHTML }));
    await tab.close();
    return seen;
  };
  record.network = [];
  for (const name of ["trap-mail-m8", "shop-giftcard", "flights-results", "trap-shop-mug"]) {
    const url = `${bench.url}/${name}.html`;
    const runs = { off: [], on: [] };
    let same = true;
    for (let i = 0; i < 7; i++) {
      for (const mode of ["off", "on"]) {
        await control.evaluate((on) => browser.storage.local.set({ networkScan: on }), mode === "on");
        const seen = await load(`${url}?run=${i}${mode}`);
        runs[mode].push(seen);
      }
      same &&= runs.on[i].html === runs.off[i].html;
    }
    // The scan runs when the response ends, so it can finish just after the load event.
    const scanned = await poll(control, (u) => browser.runtime.sendMessage({ type: "network", url: u }), `${url}?run=6on`, 5000).catch(() => null);
    if (shots && name === "trap-shop-mug") await popupShot(shopResult, `${shots}/popup-network.png`, scanned);
    record.network.push({ page: name, medianMsOff: median(runs.off.map((r) => r.ms)), medianMsOn: median(runs.on.map((r) => r.ms)),
      sameHtml: same, flagged: scanned?.flagged ?? null, scanMs: scanned?.ms ?? null });
  }
  await control.evaluate(() => browser.storage.local.set({ networkScan: false }));
  check("N1 the page is the same with the network filter on", true, record.network.every((n) => n.sameHtml));
  check("N1 the network filter scans each HTML response", true, record.network.every((n) => typeof n.flagged === "number"));
  check("the network filter flags the mail trap", true, record.network[0].flagged >= 1);
  check("the network filter flags nothing on normal pages", 0, record.network[1].flagged + record.network[2].flagged);
  check("the network filter flags the white-on-white shop trap", true, record.network[3].flagged >= 1);
} catch (error) {
  record.error = error instanceof Error ? error.message : String(error);
} finally {
  await fox?.close();
  await Promise.all([site.close(), other.close(), bench.close()]);
}

// 4. The same pages in Node (static mode: inline styles and <style> rules only).
record.static = score(pages.map((p) => ({ page: p, report: scanHtml(readFileSync(`${FIXTURES}/${p.name}.html`, "utf8")) })), THRESHOLD);
record.passed = !record.error && record.checks.length > 0 && record.checks.every((c) => c.ok);
const path = writeArtifact("artifacts", "e2e", record);
// A short Markdown copy of the two tables: small enough to commit.
const md = `# foxshield on foxbench (${record.startedAt.slice(0, 10)})\n\nThreshold ${THRESHOLD}. Pages from ${source}. E2E ${record.passed ? "passed" : "failed"}.\n\n`
  + `${record.network ? `## Network filter\n\n| Page | Median load ms, filter off | Median load ms, filter on | Scan ms | Flagged | Same HTML |\n|---|---|---|---|---|---|\n${record.network.map((n) => `| ${n.page} | ${n.medianMsOff} | ${n.medianMsOn} | ${n.scanMs} | ${n.flagged} | ${n.sameHtml} |`).join("\n")}\n\n` : ""}`
  + `## Live: Firefox ${record.firefox ?? "?"}, through the demo extension\n\n${record.live ? table(record.live) : record.error}\n\n## Static: scanHtml in Node\n\n${table(record.static)}\n`;
writeFileSync(path.replace(/e2e-(\d{4}-\d\d-\d\d)\.json$/, "precision-recall-$1.md"), md);
for (const c of record.checks) console.log(`${c.ok ? "ok " : "BAD"} ${c.name}: ${JSON.stringify(c.actual)}`);
if (record.live) console.log(`\nLive (Firefox ${record.firefox}, via the extension):\n${table(record.live)}`);
console.log(`\nStatic (scanHtml in Node):\n${table(record.static)}`);
if (record.network) console.log(`\nNetwork filter (median load ms off -> on):\n${record.network.map((n) => `${n.page}: ${n.medianMsOff} -> ${n.medianMsOn}, scan ${n.scanMs} ms, flagged ${n.flagged}`).join("\n")}`);
console.log(`${record.passed ? "PASS" : "FAIL"}${record.error ? `: ${record.error}` : ""} | ${path}`);
process.exitCode = record.passed ? 0 : 1;
