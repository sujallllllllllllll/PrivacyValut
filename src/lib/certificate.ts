import crypto from "crypto";
import { createClient } from "@/lib/supabase-server";

export interface CertificatePayload {
  cert_id: string;
  dsar_token: string;
  request_type: string;
  user_name: string;
  user_email: string;
  completed_at: string;
  ledger_chain_hash: string; // last chain_hash from the ledger
  cert_hash: string; // SHA-256 of the whole payload
  issued_at: string;
  issuer: string;
}

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * Generates a cryptographic fulfillment certificate when a DSAR is completed.
 * The certificate payload is SHA-256 hashed for tamper-proof verification.
 * Saves cert_hash and cert_issued_at back to the dsar_requests table.
 */
export async function generateCertificate(dsarId: string): Promise<CertificatePayload> {
  const supabase = await createClient();

  // Fetch the DSAR record
  const { data: dsar, error: dsarError } = await supabase
    .from("dsar_requests")
    .select("id, cert_id, token, request_type, user_name, user_email, completed_at")
    .eq("id", dsarId)
    .single();

  if (dsarError || !dsar) throw new Error("DSAR not found");

  // Get the latest ledger chain_hash
  const { data: lastLedgerEntry } = await supabase
    .from("compliance_ledger")
    .select("chain_hash")
    .eq("dsar_id", dsarId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const ledgerChainHash = lastLedgerEntry?.chain_hash ?? "NO_LEDGER";
  const issuedAt = new Date().toISOString();
  const issuer = "PrivacyVault DPDP Compliance Platform";

  // Build the payload string for hashing
  const payloadForHash = [
    dsar.cert_id,
    dsar.token,
    dsar.request_type,
    dsar.user_name,
    dsar.user_email,
    dsar.completed_at ?? issuedAt,
    ledgerChainHash,
    issuedAt,
    issuer,
  ].join("|");

  const certHash = sha256(payloadForHash);

  // Save cert_hash and cert_issued_at to the DSAR record
  await supabase
    .from("dsar_requests")
    .update({ cert_hash: certHash, cert_issued_at: issuedAt })
    .eq("id", dsarId);

  return {
    cert_id: dsar.cert_id,
    dsar_token: dsar.token,
    request_type: dsar.request_type,
    user_name: dsar.user_name,
    user_email: dsar.user_email,
    completed_at: dsar.completed_at ?? issuedAt,
    ledger_chain_hash: ledgerChainHash,
    cert_hash: certHash,
    issued_at: issuedAt,
    issuer,
  };
}
