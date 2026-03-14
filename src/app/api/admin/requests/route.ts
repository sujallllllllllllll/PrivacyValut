import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getDaysRemaining } from "@/lib/utils";
import { appendLedgerEntry } from "@/lib/ledger";
import { generateCertificate } from "@/lib/certificate";
import { generateFulfillmentSummary } from "@/lib/ai-summary";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const status = req.nextUrl.searchParams.get("status");
    const validStatuses = ["submitted", "under_review", "processing", "completed", "rejected"];

    let query = supabase.from("dsar_requests").select("*").order("created_at", { ascending: false });
    if (status && validStatuses.includes(status)) query = query.eq("status", status);

    const [{ data: requests }, { data: all }] = await Promise.all([
      query,
      supabase.from("dsar_requests").select("status, deadline"),
    ]);

    const allRows = all ?? [];
    const stats = {
      submitted: allRows.filter((r) => r.status === "submitted").length,
      underReview: allRows.filter((r) => r.status === "under_review").length,
      processing: allRows.filter((r) => r.status === "processing").length,
      completed: allRows.filter((r) => r.status === "completed").length,
      rejected: allRows.filter((r) => r.status === "rejected").length,
      urgent: 0,
    };

    const mappedRequests = (requests ?? []).map((r) => {
      const daysRemaining = getDaysRemaining(r.deadline);
      const isUrgent = r.status !== "completed" && r.status !== "rejected" && daysRemaining !== null && daysRemaining < 7;
      if (isUrgent) stats.urgent++;
      return { id: r.id, token: r.token, userName: r.user_name, userEmail: r.user_email, requestType: r.request_type, status: r.status, deadline: r.deadline, createdAt: r.created_at, daysRemaining, isUrgent };
    });

    return NextResponse.json({ requests: mappedRequests, total: mappedRequests.length, stats });
  } catch (err) {
    console.error("List requests error:", err);
    return NextResponse.json({ message: "Failed to list requests" }, { status: 500 });
  }
}

/**
 * POST /api/admin/requests
 * Body: { id: string, status: string }
 * Updates DSAR status and appends a cryptographic ledger entry.
 * On completion: generates a certificate and fires AI summary.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { id, status } = body as { id: string; status: string };

    const validStatuses = ["submitted", "under_review", "processing", "completed", "rejected"];
    if (!id || !status || !validStatuses.includes(status)) {
      return NextResponse.json({ message: "Invalid request" }, { status: 400 });
    }

    // 1. Fetch current status for ledger tracking
    const { data: current, error: fetchError } = await supabase
      .from("dsar_requests")
      .select("status")
      .eq("id", id)
      .single();

    if (fetchError || !current) {
      return NextResponse.json({ message: "DSAR not found" }, { status: 404 });
    }

    const oldStatus = current.status;
    if (oldStatus === status) {
      return NextResponse.json({ message: "Status unchanged" }, { status: 200 });
    }

    // 2. Update the DSAR status
    const updateData: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (status === "completed") {
      updateData.completed_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from("dsar_requests")
      .update(updateData)
      .eq("id", id);

    if (updateError) throw updateError;

    // 3. Append immutable ledger entry (synchronous — must succeed)
    await appendLedgerEntry({
      dsarId: id,
      eventType: status === "completed" || status === "rejected" ? status : "status_change",
      oldStatus,
      newStatus: status,
      actor: user.email ?? "admin",
    });

    // 4. On completion: generate certificate + AI summary (async, non-blocking)
    if (status === "completed") {
      // Certificate is awaited (important compliance artifact)
      await generateCertificate(id);
      // AI summary is fire-and-forget
      generateFulfillmentSummary(id).catch(() => {});
    }

    return NextResponse.json({ success: true, newStatus: status });
  } catch (err) {
    console.error("Update status error:", err);
    return NextResponse.json({ message: "Failed to update status" }, { status: 500 });
  }
}
