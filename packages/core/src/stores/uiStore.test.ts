import { beforeEach, describe, expect, it } from "vitest";

import { useUiStore } from "./uiStore.js";

describe("uiStore theme", () => {
  beforeEach(() => {
    useUiStore.setState({ theme: "light" });
  });

  it("defaults to light", () => {
    expect(useUiStore.getState().theme).toBe("light");
  });

  it("toggleTheme flips light <-> dark", () => {
    useUiStore.getState().toggleTheme();
    expect(useUiStore.getState().theme).toBe("dark");
    useUiStore.getState().toggleTheme();
    expect(useUiStore.getState().theme).toBe("light");
  });

  it("setTheme sets explicitly", () => {
    useUiStore.getState().setTheme("dark");
    expect(useUiStore.getState().theme).toBe("dark");
  });
});
