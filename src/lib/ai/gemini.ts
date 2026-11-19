/**
 * Shared Gemini JSON caller with "hedged" requests for speed.
 *
 * Gemini's popular models are often overloaded (HTTP 503) or slow (8–20s). Measured on this key:
 * gemini-3-flash-preview answered in ~1.5–2s every time, while the flash-lite models took 2–20s.
 *
 * Strategy: start the fastest model first. If it hasn't answered after `hedgeAfterMs`, or it fails,
 * start the next model in parallel. The first valid JSON answer wins and the rest are cancelled.
 * A hard `totalTimeoutMs` keeps the whole call well under Vercel's 60s limit.
 *
 * Set GEMINI_MODEL in .env.local to put a different model first.
 */

interface ModelSpec {
  name: string;
  /** Extra generationConfig for this model (e.g. low thinking for speed) */
  config?: Record<string, unknown>;
}

const DEFAULT_MODELS: ModelSpec[] = [
  { name: 'gemini-3-flash-preview', config: { thinkingConfig: { thinkingLevel: 'minimal' } } },
  { name: 'gemini-3.5-flash-lite' },
  { name: 'gemini-flash-lite-latest' },
];

function modelList(): ModelSpec[] {
  const preferred = process.env.GEMINI_MODEL?.trim();
  if (!preferred) return DEFAULT_MODELS;
  return [{ name: preferred }, ...DEFAULT_MODELS.filter(m => m.name !== preferred)];
}

export interface GeminiImagePart {
  mimeType: string;
  base64Data: string;
}

/** Turns a data URL ("data:image/jpeg;base64,....") into a Gemini image part. */
export function imagePartFromDataUrl(dataUrl?: string | null): GeminiImagePart | undefined {
  if (!dataUrl) return undefined;
  const m = dataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!m) return undefined;
  return { mimeType: m[1].toLowerCase(), base64Data: m[2].replace(/\s/g, '') };
}

export async function callGeminiJson<T = any>(
  prompt: string,
  apiKey: string,
  options: {
    temperature?: number;
    /** Start the next model if no answer after this long */
    hedgeAfterMs?: number;
    /** Hard cap for the whole call */
    totalTimeoutMs?: number;
    label?: string;
    image?: GeminiImagePart;
  } = {}
): Promise<T | null> {
  const { temperature = 0.1, hedgeAfterMs = 4000, totalTimeoutMs = 18000, label = 'gemini', image } = options;
  const parts: any[] = [{ text: prompt }];
  if (image) parts.push({ inlineData: { mimeType: image.mimeType, data: image.base64Data } });

  const models = modelList();
  const controllers: AbortController[] = [];
  const started = Date.now();

  return new Promise<T | null>(resolve => {
    let settled = false;
    let running = 0;
    let nextIndex = 0;
    let hedgeTimer: ReturnType<typeof setTimeout> | null = null;

    const finish = (value: T | null) => {
      if (settled) return;
      settled = true;
      if (hedgeTimer) clearTimeout(hedgeTimer);
      clearTimeout(totalTimer);
      controllers.forEach(c => c.abort());
      resolve(value);
    };

    const totalTimer = setTimeout(() => {
      console.warn(`[${label}] no Gemini answer within ${totalTimeoutMs}ms`);
      finish(null);
    }, totalTimeoutMs);

    const scheduleHedge = () => {
      if (hedgeTimer) clearTimeout(hedgeTimer);
      if (nextIndex < models.length) hedgeTimer = setTimeout(startNext, hedgeAfterMs);
    };

    const startNext = () => {
      if (settled || nextIndex >= models.length) return;
      const spec = models[nextIndex++];
      running++;
      scheduleHedge();
      attempt(spec)
        .then(result => {
          if (result !== null) {
            if (Date.now() - started > 5000) console.info(`[${label}] answered by ${spec.name} after ${Date.now() - started}ms`);
            finish(result);
          }
        })
        .finally(() => {
          running--;
          if (settled) return;
          // This model failed: try the next one right away instead of waiting for the hedge timer
          if (nextIndex < models.length) startNext();
          else if (running === 0) {
            console.error(`[${label}] all Gemini models failed`);
            finish(null);
          }
        });
    };

    const attempt = async (spec: ModelSpec): Promise<T | null> => {
      const controller = new AbortController();
      controllers.push(controller);
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${spec.name}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            contents: [{ role: 'user', parts }],
            generationConfig: { responseMimeType: 'application/json', temperature, ...(spec.config || {}) },
          }),
          signal: controller.signal,
        });
        if (!res.ok) {
          const body = (await res.text()).slice(0, 200).replace(/\s+/g, ' ');
          console.warn(`[${label}] ${spec.name} failed: HTTP ${res.status} ${body}`);
          return null;
        }
        const data = await res.json();
        const text: string | undefined = data?.candidates?.[0]?.content?.parts
          ?.map((p: any) => p?.text || '')
          .join('');
        if (!text) {
          console.warn(`[${label}] ${spec.name} returned no text (finishReason: ${data?.candidates?.[0]?.finishReason})`);
          return null;
        }
        return JSON.parse(text) as T;
      } catch (err: any) {
        if (err?.name !== 'AbortError') console.warn(`[${label}] ${spec.name} error: ${err?.message}`);
        return null;
      }
    };

    startNext();
  });
}
