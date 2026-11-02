import { QuestionEvent } from "@snaplab/contracts";
import { parseSse } from "../pipeline/sse";

/**
 * Posts her question photos to /api/question and reports its events in order
 * (docs/plans/snap-question.md, "Contracts"). Every event is validated against the
 * contract; an invalid one ends the stream with a client-side error event rather
 * than reaching the page. Modelled on pipeline/snapClient.ts.
 */
export async function streamQuestion(
  photos: Blob[],
  onEvent: (e: QuestionEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const form = new FormData();
  photos.forEach((photo, i) => {
    form.append("photos", photo, `photo-${i}.jpg`);
  });
  const res = await fetch("/api/question", {
    method: "POST",
    body: form,
    ...(signal ? { signal } : {}),
  });
  if (!res.ok || !res.body) {
    onEvent({
      type: "error",
      stage: "input",
      message: `The server refused the photos (HTTP ${res.status}).`,
      fallback: "app_question",
    });
    return;
  }
  for await (const msg of parseSse(res.body)) {
    let json: unknown;
    try {
      json = JSON.parse(msg.data);
    } catch {
      json = null;
    }
    const parsed = QuestionEvent.safeParse(json);
    if (!parsed.success) {
      onEvent({
        type: "error",
        stage: "input",
        message: "The server sent an event this app doesn't understand.",
        fallback: "app_question",
      });
      return;
    }
    onEvent(parsed.data);
  }
}
