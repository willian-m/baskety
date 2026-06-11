import { ExpiryBadge } from "@baskety/ui";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("ExpiryBadge", () => {
  it("returns null for null expiresAt", () => {
    const { container } = render(<ExpiryBadge expiresAt={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows 'Expired' for past date more than 24h ago", () => {
    const past = new Date(Date.now() - 86400000 * 2).toISOString();
    render(<ExpiryBadge expiresAt={past} />);
    expect(screen.getByText("Expired")).toBeInTheDocument();
  });

  it("shows 'Expiring today' for a date that expired less than 24h ago", () => {
    // days = ceil(diff / ms_per_day) where diff = expiresAt - now
    // For diff in (-ms_per_day, 0]: ceil gives 0
    // "Expiring today" is shown when days === 0
    const recentPast = new Date(Date.now() - 1000 * 60 * 60).toISOString(); // 1 hour ago
    render(<ExpiryBadge expiresAt={recentPast} />);
    expect(screen.getByText("Expiring today")).toBeInTheDocument();
  });

  it("shows 'Expiring in Nd' for dates within 7 days", () => {
    const future = new Date(Date.now() + 86400000 * 3).toISOString(); // 3 days
    render(<ExpiryBadge expiresAt={future} />);
    expect(screen.getByText(/expiring in 3d/i)).toBeInTheDocument();
  });

  it("returns null for dates more than 7 days away", () => {
    const far = new Date(Date.now() + 86400000 * 10).toISOString();
    const { container } = render(<ExpiryBadge expiresAt={far} />);
    expect(container).toBeEmptyDOMElement();
  });
});
