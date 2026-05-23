import { NextRequest } from 'next/server';
import { sseClients } from '@/lib/sse';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const clientId = uuidv4();

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  // Register client
  sseClients.set(clientId, { id: clientId, writer });

  // Send initial connection confirmation
  writer.write(
    encoder.encode(`event: connected\ndata: ${JSON.stringify({ clientId })}\n\n`)
  );

  // Send heartbeat every 25 seconds to keep connection alive
  const heartbeatInterval = setInterval(() => {
    try {
      writer.write(encoder.encode(`: heartbeat\n\n`));
    } catch {
      clearInterval(heartbeatInterval);
      sseClients.delete(clientId);
    }
  }, 25000);

  // Cleanup on disconnect
  request.signal.addEventListener('abort', () => {
    clearInterval(heartbeatInterval);
    sseClients.delete(clientId);
    writer.close().catch(() => {});
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
