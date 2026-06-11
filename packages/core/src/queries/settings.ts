import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { request } from "../api/client.js";
import type { LLMProviderResponse, OCRProviderResponse, SettingResponse } from "../api/types.js";

// ── Request shapes ────────────────────────────────────────────────────────────

interface UpsertSettingRequest {
  value: string;
}

interface CreateLLMProviderRequest {
  provider: string;
  model: string;
  endpoint_url?: string | null;
  api_key?: string | null;
  is_default?: boolean;
}

interface UpdateLLMProviderRequest {
  provider?: string;
  model?: string;
  endpoint_url?: string | null;
  api_key?: string | null;
  is_default?: boolean;
}

interface CreateOCRProviderRequest {
  provider: string;
  endpoint_url?: string | null;
  api_key?: string | null;
  extra_config?: string | null;
  is_default?: boolean;
}

interface UpdateOCRProviderRequest {
  provider?: string;
  endpoint_url?: string | null;
  api_key?: string | null;
  extra_config?: string | null;
  is_default?: boolean;
}

// ── Key-value settings ────────────────────────────────────────────────────────

export function useSettings(scope: "household" | "user" = "household") {
  return useQuery({
    queryKey: ["settings", scope],
    queryFn: () => request<SettingResponse[]>(`/settings/${scope}`),
  });
}

export function useUpdateSetting(scope: "household" | "user" = "household") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      request<SettingResponse>(`/settings/${scope}/${key}`, {
        method: "PUT",
        body: JSON.stringify({ value } satisfies UpsertSettingRequest),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["settings", scope] });
    },
  });
}

// ── LLM providers ─────────────────────────────────────────────────────────────

export function useLLMProviders() {
  return useQuery({
    queryKey: ["settings", "providers", "llm"],
    queryFn: () => request<LLMProviderResponse[]>("/settings/providers/llm"),
  });
}

export function useCreateLLMProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateLLMProviderRequest) =>
      request<LLMProviderResponse>("/settings/providers/llm", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["settings", "providers", "llm"] });
    },
  });
}

export function useUpdateLLMProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateLLMProviderRequest }) =>
      request<LLMProviderResponse>(`/settings/providers/llm/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["settings", "providers", "llm"] });
    },
  });
}

export function useDeleteLLMProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      request<void>(`/settings/providers/llm/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["settings", "providers", "llm"] });
    },
  });
}

// ── OCR providers ─────────────────────────────────────────────────────────────

export function useOCRProviders() {
  return useQuery({
    queryKey: ["settings", "providers", "ocr"],
    queryFn: () => request<OCRProviderResponse[]>("/settings/providers/ocr"),
  });
}

export function useCreateOCRProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateOCRProviderRequest) =>
      request<OCRProviderResponse>("/settings/providers/ocr", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["settings", "providers", "ocr"] });
    },
  });
}

export function useUpdateOCRProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateOCRProviderRequest }) =>
      request<OCRProviderResponse>(`/settings/providers/ocr/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["settings", "providers", "ocr"] });
    },
  });
}

export function useDeleteOCRProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      request<void>(`/settings/providers/ocr/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["settings", "providers", "ocr"] });
    },
  });
}
