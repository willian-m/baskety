import { describe, expect, it } from "vitest";

import { stockRatioColor } from "./stock.js";

describe("stockRatioColor", () => {
  it("no target -> muted, 0 width", () => {
    expect(stockRatioColor(5, 0)).toEqual({ className: "bg-muted-foreground", width: "0%" });
  });
  it("at or above target -> ok, full", () => {
    expect(stockRatioColor(2, 2)).toEqual({ className: "bg-ok", width: "100%" });
    expect(stockRatioColor(5, 2)).toEqual({ className: "bg-ok", width: "100%" });
  });
  it("half or more -> warn, proportional", () => {
    expect(stockRatioColor(1, 2)).toEqual({ className: "bg-warn", width: "50%" });
  });
  it("below half but positive -> danger, proportional", () => {
    expect(stockRatioColor(0.5, 2)).toEqual({ className: "bg-destructive", width: "25%" });
  });
  it("zero stock with target -> danger, sliver", () => {
    expect(stockRatioColor(0, 3)).toEqual({ className: "bg-destructive", width: "3%" });
  });
});
