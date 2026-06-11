import { ApiError, useShareInventory } from "@baskety/core";
import { useEffect, useState } from "react";

import { Route } from "../../routes/share.$token.js";

export function SharePage() {
  const { token } = Route.useParams();
  const [password, setPassword] = useState("");
  const [submittedPassword, setSubmittedPassword] = useState<string | undefined>(undefined);
  const [passwordError, setPasswordError] = useState(false);

  const { data, isLoading, error } = useShareInventory(token, submittedPassword);

  const is401 = error instanceof ApiError && error.status === 401;

  useEffect(() => {
    if (is401 && submittedPassword !== undefined) {
      setPasswordError(true);
    }
  }, [is401, submittedPassword]);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading shared inventory…</p>
      </div>
    );
  }

  if (is401) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-lg border p-6">
          <h2 className="mb-4 text-lg font-semibold">Password required</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            This shared inventory is password-protected.
          </p>
          {passwordError && (
            <p className="mb-3 text-sm text-red-600">Incorrect password, please try again.</p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!password) return;
              setPasswordError(false);
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
              disabled={!password}
              className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
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
                {/* expiry indicators require batch data — not returned by share endpoint */}
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
