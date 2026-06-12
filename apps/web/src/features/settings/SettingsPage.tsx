import type { LLMProviderResponse, OCRProviderResponse } from "@baskety/core";
import {
  useCreateLLMProvider,
  useCreateOCRProvider,
  useCreateShareLink,
  useHouseholds,
  useInventories,
  useLLMProviders,
  useOCRProviders,
  useUiStore,
} from "@baskety/core";
import { useState } from "react";

// ── Shared input style ────────────────────────────────────────────────────────
const inputCls =
  "flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

// ── LLM Provider section ──────────────────────────────────────────────────────

function LLMProviderRow({ p }: { p: LLMProviderResponse }) {
  return (
    <div className="flex items-center justify-between border-t px-4 py-3">
      <div className="flex flex-col gap-0.5">
        <span className="font-medium">
          {p.provider} / {p.model}
          {p.is_default && (
            <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
              default
            </span>
          )}
        </span>
        {p.endpoint_url && <span className="text-xs text-muted-foreground">{p.endpoint_url}</span>}
        {p.has_api_key && <span className="text-xs text-muted-foreground">API key configured</span>}
      </div>
    </div>
  );
}

function LLMSection() {
  const { data: providers, isLoading } = useLLMProviders();
  const create = useCreateLLMProvider();
  const [showAdd, setShowAdd] = useState(false);
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [apiKey, setApiKey] = useState("");

  const handleCreate = async () => {
    if (!provider.trim() || !model.trim()) return;
    await create.mutateAsync({
      provider: provider.trim(),
      model: model.trim(),
      endpoint_url: endpoint.trim() || null,
      api_key_encrypted: apiKey || null,
      is_default: false,
    });
    setProvider("");
    setModel("");
    setEndpoint("");
    setApiKey("");
    setShowAdd(false);
  };

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">LLM Providers</h2>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          Add provider
        </button>
      </div>

      {showAdd && (
        <div className="mb-4 rounded-lg border p-4">
          <h3 className="mb-3 font-medium">New LLM provider</h3>
          <div className="flex flex-wrap gap-2">
            <input
              autoFocus
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              placeholder="Provider (e.g. openai)"
              className={`${inputCls} w-40`}
            />
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Model (e.g. gpt-4o)"
              className={`${inputCls} w-40`}
            />
            <input
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="Endpoint URL (optional)"
              className={`${inputCls} flex-1`}
            />
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="API key (optional)"
              className={`${inputCls} w-52`}
            />
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={!provider.trim() || !model.trim() || create.isPending}
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {create.isPending ? "Adding…" : "Add"}
            </button>
          </div>
          {create.isError && (
            <p className="mt-2 text-sm text-destructive">
              {(create.error as Error).message ?? "Failed to add provider."}
            </p>
          )}
        </div>
      )}

      <div className="rounded-lg border">
        {isLoading && <p className="px-4 py-3 text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && (!providers || providers.length === 0) && (
          <p className="px-4 py-3 text-sm text-muted-foreground">No LLM providers configured.</p>
        )}
        {(providers ?? []).map((p) => (
          <LLMProviderRow key={p.id} p={p} />
        ))}
      </div>
    </section>
  );
}

// ── OCR Provider section ──────────────────────────────────────────────────────

function OCRProviderRow({ p }: { p: OCRProviderResponse }) {
  return (
    <div className="flex items-center justify-between border-t px-4 py-3">
      <div className="flex flex-col gap-0.5">
        <span className="font-medium">
          {p.provider}
          {p.is_default && (
            <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
              default
            </span>
          )}
        </span>
        {p.endpoint_url && <span className="text-xs text-muted-foreground">{p.endpoint_url}</span>}
        {p.has_api_key && <span className="text-xs text-muted-foreground">API key configured</span>}
      </div>
    </div>
  );
}

