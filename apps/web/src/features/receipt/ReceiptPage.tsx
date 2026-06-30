import { useScans, useStartScan } from "@baskety/core";
import { Link } from "@tanstack/react-router";
import { useRef, useState } from "react";

import { PageHeader } from "../../components/PageHeader.js";
import { ReceiptIcon } from "../../components/icons.js";

const STATUS_BADGE: Record<string, string> = {
  uploading: "bg-warn/15 text-warn",
  ocr_processing: "bg-primary/10 text-primary",
  llm_processing: "bg-primary/10 text-primary",
  pending_review: "bg-warn/15 text-warn",
  committed: "bg-ok/15 text-ok",
  failed: "bg-destructive/15 text-destructive",
};

const STATUS_LABEL: Record<string, string> = {
  uploading: "Uploading",
  ocr_processing: "Reading",
  llm_processing: "Extracting",
  pending_review: "Needs review",
  committed: "Committed",
  failed: "Failed",
};

export function ReceiptPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { data: scans, isLoading } = useScans();
  const startScan = useStartScan();

  const handleUpload = async () => {
    if (!selectedFile) return;
    await startScan.mutateAsync(selectedFile);
    setSelectedFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="mx-auto max-w-[1060px] px-8 pb-20 pt-8">
      <PageHeader title="Receipts" subtitle="Scan receipts and review completed trips" />

      <div className="mb-6 rounded-2xl border-[1.5px] border-border bg-card p-5 shadow-soft">
        <h2 className="mb-3 font-serif text-base font-medium">Scan a receipt</h2>
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="receipt-file" className="sr-only">
            Receipt image
          </label>
          <input
            id="receipt-file"
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
            className="flex-1 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
          />
          <button
            type="button"
            onClick={() => void handleUpload()}
            disabled={!selectedFile || startScan.isPending}
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {startScan.isPending ? "Uploading…" : "Upload"}
          </button>
        </div>
        {startScan.isError && (
          <p className="mt-2 text-sm text-destructive">
            {startScan.error instanceof Error ? startScan.error.message : "Upload failed"}
          </p>
        )}
        {startScan.isSuccess && <p className="mt-2 text-sm text-ok">Scan started successfully.</p>}
      </div>

      {isLoading ? (
        <div className="flex min-h-[20vh] items-center justify-center">
          <p className="text-muted-foreground">Loading…</p>
        </div>
      ) : !scans || scans.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">No scans yet.</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {scans.map((scan) => (
            <Link
              key={scan.id}
              to="/receipt/$scanId/review"
              params={{ scanId: scan.id }}
              className="flex items-center gap-4 rounded-xl border-[1.5px] border-border bg-card px-5 py-4 shadow-soft hover:shadow-md"
            >
              <div className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-[10px] bg-primary/10">
                <ReceiptIcon />
              </div>
              <div className="flex-1">
                <div className="font-mono text-sm font-medium">{scan.id.slice(0, 8)}…</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(scan.created_at).toLocaleString()}
                </div>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[scan.status] ?? "bg-muted text-muted-foreground"}`}
              >
                {STATUS_LABEL[scan.status] ?? scan.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
