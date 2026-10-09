// Precision and recall against foxbench's traps. A flagged finding (score at
// or above the threshold) is a true positive when it is on a trap page and
// holds that page's trap marker. Every other flagged finding is a false
// positive. A trap page is caught when it has at least one true positive.
export function score(results, threshold) {
  const rows = results.map(({ page, report }) => {
    const flagged = report.findings.filter((f) => f.score >= threshold);
    const hits = page.marker ? flagged.filter((f) => f.text.includes(page.marker)) : [];
    const top = report.findings[0];
    return { page: page.name, trap: page.trap, flagged: flagged.length, truePositives: hits.length, caught: page.trap ? hits.length > 0 : null,
      top: top ? `${top.kind} ${top.score}` : "-", ms: report.ms };
  });
  const flagged = rows.reduce((n, r) => n + r.flagged, 0);
  const tp = rows.reduce((n, r) => n + r.truePositives, 0);
  const traps = rows.filter((r) => r.trap);
  const summary = {
    pages: rows.length, trapPages: traps.length, trapsCaught: traps.filter((r) => r.caught).length,
    normalPagesFlagged: rows.filter((r) => !r.trap && r.flagged > 0).length,
    flaggedFindings: flagged, truePositives: tp, falsePositives: flagged - tp,
    precision: flagged ? Math.round((tp / flagged) * 1000) / 1000 : null,
    recall: traps.length ? Math.round((traps.filter((r) => r.caught).length / traps.length) * 1000) / 1000 : null,
  };
  return { rows, summary };
}

/** A Markdown table of the rows and the summary. */
export function table({ rows, summary }) {
  const lines = ["| Page | Trap | Flagged | True positives | Top finding | ms |", "|---|---|---|---|---|---|"];
  for (const r of rows) lines.push(`| ${r.page} | ${r.trap ?? "-"} | ${r.flagged} | ${r.truePositives} | ${r.top} | ${r.ms} |`);
  lines.push("", `Precision ${summary.precision} (${summary.truePositives} of ${summary.flaggedFindings} flagged findings). `
    + `Recall ${summary.recall} (${summary.trapsCaught} of ${summary.trapPages} trap pages). Normal pages with a flagged finding: ${summary.normalPagesFlagged} of ${summary.pages - summary.trapPages}.`);
  return lines.join("\n");
}
