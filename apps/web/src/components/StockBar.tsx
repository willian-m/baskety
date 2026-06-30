import { stockRatioColor } from "../lib/stock.js";

type Props = { stored: number; target: number };

export function StockBar({ stored, target }: Props) {
  const { className, width } = stockRatioColor(stored, target);
  const percent = target > 0 ? Math.max(0, Math.min(100, Math.round((stored / target) * 100))) : 0;
  return (
    <div
      role="progressbar"
      aria-label="Stock level"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className="h-[5px] overflow-hidden rounded-[3px] bg-secondary"
    >
      <div
        data-testid="stock-fill"
        className={`h-full rounded-[3px] ${className}`}
        style={{ width }}
      />
    </div>
  );
}
