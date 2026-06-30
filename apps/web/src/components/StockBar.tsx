import { stockRatioColor } from "../lib/stock.js";

type Props = { stored: number; target: number };

export function StockBar({ stored, target }: Props) {
  const { className, width } = stockRatioColor(stored, target);
  return (
    <div className="h-[5px] overflow-hidden rounded-[3px] bg-secondary">
      <div
        data-testid="stock-fill"
        className={`h-full rounded-[3px] ${className}`}
        style={{ width }}
      />
    </div>
  );
}
