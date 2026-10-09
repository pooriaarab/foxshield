// Saves foxbench's mock pages as fixtures for the E2E test, so the test
// needs no foxbench checkout. Run it again when foxbench changes:
//   node scripts/capture-foxbench.mjs <a built foxbench checkout>
// It writes e2e/fixtures/generated/foxbench/: one HTML file per page, the
// assets the pages load, and pages.json (which pages carry a trap).
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(process.argv[2] ?? "");
const fbn = await import(pathToFileURL(join(root, "dist/index.js")).href);
const out = "e2e/fixtures/generated/foxbench";
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const server = await fbn.startServer({ sites: fbn.sites, tasks: fbn.tasks });
const get = async (path) => {
  const res = await fetch(server.url + path);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.text();
};
const save = (file, text) => { mkdirSync(dirname(join(out, file)), { recursive: true }); writeFileSync(join(out, file), text); };

// A trap page's marker is a phrase from its trap text. A finding that holds it found the trap.
const TRAPS = {
  "flights-trap": ["trap-flights-book", "AI booking assistants", null],
  "signup-trap": ["trap-signup", "automated assistants", "/signup/"],
  "mail-trap": ["trap-mail-m8", "SYSTEM MESSAGE", "/mail/m/m8"],
  "shop-trap": ["trap-shop-mug", "AI shopping assistants", "/shop/p/trail-mug"],
};
const NORMAL = {
  home: "/", flights: "/flights/", "flights-trips": "/flights/trips", signup: "/signup/", "signup-contact": "/signup/contact",
  "mail-inbox": "/mail/", "mail-m1": "/mail/m/m1", "mail-m2": "/mail/m/m2", "mail-m6": "/mail/m/m6", "mail-compose-m1": "/mail/compose?reply=m1",
  shop: "/shop/", "shop-mug": "/shop/p/trail-mug", "shop-hoodie": "/shop/p/merino-hoodie", "shop-giftcard": "/shop/p/gift-card",
  "shop-cart": "/shop/cart", "shop-checkout": "/shop/checkout",
};
const results = "/flights/results?trip=oneway&from=LIS&to=MAD&depart=2026-10-30&pax=1";
const bookPath = async () => `/flights/book?offer=${encodeURIComponent((await get(results)).match(/data-offer="([^"]+)"/)[1])}&pax=1`;

const pages = [];
try {
  server.reset();
  NORMAL["flights-results"] = results;
  NORMAL["flights-book"] = await bookPath();
  for (const [name, path] of Object.entries(NORMAL)) {
    save(`${name}.html`, await get(path));
    pages.push({ name, path, trap: null, marker: null });
  }
  for (const [task, [name, marker, path]] of Object.entries(TRAPS)) {
    server.reset(fbn.taskById(task));
    const p = path ?? (await bookPath());
    const html = await get(p);
    if (!html.includes(marker)) throw new Error(`${name}: the trap text "${marker}" is not on ${p}`);
    save(`${name}.html`, html);
    pages.push({ name, path: p, trap: task, marker });
  }
  save("__fbn/style.css", await get("/__fbn/style.css"));
  save("flights/app.js", await get("/flights/app.js"));
  const commit = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  save("pages.json", `${JSON.stringify({ source: `foxbench ${commit}`, pages }, null, 2)}\n`);
  console.log(`Saved ${pages.length} pages from foxbench ${commit.slice(0, 7)} to ${out}.`);
} finally {
  await server.close();
}
