// Failure mode N3 in docs/failure-modes.md: what scanResponse keeps when a
// response is larger than maxBytes. Node has no DOMParser, so linkedom's
// stands in for the one in the extension's background page.
import { DOMParser } from "linkedom";
import { expect, it } from "vitest";
import { scanResponse, type StreamFilterLike } from "../src/index.js";

(globalThis as { DOMParser?: unknown }).DOMParser = DOMParser;

it("N3 stops keeping at the first chunk that does not fit, and passes every byte on", async () => {
  const written: number[] = [];
  const filter: StreamFilterLike = { ondata: null, onstop: null, onerror: null, write: (d) => { written.push(d.byteLength); }, close: () => {} };
  const done = scanResponse(filter, { maxBytes: 45 });
  const chunk = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;
  filter.ondata!({ data: chunk("<html><body><p>first part.</p>") });
  filter.ondata!({ data: chunk(`<p>${"x".repeat(60)}</p>`) });
  filter.ondata!({ data: chunk("<p>tail</p>") });
  filter.onstop!({});
  const report = (await done)!;
  expect(written).toEqual([30, 67, 11]);
  expect(report.bytes).toBe(108);
  expect(report.complete).toBe(false);
  expect(report.blocks.map((b) => b.text)).toEqual(["first part."]);
});
