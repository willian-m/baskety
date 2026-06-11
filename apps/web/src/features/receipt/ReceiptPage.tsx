import { useScans, useStartScan } from "@baskety/core";
import { Link } from "@tanstack/react-router";
import { useRef, useState } from "react";

const STATUS_BADGE: Record<string, string> = {
  uploading: "bg-yellow-100 text-yellow-800",
  ocr_processing: "bg-blue-100 text-blue-800",
  llm_processing: "bg-blue-100 text-blue-800",
  pending_review: "bg-yellow-100 text-yellow-800",
  committed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
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
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Receipts</h1>
      </div>

      <div className="mb-6 rounded-lg border p-4">
        <h2 className="mb-3 font-medium">Scan a receipt</h2>
        <div className="flex flex-wrap items-center gap-3">
          <input
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
          <p className="mt-2 text-sm text-red-600">
            {startScan.error instanceof Error ? startScan.error.message : "Upload failed"}
          </p>
        )}
        {startScan.isSuccess && (
          <p className="mt-2 text-sm text-green-600">Scan started successfully.</p>
        )}
      </div>

      {isLoading ? (
        <div className="flex min-h-[20vh] items-center justify-center">
          <p className="text-muted-foreground">Loading…</p>
        </div>
      ) : !scans || scans.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">No scans yet.</p>
      ) : (
        <div className="rounded-lg border">
          {scans.map((scan, idx) => (
            <Link
              key={scan.id}
              to="/receipt/$scanId/review"
              params={{ scanId: scan.id }}
              className={`flex items-center justify-between px-4 py-3 hover:bg-muted/50 ${idx !== 0 ? "border-t" : ""}`}
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-medium text-sm font-mono">{scan.id.slice(0, 8)}…</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(scan.created_at).toLocaleString()}
                </span>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[scan.status] ?? "bg-gray-100 text-gray-800"}`}
              >
                {scan.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
