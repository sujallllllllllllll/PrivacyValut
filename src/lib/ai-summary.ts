import { createClient } from "@/lib/supabase-server";

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3";

interface FulfillmentSummary {
  simple_english: string;
  simple_hindi: string;
  legal_reference: string;
}

// Static fallback — demo never breaks even if Ollama is offline
function staticFallback(requestType: string, userName: string): FulfillmentSummary {
  const actionMap: Record<string, string> = {
    erasure: "permanently deleted",
    correction: "corrected",
    access: "retrieved and prepared",
  };
  const action = actionMap[requestType] ?? "processed";
  return {
    simple_english: `Dear ${userName}, your personal data has been ${action} as requested. We have fulfilled your rights under the Digital Personal Data Protection Act 2023. If you need any further assistance, please reach out to our Data Protection Officer.`,
    simple_hindi: `प्रिय ${userName}, आपका व्यक्तिगत डेटा आपके अनुरोध के अनुसार ${action === "permanently deleted" ? "स्थायी रूप से हटा दिया गया है" : action === "corrected" ? "सुधारा गया है" : "तैयार कर दिया गया है"}। डिजिटल व्यक्तिगत डेटा संरक्षण अधिनियम 2023 के तहत आपके अधिकारों का सम्मान किया गया है।`,
    legal_reference: "DPDP Act 2023 — Sections 11, 12, 13",
  };
}

async function callOllama(prompt: string): Promise<string> {
  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      format: "json",
      options: { temperature: 0.3, num_predict: 600 },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed: ${response.status}`);
  }

  const data = await response.json();
  return data.response as string;
}

/**
 * Generates an AI-powered plain-language fulfillment summary in English and Hindi.
 * Uses local Ollama (llama3) — no API key, no internet required.
 * Fire-and-forget safe: never throws, always saves something to DB.
 */
export async function generateFulfillmentSummary(dsarId: string): Promise<void> {
  try {
    const supabase = await createClient();

    const { data: dsar } = await supabase
      .from("dsar_requests")
      .select("request_type, user_name, request_details")
      .eq("id", dsarId)
      .single();

    if (!dsar) return;

    const prompt = `You are a DPDP Act 2023 compliance officer. Write a plain-language fulfillment notice for a citizen.

Citizen name: ${dsar.user_name}
Request type: ${dsar.request_type}
Context: ${dsar.request_details || "No additional context"}
Action completed: The DSAR has been fulfilled.

Write a warm, simple, jargon-free explanation (2-3 sentences max each).
Output ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "simple_english": "...",
  "simple_hindi": "...",
  "legal_reference": "DPDP Act 2023 — Section X"
}`;

    let summary: FulfillmentSummary;

    try {
      const raw = await callOllama(prompt);
      // Extract JSON from the response (Ollama sometimes wraps it)
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON in response");
      summary = JSON.parse(jsonMatch[0]);
    } catch {
      // Ollama offline or model not available — use static fallback
      summary = staticFallback(dsar.request_type, dsar.user_name);
    }

    await supabase
      .from("dsar_requests")
      .update({
        ai_summary_en: summary.simple_english,
        ai_summary_hi: summary.simple_hindi,
        ai_summary_generated_at: new Date().toISOString(),
      })
      .eq("id", dsarId);
  } catch (err) {
    // Final safety net — log and try static fallback
    console.error("[AI Summary] Outer error:", err);
    try {
      const supabase = await createClient();
      const { data: dsar } = await supabase
        .from("dsar_requests")
        .select("request_type, user_name")
        .eq("id", dsarId)
        .single();
      if (dsar) {
        const fallback = staticFallback(dsar.request_type, dsar.user_name);
        await supabase
          .from("dsar_requests")
          .update({
            ai_summary_en: fallback.simple_english,
            ai_summary_hi: fallback.simple_hindi,
            ai_summary_generated_at: new Date().toISOString(),
          })
          .eq("id", dsarId);
      }
    } catch {
      // Truly silent
    }
  }
}
