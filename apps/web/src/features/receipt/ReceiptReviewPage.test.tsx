import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { useCallback, useEffect, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { scanFixture, scanItemFixture } from "../../test/fixtures.js";
import { server } from "../../test/server.js";

import { ReceiptReviewPage } from "./ReceiptReviewPage.js";

const SCAN_ID = "scan-test-1";

// ---------------------------------------------------------------------------
// Mock @tanstack/react-router: ReceiptReviewPage only needs useParams + useNavigate
// ---------------------------------------------------------------------------
vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ scanId: SCAN_ID }),
  useNavigate: () => vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Mock @baskety/core to avoid the dual-React (18 vs 19) conflict that arises
// because packages/core has its own react@19 copy in node_modules.
// We forward to real MSW-backed fetch logic via our own minimal hooks.
// ---------------------------------------------------------------------------
const BASE = "/api/v1";

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  const json = (await res.json()) as { data: T };
  return json.data;
}

async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { data: T };
  return json.data;
}

async function apiPost(path: string, body?: unknown): Promise<void> {
  await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

vi.mock("@baskety/core", () => {
  function useScan(scanId: string) {
    const [data, setData] = useState<unknown>(undefined);
    const [isLoading, setIsLoading] = useState(true);
    useEffect(() => {
      void apiFetch(`/receipts/${scanId}`).then((d) => {
        setData(d);
        setIsLoading(false);
      });
    }, [scanId]);
    return { data, isLoading };
  }

  function useScanItems(scanId: string) {
    const [data, setData] = useState<unknown[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    useEffect(() => {
      void apiFetch<unknown[]>(`/receipts/${scanId}/items`).then((d) => {
        setData(d);
        setIsLoading(false);
      });
    }, [scanId]);
    return { data, isLoading };
  }

  function useUpdateScanItem(scanId: string) {
    const [isPending, setIsPending] = useState(false);
    const mutateAsync = useCallback(
      async ({ itemId, body }: { itemId: string; body: unknown }) => {
        setIsPending(true);
        try {
          return await apiPut(`/receipts/${scanId}/items/${itemId}`, body);
        } finally {
          setIsPending(false);
        }
      },
      [scanId],
    );
    return { mutateAsync, isPending };
  }

  function useCommitScan() {
    const [isPending, setIsPending] = useState(false);
    const [isError, setIsError] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const mutateAsync = useCallback(
      async ({ scanId, purchasedAt }: { scanId: string; purchasedAt: string }) => {
        setIsPending(true);
        setIsError(false);
        try {
          await apiPost(`/receipts/${scanId}/commit`, { purchased_at: purchasedAt });
        } catch (e) {
          setIsError(true);
          setError(e instanceof Error ? e : new Error(String(e)));
          throw e;
        } finally {
          setIsPending(false);
        }
      },
      [],
    );
    return { mutateAsync, isPending, isError, error };
  }

  // The review page also reads the household's inventory items (for the link
  // picker) and the active inventory. These tests don't exercise linking, so
  // empty stubs are sufficient.
  function useInventories() {
    return { data: [] as unknown[] };
  }
  function useInventoryItems(_inventoryId: string) {
    return { data: [] as unknown[] };
  }
  function useUiStore<T>(selector: (s: { activeInventoryId: string | null }) => T): T {
    return selector({ activeInventoryId: null });
  }

  return {
    useScan,
    useScanItems,
    useUpdateScanItem,
    useCommitScan,
    useInventories,
    useInventoryItems,
    useUiStore,
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function setupHandlers(
  scanOverrides: Record<string, unknown> = {},
  items: Record<string, unknown>[] = [{ id: "item-1", receipt_scan_id: SCAN_ID }],
) {
  server.use(
    http.get(`/api/v1/receipts/${SCAN_ID}`, () =>
      HttpResponse.json({ data: scanFixture({ id: SCAN_ID, ...scanOverrides }) }),
    ),
    http.get(`/api/v1/receipts/${SCAN_ID}/items`, () =>
      HttpResponse.json({ data: items.map((o) => scanItemFixture(o)) }),
    ),
    http.put(`/api/v1/receipts/${SCAN_ID}/items/:itemId`, ({ params }) =>
      HttpResponse.json({ data: scanItemFixture({ id: params.itemId }) }),
    ),
    http.post(`/api/v1/receipts/${SCAN_ID}/commit`, () => new HttpResponse(null, { status: 204 })),
  );
}

function renderPage() {
  return render(<ReceiptReviewPage />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("ReceiptReviewPage", () => {
  it("renders scan items", async () => {
    setupHandlers();
    renderPage();

    // Default scanItemFixture has raw_text "Milk 2L"
    await waitFor(() => {
      expect(screen.getByText("Milk 2L")).toBeInTheDocument();
    });
  });

  it("shows waiting message for in-progress scans with no items", async () => {
    setupHandlers({ status: "ocr_processing" }, []);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Waiting for scan to complete…")).toBeInTheDocument();
    });
  });

  it("shows processing status badge for in-progress scans with items", async () => {
    setupHandlers({ status: "ocr_processing" }, [{ id: "item-1" }]);
    renderPage();

    // The status is rendered in a <span> badge inside the page header; it is
    // unique on the page (not repeated in item rows), so findByText is safe.
    await waitFor(() => {
      expect(screen.getByText("ocr_processing")).toBeInTheDocument();
    });
  });

  it("accept button sends accepted status to API", async () => {
    let capturedBody: unknown;
    server.use(
      http.get(`/api/v1/receipts/${SCAN_ID}`, () =>
        HttpResponse.json({ data: scanFixture({ id: SCAN_ID }) }),
      ),
      http.get(`/api/v1/receipts/${SCAN_ID}/items`, () =>
        HttpResponse.json({ data: [scanItemFixture({ id: "item-1", receipt_scan_id: SCAN_ID })] }),
      ),
      http.put(`/api/v1/receipts/${SCAN_ID}/items/:itemId`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ data: scanItemFixture({ status: "accepted" }) });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText("Milk 2L")).toBeInTheDocument());

    const acceptBtn = screen.getByRole("button", { name: "Accept" });
    expect(acceptBtn).not.toBeDisabled();
    await user.click(acceptBtn);

    await waitFor(() => expect((capturedBody as { status: string }).status).toBe("accepted"));
  });

  it("reject button sends rejected status to API", async () => {
    let capturedBody: unknown;
    server.use(
      http.get(`/api/v1/receipts/${SCAN_ID}`, () =>
        HttpResponse.json({ data: scanFixture({ id: SCAN_ID }) }),
      ),
      http.get(`/api/v1/receipts/${SCAN_ID}/items`, () =>
        HttpResponse.json({ data: [scanItemFixture({ id: "item-1", receipt_scan_id: SCAN_ID })] }),
      ),
      http.put(`/api/v1/receipts/${SCAN_ID}/items/:itemId`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ data: scanItemFixture({ status: "rejected" }) });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText("Milk 2L")).toBeInTheDocument());

    const rejectBtn = screen.getByRole("button", { name: "Reject" });
    expect(rejectBtn).not.toBeDisabled();
    await user.click(rejectBtn);

    await waitFor(() => expect((capturedBody as { status: string }).status).toBe("rejected"));
  });

  it("accept button is disabled when item is already accepted", async () => {
    server.use(
      http.get(`/api/v1/receipts/${SCAN_ID}`, () =>
        HttpResponse.json({ data: scanFixture({ id: SCAN_ID }) }),
      ),
      http.get(`/api/v1/receipts/${SCAN_ID}/items`, () =>
        HttpResponse.json({ data: [scanItemFixture({ status: "accepted" })] }),
      ),
    );
    renderPage();

    const acceptBtn = await screen.findByRole("button", { name: /accept/i });
    expect(acceptBtn).toBeDisabled();
  });

  it("commit button is disabled when items have pending status", async () => {
    // "pending" status items mean allReviewed is false → commit disabled
    setupHandlers({ status: "pending" }, [{ id: "item-1", status: "pending" }]);
    renderPage();

    await waitFor(() => expect(screen.getByText("Milk 2L")).toBeInTheDocument());

    const commitBtn = screen.getByRole("button", { name: "Commit to inventory" });
    expect(commitBtn).toBeDisabled();
  });

  it("commit button is enabled when all items are reviewed", async () => {
    // "accepted" status → allReviewed true → commit enabled
    setupHandlers({ status: "pending" }, [{ id: "item-1", status: "accepted" }]);
    renderPage();

    await waitFor(() => {
      const commitBtn = screen.getByRole("button", { name: "Commit to inventory" });
      expect(commitBtn).not.toBeDisabled();
    });
  });

  it("commit button is enabled when all items are corrected", async () => {
    server.use(
      http.get(`/api/v1/receipts/${SCAN_ID}`, () =>
        HttpResponse.json({ data: scanFixture({ id: SCAN_ID }) }),
      ),
      http.get(`/api/v1/receipts/${SCAN_ID}/items`, () =>
        HttpResponse.json({ data: [scanItemFixture({ status: "corrected" })] }),
      ),
    );
    renderPage();

    await waitFor(() => expect(screen.getByRole("button", { name: /commit/i })).not.toBeDisabled());
  });

  it("editing unit price auto-fills total via quantity", async () => {
    server.use(
      http.get(`/api/v1/receipts/${SCAN_ID}`, () =>
        HttpResponse.json({ data: scanFixture({ id: SCAN_ID }) }),
      ),
      http.get(`/api/v1/receipts/${SCAN_ID}/items`, () =>
        HttpResponse.json({
          data: [scanItemFixture({ id: "item-1", parsed_quantity: 2, parsed_price_minor: null })],
        }),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    const unitPrice = await screen.findByLabelText("Unit price");
    await user.clear(unitPrice);
    await user.type(unitPrice, "5");

    expect((screen.getByLabelText("Total") as HTMLInputElement).value).toBe("10");
  });

  it("editing total auto-fills unit price via quantity", async () => {
    server.use(
      http.get(`/api/v1/receipts/${SCAN_ID}`, () =>
        HttpResponse.json({ data: scanFixture({ id: SCAN_ID }) }),
      ),
      http.get(`/api/v1/receipts/${SCAN_ID}/items`, () =>
        HttpResponse.json({
          data: [scanItemFixture({ id: "item-1", parsed_quantity: 2, parsed_price_minor: null })],
        }),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    const total = await screen.findByLabelText("Total");
    await user.clear(total);
    await user.type(total, "10");

    expect((screen.getByLabelText("Unit price") as HTMLInputElement).value).toBe("5");
  });

  it("clicking commit sends POST to commit endpoint", async () => {
    let commitCalled = false;
    server.use(
      http.get(`/api/v1/receipts/${SCAN_ID}`, () =>
        HttpResponse.json({ data: scanFixture({ id: SCAN_ID }) }),
      ),
      http.get(`/api/v1/receipts/${SCAN_ID}/items`, () =>
        HttpResponse.json({ data: [scanItemFixture({ status: "accepted" })] }),
      ),
      http.post(`/api/v1/receipts/${SCAN_ID}/commit`, () => {
        commitCalled = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    const commitBtn = await screen.findByRole("button", { name: /commit/i });
    await waitFor(() => expect(commitBtn).not.toBeDisabled());
    await user.click(commitBtn);

    await waitFor(() => expect(commitCalled).toBe(true));
  });
});
