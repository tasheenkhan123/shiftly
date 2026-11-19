/**
 * Shared Gemini JSON caller.
 * Tries each model in order and logs why a model failed, instead of failing silently.
 * Set GEMINI_MODEL in .env.local to put your preferred model first.
 */

const DEFAULT_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];

function modelList(): string[] {
  const preferred = process.env.GEMINI_MODEL?.trim();
  return preferred ? [preferred, ...DEFAULT_MODELS.filter(m => m !== preferred)] : DEFAULT_MODELS;
}

export interface GeminiImagePart {
  mimeType: string;
  base64Data: string;
}

export async function callGeminiJson<T = any>(
  prompt: string,
  apiKey: string,
  options: { temperature?: number; timeoutMs?: number; totalTimeoutMs?: number; label?: string; image?: GeminiImagePart } = {}
): Promise<T | null> {
  // timeoutMs: per model attempt. totalTimeoutMs: hard cap across all models, so a Gemini outage
  // can't push the whole request past Vercel's 60s limit.
  const { temperature = 0.1, timeoutMs = 12000, totalTimeoutMs = 20000, label = 'gemini', image } = options;
  const deadline = Date.now() + totalTimeoutMs;
  const parts: any[] = [{ text: prompt }];
  if (image) parts.push({ inlineData: { mimeType: image.mimeType, data: image.base64Data } });

  for (const model of modelList()) {
    const remaining = deadline - Date.now();
    if (remaining < 1500) {
      console.warn(`[${label}] time budget used up, skipping remaining models`);
      break;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(timeoutMs, remaining));
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: { responseMimeType: 'application/json', temperature },
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = (await res.text()).slice(0, 300);
        console.warn(`[${label}] model ${model} failed: HTTP ${res.status} ${body}`);
        continue;
      }
      const data = await res.json();
      const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        console.warn(`[${label}] model ${model} returned no text (finishReason: ${data?.candidates?.[0]?.finishReason})`);
        continue;
      }
      return JSON.parse(text) as T;
    } catch (err: any) {
      console.warn(`[${label}] model ${model} error: ${err?.name === 'AbortError' ? 'timeout' : err?.message}`);
    } finally {
      clearTimeout(timer);
    }
  }
  console.error(`[${label}] all Gemini models failed`);
  return null;
}
