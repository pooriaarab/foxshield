// The demo popup: "Scan this page" asks the background to scan the active
// tab, lists the findings, and the background highlights them in the page.
// Page text goes in with textContent only, never as HTML.
const params = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);

async function tabId() {
  if (params.has("tab")) return Number(params.get("tab"));
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

function item(f, threshold) {
  const li = document.createElement("li");
  li.className = f.score >= threshold ? "high" : "low";
  const head = document.createElement("div");
  const kind = Object.assign(document.createElement("span"), { className: "kind", textContent: f.kind });
  const score = Object.assign(document.createElement("span"), { className: "score", textContent: f.score.toFixed(2) });
  head.append(kind, score);
  const reason = Object.assign(document.createElement("p"), { className: "reason", textContent: f.reason });
  const text = Object.assign(document.createElement("p"), { className: "text", textContent: `"${f.text.slice(0, 220)}"` });
  li.append(head, reason, text);
  return li;
}

$("scan").addEventListener("click", async () => {
  $("status").textContent = "Scanning...";
  $("findings").replaceChildren();
  const result = await browser.runtime.sendMessage({ type: "scan", tabId: await tabId() });
  if (!result || result.error) {
    $("status").textContent = `Cannot scan this page: ${result?.error ?? "no answer"}`;
    return;
  }
  const { report, threshold } = result;
  const high = report.findings.filter((f) => f.score >= threshold).length;
  $("status").textContent = `${high} of ${report.findings.length} findings at or above ${threshold}${report.truncated ? " (scan stopped early)" : ""}.`;
  $("findings").replaceChildren(...report.findings.map((f) => item(f, threshold)));
});

$("clear").addEventListener("click", async () => {
  await browser.runtime.sendMessage({ type: "clear", tabId: await tabId() });
  $("findings").replaceChildren();
  $("status").textContent = "";
});

$("all").addEventListener("change", (e) => document.body.classList.toggle("all", e.target.checked));
