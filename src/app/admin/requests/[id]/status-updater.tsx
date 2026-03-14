"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const STATUSES = ["submitted", "under_review", "processing", "completed", "rejected"] as const;
type Status = typeof STATUSES[number];

export function StatusUpdater({ id, currentStatus }: { id: string; currentStatus: string }) {
  const [selected, setSelected] = useState<Status>(currentStatus as Status);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSave() {
    setError("");
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, status: selected }),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.message || "Failed to update status");
          return;
        }
        router.refresh();
      } catch {
        setError("Network error. Please try again.");
      }
    });
  }

  return (
    <div className="bg-secondary/50 p-4 rounded-sm border border-border flex flex-col gap-2 min-w-[240px]">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Update Status</p>
      <div className="flex gap-2">
        <select
          className="flex-1 h-9 px-3 py-1 text-sm border border-input rounded-sm bg-background"
          value={selected}
          onChange={(e) => setSelected(e.target.value as Status)}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}</option>
          ))}
        </select>
        <Button size="sm" onClick={handleSave} disabled={selected === currentStatus || isPending}>
          {isPending ? "Saving..." : "Save"}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {isPending && selected === "completed" && (
        <p className="text-xs text-muted-foreground">Generating certificate & AI summary…</p>
      )}
    </div>
  );
}
