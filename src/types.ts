/** How a piece of text hides from a person, or why the text looks like an attack. */
export type FindingKind =
  | "instruction"
  | "invisible-chars"
  | "bidi"
  | "homoglyph"
  | "display-none"
  | "not-rendered"
  | "visibility-hidden"
  | "opacity-zero"
  | "offscreen"
  | "clipped"
  | "tiny-font"
  | "low-contrast"
  | "aria-hidden"
  | "comment"
  | "noscript"
  | "attribute"
  | "pseudo-content";

export interface Finding {
  kind: FindingKind;
  /** The text, cut to 500 characters. For tag characters, the decoded message. */
  text: string;
  /** A CSS selector for the element. `>>>` crosses into a shadow root or an iframe. */
  selector: string;
  /** The hiding technique and the instruction rules that matched, joined by ", ". */
  reason: string;
  /** From 0 to 1. Treat 0.5 or more as suspicious. */
  score: number;
}

/** One run of visible text, in page order. sanitize() builds its output from these. */
export interface Block {
  selector: string;
  text: string;
  /** Set when instruction rules match the text. */
  score?: number;
  reason?: string;
}

export interface ScanOptions {
  /** Stop after this many elements. Default 50000. */
  maxNodes?: number;
  /** Stop after this many milliseconds. Default 3000. */
  maxMs?: number;
  /**
   * "live" reads computed styles and layout boxes (a real browser).
   * "static" reads inline styles and `<style>` rules only (Node).
   * The default is "live" when the document has layout, else "static".
   */
  mode?: "live" | "static";
}

export interface ScanReport {
  mode: "live" | "static";
  /** Highest score first. */
  findings: Finding[];
  blocks: Block[];
  /** True when the scan stopped at maxNodes or maxMs. */
  truncated: boolean;
  /** Elements visited. */
  nodes: number;
  ms: number;
  /** Cross-origin frames the scan could not read. */
  skippedFrames: number;
}
