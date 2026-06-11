import { ApiError, useShareInventory } from "@baskety/core";
import { useParams } from "@tanstack/react-router";
import { useState } from "react";

function ExpiryStatus({ expires_at }: { expires_at: string | null }) {
  if (!expires_at) return null;
  const expiry = new Date(expires_at);
  const now = new Date();
  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffMs < 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
        Expired
      </span>
    );
  }
  if (diffDays <= 7) {
    return (
      <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
        Expiring soon
      </span>
    );
  }
  return null;
}

export function SharePage() {
  const { token } = useParams({ from: "/share/$token" });
  const [password, setPassword] = useState("");
  const [submittedPassword, setSubmittedPassword] = useState<string | undefined>(undefined);

  const { data, isLoading, error } = useShareInventory(token, submittedPassword);

  const is401 = error instanceof ApiError && error.status === 401;

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading shared inventory…</p>
      </div>
    );
  }

  if (is401 && submittedPassword === undefined) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-lg border p-6">
          <h2 className="mb-4 text-lg font-semibold">Password required</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            This shared inventory is password-protected.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSubmittedPassword(password);
            }}
          >
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="mb-3 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <button
              type="submit"
              className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Unlock
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Access denied.</p>
      </div>
    );
  }

  const items = data?.items ?? [];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Shared Inventory</h1>
      </div>

      {items.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">No items found.</p>
      ) : (
        <div className="rounded-lg border">
          {items.map((item, idx) => (
            <div
              key={item.id}
              className={`flex items-center justify-between px-4 py-3 ${idx !== 0 ? "border-t" : ""}`}
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">{item.name}</span>
                <span className="text-xs text-muted-foreground">{item.category}</span>
              </div>
              <div className="flex items-center gap-3">
                <ExpiryStatus expires_at={null} />
                <span className="text-sm font-medium text-foreground">
                  {item.target_quantity} {item.unit}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
