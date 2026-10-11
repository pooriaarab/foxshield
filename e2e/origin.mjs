// A static server in its own process, for a second origin on Ichabod.
// create-foxkit opens one shared tunnel per process, so every serve() in a
// process has the same public origin. A server in a child process gets its
// own tunnel, and so its own origin.
// Usage: node e2e/origin.mjs <dir>. Prints the URL, then serves until stdin closes.
import { serve } from "create-foxkit/e2e";

const server = await serve(process.argv[2]);
console.log(server.url);
process.stdin.resume();
process.stdin.on("close", async () => {
  await server.close();
  process.exit(0);
});