function OCRSection() {
  const { data: providers, isLoading } = useOCRProviders();
  const create = useCreateOCRProvider();
  const [showAdd, setShowAdd] = useState(false);
  const [provider, setProvider] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [apiKey, setApiKey] = useState("");

  const handleCreate = async () => {
    if (!provider.trim()) return;
    await create.mutateAsync({
      provider: provider.trim(),
      endpoint_url: endpoint.trim() || null,
      api_key_encrypted: apiKey || null,
      is_default: false,
    });
    setProvider("");
    setEndpoint("");
    setApiKey("");
    setShowAdd(false);
  };

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">OCR Providers</h2>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          Add provider
        </button>
      </div>

      {showAdd && (
        <div className="mb-4 rounded-lg border p-4">
          <h3 className="mb-3 font-medium">New OCR provider</h3>
          <div className="flex flex-wrap gap-2">
            <input
              autoFocus
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              placeholder="Provider (e.g. tesseract)"
              className={`${inputCls} w-44`}
            />
            <input
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="Endpoint URL (optional)"
              className={`${inputCls} flex-1`}
            />
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="API key (optional)"
              className={`${inputCls} w-52`}
            />
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={!provider.trim() || create.isPending}
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {create.isPending ? "Adding…" : "Add"}
            </button>
          </div>
          {create.isError && (
            <p className="mt-2 text-sm text-destructive">
              {(create.error as Error).message ?? "Failed to add provider."}
            </p>
          )}
        </div>
      )}

      <div className="rounded-lg border">
        {isLoading && <p className="px-4 py-3 text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && (!providers || providers.length === 0) && (
          <p className="px-4 py-3 text-sm text-muted-foreground">No OCR providers configured.</p>
        )}
        {(providers ?? []).map((p) => (
          <OCRProviderRow key={p.id} p={p} />
        ))}
      </div>
    </section>
  );
}

// ── Household section ─────────────────────────────────────────────────────────

function HouseholdSection() {
  const activeHouseholdId = useUiStore((s) => s.activeHouseholdId);
  const { data: households, isLoading } = useHouseholds();
  const active = households?.find((h) => h.id === activeHouseholdId) ?? households?.[0];

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Household</h2>
      <div className="rounded-lg border px-4 py-3">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && active && (
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">{active.name}</span>
            <span className="text-xs text-muted-foreground">ID: {active.id}</span>
            <p className="mt-2 text-xs text-muted-foreground">
              Household rename is not yet available in this release.
            </p>
          </div>
        )}
        {!isLoading && !active && (
          <p className="text-sm text-muted-foreground">No household found.</p>
        )}
      </div>
    </section>
  );
}

// ── Share Links section ───────────────────────────────────────────────────────

function ShareLinksSection() {
  const { data: inventories } = useInventories();
  const createShareLink = useCreateShareLink();
  const [selectedInventoryId, setSelectedInventoryId] = useState("");
  const [password, setPassword] = useState("");
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!selectedInventoryId) return;
    const link = await createShareLink.mutateAsync({
      inventory_id: selectedInventoryId,
      password: password.trim() || null,
    });
    const base = window.location.origin;
    setShareUrl(`${base}/share/${link.token}`);
    setSelectedInventoryId("");
    setPassword("");
  };

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Share Links</h2>
      <div className="rounded-lg border p-4">
        <p className="mb-3 text-sm text-muted-foreground">
          Create a read-only share link to your inventory.
        </p>
        <div className="flex flex-wrap gap-2">
          <select
            data-testid="share-inventory-select"
            value={selectedInventoryId}
            onChange={(e) => setSelectedInventoryId(e.target.value)}
            className={`${inputCls} w-52`}
          >
            <option value="">Select inventory…</option>
            {(inventories ?? []).map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.name}
              </option>
            ))}
          </select>
          <input
            data-testid="share-password-input"
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (optional)"
            className={`${inputCls} w-48`}
          />
          <button
            type="button"
            data-testid="share-create-button"
            onClick={() => void handleCreate()}
            disabled={!selectedInventoryId || createShareLink.isPending}
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {createShareLink.isPending ? "Creating…" : "Create share link"}
          </button>
        </div>
        {shareUrl && (
          <div className="mt-3 flex items-center gap-2">
            <input
              data-testid="share-link-url"
              readOnly
              value={shareUrl}
              className={`${inputCls} flex-1 bg-muted`}
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(shareUrl)}
              className="inline-flex h-9 items-center rounded-md border border-input px-3 text-sm hover:bg-muted"
            >
              Copy
            </button>
          </div>
        )}
        {createShareLink.isError && (
          <p className="mt-2 text-sm text-destructive">
            {(createShareLink.error as Error).message ?? "Failed to create share link."}
          </p>
        )}
      </div>
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function SettingsPage() {
  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Settings</h1>
      <div className="flex flex-col gap-8">
        <HouseholdSection />
        <ShareLinksSection />
        <LLMSection />
        <OCRSection />
      </div>
    </div>
  );
}
