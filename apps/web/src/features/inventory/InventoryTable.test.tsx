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
      expect(screen.getByText(/└ Batch Qty: 1 L/)).toBeInTheDocument();
    });

    // Collapse
    await user.click(screen.getByRole("button", { name: "Collapse batches" }));
    await waitFor(() => {
      expect(screen.queryByText(/└ Batch Qty: 1 L/)).not.toBeInTheDocument();
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

  describe("category combobox", () => {
    it("does not render a <datalist> element", async () => {
      renderTable();
      await screen.findByText("Rice");
      expect(document.getElementById("category-suggestions")).not.toBeInTheDocument();
    });

    it("category input in edit mode has no list attribute", async () => {
      const user = userEvent.setup();
      renderTable();
      await user.click(await screen.findByText("Rice"));
      const categoryInput = await screen.findByLabelText("Category");
      expect(categoryInput).not.toHaveAttribute("list");
    });

    it("focusing the category input in edit mode opens a dropdown with existing categories", async () => {
      const user = userEvent.setup();
      renderTable();
      await user.click(await screen.findByText("Rice"));
      const categoryInput = await screen.findByLabelText("Category");
      await user.click(categoryInput);
      expect(await screen.findByRole("listbox")).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Dairy" })).toBeInTheDocument();
    });

    it("clicking a dropdown suggestion updates the category field", async () => {
      const user = userEvent.setup();
      renderTable();
      await user.click(await screen.findByText("Rice"));
      const categoryInput = await screen.findByLabelText("Category");
      await user.click(categoryInput);
      await user.click(await screen.findByRole("option", { name: "Dairy" }));
      expect(categoryInput).toHaveValue("Dairy");
    });
  });

  describe("category header rename", () => {
    it("clicking a category header reveals an input pre-filled with the category name", async () => {
      const user = userEvent.setup();
      renderTable();
      await user.click(await screen.findByText("Dairy"));
      const input = await screen.findByLabelText("Rename category Dairy");
      expect(input).toHaveValue("Dairy");
    });

    it("pressing Escape while renaming cancels without calling the API", async () => {
      const user = userEvent.setup();
      const update = vi.fn();
      server.use(
        http.put(`${BASE}/inventories/:invId/items/:itemId`, async ({ request }) => {
          update(await request.json());
          return HttpResponse.json({ data: inventoryItemFixture() });
        }),
      );
      renderTable();
      await user.click(await screen.findByText("Dairy"));
      const input = await screen.findByLabelText("Rename category Dairy");
      await user.clear(input);
      await user.type(input, "Fresh");
      await user.keyboard("{Escape}");
      await waitFor(() => {
        expect(screen.queryByLabelText("Rename category Dairy")).not.toBeInTheDocument();
      });
      expect(update).not.toHaveBeenCalled();
    });

    it("pressing Enter renames all items in the category via PUT requests", async () => {
      const user = userEvent.setup();
      const update = vi.fn();
      server.use(
        http.put(`${BASE}/inventories/:invId/items/:itemId`, async ({ request }) => {
          update(await request.json());
          return HttpResponse.json({ data: inventoryItemFixture() });
        }),
      );
      renderTable();
      await user.click(await screen.findByText("Non perishable"));
      const input = await screen.findByLabelText("Rename category Non perishable");
      await user.clear(input);
      await user.type(input, "Pantry");
      await user.keyboard("{Enter}");
      await waitFor(() => {
        // "Non perishable" has Rice + Beans → 2 PUT calls
        expect(update).toHaveBeenCalledTimes(2);
      });
      expect(update.mock.calls.every((c) => c[0].category === "Pantry")).toBe(true);
    });
  });

  describe("category header delete", () => {
    it("renders a delete button for each category header", async () => {
      renderTable();
      await screen.findByText("Dairy");
      expect(screen.getByRole("button", { name: "Delete category Dairy" })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Delete category Non perishable" }),
      ).toBeInTheDocument();
    });

    it("clicking the delete button opens a confirmation modal with category name and item count", async () => {
      const user = userEvent.setup();
      renderTable();
      await user.click(await screen.findByRole("button", { name: "Delete category Dairy" }));
      const modal = await screen.findByRole("dialog");
      expect(modal).toBeInTheDocument();
      // "Dairy" has 1 item (Milk)
      expect(within(modal).getByText(/Delete "Dairy"\?/)).toBeInTheDocument();
      expect(within(modal).getByText(/1 item/)).toBeInTheDocument();
      expect(within(modal).getByText(/Uncategorized/)).toBeInTheDocument();
    });

    it("Cancel closes the modal without calling the API", async () => {
      const user = userEvent.setup();
      const update = vi.fn();
      server.use(
        http.put(`${BASE}/inventories/:invId/items/:itemId`, async ({ request }) => {
          update(await request.json());
          return HttpResponse.json({ data: inventoryItemFixture() });
        }),
      );
      renderTable();
      await user.click(await screen.findByRole("button", { name: "Delete category Dairy" }));
      await user.click(await screen.findByRole("button", { name: "Cancel" }));
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
      expect(update).not.toHaveBeenCalled();
    });

    it("clicking Delete calls PUT with category '' for every item in the category", async () => {
      const user = userEvent.setup();
      const update = vi.fn();
      server.use(
        http.put(`${BASE}/inventories/:invId/items/:itemId`, async ({ request }) => {
          update(await request.json());
          return HttpResponse.json({ data: inventoryItemFixture() });
        }),
      );
      renderTable();
      // "Non perishable" has Rice + Beans → 2 PUT calls
      await user.click(
        await screen.findByRole("button", { name: "Delete category Non perishable" }),
      );
      const modal = await screen.findByRole("dialog");
      await user.click(within(modal).getByRole("button", { name: "Delete" }));
      await waitFor(() => {
        expect(update).toHaveBeenCalledTimes(2);
      });
      expect(update.mock.calls.every((c) => c[0].category === "")).toBe(true);
    });

    it("clicking Delete closes the modal", async () => {
      const user = userEvent.setup();
      server.use(
        http.put(`${BASE}/inventories/:invId/items/:itemId`, () =>
          HttpResponse.json({ data: inventoryItemFixture() }),
        ),
      );
      renderTable();
      await user.click(await screen.findByRole("button", { name: "Delete category Dairy" }));
      const modal = await screen.findByRole("dialog");
      await user.click(within(modal).getByRole("button", { name: "Delete" }));
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });
  });

  describe("20.4 — Initial stored quantity", () => {
    it("NewItemRow renders 'Initial stored quantity' and 'Expiry date' inputs", async () => {
      renderTable({ newItemName: "Oats" });
      expect(await screen.findByLabelText("Initial stored quantity")).toBeInTheDocument();
      expect(screen.getByLabelText("Expiry date")).toBeInTheDocument();
    });

    it("saving a new item with storedQty > 0 sends initial_quantity and initial_expires_at in the item POST body (no separate batch POST)", async () => {
      const user = userEvent.setup();
      const itemPost = vi.fn();
      const batchPost = vi.fn();
      server.use(
        http.post(`${BASE}/inventories/:id/items`, async ({ request }) => {
          itemPost(await request.json());
          return HttpResponse.json({
            data: inventoryItemFixture({ id: "new-item-id", name: "Oats" }),
          });
        }),
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
        expect(onSaved).toHaveBeenCalledTimes(1);
      });

      // initial_quantity and initial_expires_at go on the item POST body
      expect(itemPost).toHaveBeenCalledTimes(1);
      expect(itemPost.mock.calls[0]![0]).toMatchObject({ initial_quantity: 3 });

      // No separate batch POST is called
      expect(batchPost).not.toHaveBeenCalled();
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

  it('shows a "+" button on every item regardless of batch_count', async () => {
    renderTable();
    // All items render — Rice and Beans have batch_count 1, Milk has batch_count 2.
    await screen.findByText("Rice");
    const addBatchBtns = screen.getAllByRole("button", { name: "Add a new batch" });
    // Three items → three "+" buttons
    expect(addBatchBtns).toHaveLength(3);
  });

  it("right-clicking an item selects it and shows the delete button", async () => {
    const user = userEvent.setup();
    renderTable();

    await screen.findByText("Rice");

    // Right-click Rice row
    const riceRow = screen.getByTestId("item-row-item-rice");
    await user.pointer({ target: riceRow, keys: "[MouseRight]" });

    expect(await screen.findByRole("button", { name: /Delete 1 item/ })).toBeInTheDocument();

    // Right-click Beans row to select a second item
    const beansRow = screen.getByTestId("item-row-item-beans");
    await user.pointer({ target: beansRow, keys: "[MouseRight]" });

    expect(await screen.findByRole("button", { name: /Delete 2 items/ })).toBeInTheDocument();
  });

  it("shows confirmation modal and deletes selected items on confirm", async () => {
    const user = userEvent.setup();
    const deleteHandler = vi.fn();
    server.use(
      http.delete(`${BASE}/inventories/:invId/items/:itemId`, ({ params }) => {
        deleteHandler(params.itemId);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderTable();

    await screen.findByText("Rice");

    // Right-click Rice to select it
    const riceRow = screen.getByTestId("item-row-item-rice");
    await user.pointer({ target: riceRow, keys: "[MouseRight]" });

    // Click the delete button to open the modal
    await user.click(await screen.findByRole("button", { name: /Delete 1 item/ }));

    // Modal appears with irreversible warning
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/irreversible/i)).toBeInTheDocument();

    // Click the confirm Delete button inside the modal
    const modal = screen.getByRole("dialog");
    await user.click(within(modal).getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(deleteHandler).toHaveBeenCalledTimes(1);
    });
    expect(deleteHandler).toHaveBeenCalledWith("item-rice");
  });

  it("shows editable stored qty and expiry in edit mode for single-batch items", async () => {
    const user = userEvent.setup();
    const patchBatch = vi.fn();
    server.use(
      http.get(`${BASE}/inventories/:invId/items/:itemId/batches`, () =>
        HttpResponse.json({
          data: [batchFixture({ id: "batch-1", quantity: 2, expires_at: "2030-06-14T00:00:00Z" })],
        }),
      ),
      http.put(`${BASE}/inventories/:invId/items/:itemId`, () =>
        HttpResponse.json({ data: inventoryItemFixture({ id: "item-rice", name: "Rice" }) }),
      ),
      http.patch(
        `${BASE}/inventories/:invId/items/:itemId/batches/:batchId`,
        async ({ request }) => {
          patchBatch(await request.json());
          return HttpResponse.json({ data: batchFixture({ id: "batch-1" }) });
        },
      ),
    );

    // Render with Rice (batch_count: 1)
    renderTable({
      items: [
        inventoryItemFixture({
          id: "item-rice",
          name: "Rice",
          category: "Non perishable",
          unit: "kg",
          stored_quantity: 2,
          target_quantity: 5,
          batch_count: 1,
        }),
      ],
    });

    // Click Rice row to enter edit mode
    await user.click(await screen.findByText("Rice"));

    // Stored quantity input should appear
    const storedQtyInput = await screen.findByLabelText("Stored quantity");
    expect(storedQtyInput).toBeInTheDocument();

    // Expiry date input should appear
    const expiryInput = screen.getByLabelText("Expiry date");
    expect(expiryInput).toBeInTheDocument();

    // Wait for the seeded value from batches (seeded as YYYY-MM-DD)
    await waitFor(() => {
      expect(storedQtyInput).toHaveValue(2);
    });

    // Change the stored quantity
    await user.clear(storedQtyInput);
    await user.type(storedQtyInput, "5");

    // Click save
    const editRow = screen.getByTestId("item-row-item-rice");
    await user.click(within(editRow).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(patchBatch).toHaveBeenCalledTimes(1);
    });
    expect(patchBatch.mock.calls[0]![0]).toMatchObject({ quantity: 5 });
  });

  it("shows editable stored qty and expiry in edit mode for zero-batch items and creates a new batch on save", async () => {
    const user = userEvent.setup();
    const addBatch = vi.fn();
    server.use(
      http.get(`${BASE}/inventories/:invId/items/:itemId/batches`, () =>
        HttpResponse.json({ data: [] }),
      ),
      http.put(`${BASE}/inventories/:invId/items/:itemId`, () =>
        HttpResponse.json({ data: inventoryItemFixture({ id: "item-rice", name: "Rice" }) }),
      ),
      http.post(`${BASE}/inventories/:invId/items/:itemId/batches`, async ({ request }) => {
        addBatch(await request.json());
        return HttpResponse.json({ data: batchFixture({ id: "batch-new" }) });
      }),
    );

    renderTable({
      items: [
        inventoryItemFixture({
          id: "item-rice",
          name: "Rice",
          category: "Non perishable",
          unit: "kg",
          stored_quantity: 0,
          target_quantity: 5,
          batch_count: 0,
        }),
      ],
    });

    await user.click(await screen.findByText("Rice"));

    const storedQtyInput = await screen.findByLabelText("Stored quantity");
    expect(storedQtyInput).toBeInTheDocument();
    expect(screen.getByLabelText("Expiry date")).toBeInTheDocument();

    await user.clear(storedQtyInput);
    await user.type(storedQtyInput, "3");

    const editRow = screen.getByTestId("item-row-item-rice");
    await user.click(within(editRow).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(addBatch).toHaveBeenCalledTimes(1);
    });
    expect(addBatch.mock.calls[0]![0]).toMatchObject({ quantity: 3 });
  });

  describe("checkbox select + per-row trash icon", () => {
    it("renders a select checkbox for each item row", async () => {
      renderTable();
      await screen.findByText("Rice");
      expect(screen.getByRole("checkbox", { name: "Select Rice" })).toBeInTheDocument();
      expect(screen.getByRole("checkbox", { name: "Select Beans" })).toBeInTheDocument();
      expect(screen.getByRole("checkbox", { name: "Select Milk" })).toBeInTheDocument();
    });

    it("clicking an item checkbox selects it and shows the bulk delete button", async () => {
      const user = userEvent.setup();
      renderTable();
      await screen.findByText("Rice");

      const riceCheckbox = screen.getByRole("checkbox", { name: "Select Rice" });
      await user.click(riceCheckbox);

      expect(riceCheckbox).toBeChecked();
      expect(await screen.findByRole("button", { name: /Delete 1 item/ })).toBeInTheDocument();
    });

    it("clicking a selected checkbox deselects it and hides the delete button", async () => {
      const user = userEvent.setup();
      renderTable();
      await screen.findByText("Rice");

      const riceCheckbox = screen.getByRole("checkbox", { name: "Select Rice" });
      await user.click(riceCheckbox);
      await user.click(riceCheckbox);

      await waitFor(() => {
        expect(screen.queryByRole("button", { name: /Delete \d+ items?/ })).not.toBeInTheDocument();
      });
      expect(riceCheckbox).not.toBeChecked();
    });

    it("select-all header checkbox selects all visible items", async () => {
      const user = userEvent.setup();
      renderTable();
      await screen.findByText("Rice");

      await user.click(screen.getByRole("checkbox", { name: "Select all items" }));
      expect(await screen.findByRole("button", { name: /Delete 3 items/ })).toBeInTheDocument();
    });

    it("select-all deselects all when all items are already selected", async () => {
      const user = userEvent.setup();
      renderTable();
      await screen.findByText("Rice");

      const selectAll = screen.getByRole("checkbox", { name: "Select all items" });
      await user.click(selectAll);
      await screen.findByRole("button", { name: /Delete 3 items/ });

      await user.click(selectAll);
      await waitFor(() => {
        expect(screen.queryByRole("button", { name: /Delete \d+ items?/ })).not.toBeInTheDocument();
      });
    });

    it("renders a Delete button for each item row", async () => {
      renderTable();
      await screen.findByText("Rice");
      expect(screen.getByRole("button", { name: "Delete Rice" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Delete Beans" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Delete Milk" })).toBeInTheDocument();
    });

    it("clicking the trash icon opens the confirmation modal for that single item", async () => {
      const user = userEvent.setup();
      renderTable();
      await screen.findByText("Rice");

      await user.click(screen.getByRole("button", { name: "Delete Rice" }));

      const modal = await screen.findByRole("dialog");
      expect(modal).toBeInTheDocument();
      expect(within(modal).getByText(/Delete 1 item/)).toBeInTheDocument();
      expect(within(modal).getByText(/irreversible/i)).toBeInTheDocument();
    });

    it("confirming delete via trash icon calls the API for exactly that item only", async () => {
      const user = userEvent.setup();
      const deleteHandler = vi.fn();
      server.use(
        http.delete(`${BASE}/inventories/:invId/items/:itemId`, ({ params }) => {
          deleteHandler(params.itemId);
          return new HttpResponse(null, { status: 204 });
        }),
      );
      renderTable();
      await screen.findByText("Rice");

      await user.click(screen.getByRole("button", { name: "Delete Rice" }));
      const modal = await screen.findByRole("dialog");
      await user.click(within(modal).getByRole("button", { name: "Delete" }));

      await waitFor(() => expect(deleteHandler).toHaveBeenCalledTimes(1));
      expect(deleteHandler).toHaveBeenCalledWith("item-rice");
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

  describe("batch removal", () => {
    function setupBatchRemovalHandlers(batchId = "batch-rm-1") {
      server.use(
        http.get(`${BASE}/inventories/:invId/items/:itemId/batches`, () =>
          HttpResponse.json({
            data: [
              batchFixture({ id: batchId, quantity: 2 }),
              batchFixture({ id: "batch-rm-2", quantity: 1 }),
            ],
          }),
        ),
      );
    }

    async function expandMilkBatches(user: ReturnType<typeof userEvent.setup>) {
      renderTable();
      const expandBtn = await screen.findByRole("button", { name: "Expand batches" });
      await user.click(expandBtn);
      await screen.findByText(/└ Batch Qty: 2 L/);
    }

    it("each expanded batch row has a remove-batch button", async () => {
      const user = userEvent.setup();
      setupBatchRemovalHandlers();
      await expandMilkBatches(user);

      const removeBtns = screen.getAllByRole("button", { name: "Remove batch" });
      expect(removeBtns).toHaveLength(2);
    });

    it("clicking remove-batch opens the choice modal", async () => {
      const user = userEvent.setup();
      setupBatchRemovalHandlers();
      await expandMilkBatches(user);

      await user.click(screen.getAllByRole("button", { name: "Remove batch" })[0]!);

      const modal = await screen.findByRole("dialog");
      expect(within(modal).getByRole("button", { name: "Mark as consumed" })).toBeInTheDocument();
      expect(within(modal).getByRole("button", { name: "Delete permanently" })).toBeInTheDocument();
      expect(within(modal).getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    });

    it("cancel closes the modal without making any request", async () => {
      const user = userEvent.setup();
      const emptied = vi.fn();
      const deleted = vi.fn();
      server.use(
        http.post(`${BASE}/inventories/:invId/items/:itemId/batches/:batchId/empty`, () => {
          emptied();
          return new HttpResponse(null, { status: 200 });
        }),
        http.delete(`${BASE}/inventories/:invId/items/:itemId/batches/:batchId`, () => {
          deleted();
          return new HttpResponse(null, { status: 204 });
        }),
      );
      setupBatchRemovalHandlers();
      await expandMilkBatches(user);

      await user.click(screen.getAllByRole("button", { name: "Remove batch" })[0]!);
      await user.click(await screen.findByRole("button", { name: "Cancel" }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(emptied).not.toHaveBeenCalled();
      expect(deleted).not.toHaveBeenCalled();
    });

    it('"Mark as consumed" calls the empty endpoint and closes the modal', async () => {
      const user = userEvent.setup();
      const emptied = vi.fn();
      server.use(
        http.post(
          `${BASE}/inventories/:invId/items/:itemId/batches/:batchId/empty`,
          ({ params }) => {
            emptied(params.batchId);
            return HttpResponse.json({ data: { status: "emptied" } });
          },
        ),
      );
      setupBatchRemovalHandlers("batch-rm-1");
      await expandMilkBatches(user);

      await user.click(screen.getAllByRole("button", { name: "Remove batch" })[0]!);
      await user.click(await screen.findByRole("button", { name: "Mark as consumed" }));

      await waitFor(() => {
        expect(emptied).toHaveBeenCalledTimes(1);
      });
      expect(emptied).toHaveBeenCalledWith("batch-rm-1");
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });

    it('"Delete permanently" calls the delete endpoint and closes the modal', async () => {
      const user = userEvent.setup();
      const deleted = vi.fn();
      server.use(
        http.delete(`${BASE}/inventories/:invId/items/:itemId/batches/:batchId`, ({ params }) => {
          deleted(params.batchId);
          return new HttpResponse(null, { status: 204 });
        }),
      );
      setupBatchRemovalHandlers("batch-rm-1");
      await expandMilkBatches(user);

      await user.click(screen.getAllByRole("button", { name: "Remove batch" })[0]!);
      await user.click(await screen.findByRole("button", { name: "Delete permanently" }));

      await waitFor(() => {
        expect(deleted).toHaveBeenCalledTimes(1);
      });
      expect(deleted).toHaveBeenCalledWith("batch-rm-1");
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });
  });

  describe("inline batch editing", () => {
    async function expandMilkBatches(user: ReturnType<typeof userEvent.setup>) {
      server.use(
        http.get(`${BASE}/inventories/:invId/items/:itemId/batches`, () =>
          HttpResponse.json({
            data: [
              batchFixture({ id: "be-1", quantity: 2, expires_at: "2030-06-01T00:00:00Z" }),
              batchFixture({ id: "be-2", quantity: 1, expires_at: null }),
            ],
          }),
        ),
      );
      renderTable();
      await user.click(await screen.findByRole("button", { name: "Expand batches" }));
      await screen.findByText(/└ Batch Qty: 2 L/);
    }

    it("clicking a batch row enters edit mode with pre-filled qty and expiry", async () => {
      const user = userEvent.setup();
      await expandMilkBatches(user);

      await user.click(screen.getAllByText(/└ Batch/)[0]!);

      expect(await screen.findByLabelText("Batch quantity")).toHaveValue(2);
      expect(screen.getByLabelText("Batch expiry")).toHaveValue("2030-06-01");
    });

    it("saving a batch edit calls PATCH and exits edit mode", async () => {
      const user = userEvent.setup();
      const patch = vi.fn();
      server.use(
        http.patch(
          `${BASE}/inventories/:invId/items/:itemId/batches/:batchId`,
          async ({ request, params }) => {
            patch({ batchId: params.batchId, body: await request.json() });
            return HttpResponse.json({ data: batchFixture({ id: params.batchId as string }) });
          },
        ),
      );
      await expandMilkBatches(user);

      await user.click(screen.getAllByText(/└ Batch/)[0]!);

      const qtyInput = await screen.findByLabelText("Batch quantity");
      await user.clear(qtyInput);
      await user.type(qtyInput, "5");

      await user.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
      expect(patch.mock.calls[0]![0]).toMatchObject({ batchId: "be-1", body: { quantity: 5 } });
      await waitFor(() =>
        expect(screen.queryByLabelText("Batch quantity")).not.toBeInTheDocument(),
      );
    });

    it("pressing Escape cancels the edit without calling PATCH", async () => {
      const user = userEvent.setup();
      const patch = vi.fn();
      server.use(
        http.patch(`${BASE}/inventories/:invId/items/:itemId/batches/:batchId`, () => {
          patch();
          return HttpResponse.json({ data: batchFixture() });
        }),
      );
      await expandMilkBatches(user);

      await user.click(screen.getAllByText(/└ Batch/)[0]!);
      await screen.findByLabelText("Batch quantity");
      await user.keyboard("{Escape}");

      await waitFor(() =>
        expect(screen.queryByLabelText("Batch quantity")).not.toBeInTheDocument(),
      );
      expect(patch).not.toHaveBeenCalled();
    });
  });
});
