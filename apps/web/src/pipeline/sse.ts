/** One server-sent event: its `event:` name and its `data:` lines joined. */
export interface SseMessage {
  event: string;
  data: string;
}

/**
 * Splits a byte stream into server-sent events. Handles events split across chunks
 * (including a CRLF split between chunks), multi-line data and comment lines
 * (": heartbeat"). If the consumer stops early, the stream is cancelled so the server
 * sees the disconnect and stops its work.
 */
export async function* parseSse(body: ReadableStream<Uint8Array>): AsyncGenerator<SseMessage> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let finished = false;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      // Normalise CRLF, but keep a trailing "\r" until we know whether "\n" follows.
      const tail = buf.endsWith("\r") ? "\r" : "";
      buf = buf.slice(0, buf.length - tail.length).replace(/\r\n?/g, "\n") + tail;
      let end = buf.indexOf("\n\n");
      while (end !== -1) {
        const block = buf.slice(0, end);
        buf = buf.slice(end + 2);
        const msg = toMessage(block);
        if (msg) yield msg;
        end = buf.indexOf("\n\n");
      }
    }
    const last = toMessage((buf + decoder.decode()).replace(/\r\n?/g, "\n"));
    if (last) yield last;
    finished = true;
  } finally {
    if (!finished) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

function toMessage(block: string): SseMessage | null {
  let event = "message";
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith(":") || line === "") continue;
    const i = line.indexOf(":");
    const field = i === -1 ? line : line.slice(0, i);
    const value = i === -1 ? "" : line.slice(i + 1).replace(/^ /, "");
    if (field === "event") event = value;
    else if (field === "data") data.push(value);
  }
  return data.length ? { event, data: data.join("\n") } : null;
}
