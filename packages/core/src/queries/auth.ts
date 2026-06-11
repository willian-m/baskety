import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { request } from "../api/client.js";
import type { AuthResponse, Household, LoginRequest, RegisterRequest } from "../api/types.js";
import { useUiStore } from "../stores/uiStore.js";

export function useLogin() {
  const setSession = useUiStore((s) => s.setSession);
  return useMutation({
    mutationFn: (body: LoginRequest) =>
      request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (data) => {
      setSession(data.token, data.user.id);
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (body: RegisterRequest) =>
      request<AuthResponse>("/auth/register", { method: "POST", body: JSON.stringify(body) }),
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
    queryFn: () => request<Household[]>("/households"),
    enabled: !!token,
  });
}
