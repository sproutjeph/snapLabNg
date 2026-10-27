import { GoldenRecording } from "@snaplab/contracts";

/** Fetches `/golden/<id>.json` and validates it as a GoldenRecording. */
export async function loadGolden(id: string, signal: AbortSignal): Promise<GoldenRecording> {
  let response: Response;
  try {
    response = await fetch(`/golden/${id}.json`, { signal });
  } catch (err) {
    if (signal.aborted) {
      throw err;
    }
    throw new Error(`Could not load golden recording "${id}": ${String(err)}`);
  }
  if (!response.ok) {
    throw new Error(`Could not load golden recording "${id}" (HTTP ${response.status})`);
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error(`Golden recording "${id}" is not valid JSON`);
  }
  const parsed = GoldenRecording.safeParse(data);
  if (!parsed.success) {
    throw new Error(`Golden recording "${id}" is invalid: ${parsed.error.message}`);
  }
  return parsed.data;
}
