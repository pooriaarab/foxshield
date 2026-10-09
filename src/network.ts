import { scanDocument } from "./page.js";
import type { ScanOptions, ScanReport } from "./types.js";

/** The part of Firefox's `webRequest.StreamFilter` that scanResponse uses. */
export interface StreamFilterLike {
  ondata: ((event: { data: ArrayBuffer }) => void) | null;
  onstop: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  error?: string;
  write(data: ArrayBuffer | Uint8Array): void;
  close(): void;
}

export interface ResponseScanOptions extends ScanOptions {
  /** Keep at most this many bytes for the scan. The page still gets every byte. Default 5 MB. */
  maxBytes?: number;
  /** The response charset. Default "utf-8". */
  charset?: string;
  /** Called when the response ends. Return false to skip the scan (for example, not text/html). */
  isHtml?: () => boolean;
}

export type ResponseReport = ScanReport & { bytes: number; complete: boolean };

/**
 * Scans an HTML response as it arrives, from a Firefox extension:
 * `scanResponse(browser.webRequest.filterResponseData(requestId))`.
 * Each chunk goes on to the page at once and unchanged. When the response
 * ends, the kept bytes are parsed with DOMParser and scanned in static mode
 * (no layout exists yet). Resolves null when `isHtml` says no.
 */
export function scanResponse(filter: StreamFilterLike, options: ResponseScanOptions = {}): Promise<ResponseReport | null> {
  const maxBytes = options.maxBytes ?? 5_000_000;
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    let kept = 0;
    let full = false;
    filter.ondata = (event) => {
      filter.write(event.data);
      bytes += event.data.byteLength;
      // Stop keeping at the first chunk that does not fit, so the scan never reads text with a hole in it.
      if (!full && kept + event.data.byteLength <= maxBytes) {
        chunks.push(new Uint8Array(event.data.slice(0)));
        kept += event.data.byteLength;
      } else full = true;
    };
    filter.onstop = () => {
      filter.close();
      if (options.isHtml && !options.isHtml()) return resolve(null);
      const all = new Uint8Array(kept);
      let at = 0;
      for (const c of chunks) { all.set(c, at); at += c.byteLength; }
      const doc = new DOMParser().parseFromString(new TextDecoder(options.charset ?? "utf-8").decode(all), "text/html");
      resolve({ ...scanDocument(doc, { ...options, mode: "static" }), bytes, complete: kept === bytes });
    };
    // StreamFilter's documented API is the on* handlers; this module owns the filter.
    // oxlint-disable-next-line unicorn/prefer-add-event-listener
    filter.onerror = () => reject(new Error(filter.error || "the response filter failed"));
  });
}
