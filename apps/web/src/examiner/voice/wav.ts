/**
 * Wraps PCM16 mono samples in a standard 44-byte RIFF/WAVE header
 * (PCM format 1, mono, 16-bit). For testing a recording by ear only.
 */
export function pcm16ToWav(chunks: Int16Array[], sampleRate = 16000): Blob {
  let total = 0;
  for (const chunk of chunks) total += chunk.length;
  const dataSize = total * 2;
  const bytes = new Uint8Array(44 + dataSize);
  const view = new DataView(bytes.buffer);
  const writeText = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeText(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, dataSize, true);
  let offset = 44;
  for (const chunk of chunks) {
    for (let i = 0; i < chunk.length; i++) {
      view.setInt16(offset, chunk[i] ?? 0, true);
      offset += 2;
    }
  }
  return new Blob([bytes.buffer as ArrayBuffer], { type: "audio/wav" });
}
