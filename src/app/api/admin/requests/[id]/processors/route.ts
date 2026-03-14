import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { readFileSync } from "fs";
import { join } from "path";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { data: req, error } = await supabase
      .from("dsar_requests")
      .select("request_type, user_email")
      .eq("id", id)
      .single();

    if (error || !req)
      return NextResponse.json({ message: "Request not found" }, { status: 404 });

    const filePath = join(process.cwd(), "data", "processors.json");
    const raw = readFileSync(filePath, "utf-8");
    const processors: Array<{
      id: string;
      name: string;
      type: string;
      records: Record<string, unknown>;
    }> = JSON.parse(raw);

    const citizenEmail = req.user_email as string;
    const requestType = req.request_type as string;

    const actionedSet = new Set<string>();

    if (requestType === "erasure") {
      const { data: logs } = await supabase
        .from("processor_deletion_log")
        .select("processor")
        .eq("request_id", id);
      (logs || []).forEach(l => actionedSet.add(l.processor));
    } else if (requestType === "correction") {
      const { data: logs } = await supabase
        .from("processor_modification_log")
        .select("processor")
        .eq("request_id", id);
      (logs || []).forEach(l => actionedSet.add(l.processor));
    }

    const results = processors.map((processor) => {
      const found = citizenEmail in processor.records;
      const isActioned = actionedSet.has(processor.id);
      
      return {
        processorId: processor.id,
        processorName: processor.name,
        type: processor.type,
        found,
        deleted: (requestType === "erasure" && isActioned),
        modified: (requestType === "modify" && isActioned),
        data: found ? processor.records[citizenEmail] : null,
      };
    });

    return NextResponse.json({ processors: results });
  } catch (err) {
    console.error("Processors fetch error:", err);
    return NextResponse.json(
      { message: "Failed to fetch processors" },
      { status: 500 }
    );
  }
}
