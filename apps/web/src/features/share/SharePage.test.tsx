import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../test/renderWithProviders.js";
import { server } from "../../test/server.js";

import { SharePage } from "./SharePage.js";

vi.mock("../../routes/share.$token.js", () => ({
  Route: { useParams: () => ({ token: "test-token" }) },
}));

describe("SharePage", () => {
  it("shows loading state then resolves", async () => {
    server.use(
      http.get("/api/v1/share/:token/inventory", async () => {
        await new Promise((r) => setTimeout(r, 150));
        return HttpResponse.json({ data: { inventory_id: "inv-1", items: [] } });
      }),
    );

    renderWithProviders(() => <SharePage />);
    expect(await screen.findByText("Loading shared inventory…")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText("Loading shared inventory…")).not.toBeInTheDocument(),
    );
  });

  it("renders shared inventory items", async () => {
    renderWithProviders(() => <SharePage />);

    expect(await screen.findByRole("heading", { name: "Shared Inventory" })).toBeInTheDocument();
    expect(await screen.findByText("Test Item")).toBeInTheDocument();

    expect(screen.queryByRole("button", { name: /add/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
  });

  it("shows empty state when no items", async () => {
    server.use(
      http.get("/api/v1/share/:token/inventory", () =>
        HttpResponse.json({ data: { inventory_id: "inv-1", items: [] } }),
      ),
    );

    renderWithProviders(() => <SharePage />);
    expect(await screen.findByText("No items found.")).toBeInTheDocument();
  });

  it("shows password form on 401", async () => {
    server.use(
      http.get("/api/v1/share/:token/inventory", () => new HttpResponse(null, { status: 401 })),
    );

    renderWithProviders(() => <SharePage />);
    expect(await screen.findByRole("heading", { name: "Password required" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unlock" })).toBeInTheDocument();
  });

  it("shows 'Incorrect password' after submitting wrong password", async () => {
    server.use(
      http.get("/api/v1/share/:token/inventory", () => new HttpResponse(null, { status: 401 })),
    );

    const user = userEvent.setup();
    renderWithProviders(() => <SharePage />);
    expect(await screen.findByRole("heading", { name: "Password required" })).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Enter password"), "wrongpass");
    await user.click(screen.getByRole("button", { name: "Unlock" }));

    expect(await screen.findByText("Incorrect password, please try again.")).toBeInTheDocument();
  });

  it("shows 'Access denied' on non-401 error", async () => {
    server.use(
      http.get("/api/v1/share/:token/inventory", () => new HttpResponse(null, { status: 500 })),
    );

    renderWithProviders(() => <SharePage />);
    expect(await screen.findByText("Access denied.")).toBeInTheDocument();
  });
});
