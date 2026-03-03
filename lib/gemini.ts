const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

export type GeminiInsightParams = {
  chainage: number;
  pipeId: string;
  vSign: string;
  vMm: number;
  hSide: string;
  hMm: number;
  jointType: string;
};

export async function getPipeInstallationInsight(
  params: GeminiInsightParams
): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return "AI insight unavailable (GEMINI_API_KEY not configured).";
  }

  const prompt = `Act as a senior civil engineer. Analyze this pipe installation:
Chainage: ${params.chainage}, Pipe ID: ${params.pipeId},
Deflection: V: ${params.vSign}${params.vMm}mm / H: ${params.hSide}${params.hMm}mm, Joint: ${params.jointType}.
Provide a professional 2-sentence evaluation in English.`;

  const url = `${GEMINI_API_BASE}/models/gemini-2.0-flash-exp:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 256,
        temperature: 0.3,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error: ${res.status} ${err}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  const text =
    data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ??
    "No insight generated.";
  return text;
}
