const AIRPORTS = {"YYZ":"Toronto Pearson","YVR":"Vancouver","YUL":"Montreal Trudeau","JFK":"New York JFK","SFO":"San Francisco","LAX":"Los Angeles","BCN":"Barcelona El Prat","MAD":"Madrid Barajas","LHR":"London Heathrow","CDG":"Paris Charles de Gaulle","FRA":"Frankfurt","AMS":"Amsterdam Schiphol","LIS":"Lisbon","NRT":"Tokyo Narita"};
for (const name of ["from", "to"]) {
  const input = document.getElementById(name), list = document.getElementById(name + "-list");
  const hidden = input.form.elements[name];
  const pick = (code) => { input.value = AIRPORTS[code] + " (" + code + ")"; hidden.value = code; list.hidden = true; input.setAttribute("aria-expanded", "false"); };
  input.addEventListener("input", () => {
    hidden.value = "";
    const q = input.value.trim().toLowerCase();
    const hits = Object.entries(AIRPORTS).filter(([c, n]) => q && (c.toLowerCase().startsWith(q) || n.toLowerCase().includes(q))).slice(0, 6);
    list.innerHTML = hits.map(([c, n]) => '<li role="option" id="' + name + '-' + c + '" data-code="' + c + '">' + n + " (" + c + ")</li>").join("");
    list.hidden = !hits.length;
    input.setAttribute("aria-expanded", String(!!hits.length));
  });
  list.addEventListener("mousedown", (e) => { const li = e.target.closest("li"); if (li) { e.preventDefault(); pick(li.dataset.code); } });
  input.addEventListener("keydown", (e) => { const first = list.querySelector("li"); if (e.key === "Enter" && first && !list.hidden) { e.preventDefault(); pick(first.dataset.code); } });
  input.addEventListener("blur", () => setTimeout(() => { list.hidden = true; }, 150));
}
const cal = document.getElementById("calendar");
let target = null, month = new Date(Date.UTC(2026, 9, 1));
const iso = (d) => d.toISOString().slice(0, 10);
function draw() {
  const y = month.getUTCFullYear(), m = month.getUTCMonth(), days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const lead = new Date(Date.UTC(y, m, 1)).getUTCDay();
  let cells = "";
  for (let i = 0; i < lead; i++) cells += "<span></span>";
  for (let d = 1; d <= days; d++) {
    const day = new Date(Date.UTC(y, m, d)), label = day.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
    cells += '<button type="button" data-date="' + iso(day) + '" aria-label="' + label + '"' + (iso(day) < "2026-10-08" ? " disabled" : "") + ">" + d + "</button>";
  }
  cal.innerHTML = '<div class="row"><button type="button" data-step="-1" aria-label="Previous month">‹</button><strong>' +
    month.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }) + '</strong><button type="button" data-step="1" aria-label="Next month">›</button></div><div class="grid">' + cells + "</div>";
}
for (const input of document.querySelectorAll("input.date")) {
  input.addEventListener("focus", () => { target = input; cal.hidden = false; draw(); input.after(cal); });
  input.addEventListener("input", () => { input.form.elements[input.id].value = ""; });
}
cal.addEventListener("mousedown", (e) => e.preventDefault());
cal.addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.step) { month = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + Number(b.dataset.step), 1)); draw(); return; }
  target.value = new Date(b.dataset.date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  target.form.elements[target.id].value = b.dataset.date; cal.hidden = true; target.blur();
});
document.addEventListener("mousedown", (e) => { if (!cal.contains(e.target) && !e.target.classList.contains("date")) cal.hidden = true; });
for (const r of document.querySelectorAll("input[name=trip]")) r.addEventListener("change", () => { document.getElementById("return").disabled = r.value === "oneway" && r.checked; });