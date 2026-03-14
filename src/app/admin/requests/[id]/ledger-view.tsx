"use client";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";

type LedgerEntry = {
  id: string;
  event_type: string;
  old_status: string | null;
  new_status: string;
  actor: string | null;
  payload_hash: string;
  chain_hash: string;
  created_at: string;
};

type VerificationResult = {
  valid: boolean;
  brokenAtIndex: number | null;
};

const EVENT_LABELS: Record<string, string> = {
  submitted: "Request Submitted",
  status_change: "Status Updated",
  completed: "Request Completed",
  rejected: "Request Rejected",
};

export function LedgerView({ dsarId }: { dsarId: string }) {
  const [entries, setEntries] = useState<LedgerEntry[] | null>(null);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState("");

  const loadEntries = useCallback(async () => {
    setIsLoading(true);
    setError("");
    setVerification(null);
    try {
      const res = await fetch(`/api/ledger/${dsarId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      setEntries(data.entries);
    } catch {
      setError("Failed to load ledger entries.");
    } finally {
      setIsLoading(false);
    }
  }, [dsarId]);

  async function verifyChain() {
    setIsVerifying(true);
    setError("");
    try {
      const res = await fetch(`/api/ledger/${dsarId}?verify=true`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      setEntries(data.entries);
      setVerification(data.verification);
    } catch {
      setError("Failed to verify chain.");
    } finally {
      setIsVerifying(false);
    }
  }

  if (!entries) {
    return (
      <CardContent className="pt-4 border-t border-border">
        <Button variant="outline" onClick={loadEntries} disabled={isLoading} className="w-full">
          {isLoading ? "Loading Ledger…" : "🔗 View Compliance Ledger"}
        </Button>
        {error && <p className="text-xs text-destructive mt-2">{error}</p>}
      </CardContent>
    );
  }

  return (
    <CardContent className="pt-4 border-t border-border space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Immutable Audit Chain</p>
        <Button variant="outline" size="sm" onClick={verifyChain} disabled={isVerifying}>
          {isVerifying ? "Verifying…" : "Verify Integrity"}
        </Button>
      </div>

      {verification && (
        <div className={`p-3 rounded-sm border text-sm font-medium flex items-center gap-2 ${
          verification.valid
            ? "bg-green-50 border-green-200 text-green-800"
            : "bg-red-50 border-red-200 text-red-800"
        }`}>
          {verification.valid ? (
            <><span>✅</span> Chain intact — all {entries.length} entries verified. No tampering detected.</>
          ) : (
            <><span>❌</span> TAMPER DETECTED at entry #{(verification.brokenAtIndex ?? 0) + 1}. Chain is broken.</>
          )}
        </div>
      )}

      <div className="relative space-y-0">
        {entries.map((entry, i) => (
          <div key={entry.id} className="flex gap-3 pb-4">
            {/* Timeline line */}
            <div className="flex flex-col items-center">
              <div className="w-7 h-7 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                {i + 1}
              </div>
              {i < entries.length - 1 && <div className="w-0.5 bg-border flex-1 my-1" />}
            </div>

            <div className="flex-1 pb-2">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-semibold">{EVENT_LABELS[entry.event_type] ?? entry.event_type}</p>
                {entry.old_status && (
                  <span className="text-xs text-muted-foreground">
                    {entry.old_status.replace("_", " ")} → {entry.new_status.replace("_", " ")}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                {new Date(entry.created_at).toLocaleString("en-IN")} · by {entry.actor ?? "system"}
              </p>
              <div className="font-mono text-[10px] text-muted-foreground bg-muted/50 p-2 rounded-sm border border-border/50 break-all">
                <span className="font-semibold text-foreground">chain:</span> {entry.chain_hash}
              </div>
            </div>
          </div>
        ))}

        {entries.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No ledger entries yet.</p>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </CardContent>
  );
}
