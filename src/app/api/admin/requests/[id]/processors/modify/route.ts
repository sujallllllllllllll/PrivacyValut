import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { generateAndSaveStatusNote } from "@/lib/status-note";

export async function POST(
  req: NextRequest,
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
    const body = await req.json();
    const processorIds: string[] = body.processorIds ?? [];
    // corrections: { [processorId]: { [field]: newValue } }
    const corrections: Record<string, Record<string, unknown>> = body.corrections ?? {};

    if (!Array.isArray(processorIds) || processorIds.length === 0) {
      return NextResponse.json({ message: "No processor IDs provided" }, { status: 400 });
    }

    // Get user email for this request
    const { data: reqData } = await supabase
      .from("dsar_requests")
      .select("user_email")
      .eq("id", id)
      .single();

    if (!reqData?.user_email) {
      return NextResponse.json({ message: "Request not found" }, { status: 404 });
    }

    const userEmail = reqData.user_email as string;
    const filePath = join(process.cwd(), "data", "processors.json");
    const processors: Array<{ id: string; name: string; type: string; records: Record<string, unknown> }> =
      JSON.parse(readFileSync(filePath, "utf-8"));

    const toModifySet = new Set(processorIds);

    // Actually apply corrections to the user's record in each selected processor
    for (const processor of processors) {
      if (toModifySet.has(processor.id) && userEmail in processor.records) {
        const fields = corrections[processor.id];
        if (fields && typeof fields === "object") {
          processor.records[userEmail] = {
            ...(processor.records[userEmail] as Record<string, unknown>),
            ...fields,
          };
        }
      }
    }

    writeFileSync(filePath, JSON.stringify(processors, null, 2), "utf-8");

    // Log the modification
    const rows = processorIds.map((processor) => ({
      request_id: id,
      processor,
      actioned_by: user.id,
      modified_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from("processor_modification_log").insert(rows);
    if (error) {
      console.error("Modification log insert error:", error);
      return NextResponse.json({ message: "Failed to log modification" }, { status: 500 });
    }

    // Update status based on progress
    try {
      const applicableCount = processors.filter((p) => userEmail in p.records).length;
      const { data: logs } = await supabase
        .from("processor_modification_log")
        .select("processor")
        .eq("request_id", id);

      const uniqueActioned = new Set((logs || []).map((l) => l.processor)).size;
      const totalApplicable = applicableCount + uniqueActioned;

      if (totalApplicable > 0) {
        if (uniqueActioned >= totalApplicable) {
          await supabase
            .from("dsar_requests")
            .update({ status: "completed", completed_at: new Date().toISOString() })
            .eq("id", id);
          generateAndSaveStatusNote(supabase, id, reqData.user_email, "correction", "processing", "completed").catch(() => {});
        } else {
          await supabase
            .from("dsar_requests")
            .update({ status: "processing" })
            .eq("id", id);
        }
      }
    } catch (autoErr) {
      console.error("Auto-complete error:", autoErr);
    }

    return NextResponse.json({ success: true, modified: processorIds });
  } catch (err) {
    console.error("Processor modify error:", err);
    return NextResponse.json({ message: "Failed to process modification" }, { status: 500 });
  }
}
