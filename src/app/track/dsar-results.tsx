"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";

type ProcessorResult = {
  processorId: string;
  processorName: string;
  type: string;
  data: Record<string, unknown> | null;
  action?: string;
  timestamp?: string | null;
};

type ResultData = {
  type: string;
  results: ProcessorResult[];
  totalSystems?: number;
  foundInSystems?: number;
  actionedSystems?: number;
};

function renderValue(value: unknown, depth = 0): React.ReactNode {
  if (value === null || value === undefined) return <span className="text-gray-400">—</span>;
  if (typeof value === "boolean") return <span className={value ? "text-green-600 font-medium" : "text-gray-500 font-medium"}>{value ? "Yes" : "No"}</span>;
  if (typeof value === "string" || typeof value === "number") {
    return <span className="text-gray-800">{String(value)}</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-gray-400">None</span>;
    if (typeof value[0] !== "object") {
      return (
        <div className="flex flex-wrap gap-1 mt-0.5">
          {value.map((v, i) => (
            <span key={i} className="inline-block bg-blue-50 text-blue-700 border border-blue-100 text-xs px-2 py-0.5 rounded-full">
              {String(v)}
            </span>
          ))}
        </div>
      );
    }
    return (
      <div className="space-y-2 mt-1">
        {value.map((item, i) => (
          <div key={i} className="bg-gray-50 rounded border border-gray-100 p-2">
            {renderValue(item, depth + 1)}
          </div>
        ))}
      </div>
    );
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return (
      <div className={`space-y-1 ${depth > 0 ? "pl-2" : ""}`}>
        {entries.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[40%_60%] gap-x-2 items-start text-xs">
            <span className="text-gray-500 capitalize font-medium truncate" title={k.replace(/_/g, " ")}>
              {k.replace(/_/g, " ")}
            </span>
            <span>{renderValue(v, depth + 1)}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

function CheckIcon() {
  return (
    <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function DsarResults({ token, status }: { token: string; status: string }) {
  const [data, setData] = useState<ResultData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status !== "completed") {
      setIsLoading(false);
      return;
    }

    async function fetchResults() {
      try {
        const res = await fetch(`/api/dsar/track/${token}/results`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || "Failed to load results");
        setData(json);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Error loading data");
      } finally {
        setIsLoading(false);
      }
    }

    fetchResults();
  }, [token, status]);

  if (status !== "completed") return null;

  return (
    <Card className="mt-8 overflow-hidden border-blue-100 shadow-sm">
      <CardHeader className="bg-blue-50/50 pb-6 border-b border-blue-100">
        <CardTitle className="text-xl text-blue-900">Request Results</CardTitle>
        <CardDescription className="text-blue-700/80">
          {data?.type === "access" 
            ? "Your personal data retrieved from our integrated processing systems."
            : data?.type === "erasure"
            ? "Proof of deletion from our integrated processing systems."
            : data?.type === "modify"
            ? "Proof of modification across our integrated processing systems."
            : "Review the outcome of your request."}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="pt-6">
        {isLoading && <div className="text-center py-8 text-muted-foreground"><p className="animate-pulse">Loading secure data...</p></div>}
        
        {error && !isLoading && (
          <div className="text-center py-6 text-muted-foreground bg-gray-50 rounded-lg border border-gray-100">
            <p>{error}</p>
          </div>
        )}

        {data && !isLoading && (
          <div className="space-y-6">
            
            {/* ACCESS REQUEST VIEW */}
            {data.type === "access" && (
              data.results.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 bg-gray-50 rounded-lg">No third-party processor data found linked to your email.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data.results.map((p, idx) => (
                    <div key={idx} className="border border-border rounded-lg p-4 bg-white shadow-sm">
                      <div className="mb-3 pb-2 border-b border-gray-100 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">{p.processorName}</p>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{p.type}</p>
                        </div>
                        <span className="text-[10px] bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-medium">Data Found</span>
                      </div>
                      <div className="max-h-60 overflow-y-auto pr-2">
                        {renderValue(p.data)}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* ERASURE OR MODIFY REQUEST VIEW (PROOF LOGS) */}
            {(data.type === "erasure" || data.type === "modify") && (
              data.results.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 bg-gray-50 rounded-lg border border-gray-100">
                  No third-party processor actions recorded.
                </p>
              ) : (
                <div className="space-y-4">
                  {/* Summary progress bar */}
                  <div className="bg-white border text-sm border-gray-200 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
                    <div>
                      <p className="font-semibold text-gray-900">
                        Activity Summary
                      </p>
                      <p className="text-muted-foreground text-xs mt-0.5">
                        Data {data.type === "erasure" ? "deleted from" : "modified in"} <strong>{data.actionedSystems || 0}</strong> / <strong>{data.totalSystems || 1}</strong> registered processors.
                      </p>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-1/3">
                      <div className="h-2 flex-grow bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${(data.type === "erasure") ? "bg-red-500" : "bg-amber-500"} rounded-full transition-all duration-500`}
                          style={{ width: `${Math.round(((data.actionedSystems || 0) / (data.totalSystems || 1)) * 100)}%` }} 
                        />
                      </div>
                      <span className="font-semibold font-mono text-gray-700 w-10 text-right">
                        {Math.round(((data.actionedSystems || 0) / (data.totalSystems || 1)) * 100)}%
                      </span>
                    </div>
                  </div>

                  {/* Action Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {data.results.map((p, idx) => {
                      const isActioned = p.timestamp != null;
                      return (
                        <div key={idx} className={`border rounded-lg p-4 shadow-sm flex flex-col transition-all duration-300 ${isActioned ? (data.type === "erasure" ? "bg-red-50/20 border-red-100" : "bg-amber-50/20 border-amber-100") : "bg-white border-border border-blue-100"}`}>
                          <div className="mb-3 pb-2 flex-grow-0 border-b border-gray-100 flex items-start justify-between">
                            <div>
                              <p className="font-semibold text-gray-900">{p.processorName}</p>
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{p.type}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              {isActioned ? (
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${data.type === 'erasure' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>
                                  {p.action}
                                </span>
                              ) : (
                                <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-bold">
                                  IN PROGRESS
                                </span>
                              )}
                              {isActioned && <span className="text-[10px] text-muted-foreground font-mono">{formatDateTime(p.timestamp)}</span>}
                            </div>
                          </div>
                          <div className={`max-h-60 overflow-y-auto pr-2 ${isActioned ? "opacity-60" : "opacity-100"}`}>
                            {renderValue(p.data)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            )}

          </div>
        )}
      </CardContent>
    </Card>
  );
}
