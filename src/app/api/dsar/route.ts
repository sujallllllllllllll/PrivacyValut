import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { z } from "zod";

const schema = z.object({
  userName: z.string().min(2),
  userEmail: z.string().email(),
  userPhone: z.string().optional(),
  requestType: z.enum(["access", "correction", "erasure"]),
  requestDetails: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = schema.safeParse(await req.json());
    if (!body.success) {
      return NextResponse.json({ message: "Invalid request data" }, { status: 400 });
    }

    const { userName, userEmail, userPhone, requestType, requestDetails } = body.data;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("dsar_requests")
      .insert({
        user_name: userName,
        user_email: userEmail,
        user_phone: userPhone ?? null,
        request_type: requestType,
        request_details: requestDetails ?? null,
        status: "submitted",
      })
      .select("id, token, deadline")
      .single();

    if (error) throw error;

    return NextResponse.json({ token: data.token, id: data.id, deadline: data.deadline }, { status: 201 });
  } catch (err) {
    console.error("Submit DSAR error:", err);
    return NextResponse.json({ message: "Failed to submit request" }, { status: 500 });
  }
}
