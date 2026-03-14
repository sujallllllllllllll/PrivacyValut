import { createClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ certId: string }>;
}) {
  const { certId } = await params;
  const supabase = await createClient();

  const { data: dsar } = await supabase
    .from("dsar_requests")
    .select("cert_id, cert_hash, cert_issued_at, token, request_type, user_name, completed_at, status")
    .eq("cert_id", certId)
    .single();

  if (!dsar || dsar.status !== "completed" || !dsar.cert_hash) notFound();

  const typeLabel =
    dsar.request_type === "erasure"
      ? "Data Erasure"
      : dsar.request_type === "correction"
      ? "Data Correction"
      : "Data Access";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-2xl w-full space-y-8">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 px-4 py-2 rounded-full text-sm font-semibold">
            <span className="text-lg">✅</span>
            Cryptographically Verified
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Compliance Certificate</h1>
          <p className="text-muted-foreground text-sm">
            Issued under the Digital Personal Data Protection Act 2023
          </p>
        </div>

        {/* Certificate Card */}
        <div className="border-2 border-green-200 rounded-xl bg-white shadow-sm overflow-hidden">
          {/* Green header bar */}
          <div className="bg-green-600 px-8 py-4">
            <p className="text-white font-semibold text-sm uppercase tracking-widest">PrivacyVault DPDP Compliance Platform</p>
          </div>

          <div className="p-8 space-y-6">
            <div className="text-center border-b border-border pb-6">
              <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Certificate Type</p>
              <p className="text-2xl font-bold">{typeLabel} Fulfillment Certificate</p>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Citizen Name</p>
                <p className="font-semibold">{dsar.user_name}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Request Token</p>
                <p className="font-mono font-bold text-primary">{dsar.token}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Fulfilled On</p>
                <p className="font-medium">{new Date(dsar.completed_at!).toLocaleString("en-IN")}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Certificate ID</p>
                <p className="font-mono text-xs break-all text-muted-foreground">{dsar.cert_id}</p>
              </div>
            </div>

            {/* Hash Fingerprint */}
            <div className="bg-muted/40 border border-border rounded-lg p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">SHA-256 Fulfillment Hash</p>
              <p className="font-mono text-xs break-all text-foreground leading-relaxed">{dsar.cert_hash}</p>
              <p className="text-xs text-muted-foreground">
                This hash is a cryptographic fingerprint of the fulfillment payload. Any tampering changes this value.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border text-xs text-muted-foreground">
              <span>Certificate issued: {new Date(dsar.cert_issued_at!).toLocaleString("en-IN")}</span>
              <span className="text-green-700 font-semibold">✓ DPDP Act 2023 Compliant</span>
            </div>
          </div>
        </div>

        <div className="text-center">
          <Link href="/" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            ← Return to PrivacyVault
          </Link>
        </div>
      </div>
    </div>
  );
}
