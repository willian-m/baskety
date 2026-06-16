# Inventory UX Redesign — Feature Wish List

**Source:** User feedback from real-world testing of the Baskety inventory page  
**Date:** 2026-06-13  
**Status:** Proposal / design brief — not yet scheduled

---

## Background

The current inventory page provides a search bar, a category dropdown filter, an item list, and a separate form for adding items and batches. While functional, user testing revealed friction in three areas that together make first-time inventory setup feel laborious.

---

## Pain Points

### 1. Search-to-Add Friction

The search bar is designed for finding existing items, but users instinctively type a new item's name there when building their inventory from scratch. When no match appears, the current flow forces them to:

1. Notice there are no results.
2. Click "Add item".
3. Retype the item name.
4. Fill out the form.
5. Save.

This multi-step detour breaks the mental flow of "I'm stocking my inventory" and adds unnecessary re-entry work.

### 2. Batch Entry Ceremony

Adding batches to an item requires navigating into the item detail view, opening a new form for each batch, and saving individually. For a task that users perform every time they buy groceries, this is too many steps. The cost compounds when stocking multiple batches of the same item (e.g., several bags of rice with different expiration dates).

### 3. Missing Category Grouping in the List

The category dropdown filter is useful and should be kept, but the list itself has no visual grouping. Users must rely entirely on the filter to see items by category; there is no at-a-glance structure when viewing the full inventory.

---

## Proposed Redesign

### Goal

Replace the separate item list + form with a single-page, inline-editable, spreadsheet-style table that minimizes navigation and redundant data entry.

### Layout

Keep the search bar and category dropdown filter at the top, unchanged in purpose.

Replace the item list below with a table structured as follows:

```
| Item   | Stored Qty | Target Qty |
|--------|------------|------------|
| **Non perishable**                |
| Rice   | 2 kg       | 5 kg       |
| Beans  | 1 kg       | 3 kg       |
| **Vegetables**                    |
| ▶ Potato | 0.5 kg   | 1 kg       |
|   └ Batch 1 | 0.3 kg | exp 2026-07-01 |
|   └ Batch 2 | 0.2 kg | exp 2026-08-15 |
|   └ + Add batch                   |
```

### Behavior Details

#### Category Headers as Section Dividers

Category names appear as bold section-divider rows inside the table itself — not as tabs, separate pages, or accordion panels. The category dropdown filter continues to work and hides/shows entire sections. When all categories are visible, each section is separated by its header row.

#### Inline Row Editing

Clicking any item row makes it editable in place. Fields (name, stored quantity, target quantity) become input controls directly in the table row. No modal, no navigation away from the page. Saving commits the change; pressing Escape or clicking elsewhere cancels.

#### Batch Disclosure (Expandable Rows)

Items that have more than one batch are shown with a disclosure arrow (▶) to the left of the item name. Clicking the arrow expands the row to reveal one sub-row per batch, each showing:

- Batch quantity
- Expiration date

Items with a single batch (or no batch detail needed) are shown without the arrow.

#### Inline Add Batch

At the bottom of each expanded item's sub-rows, a subtle inline affordance — for example, a `+ Add batch` row — allows adding a new batch without opening a modal or navigating away. Clicking it inserts a new editable sub-row inline.

#### Search-to-Add Flow

When the user types a name in the search bar and no existing item matches, an inline **"Add [name]"** row appears at the bottom of the relevant category section (or at the end of the table if no category has been selected). Clicking it promotes that row to a new editable item row, pre-filled with the typed name, ready for quantity entry — no re-typing required.

---

## Scope and Constraints

- The search bar and category dropdown filter must be preserved with their existing semantics.
- The redesign applies to the inventory list screen only. Item detail (for viewing full batch history, price history, etc.) can remain as a secondary view accessed from the expanded batch area if needed.
- Inline editing must be accessible via keyboard (Tab between fields, Enter to save, Escape to cancel).
- The "Add [name]" affordance from the search bar should only appear when the search yields zero results, to avoid cluttering searches over existing items.

---

## Open Questions for Implementation

1. **Category assignment on new items:** When the user creates an item from the search bar, what determines which category section it appears in? Options: default to "Uncategorized", prompt inline, or infer from a catalog lookup.
A: If the user start typing and no product is found, immediattely at the side should be a button called `Add this item`. Upon clicking it, the page scrows to the bottom, where a new line will be opened with the item name pre-filled. There the user will be able to finish filling the form and one of the boxes will be the category. The user is allowed to not fill the category if its his/her wish.
2. **Unit handling:** Stored and target quantities need units (kg, L, units, etc.). Should units be a per-item setting editable inline, or selected once and locked per item?
A: Editable in-line
3. **Conflict resolution:** If two household members edit the same row simultaneously, how should conflicts be surfaced? (Optimistic update + toast on conflict is the likely answer, consistent with existing patterns in the codebase.)
A: Use the Optimistic update + toast
4. **Mobile parity:** The spreadsheet table pattern works well on desktop/web. The mobile app may need a different treatment for the same data (e.g., swipeable cards with inline edit taps rather than a wide table).
A: I like the suggestion of swipeable cards with inline edit taps
