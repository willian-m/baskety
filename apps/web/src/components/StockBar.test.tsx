import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StockBar } from "./StockBar.js";

describe("StockBar", () => {
  it("renders a fill at the computed width and color", () => {
    const { container } = render(<StockBar stored={1} target={2} />);
    const fill = container.querySelector("[data-testid='stock-fill']") as HTMLElement;
    expect(fill).toBeTruthy();
    expect(fill.style.width).toBe("50%");
    expect(fill.className).toContain("bg-warn");
  });
});
