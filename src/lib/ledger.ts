import crypto from "crypto";
import { createClient } from "@/lib/supabase-server";

export interface LedgerEntry {
  id: string;
  dsar_id: string;
  event_type: string;
  old_status: string | null;
  new_status: string;
  actor: string | null;
  payload_hash: string;
  prev_hash: string | null;
  chain_hash: string;
  created_at: string;
}

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * Appends a new entry to the compliance ledger for a given DSAR.
 * Each entry is chained to the previous via SHA-256, making any
 * tampering instantly detectable.
 */
export async function appendLedgerEntry({
  dsarId,
  eventType,
  oldStatus,
  newStatus,
  actor,
}: {
  dsarId: string;
  eventType: string;
  oldStatus: string | null;
  newStatus: string;
  actor: string;
}): Promise<LedgerEntry> {
  const supabase = await createClient();

  // 1. Get the last entry to retrieve prev_hash
  const { data: lastEntry } = await supabase
    .from("compliance_ledger")
    .select("chain_hash")
    .eq("dsar_id", dsarId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const prevHash = lastEntry?.chain_hash ?? null;
  const timestamp = new Date().toISOString();

  // 2. Compute payload_hash = SHA-256(dsar_id + new_status + timestamp + actor)
  const payloadRaw = `${dsarId}|${newStatus}|${timestamp}|${actor}`;
  const payloadHash = sha256(payloadRaw);

  // 3. Compute chain_hash = SHA-256(payload_hash + prev_hash)
  const chainRaw = `${payloadHash}|${prevHash ?? "GENESIS"}`;
  const chainHash = sha256(chainRaw);

  // 4. Insert into ledger
  const { data, error } = await supabase
    .from("compliance_ledger")
    .insert({
      dsar_id: dsarId,
      event_type: eventType,
      old_status: oldStatus,
      new_status: newStatus,
      actor,
      payload_hash: payloadHash,
      prev_hash: prevHash,
      chain_hash: chainHash,
    })
    .select()
    .single();

  if (error) throw error;
  return data as LedgerEntry;
}

/**
 * Verifies the integrity of the full ledger chain for a DSAR.
 * Returns true only if every chain_hash is correct and unbroken.
 */
export function verifyLedgerChain(entries: LedgerEntry[]): {
  valid: boolean;
  brokenAtIndex: number | null;
} {
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const expectedPrevHash = i === 0 ? null : entries[i - 1].chain_hash;

    // Re-compute chain_hash
    const chainRaw = `${entry.payload_hash}|${entry.prev_hash ?? "GENESIS"}`;
    const computedChainHash = sha256(chainRaw);

    if (computedChainHash !== entry.chain_hash) {
      return { valid: false, brokenAtIndex: i };
    }
    if (entry.prev_hash !== expectedPrevHash) {
      return { valid: false, brokenAtIndex: i };
    }
  }
  return { valid: true, brokenAtIndex: null };
}
