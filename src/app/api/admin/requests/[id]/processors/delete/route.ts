import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

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

    if (!Array.isArray(processorIds) || processorIds.length === 0) {
      return NextResponse.json(
        { message: "No processor IDs provided" },
        { status: 400 }
      );
    }

    const rows = processorIds.map((processor) => ({
      request_id: id,
      processor,
      actioned_by: user.id,
      deleted_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("processor_deletion_log")
      .insert(rows);

    if (error) {
      console.error("Deletion log insert error:", error);
      return NextResponse.json(
        { message: "Failed to log deletion" },
        { status: 500 }
      );
    }

    // Auto-complete logic
    try {
      const { data: reqData } = await supabase
        .from("dsar_requests")
        .select("user_email")
        .eq("id", id)
        .single();

      if (reqData?.user_email) {
        const { readFileSync } = await import("fs");
        const { join } = await import("path");
        const filePath = join(process.cwd(), "data", "processors.json");
        const raw = readFileSync(filePath, "utf-8");
        const processors: any[] = JSON.parse(raw);
        
        const applicableCount = processors.filter((p) => reqData.user_email in p.records).length;

        const { data: logs } = await supabase
          .from("processor_deletion_log")
          .select("processor")
          .eq("request_id", id);

        const uniqueActioned = new Set((logs || []).map((l) => l.processor)).size;

        if (uniqueActioned >= applicableCount && applicableCount > 0) {
          await supabase
            .from("dsar_requests")
            .update({ status: "completed", completed_at: new Date().toISOString() })
            .eq("id", id);
        }
      }
    } catch (autoErr) {
      console.error("Auto-complete error:", autoErr);
      // Non-fatal, so we don't throw
    }

    return NextResponse.json({ success: true, deleted: processorIds });
  } catch (err) {
    console.error("Processor delete error:", err);
    return NextResponse.json(
      { message: "Failed to process deletion" },
      { status: 500 }
    );
  }
}
