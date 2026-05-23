// Server-Sent Events broadcaster
// Uses a global registry of response writers to push updates

type SSEClient = {
  id: string;
  writer: WritableStreamDefaultWriter<Uint8Array>;
};

const globalForSSE = globalThis as unknown as {
  sseClients: Map<string, SSEClient>;
};

if (!globalForSSE.sseClients) {
  globalForSSE.sseClients = new Map();
}

export const sseClients = globalForSSE.sseClients;

export function broadcastUpdate(eventType: string, data: unknown) {
  const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  const encoder = new TextEncoder();
  const encoded = encoder.encode(message);

  const deadClients: string[] = [];

  sseClients.forEach((client, id) => {
    try {
      client.writer.write(encoded).catch(() => {
        deadClients.push(id);
      });
    } catch {
      deadClients.push(id);
    }
  });

  deadClients.forEach((id) => sseClients.delete(id));
}
