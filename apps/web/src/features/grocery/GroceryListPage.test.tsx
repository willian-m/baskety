import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { groceryItemFixture, groceryListFixture } from "../../test/fixtures.js";
import { server } from "../../test/server.js";

import { GroceryListPage } from "./GroceryListPage.js";

const mockNavigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ listId: "test-list-id" }),
  useNavigate: () => mockNavigate,
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("GroceryListPage", () => {
  it("shows loading state then resolves", async () => {
    renderWithProviders(<GroceryListPage />);
    const loading = screen.getByText("Loading…");
    expect(loading).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Loading…")).not.toBeInTheDocument());
  });

  it("renders grocery list items", async () => {
    renderWithProviders(<GroceryListPage />);
    await waitFor(() => expect(screen.getByText("Test Grocery Item")).toBeInTheDocument());
  });

  it("toggles item from pending to bought", async () => {
    const user = userEvent.setup();
    let capturedBody: unknown;
    server.use(
      http.put(
        "/api/v1/inventories/:invId/lists/:listId/items/:itemId/status",
        async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json({ data: groceryItemFixture({ status: "bought" }) });
        },
      ),
    );
    renderWithProviders(<GroceryListPage />);
    const checkbox = await screen.findByRole("checkbox");
    await user.click(checkbox);
    await waitFor(() => expect((capturedBody as { status: string }).status).toBe("bought"));
  });

  it("shows complete list button", async () => {
    renderWithProviders(<GroceryListPage />);
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

    renderWithProviders(<GroceryListPage />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Complete list" })).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: "Complete list" }));

    await waitFor(() => expect(wasCalled).toBe(true));
  });

  it("hides complete button when list is already completed", async () => {
    server.use(
      http.get("/api/v1/inventories/:invId/lists/:listId", ({ params }) =>
        HttpResponse.json({
          data: groceryListFixture({ id: params.listId as string, status: "completed" }),
        }),
      ),
    );
    renderWithProviders(<GroceryListPage />);
    await screen.findByText("Test Grocery Item"); // wait for data to load
    expect(screen.queryByRole("button", { name: /complete list/i })).not.toBeInTheDocument();
  });
});
