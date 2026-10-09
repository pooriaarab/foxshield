// Like scanDocument, these functions are self-contained, so an extension can
// pass them to scripting.executeScript. So this rule is off here.
// oxlint-disable unicorn/consistent-function-scoping

/** What the overlay needs from a finding. */
export interface OverlayItem {
  selector: string;
  kind: string;
  score: number;
}

/**
 * Draws a box over each finding's element, in a closed shadow root on one
 * host element, so page scripts cannot read or restyle the boxes. A hidden
 * element gets a dashed box on its nearest ancestor that has a box on the
 * screen. Returns the number of boxes drawn. A second call replaces the first.
 */
export function showOverlay(items: OverlayItem[]): number {
  const MARK = "data-foxshield-overlay";
  for (const old of Array.from(document.querySelectorAll(`[${MARK}]`))) old.remove();
  const host = document.createElement("foxshield-overlay");
  host.setAttribute(MARK, "");
  host.setAttribute("style", "all:initial !important;position:absolute !important;left:0 !important;top:0 !important;z-index:2147483647 !important;pointer-events:none !important;display:block !important");
  const shadow = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = `.box{position:absolute;box-sizing:border-box;border:3px solid #d70022;background:rgba(215,0,34,.12);border-radius:3px}
.box.low{border-color:#b45309;background:rgba(180,83,9,.08)} .box.hidden{border-style:dashed}
.tag{position:absolute;left:-3px;top:-22px;font:600 12px/18px system-ui,sans-serif;color:#fff;background:#d70022;padding:0 6px;border-radius:3px;white-space:nowrap}
.low .tag{background:#b45309}`;
  shadow.append(style);

  const shows = (r: DOMRect) => r.width > 2 && r.height > 2 && r.right > 0 && r.bottom > 0;
  /** Finds the element, crossing `>>>` into shadow roots and same-origin iframes. Returns it with the frame offset. */
  const resolve = (selector: string): [Element, number, number] | null => {
    let root: Document | ShadowRoot = document;
    let x = 0;
    let y = 0;
    let el: Element | null = null;
    for (const part of selector.split(" >>> ")) {
      if (el) {
        if (el instanceof HTMLIFrameElement && el.contentDocument) {
          const r = el.getBoundingClientRect();
          x += r.left + el.clientLeft;
          y += r.top + el.clientTop;
          root = el.contentDocument;
        } else if (el.shadowRoot) root = el.shadowRoot;
        else return null;
      }
      try { el = root.querySelector(part); } catch { return null; }
      if (!el) return null;
    }
    return el ? [el, x, y] : null;
  };

  let drawn = 0;
  for (const item of items) {
    const found = resolve(item.selector);
    if (!found) continue;
    let [el] = found;
    const [, x, y] = found;
    let hidden = false;
    while (!shows(el.getBoundingClientRect()) && el.parentElement) {
      el = el.parentElement;
      hidden = true;
    }
    const r = el.getBoundingClientRect();
    const box = document.createElement("div");
    box.className = `box${item.score < 0.5 ? " low" : ""}${hidden ? " hidden" : ""}`;
    box.style.cssText = `left:${r.left + x + scrollX}px;top:${r.top + y + scrollY}px;width:${r.width}px;height:${r.height}px`;
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = `${hidden ? "hidden here: " : ""}${item.kind} ${item.score.toFixed(2)}`;
    box.append(tag);
    shadow.append(box);
    drawn += 1;
  }
  document.documentElement.append(host);
  return drawn;
}

/** Removes the overlay. Returns the number of overlay hosts removed. */
export function clearOverlay(): number {
  const hosts = Array.from(document.querySelectorAll("[data-foxshield-overlay]"));
  for (const host of hosts) host.remove();
  return hosts.length;
}
