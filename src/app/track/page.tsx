"use client";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import { formatStatus, getStatusTheme, getDaysRemainingTheme, formatDate, formatDateTime } from "@/lib/utils";

type DsarStatus = {
  token: string; requestType: string; status: string; userName: string;
  createdAt: string; deadline: string | null; updatedAt: string;
  completedAt: string | null; daysRemaining: number | null;
};

export default function TrackPage() {
  const [searchInput, setSearchInput] = useState("");
  const [activeToken, setActiveToken] = useState("");
  const [request, setRequest] = useState<DsarStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchRequest = useCallback(async (token: string) => {
    if (!token) return;
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/dsar/track/${token.toUpperCase()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Request not found");
      setRequest(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Request not found. Check your token.");
      setRequest(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!activeToken) return;
    fetchRequest(activeToken);
    const interval = setInterval(() => fetchRequest(activeToken), 5000);
    return () => clearInterval(interval);
  }, [activeToken, fetchRequest]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchInput.trim()) setActiveToken(searchInput.trim());
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="text-center space-y-4 mb-10">
        <h1 className="text-3xl font-bold tracking-tight">Track Your Request</h1>
        <p className="text-muted-foreground">Enter your tracking token to see the real-time status of your request.</p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-3 max-w-lg mx-auto">
        <Input placeholder="e.g. TKN-1234" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="h-12 text-lg font-mono placeholder:font-sans" />
        <Button type="submit" size="lg" className="h-12 px-8" disabled={isLoading}>
          {isLoading ? "Searching..." : "Track"}
        </Button>
      </form>

      {error && (
        <div className="text-center mt-8 p-4 bg-destructive/5 text-destructive rounded-sm border border-destructive/20">{error}</div>
      )}

      {request && (
        <div className="mt-12">
          <Card>
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row justify-between md:items-start gap-6 mb-8">
                <div>
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Token</p>
                  <h2 className="text-2xl font-mono font-bold">{request.token}</h2>
                </div>
                <div className="flex flex-col items-start md:items-end">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Current Status</p>
                  <span className={`px-4 py-1.5 rounded-full text-sm font-semibold border ${getStatusTheme(request.status)}`}>
                    {formatStatus(request.status)}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-8 gap-x-4 pt-8 border-t border-border">
                <div><p className="text-sm text-muted-foreground mb-1">Request Type</p><p className="font-medium capitalize">{request.requestType}</p></div>
                <div><p className="text-sm text-muted-foreground mb-1">Applicant Name</p><p className="font-medium">{request.userName}</p></div>
                <div><p className="text-sm text-muted-foreground mb-1">Submitted On</p><p className="font-medium">{formatDateTime(request.createdAt)}</p></div>
                <div><p className="text-sm text-muted-foreground mb-1">Last Updated</p><p className="font-medium">{formatDateTime(request.updatedAt)}</p></div>
                {request.status !== "completed" && request.status !== "rejected" && (
                  <>
                    <div><p className="text-sm text-muted-foreground mb-1">Deadline</p><p className="font-medium">{formatDate(request.deadline)}</p></div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Time Remaining</p>
                      <p className={`font-medium ${getDaysRemainingTheme(request.daysRemaining)}`}>
                        {request.daysRemaining != null ? `${request.daysRemaining} days` : "N/A"}
                      </p>
                    </div>
                  </>
                )}
                {request.completedAt && (
                  <div className="col-span-1 sm:col-span-2 lg:col-span-3 pt-4">
                    <div className="bg-green-50/50 border border-green-100 p-4 rounded-sm">
                      <p className="text-sm text-green-800 font-medium mb-1">Completed On</p>
                      <p className="font-semibold text-green-900">{formatDateTime(request.completedAt)}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          <p className="text-center text-xs text-muted-foreground mt-4">Status refreshes automatically.</p>
        </div>
      )}
    </div>
  );
}
