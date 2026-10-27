import { SnapEvent } from "@snaplab/contracts";
import { parseSse } from "./sse";

/**
 * Posts the flattened, header-blurred page to /api/snap and yields its events in order
 * (docs/04 §4.3). Every event is validated against the contract; an invalid one ends the
 * stream with a client-side error event rather than reaching the bench or the drawer.
 */
export async function* streamSnap(
  page: Blob,
  width: number,
  height: number,
  signal: AbortSignal,
): AsyncGenerator<SnapEvent> {
  const form = new FormData();
  form.set("photo", page, "page.jpg");
  form.set("width", String(width));
  form.set("height", String(height));
  const res = await fetch("/api/snap", { method: "POST", body: form, signal });
  if (!res.ok || !res.body) {
    yield {
      type: "error",
      stage: "input",
      message: `The server refused the page (HTTP ${res.status}).`,
      fallback: "golden",
    };
    return;
  }
  for await (const msg of parseSse(res.body)) {
    let json: unknown;
    try {
      json = JSON.parse(msg.data);
    } catch {
      json = null;
    }
    // Returning here ends parseSse early, which cancels the stream so the server stops.
    const parsed = SnapEvent.safeParse(json);
    if (!parsed.success) {
      yield {
        type: "error",
        stage: "input",
        message: "The server sent an event this app doesn't understand.",
        fallback: "golden",
      };
      return;
    }
    yield parsed.data;
  }
}
