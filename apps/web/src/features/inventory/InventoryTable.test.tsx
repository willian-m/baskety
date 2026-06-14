import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { batchFixture, inventoryItemFixture } from "../../test/fixtures.js";
import { renderWithProviders } from "../../test/renderWithProviders.js";
import { server } from "../../test/server.js";

import { InventoryPage } from "./InventoryPage.js";
import { InventoryTable } from "./InventoryTable.js";

const BASE = "/api/v1";
const INV_ID = "inv-1";

function makeItems() {
  return [
    inventoryItemFixture({
      id: "item-rice",
      name: "Rice",
      category: "Non perishable",
      unit: "kg",
      stored_quantity: 2,
      target_quantity: 5,
      batch_count: 1,
    }),
    inventoryItemFixture({
      id: "item-beans",
      name: "Beans",
      category: "Non perishable",
      unit: "kg",
      stored_quantity: 1,
      target_quantity: 3,
      batch_count: 1,
    }),
    inventoryItemFixture({
      id: "item-milk",
      name: "Milk",
      category: "Dairy",
      unit: "L",
      stored_quantity: 1.5,
      target_quantity: 4,
      batch_count: 2,
    }),
  ];
}

const UNCATEGORIZED = "Uncategorized";

function applyFilters(items: ReturnType<typeof makeItems>, search: string, categoryFilter: string) {
  return items.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const effectiveCategory = item.category || UNCATEGORIZED;
    const matchesCategory = !categoryFilter || effectiveCategory === categoryFilter;
    return matchesSearch && matchesCategory;
  });
}

type RenderTableProps = Partial<React.ComponentProps<typeof InventoryTable>> & {
  search?: string;
  categoryFilter?: string;
};

function renderTable(props?: RenderTableProps) {
  const search = props?.search ?? "";
  const categoryFilter = props?.categoryFilter ?? "";
  const rawItems = props?.items ?? makeItems();
  const items = applyFilters(rawItems, search, categoryFilter);
  return renderWithProviders(() => (
    <InventoryTable
      inventoryId={INV_ID}
      items={items}
      newItemName={props?.newItemName ?? ""}
      onNewItemSaved={props?.onNewItemSaved ?? (() => {})}
    />
  ));
}

