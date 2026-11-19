import { NextRequest, NextResponse } from 'next/server';
import { parseUserConstraints } from '@/lib/ai/constraints';
import { searchProductsWithTavilyAndGemini, type ConversationTurn } from '@/lib/search/tavilyShoppingPipeline';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_IMAGE_CHARS = 6_000_000; // ~4.5MB image as base64; the client downsizes images well below this

/**
 * POST /api/analyze
 * Body: { input: string, imagePreviewUrl?: "data:image/...;base64,...", conversationHistory?: ConversationTurn[] }
 *
 * Responds with newline-delimited JSON so the page can show live progress:
 *   {"type":"progress","stage":"searching","message":"Searching Google Shopping…"}
 *   ...
 *   {"type":"result","data":{...}}      or      {"type":"error","message":"..."}
 */
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const input: string = typeof body?.input === 'string' ? body.input.slice(0, 2000) : '';
  const rawImage: unknown = body?.imagePreviewUrl;
  const image =
    typeof rawImage === 'string' && rawImage.startsWith('data:image/') && rawImage.length <= MAX_IMAGE_CHARS
      ? rawImage
      : undefined;
  if (typeof rawImage === 'string' && rawImage && !image) {
    return NextResponse.json({ error: 'That image is too large or not a supported image type.' }, { status: 400 });
  }
  if (!input.trim() && !image) {
    return NextResponse.json({ error: 'Please type what you are looking for or attach an image.' }, { status: 400 });
  }

  const history: ConversationTurn[] = Array.isArray(body?.conversationHistory)
    ? body.conversationHistory.slice(-6).map((t: any) => ({
        sender: t?.sender === 'assistant' ? 'assistant' : 'user',
        text: typeof t?.text === 'string' ? t.text.slice(0, 1500) : '',
        previousProducts: Array.isArray(t?.previousProducts) ? t.previousProducts.slice(0, 15) : [],
      }))
    : [];

  const effectiveQuery = input.trim() || 'Find the product in this image';
  const constraints = parseUserConstraints(effectiveQuery);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
        } catch {
          // client went away
        }
      };
      try {
        const search = await searchProductsWithTavilyAndGemini(
          effectiveQuery,
          image,
          constraints,
          history,
          (stage, message) => send({ type: 'progress', stage, message })
        );
        // Don't echo the (large) image back; the page already has it
        const { mediaPreviewUrl: _omit, ...result } = search.result;
        send({ type: 'result', data: { ...result, customSummary: search.assistantSummary } });
      } catch (error: any) {
        console.error('Siftly API Error:', error);
        send({ type: 'error', message: error?.message || 'Something went wrong while searching.' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    },
  });
}
