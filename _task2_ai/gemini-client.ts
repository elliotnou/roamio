// ─── Minimal Gemini REST Client (fetch-only, no SDK) ───

import { GeminiClientError, type GeminiConfig } from "./types";

const DEFAULT_MODEL = "gemini-2.0-flash";
const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

/**
 * Send a prompt to Gemini and get back parsed JSON.
 *
 * @throws {GeminiClientError} on network / API / parse errors
 */
export async function callGemini<T>(
  prompt: string,
  config: GeminiConfig
): Promise<T> {
  const model = config.model ?? DEFAULT_MODEL;
  const base = config.baseUrl ?? DEFAULT_BASE_URL;
  const url = `${base}/models/${model}:generateContent?key=${config.apiKey}`;

  const body = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.2, // low temp for deterministic JSON
      topP: 0.8,
      maxOutputTokens: 1024,
    },
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err: unknown) {
    throw new GeminiClientError(
      `Network error calling Gemini: ${(err as Error).message}`
    );
  }

  if (!res.ok) {
    const raw = await res.text().catch(() => "(unreadable body)");
    throw new GeminiClientError(
      `Gemini API returned HTTP ${res.status}`,
      res.status,
      raw
    );
  }

  const json = await res.json();

  // Navigate Gemini response structure
  const textContent: string | undefined =
    json?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textContent || textContent.trim().length === 0) {
    throw new GeminiClientError(
      "Gemini returned an empty or unparseable response",
      undefined,
      JSON.stringify(json)
    );
  }

  return parseJsonResponse<T>(textContent);
}

/**
 * Safely extract JSON from a Gemini text response.
 * Handles optional markdown fences the model sometimes adds.
 */
function parseJsonResponse<T>(raw: string): T {
  let cleaned = raw.trim();

  // Strip markdown code fences if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new GeminiClientError(
      "Failed to parse Gemini response as JSON",
      undefined,
      raw
    );
  }
}