describe("InventoryTable", () => {
  it("groups items under bold category section headers", async () => {
    renderTable();

    // Section headers
    expect(await screen.findByText("Non perishable")).toBeInTheDocument();
    expect(screen.getByText("Dairy")).toBeInTheDocument();

    // Items present
    expect(screen.getByText("Rice")).toBeInTheDocument();
    expect(screen.getByText("Beans")).toBeInTheDocument();
    expect(screen.getByText("Milk")).toBeInTheDocument();
  });

  it("category filter hides non-matching sections entirely", async () => {
    renderTable({ categoryFilter: "Dairy" });

    expect(await screen.findByText("Dairy")).toBeInTheDocument();
    expect(screen.getByText("Milk")).toBeInTheDocument();

    // Non perishable section + its items are gone
    expect(screen.queryByText("Non perishable")).not.toBeInTheDocument();
    expect(screen.queryByText("Rice")).not.toBeInTheDocument();
    expect(screen.queryByText("Beans")).not.toBeInTheDocument();
  });

  it("search filters items and hides empty section headers", async () => {
    renderTable({ search: "rice" });

    expect(await screen.findByText("Rice")).toBeInTheDocument();
    expect(screen.getByText("Non perishable")).toBeInTheDocument();

    // Beans filtered out
    expect(screen.queryByText("Beans")).not.toBeInTheDocument();
    // Dairy section header hidden because Milk doesn't match
    expect(screen.queryByText("Dairy")).not.toBeInTheDocument();
    expect(screen.queryByText("Milk")).not.toBeInTheDocument();
  });

  it("inline editing: clicking a row reveals inputs; Enter saves via mutation", async () => {
    const user = userEvent.setup();
    const update = vi.fn();
    server.use(
      http.put(`${BASE}/inventories/:invId/items/:itemId`, async ({ request, params }) => {
        update(await request.json());
        return HttpResponse.json({
          data: inventoryItemFixture({ id: params.itemId }),
        });
      }),
    );

    renderTable();

    await user.click(await screen.findByText("Rice"));

    const nameInput = await screen.findByLabelText("Item name");
    expect(nameInput).toHaveValue("Rice");

    await user.clear(nameInput);
    await user.type(nameInput, "Brown Rice");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(update).toHaveBeenCalledTimes(1);
    });
    expect(update.mock.calls[0]![0]).toMatchObject({ name: "Brown Rice" });
  });

  it("inline editing: Escape cancels without calling the mutation", async () => {
    const user = userEvent.setup();
    const update = vi.fn();
    server.use(
      http.put(`${BASE}/inventories/:invId/items/:itemId`, async ({ request, params }) => {
        update(await request.json());
        return HttpResponse.json({
          data: inventoryItemFixture({ id: params.itemId }),
        });
      }),
    );

    renderTable();

    await user.click(await screen.findByText("Rice"));
    const nameInput = await screen.findByLabelText("Item name");
    await user.clear(nameInput);
    await user.type(nameInput, "Wild Rice");
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByLabelText("Item name")).not.toBeInTheDocument();
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("batch disclosure: only items with batch_count > 1 show a toggle; expanding loads sub-rows", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${BASE}/inventories/:invId/items/:itemId/batches`, () =>
        HttpResponse.json({
          data: [
            batchFixture({ id: "b1", quantity: 1, expires_at: null }),
            batchFixture({
              id: "b2",
              quantity: 0.5,
              expires_at: "2030-01-01T00:00:00Z",
            }),
          ],
        }),
      ),
    );

    renderTable();

    // Milk (batch_count 2) has a toggle; Rice (batch_count 1) does not.
    const expandBtn = await screen.findByRole("button", { name: "Expand batches" });
    expect(screen.getAllByRole("button", { name: "Expand batches" })).toHaveLength(1);

    await user.click(expandBtn);

    await waitFor(() => {
      expect(screen.getByText(/└ Batch 1 L/)).toBeInTheDocument();
    });
    expect(screen.getByText("View details →")).toBeInTheDocument();

    // Collapse
    await user.click(screen.getByRole("button", { name: "Collapse batches" }));
    await waitFor(() => {
      expect(screen.queryByText(/└ Batch 1 L/)).not.toBeInTheDocument();
    });
  });

  it("add batch inline: filling inputs and saving calls useAddBatch", async () => {
    const user = userEvent.setup();
    const addBatch = vi.fn();
    server.use(
      http.get(`${BASE}/inventories/:invId/items/:itemId/batches`, () =>
        HttpResponse.json({ data: [batchFixture({ id: "b1", quantity: 1 })] }),
      ),
      http.post(`${BASE}/inventories/:invId/items/:itemId/batches`, async ({ request }) => {
        addBatch(await request.json());
        return HttpResponse.json({ data: batchFixture() });
      }),
    );

    renderTable();

    await user.click(await screen.findByRole("button", { name: "Expand batches" }));

    const addBatchBtn = await screen.findByRole("button", { name: "+ Add batch" });
    await user.click(addBatchBtn);

    const qtyInput = await screen.findByLabelText("Batch quantity");
    await user.type(qtyInput, "3");

    await user.click(screen.getByTestId("add-batch-submit"));

    await waitFor(() => {
      expect(addBatch).toHaveBeenCalledTimes(1);
    });
    expect(addBatch.mock.calls[0]![0]).toMatchObject({ quantity: 3 });
  });

  describe("20.3 — Category datalist", () => {
    it("renders a <datalist id='category-suggestions'> element", async () => {
      renderTable();
      await screen.findByText("Rice");
      const datalist = document.getElementById("category-suggestions");
      expect(datalist).toBeInTheDocument();
      expect(datalist!.tagName.toLowerCase()).toBe("datalist");
    });

    it("populates the datalist with real category values, not 'Uncategorized'", async () => {
      renderTable();
      await screen.findByText("Rice");
      const datalist = document.getElementById("category-suggestions")!;
      const options = Array.from(datalist.querySelectorAll("option")).map((o) => o.value);
      expect(options).toContain("Dairy");
      expect(options).toContain("Non perishable");
      expect(options).not.toContain("Uncategorized");
    });

    it("category input in edit mode has list='category-suggestions'", async () => {
      const user = userEvent.setup();
      renderTable();
      await user.click(await screen.findByText("Rice"));
      const categoryInput = await screen.findByLabelText("Category");
      expect(categoryInput).toHaveAttribute("list", "category-suggestions");
    });
  });

  describe("20.4 — Initial stored quantity", () => {
    it("NewItemRow renders 'Initial stored quantity' and 'Expiry date' inputs", async () => {
      renderTable({ newItemName: "Oats" });
      expect(await screen.findByLabelText("Initial stored quantity")).toBeInTheDocument();
      expect(screen.getByLabelText("Expiry date")).toBeInTheDocument();
    });

    it("saving a new item with storedQty > 0 calls the batch POST endpoint", async () => {
      const user = userEvent.setup();
      const batchPost = vi.fn();
      server.use(
        http.post(`${BASE}/inventories/:id/items`, () =>
          HttpResponse.json({ data: inventoryItemFixture({ id: "new-item-id", name: "Oats" }) }),
        ),
        http.post(`${BASE}/inventories/:invId/items/:itemId/batches`, async ({ request }) => {
          batchPost(await request.json());
          return HttpResponse.json({ data: batchFixture() });
        }),
      );

      const onSaved = vi.fn();
      renderTable({ newItemName: "Oats", onNewItemSaved: onSaved });

      const qtyInput = await screen.findByLabelText("Initial stored quantity");
      await user.type(qtyInput, "3");

      const newRow = screen.getByTestId("new-item-row");
      await user.click(within(newRow).getByRole("button", { name: "Save" }));

      await waitFor(() => {
        expect(batchPost).toHaveBeenCalledTimes(1);
      });
      expect(batchPost.mock.calls[0]![0]).toMatchObject({ quantity: 3 });
    });

    it("saving a new item with storedQty = 0 does NOT call the batch POST endpoint", async () => {
      const user = userEvent.setup();
      const batchPost = vi.fn();
      server.use(
        http.post(`${BASE}/inventories/:id/items`, () =>
          HttpResponse.json({ data: inventoryItemFixture({ id: "new-item-id", name: "Oats" }) }),
        ),
        http.post(`${BASE}/inventories/:invId/items/:itemId/batches`, async ({ request }) => {
          batchPost(await request.json());
          return HttpResponse.json({ data: batchFixture() });
        }),
      );

      const onSaved = vi.fn();
      renderTable({ newItemName: "Oats", onNewItemSaved: onSaved });

      // Leave storedQty empty (defaults to "")
      const newRow = await screen.findByTestId("new-item-row");
      await user.click(within(newRow).getByRole("button", { name: "Save" }));

      await waitFor(() => {
        expect(onSaved).toHaveBeenCalledTimes(1);
      });
      expect(batchPost).not.toHaveBeenCalled();
    });
  });

  describe("20.5 — Per-category add button", () => {
    it("renders a '+ Add item to [Category]' button for each category", async () => {
      renderTable();
      expect(
        await screen.findByRole("button", { name: "+ Add item to Non perishable" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "+ Add item to Dairy" })).toBeInTheDocument();
    });

    it("clicking the button opens an inline NewItemRow with the category pre-filled", async () => {
      const user = userEvent.setup();
      renderTable();

      const addBtn = await screen.findByRole("button", { name: "+ Add item to Dairy" });
      await user.click(addBtn);

      const newRow = screen.getByTestId("new-item-row-Dairy");
      expect(newRow).toBeInTheDocument();

      const categoryInput = within(newRow).getByLabelText("New item category");
      expect(categoryInput).toHaveValue("Dairy");
    });

    it("the pre-filled category input is read-only", async () => {
      const user = userEvent.setup();
      renderTable();

      const addBtn = await screen.findByRole("button", { name: "+ Add item to Non perishable" });
      await user.click(addBtn);

      const newRow = screen.getByTestId("new-item-row-Non perishable");
      const categoryInput = within(newRow).getByLabelText("New item category");
      expect(categoryInput).toHaveAttribute("readonly");
    });
  });

  it("search-to-add: typing an unmatched name then 'Add this item' shows a pre-filled row and saving calls useCreateItem", async () => {
    const user = userEvent.setup();
    const create = vi.fn();
    server.use(
      http.get(`${BASE}/inventories/:id/items`, () => HttpResponse.json({ data: makeItems() })),
      http.post(`${BASE}/inventories/:id/items`, async ({ request }) => {
        create(await request.json());
        return HttpResponse.json({ data: inventoryItemFixture({ name: "Quinoa" }) });
      }),
    );

    renderWithProviders(() => <InventoryPage />);

    await waitFor(() => {
      expect(screen.getByText("Rice")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Search items…");
    await user.type(searchInput, "Quinoa");

    const addThis = await screen.findByRole("button", { name: "Add this item" });
    await user.click(addThis);

    const nameInput = await screen.findByLabelText("New item name");
    expect(nameInput).toHaveValue("Quinoa");

    await user.type(screen.getByLabelText("New item unit"), "kg");

    const newRow = screen.getByTestId("new-item-row");
    await user.click(within(newRow).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(create).toHaveBeenCalledTimes(1);
    });
    expect(create.mock.calls[0]![0]).toMatchObject({ name: "Quinoa", unit: "kg" });
  });
});
