import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { request } from "../api/client.js";
import type {
  LLMProviderResponse,
  OCRProviderResponse,
  SettingResponse,
  UpdateLLMProviderRequest,
  UpdateOCRProviderRequest,
} from "../api/types.js";

// ── Request shapes ────────────────────────────────────────────────────────────

interface UpsertSettingRequest {
  value: string;
}

interface CreateLLMProviderRequest {
  provider: string;
  model: string;
  endpoint_url?: string | null;
  api_key_encrypted?: string | null;
  is_default: boolean;
}

interface CreateOCRProviderRequest {
  provider: string;
  endpoint_url?: string | null;
  api_key_encrypted?: string | null;
  extra_config?: string | null;
  is_default: boolean;
}

// ── Key-value settings ────────────────────────────────────────────────────────

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
    queryKey: ["llm-providers"],
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
      void qc.invalidateQueries({ queryKey: ["llm-providers"] });
    },
  });
}

export function useUpdateLLMProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateLLMProviderRequest }) =>
      request<LLMProviderResponse>(`/settings/providers/llm/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["llm-providers"] });
    },
  });
}

export function useDeleteLLMProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      request<void>(`/settings/providers/llm/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["llm-providers"] });
    },
  });
}

// ── OCR providers ─────────────────────────────────────────────────────────────

export function useOCRProviders() {
  return useQuery({
    queryKey: ["ocr-providers"],
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
      void qc.invalidateQueries({ queryKey: ["ocr-providers"] });
    },
  });
}

export function useUpdateOCRProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateOCRProviderRequest }) =>
      request<OCRProviderResponse>(`/settings/providers/ocr/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ocr-providers"] });
    },
  });
}

export function useDeleteOCRProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      request<void>(`/settings/providers/ocr/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ocr-providers"] });
    },
  });
}
