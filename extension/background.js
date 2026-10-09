// The demo's background script (an event page in Firefox MV3). It runs the
// foxshield page functions in a tab with scripting.executeScript. It imports
// only the page code, so linkedom and the CLI stay out of the bundle.
import { clearOverlay, showOverlay } from "../src/overlay.ts";
import { scanResponse } from "../src/network.ts";
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

// The optional network filter. When the popup turns it on, each page's HTML
// is scanned as it arrives, before the page parses it. The bytes go on
// unchanged; the filter only reads. Results are kept by URL for the popup.
// The switch lives in memory: true, false, or a pending read after the event page wakes.
// The popup changes it with a "network-switch" message, which sets memory before it
// answers, so the next page load sees the new value without a storage read.
let networkOn = null;
const readSwitch = () => (networkOn ??= browser.storage.local.get("networkScan").then(({ networkScan }) => (networkOn = Boolean(networkScan))));
browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && "networkScan" in changes) networkOn = Boolean(changes.networkScan.newValue);
});
const KEEP = 50;
const types = new Map();
const results = new Map();

browser.webRequest.onHeadersReceived.addListener((details) => {
  types.set(details.requestId, details.responseHeaders?.find((h) => h.name.toLowerCase() === "content-type")?.value ?? "");
}, { urls: ["<all_urls>"], types: ["main_frame"] }, ["responseHeaders"]);

function filterPage(details) {
  const started = performance.now();
  // No content type seen (the event page woke late): scan anyway, DOMParser copes.
  const isHtml = () => { const type = types.get(details.requestId); return type === undefined || /text\/html|xhtml/i.test(type); };
  const charset = () => /charset=([\w-]+)/i.exec(types.get(details.requestId) ?? "")?.[1] ?? "utf-8";
  // The headers arrive after this listener, so the charset is read when the response ends.
  scanResponse(browser.webRequest.filterResponseData(details.requestId), { isHtml, get charset() { return charset(); } })
    .then((report) => {
      types.delete(details.requestId);
      if (!report) return;
      const flagged = report.findings.filter((f) => f.score >= THRESHOLD);
      const summary = { flagged: flagged.length, findings: flagged, ms: Math.round(performance.now() - started), bytes: report.bytes };
      results.set(details.url, summary);
      if (results.size > 50) results.delete(results.keys().next().value);
      // The event page can unload when idle, so keep a copy in session storage too, capped at KEEP.
      remember(`net:${details.url}`, summary);
      if (details.tabId >= 0) browser.action.setBadgeText({ tabId: details.tabId, text: flagged.length ? String(flagged.length) : "" });
    })
    .catch(() => types.delete(details.requestId));
  return {};
}

// One write at a time: the reads and writes of the index must not interleave.
let saving = Promise.resolve();
function remember(key, summary) {
  saving = saving.then(async () => {
    const { netIndex = [] } = await browser.storage.session.get("netIndex");
    const next = [...netIndex.filter((k) => k !== key), key];
    const drop = next.splice(0, Math.max(0, next.length - KEEP));
    await browser.storage.session.set({ [key]: summary, netIndex: next });
    if (drop.length) await browser.storage.session.remove(drop);
  }).catch(() => {});
}

browser.webRequest.onBeforeRequest.addListener((details) => {
  if (networkOn === false) return undefined; // off: no wait at all
  if (networkOn === true) return filterPage(details);
  return readSwitch().then((on) => (on ? filterPage(details) : {}));
}, { urls: ["<all_urls>"], types: ["main_frame"] }, ["blocking"]);

browser.runtime.onMessage.addListener((message) => {
  if (message?.type === "network-switch") {
    networkOn = Boolean(message.on);
    return browser.storage.local.set({ networkScan: networkOn }).then(() => true);
  }
  if (message?.type === "network") {
    const key = `net:${message.url}`;
    return results.has(message.url) ? Promise.resolve(results.get(message.url)) : browser.storage.session.get(key).then((s) => s[key] ?? null);
  }
  return undefined;
});
