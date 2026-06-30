export type StockBarStyle = { className: string; width: string };

/** Mirrors the design canvas `si()` logic: pick a status color + bar width. */
export function stockRatioColor(stored: number, target: number): StockBarStyle {
  if (!target) return { className: "bg-muted-foreground", width: "0%" };
  const ratio = stored / target;
  if (ratio >= 1) return { className: "bg-ok", width: "100%" };
  if (ratio >= 0.5) return { className: "bg-warn", width: `${Math.round(ratio * 100)}%` };
  if (ratio > 0) return { className: "bg-destructive", width: `${Math.round(ratio * 100)}%` };
  return { className: "bg-destructive", width: "3%" };
}
