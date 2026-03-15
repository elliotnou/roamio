/**
 * Gemini AI client for Roamio mobile.
 * Provides a configured callGemini function using EXPO_PUBLIC_GEMINI_API_KEY.
 */

export class GeminiClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly rawBody?: string
  ) {
    super(message);
    this.name = 'GeminiClientError';
  }
}

const DEFAULT_MODEL = 'gemini-2.0-flash';
const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Send a prompt to Gemini and get back parsed JSON.
 * Strips markdown fences the model sometimes adds.
 *
 * @throws {GeminiClientError} on network / API / parse errors
 */
export async function callGemini<T>(
  prompt: string,
  options?: { model?: string; baseUrl?: string; apiKey?: string }
): Promise<T> {
  const apiKey =
    options?.apiKey ||
    process.env.EXPO_PUBLIC_GEMINI_API_KEY ||
    '';

  if (!apiKey) {
    throw new GeminiClientError(
      'EXPO_PUBLIC_GEMINI_API_KEY is not set. Gemini calls will not work.'
    );
  }

  const model = options?.model ?? DEFAULT_MODEL;
  const base = options?.baseUrl ?? DEFAULT_BASE_URL;
  const url = `${base}/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      topP: 0.8,
      maxOutputTokens: 4096,
    },
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err: unknown) {
    throw new GeminiClientError(
      `Network error calling Gemini: ${(err as Error).message}`
    );
  }

  if (!res.ok) {
    const raw = await res.text().catch(() => '(unreadable body)');
    throw new GeminiClientError(
      `Gemini API returned HTTP ${res.status}`,
      res.status,
      raw
    );
  }

  const json = await res.json();

  const textContent: string | undefined =
    json?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textContent || textContent.trim().length === 0) {
    throw new GeminiClientError(
      'Gemini returned an empty or unparseable response',
      undefined,
      JSON.stringify(json)
    );
  }

  return parseJsonResponse<T>(textContent);
}

function parseJsonResponse<T>(raw: string): T {
  let cleaned = raw.trim();

  // Strip markdown code fences if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*\n?/, '')
      .replace(/\n?```\s*$/, '');
  }

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new GeminiClientError(
      'Failed to parse Gemini response as JSON',
      undefined,
      raw
    );
  }
}
