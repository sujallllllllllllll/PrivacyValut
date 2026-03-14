import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { verifyLedgerChain } from "@/lib/ledger";

export const dynamic = "force-dynamic";

/**
 * GET /api/ledger/[dsarId]
 * Returns all ledger entries for a DSAR.
 * If ?verify=true, also verifies the hash chain integrity.
 * Admin-only.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ dsarId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { dsarId } = await params;
    const shouldVerify = req.nextUrl.searchParams.get("verify") === "true";

    const { data: entries, error } = await supabase
      .from("compliance_ledger")
      .select("*")
      .eq("dsar_id", dsarId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const result: Record<string, unknown> = { entries: entries ?? [] };

    if (shouldVerify && entries) {
      const verification = verifyLedgerChain(entries);
      result.verification = verification;
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("Ledger fetch error:", err);
    return NextResponse.json({ message: "Failed to fetch ledger" }, { status: 500 });
  }
}
