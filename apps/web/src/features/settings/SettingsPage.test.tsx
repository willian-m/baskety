import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../test/renderWithProviders.js";

import { SettingsPage } from "./SettingsPage.js";

// @baskety/core uses Zustand 5 which resolves React 19 internally — a hook mismatch
// with the React 18 renderer used in tests. Mock the whole package to avoid it.
// vi.hoisted makes the fn available inside the vi.mock factory (which is hoisted).
const { createLLMMutateAsync, setTheme } = vi.hoisted(() => ({
  createLLMMutateAsync: vi.fn().mockResolvedValue({}),
  setTheme: vi.fn(),
}));

vi.mock("@baskety/core", () => ({
  useLLMProviders: () => ({
    data: [
      {
        id: "llm-1",
        provider: "openai",
        model: "gpt-4o-mini",
        is_default: true,
        has_api_key: false,
        endpoint_url: null,
        household_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    isLoading: false,
  }),
  useOCRProviders: () => ({
    data: [
      {
        id: "ocr-1",
        provider: "tesseract",
        is_default: true,
        has_api_key: false,
        endpoint_url: null,
        extra_config: null,
        household_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    isLoading: false,
  }),
  useHouseholds: () => ({
    data: [{ id: "hh-1", name: "Test Household", created_at: new Date().toISOString() }],
    isLoading: false,
  }),
  useCreateLLMProvider: () => ({
    mutateAsync: createLLMMutateAsync,
    isPending: false,
    isError: false,
  }),
  useUpdateLLMProvider: () => ({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
  }),
  useDeleteLLMProvider: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useCreateOCRProvider: () => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
    isError: false,
  }),
  useUpdateOCRProvider: () => ({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
  }),
  useDeleteOCRProvider: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useUiStore: (
    selector: (s: {
      activeHouseholdId: string | null;
      theme: "light" | "dark";
      setTheme: (theme: "light" | "dark") => void;
    }) => unknown,
  ) => selector({ activeHouseholdId: null, theme: "light", setTheme }),
  useInventories: () => ({ data: [], isLoading: false }),
  useCreateShareLink: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ token: "share-abc123" }),
    isPending: false,
  }),
}));

describe("SettingsPage", () => {
  it("renders page heading", async () => {
    renderWithProviders(() => <SettingsPage />);
    expect(await screen.findByRole("heading", { name: /settings/i })).toBeInTheDocument();
  });

  it("shows LLM providers list", async () => {
    renderWithProviders(() => <SettingsPage />);
    expect(await screen.findByText("openai / gpt-4o-mini")).toBeInTheDocument();
  });

  it("shows OCR providers list", async () => {
    renderWithProviders(() => <SettingsPage />);
    expect(await screen.findByText("tesseract")).toBeInTheDocument();
  });

  it("shows household name", async () => {
    renderWithProviders(() => <SettingsPage />);
    expect(await screen.findByText("Test Household")).toBeInTheDocument();
  });

  it("shows LLM add form when 'Add provider' clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(() => <SettingsPage />);
    await screen.findByText("openai / gpt-4o-mini");

    const llmSection = screen.getByText("LLM Providers").closest("section")!;
    await user.click(within(llmSection).getByRole("button", { name: "Add provider" }));

    expect(within(llmSection).getByRole("combobox", { name: "Provider" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/model \(e\.g\. gpt-4o\)/i)).toBeInTheDocument();
  });

  it("calls mutateAsync with form data when LLM form submitted", async () => {
    const user = userEvent.setup();

    renderWithProviders(() => <SettingsPage />);
    await screen.findByText("openai / gpt-4o-mini");

    const llmSection = screen.getByText("LLM Providers").closest("section")!;
    await user.click(within(llmSection).getByRole("button", { name: "Add provider" }));

    await user.selectOptions(
      within(llmSection).getByRole("combobox", { name: "Provider" }),
      "openai",
    );
    await user.type(screen.getByPlaceholderText(/model \(e\.g\. gpt-4o\)/i), "gpt-4o");
    await user.click(within(llmSection).getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(createLLMMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ provider: "openai", model: "gpt-4o" }),
      );
    });
  });

  it("marks the Light theme card as selected (mock default theme)", async () => {
    renderWithProviders(() => <SettingsPage />);
    const appearance = (await screen.findByText("Appearance")).closest("section")!;
    const lightButton = within(appearance).getByRole("button", { pressed: true });
    expect(within(lightButton).getByText("Light")).toBeInTheDocument();
    expect(within(lightButton).getByText("✓")).toBeInTheDocument();
  });

  it("calls setTheme('dark') when the Dark card is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(() => <SettingsPage />);
    const appearance = (await screen.findByText("Appearance")).closest("section")!;
    const darkButton = within(appearance).getByText("Dark").closest("button")!;
    await user.click(darkButton);
    expect(setTheme).toHaveBeenCalledWith("dark");
  });
});
