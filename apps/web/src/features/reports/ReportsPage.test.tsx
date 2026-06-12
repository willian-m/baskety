import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../test/renderWithProviders.js";
import { server } from "../../test/server.js";

import { ReportsPage } from "./ReportsPage.js";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

describe("ReportsPage", () => {
  it("shows loading state then resolves", async () => {
    renderWithProviders(() => <ReportsPage />);
    // RouterProvider renders async; findByLabelText retries until the component settles
    expect(await screen.findByLabelText("Catalog entry")).toBeInTheDocument();
  });

  it("renders catalog entry selector", async () => {
    renderWithProviders(() => <ReportsPage />);
    const select = await screen.findByLabelText("Catalog entry");
    expect(select).toBeInTheDocument();
    expect(screen.getByText("Select an item…")).toBeInTheDocument();
  });

  it("shows prompt when no entry selected", async () => {
    renderWithProviders(() => <ReportsPage />);
    await screen.findByLabelText("Catalog entry");
    expect(
      screen.getByText("Select a catalog entry above to view price history."),
    ).toBeInTheDocument();
  });

  it("shows table and chart after selecting a catalog entry", async () => {
    renderWithProviders(() => <ReportsPage />);
    const select = await screen.findByLabelText("Catalog entry");

    const user = userEvent.setup();
    await user.selectOptions(select, ["Test Product"]);

    await screen.findByText("Date");
    expect(screen.getByText("Store")).toBeInTheDocument();
    expect(screen.getByText("Price / unit")).toBeInTheDocument();
    expect(screen.getByTestId("line-chart")).toBeInTheDocument();
  });

  it("shows 'No transactions found' when transactions empty for selected entry", async () => {
    server.use(http.get("/api/v1/catalog/transactions", () => HttpResponse.json({ data: [] })));

    renderWithProviders(() => <ReportsPage />);
    const select = await screen.findByLabelText("Catalog entry");

    const user = userEvent.setup();
    await user.selectOptions(select, ["Test Product"]);

    expect(await screen.findByText("No transactions found for this item.")).toBeInTheDocument();
  });
});
