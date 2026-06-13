import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { inventoryItemFixture } from "../../test/fixtures.js";
import { renderWithProviders } from "../../test/renderWithProviders.js";
import { server } from "../../test/server.js";

import { InventoryPage } from "./InventoryPage.js";

describe("InventoryPage", () => {
  it("shows loading state initially", async () => {
    // Delay the inventories response so we can catch the loading state
    server.use(
      http.get("/api/v1/inventories", async () => {
        await new Promise((r) => setTimeout(r, 200));
        return HttpResponse.json({ data: [] });
      }),
    );

    renderWithProviders(() => <InventoryPage />);

    // The loading text appears once the router has mounted the component
    // but before the async fetch resolves
    const loadingEl = await screen.findByText("Loading…");
    expect(loadingEl).toBeInTheDocument();
  });

  it("renders inventory items after load", async () => {
    renderWithProviders(() => <InventoryPage />);

    // Wait for the items to appear
    await waitFor(() => {
      expect(screen.getByText("Test Item")).toBeInTheDocument();
    });
  });

  it("filters items by search text", async () => {
    const user = userEvent.setup();
    // Return two items with different names
    server.use(
      http.get("/api/v1/inventories/:id/items", () =>
        HttpResponse.json({
          data: [
            inventoryItemFixture({ name: "Apple", category: "Fruit" }),
            inventoryItemFixture({ name: "Milk", category: "Dairy" }),
          ],
        }),
      ),
    );

    renderWithProviders(() => <InventoryPage />);

    await waitFor(() => {
      expect(screen.getByText("Apple")).toBeInTheDocument();
      expect(screen.getByText("Milk")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Search items…");
    await user.type(searchInput, "Apple");

    expect(screen.getByText("Apple")).toBeInTheDocument();
    expect(screen.queryByText("Milk")).not.toBeInTheDocument();
  });

  it("shows SetupWizard when no inventory exists", async () => {
    server.use(http.get("/api/v1/inventories", () => HttpResponse.json({ data: [] })));

    renderWithProviders(() => <InventoryPage />);

    // SetupWizard should appear when inventories list is empty
    await waitFor(() => {
      // The SetupWizard renders when no inventoryId
      expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
    });

    // No inventory means SetupWizard is rendered, not the main inventory view
    expect(screen.queryByPlaceholderText("Search items…")).not.toBeInTheDocument();
  });

  it("shows 'Add this item' when search has no matches, revealing a pre-filled row", async () => {
    const user = userEvent.setup();
    renderWithProviders(() => <InventoryPage />);

    await waitFor(() => {
      expect(screen.getByText("Test Item")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Search items…");
    await user.type(searchInput, "Quinoa");

    const addThis = await screen.findByRole("button", { name: "Add this item" });
    await user.click(addThis);

    // The pre-filled new item row appears with the searched name
    const nameInput = await screen.findByLabelText("New item name");
    expect(nameInput).toHaveValue("Quinoa");
  });
});
