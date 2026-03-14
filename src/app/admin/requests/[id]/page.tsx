import { createClient } from "@/lib/supabase-server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatStatus, getStatusTheme, getDaysRemainingTheme, formatDateTime, getDaysRemaining } from "@/lib/utils";
import { StatusUpdater } from "./status-updater";
import { AiSummary } from "./ai-summary";
import { LedgerView } from "./ledger-view";

export const dynamic = "force-dynamic";

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const { id } = await params;
  const { data: req } = await supabase.from("dsar_requests").select("*").eq("id", id).single();
  if (!req) notFound();

  const daysRemaining = getDaysRemaining(req.deadline);
  const isUrgent = req.status !== "completed" && req.status !== "rejected" && daysRemaining !== null && daysRemaining < 7;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/admin" className="text-muted-foreground hover:text-primary transition-colors text-sm font-medium">
          &larr; Back to Dashboard
        </Link>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-mono font-bold">{req.token}</h1>
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusTheme(req.status)}`}>
              {formatStatus(req.status)}
            </span>
            {isUrgent && (
              <span className="px-2.5 py-1 rounded-full text-xs font-bold border border-red-200 bg-red-100 text-red-800">URGENT</span>
            )}
          </div>
          <p className="text-muted-foreground">Requested by {req.user_name} ({req.user_email})</p>
        </div>
        <StatusUpdater id={id} currentStatus={req.status} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Request Details</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Type</p>
                  <p className="font-semibold capitalize text-lg">{req.request_type}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Phone</p>
                  <p className="font-medium">{req.user_phone || "Not provided"}</p>
                </div>
              </div>
              <div className="pt-4 border-t border-border">
                <p className="text-sm font-medium text-muted-foreground mb-3">Additional Context</p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed bg-muted/30 p-4 rounded-sm border border-border/50 min-h-[100px]">
                  {req.request_details || "No additional details provided by the citizen."}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-4">
              <div>
                <CardTitle>AI Assistant Analysis</CardTitle>
                <CardDescription>Generate an automated summary and action plan.</CardDescription>
              </div>
            </CardHeader>
            <AiSummary requestId={id} />
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Timeline & SLA</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Created</p>
                <p className="text-sm font-medium">{formatDateTime(req.created_at)}</p>
              </div>
              <div className="py-4 border-y border-border">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Legal Deadline</p>
                <p className="text-sm font-semibold">{formatDateTime(req.deadline)}</p>
                {req.status !== "completed" && req.status !== "rejected" && daysRemaining !== null && (
                  <div className="mt-3">
                    <p className={`text-2xl font-bold ${getDaysRemainingTheme(daysRemaining)}`}>{daysRemaining}</p>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-1">Days Remaining</p>
                  </div>
                )}
              </div>
              {req.completed_at && (
                <div className="bg-green-50 p-3 rounded-sm border border-green-100">
                  <p className="text-xs font-medium text-green-800 uppercase tracking-wider mb-1">Resolved On</p>
                  <p className="text-sm font-semibold text-green-900">{formatDateTime(req.completed_at)}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Last System Update</p>
                <p className="text-sm text-muted-foreground">{formatDateTime(req.updated_at)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Immutable Compliance Ledger */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">🔗 Compliance Ledger</CardTitle>
              <CardDescription>Tamper-proof hash-chain audit trail (DPDP Act 2023)</CardDescription>
            </CardHeader>
            <LedgerView dsarId={id} />
          </Card>
        </div>
      </div>
    </div>
  );
}
