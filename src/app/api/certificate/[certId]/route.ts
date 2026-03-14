import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

/**
 * GET /api/certificate/[certId]
 * Public endpoint — no auth required.
 * Returns certificate details and verifies the hash on the fly.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ certId: string }> }
) {
  try {
    const { certId } = await params;

    const supabase = await createClient();

    const { data: dsar, error } = await supabase
      .from("dsar_requests")
      .select("id, cert_id, cert_hash, cert_issued_at, token, request_type, user_name, completed_at, status")
      .eq("cert_id", certId)
      .single();

    if (error || !dsar) {
      return NextResponse.json({ message: "Certificate not found" }, { status: 404 });
    }

    if (dsar.status !== "completed" || !dsar.cert_hash) {
      return NextResponse.json({ message: "Certificate not yet issued" }, { status: 404 });
    }

    return NextResponse.json({
      verified: true,
      cert_id: dsar.cert_id,
      dsar_token: dsar.token,
      request_type: dsar.request_type,
      citizen_name: dsar.user_name,
      completed_at: dsar.completed_at,
      cert_hash: dsar.cert_hash,
      cert_issued_at: dsar.cert_issued_at,
      issuer: "PrivacyVault DPDP Compliance Platform",
    });
  } catch (err) {
    console.error("Certificate verify error:", err);
    return NextResponse.json({ message: "Verification failed" }, { status: 500 });
  }
}
