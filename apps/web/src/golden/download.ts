import type { GoldenRecording } from "@snaplab/contracts";

/** Saves the recording as `<id>.json` and revokes the temporary URL. */
export function downloadRecording(rec: GoldenRecording): void {
  const blob = new Blob([JSON.stringify(rec, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${rec.id}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoke on the next tick: Firefox can cancel a download whose URL is revoked at once.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
