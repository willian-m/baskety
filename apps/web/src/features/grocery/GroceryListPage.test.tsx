import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { server } from "../../test/server.js";

import { GroceryListPage } from "./GroceryListPage.js";

// Avoid React version mismatch: mock @baskety/core hooks to use the web app's own React
vi.mock("@baskety/core", async () => {
  const { useQuery, useMutation } = await import("@tanstack/react-query");

  return {
    useInventories: () =>
      useQuery({
        queryKey: ["inventories"],
        queryFn: () =>
          fetch("/api/v1/inventories")
            .then((r) => r.json())
            .then((r) => r.data),
      }),
    useGroceryList: (invId: string, listId: string) =>
      useQuery({
        queryKey: ["grocery-list", invId, listId],
        queryFn: () =>
          fetch(`/api/v1/inventories/${invId}/lists/${listId}`)
            .then((r) => r.json())
            .then((r) => r.data),
        enabled: !!invId && !!listId,
      }),
    useGroceryItems: (invId: string, listId: string) =>
      useQuery({
        queryKey: ["grocery-items", invId, listId],
        queryFn: () =>
          fetch(`/api/v1/inventories/${invId}/lists/${listId}/items`)
            .then((r) => r.json())
            .then((r) => r.data),
        enabled: !!invId && !!listId,
      }),
    useUpdateListItem: (invId: string, listId: string) =>
      useMutation({
        mutationFn: ({ itemId, status }: { itemId: string; status: string }) =>
          fetch(`/api/v1/inventories/${invId}/lists/${listId}/items/${itemId}/status`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
          })
            .then((r) => r.json())
            .then((r) => r.data),
      }),
    useAddListItem: (invId: string, listId: string) =>
      useMutation({
        mutationFn: (body: { name: string; quantity: number; unit: string }) =>
          fetch(`/api/v1/inventories/${invId}/lists/${listId}/items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
            .then((r) => r.json())
            .then((r) => r.data),
      }),
    useCompleteList: (invId: string, listId: string) =>
      useMutation({
        mutationFn: () =>
          fetch(`/api/v1/inventories/${invId}/lists/${listId}/complete`, {
            method: "POST",
          }).then(() => undefined),
      }),
  };
});

// Mock useParams and useNavigate to avoid complex router hierarchy with auth guards
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useParams: () => ({ listId: "test-list-id" }),
    useNavigate: () => vi.fn(),
  };
});

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <GroceryListPage />
    </QueryClientProvider>,
  );
}

describe("GroceryListPage", () => {
  it("shows loading state", () => {
    renderPage();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders grocery list items", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Test Grocery Item")).toBeInTheDocument());
  });

  it("toggles item from pending to bought", async () => {
    const user = userEvent.setup();
    let wasCalled = false;
    server.use(
      http.put("/api/v1/inventories/:invId/lists/:listId/items/:itemId/status", () => {
        wasCalled = true;
        return HttpResponse.json({
          data: {
            id: "item-1",
            grocery_list_id: "test-list-id",
            inventory_item_id: null,
            name: "Test Grocery Item",
            quantity: 1,
            unit: "pcs",
            notes: null,
            status: "bought",
            sort_order: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        });
      }),
    );

    renderPage();
    await waitFor(() => expect(screen.getByText("Test Grocery Item")).toBeInTheDocument());

    const checkbox = screen.getByRole("checkbox");
    await user.click(checkbox);

    await waitFor(() => expect(wasCalled).toBe(true));
  });

  it("shows complete list button", async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Complete list" })).toBeInTheDocument(),
    );
  });

  it("complete list button calls completeList", async () => {
    const user = userEvent.setup();
    let wasCalled = false;
    server.use(
      http.post("/api/v1/inventories/:invId/lists/:listId/complete", () => {
        wasCalled = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderPage();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Complete list" })).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: "Complete list" }));

    await waitFor(() => expect(wasCalled).toBe(true));
  });
});
