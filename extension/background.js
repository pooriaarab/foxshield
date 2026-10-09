// The demo's background script (an event page in Firefox MV3). It runs the
// foxshield page functions in a tab with scripting.executeScript. It imports
// only the page code, so linkedom and the CLI stay out of the bundle.
import { clearOverlay, showOverlay } from "../src/overlay.ts";
import { scanDocument } from "../src/page.ts";

const THRESHOLD = 0.5;

async function run(tabId, func, args) {
  const [injection] = await browser.scripting.executeScript({ target: { tabId }, func, args });
  if (!injection || injection.error) throw new Error(String(injection?.error?.message ?? injection?.error ?? "the script did not run"));
  return injection.result;
}

async function scan(tabId) {
  try {
    const report = await run(tabId, scanDocument, [{}]);
    const items = report.findings.filter((f) => f.score >= THRESHOLD).map(({ selector, kind, score }) => ({ selector, kind, score }));
    const boxes = await run(tabId, showOverlay, [items]);
    return { report, boxes, threshold: THRESHOLD };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

browser.runtime.onMessage.addListener((message) => {
  if (message?.type === "scan") return scan(message.tabId);
  if (message?.type === "clear") return run(message.tabId, clearOverlay, []).catch((error) => ({ error: String(error) }));
  return undefined;
});
