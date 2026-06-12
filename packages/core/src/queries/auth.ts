import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { request } from "../api/client.js";
import type {
  AuthResponse,
  HouseholdResponse,
  LoginRequest,
  RegisterRequest,
  User,
} from "../api/types.js";
// Extensionless on purpose: lets Metro resolve uiStore.native.ts on native.
// Do NOT add a .js extension here — it would defeat platform-specific resolution.
import { useUiStore } from "../stores/uiStore";

export function useLogin() {
  const setSession = useUiStore((s) => s.setSession);
  return useMutation({
    mutationFn: (body: LoginRequest) =>
      request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (data) => {
      // Auth response contains only the token; household is fetched separately via useHouseholds.
      // Store token now; the caller should follow up with setActiveHousehold once households load.
      setSession(data.token);
    },
  });
}

export function useRegister() {
  return useMutation({
    // Register returns a UserResponse (201); it does not establish a session.
    mutationFn: (body: RegisterRequest) =>
      request<User>("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  });
}

export function useLogout() {
  const clearSession = useUiStore((s) => s.clearSession);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => request<void>("/auth/session", { method: "DELETE" }),
    onSettled: () => {
      clearSession();
      qc.clear();
    },
  });
}

export function useHouseholds() {
  const token = useUiStore((s) => s.token);
  return useQuery({
    queryKey: ["households"],
    queryFn: () => request<HouseholdResponse[]>("/households"),
    enabled: !!token,
  });
}

export function useCreateHousehold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string }) =>
      request<HouseholdResponse>("/households", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["households"] });
    },
  });
}
