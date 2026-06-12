import { useUiStore } from "../stores/uiStore";

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

  if (res.status === 204) return undefined as T;

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiError(
      res.status,
      typeof body["error"] === "string" ? body["error"] : res.statusText,
      typeof body["fields"] === "object" && body["fields"] !== null
        ? (body["fields"] as Record<string, string>)
        : undefined,
    );
  }
  return body["data"] as T;
}

async function requestShare<T>(path: string, password?: string): Promise<T> {
  const { activeServerUrl } = useUiStore.getState();
  const base = activeServerUrl ?? "";
  const headers = new Headers();
  if (password) headers.set("X-Share-Password", password);
  const res = await fetch(`${base}/api/v1${path}`, { headers });
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiError(
      res.status,
      typeof body["error"] === "string" ? body["error"] : res.statusText,
    );
  }
  return body["data"] as T;
}

export { request, requestShare };
