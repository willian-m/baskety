import { useUiStore } from "@baskety/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { ThemeToggle } from "./ThemeToggle.js";

describe("ThemeToggle", () => {
  beforeEach(() => useUiStore.setState({ theme: "light" }));

  it("shows the moon in light mode and toggles to dark", () => {
    render(<ThemeToggle />);
    const btn = screen.getByRole("button", { name: /toggle theme/i });
    expect(btn).toHaveTextContent("☾");
    fireEvent.click(btn);
    expect(useUiStore.getState().theme).toBe("dark");
  });
});
