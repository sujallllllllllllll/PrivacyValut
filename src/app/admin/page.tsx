import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { formatStatus, getStatusTheme, getDaysRemainingTheme, formatDate, getDaysRemaining } from "@/lib/utils";
import { StatusFilter } from "./status-filter";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const { status } = await searchParams;
  const validStatuses = ["submitted", "under_review", "processing", "completed", "rejected"];

  let query = supabase.from("dsar_requests").select("*").order("created_at", { ascending: false });
  if (status && validStatuses.includes(status)) {
    query = query.eq("status", status);
  }

  const [{ data: requests }, { data: allRequests }, { data: adminRow }] = await Promise.all([
    query,
    supabase.from("dsar_requests").select("status, deadline"),
    supabase.from("admins").select("name").eq("id", user.id).single(),
  ]);

  const rows = requests ?? [];
  const all = allRequests ?? [];

  const stats = {
    submitted: all.filter((r) => r.status === "submitted").length,
    underReview: all.filter((r) => r.status === "under_review").length,
    processing: all.filter((r) => r.status === "processing").length,
    completed: all.filter((r) => r.status === "completed").length,
    rejected: all.filter((r) => r.status === "rejected").length,
    urgent: all.filter((r) => {
      if (r.status === "completed" || r.status === "rejected") return false;
      const d = getDaysRemaining(r.deadline);
      return d !== null && d < 7 && d >= 0;
    }).length,
  };

  const adminName = adminRow?.name ?? user.email;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back, {adminName}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard title="Total Requests" value={stats.submitted + stats.underReview + stats.processing + stats.completed + stats.rejected} />
        <StatsCard title="Urgent (< 7 Days)" value={stats.urgent} highlight="red" />
        <StatsCard title="Processing" value={stats.processing + stats.underReview} highlight="blue" />
        <StatsCard title="Completed" value={stats.completed} highlight="green" />
      </div>

      <div className="flex justify-between items-center pt-4">
        <h2 className="text-xl font-semibold">All Requests</h2>
        <StatusFilter current={status ?? ""} />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-secondary/50 text-muted-foreground">
              <tr>
                <th className="px-6 py-4 font-medium">Token / User</th>
                <th className="px-6 py-4 font-medium">Type</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Deadline / SLA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">No requests found.</td>
                </tr>
              ) : (
                rows.map((req) => {
                  const daysRemaining = getDaysRemaining(req.deadline);
                  return (
                    <tr key={req.id} className="hover:bg-muted/50 transition-colors group">
                      <td className="px-6 py-4">
                        <Link href={`/admin/requests/${req.id}`} className="block">
                          <div className="font-mono font-medium text-primary group-hover:underline">{req.token}</div>
                          <div className="text-muted-foreground text-xs mt-1">{req.user_name}</div>
                        </Link>
                      </td>
                      <td className="px-6 py-4 capitalize">{req.request_type}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusTheme(req.status)}`}>
                          {formatStatus(req.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="font-medium">{formatDate(req.deadline)}</div>
                        {req.status !== "completed" && req.status !== "rejected" && (
                          <div className={`text-xs mt-1 font-semibold ${getDaysRemainingTheme(daysRemaining)}`}>
                            {daysRemaining} days left
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function StatsCard({ title, value, highlight }: { title: string; value: number; highlight?: "red" | "green" | "blue" }) {
  let colorClass = "text-foreground";
  if (highlight === "red" && value > 0) colorClass = "text-destructive";
  if (highlight === "green" && value > 0) colorClass = "text-green-600";
  if (highlight === "blue" && value > 0) colorClass = "text-blue-600";
  return (
    <Card>
      <CardContent className="p-6">
        <p className="text-sm font-medium text-muted-foreground mb-2">{title}</p>
        <p className={`text-3xl font-bold tracking-tight ${colorClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
