import { useUiStore } from "../stores/uiStore.js";

import { ApiError } from "./types.js";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const { activeServerUrl, token, activeHouseholdId } = useUiStore.getState();
  const base = activeServerUrl ?? "";
  const headers = new Headers(init?.headers);
  if (
    init?.body !== undefined &&
    !(init.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (activeHouseholdId) headers.set("X-Household-ID", activeHouseholdId);

  const res = await fetch(`${base}/api/v1${path}`, { ...init, headers });
  // 204 No Content — no body to parse (e.g. logout, soft-deletes)
  if (res.status === 204) return undefined as T;
  const body = await res.json();
  if (!res.ok)
    throw new ApiError(
      res.status,
      body.error as string,
      body.fields as Record<string, string> | undefined,
    );
  return body.data as T;
}

export { request };
