import { VoiceServerMessage } from "@snaplab/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePushToTalk } from "./usePushToTalk";

/** The chunk's own bytes (little-endian PCM16), as a plain ArrayBuffer view for send(). */
const bytesOf = (pcm: Int16Array): Uint8Array<ArrayBuffer> => new Uint8Array(pcm.slice().buffer);

export type VoiceAnswerState = "idle" | "listening" | "thinking" | "error";

/**
 * A spoken answer: while she holds the button, her voice goes as PCM16 16 kHz to the
 * server's /ws/examiner relay (one socket per answer), and her words come back as she
 * speaks. The browser never talks to Meta and never holds a key.
 */
export function useVoiceAnswer(onText: (text: string, final: boolean) => void) {
  const [state, setState] = useState<VoiceAnswerState>("idle");
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const queue = useRef<Int16Array[]>([]);
  const endPending = useRef(false);
  const holding = useRef(false);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  const ptt = usePushToTalk({
    onChunk(pcm) {
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) ws.send(bytesOf(pcm));
      else queue.current.push(pcm);
    },
  });

  /** Retires a socket for good: no handler of it can touch the answer or the state again. */
  const retire = useCallback((ws: WebSocket | null) => {
    if (!ws) return;
    ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
    ws.close();
    if (wsRef.current === ws) wsRef.current = null;
  }, []);

  const fail = useCallback(
    (message: string) => {
      setError(message);
      setState("error");
      retire(wsRef.current);
    },
    [retire],
  );

  const start = useCallback(async () => {
    // One answer at a time: a second finger, a held key or a press while the last answer
    // is still being written down replaces the old socket rather than racing it.
    if (holding.current) return;
    holding.current = true;
    retire(wsRef.current);
    setError(null);
    endPending.current = false;
    queue.current = [];
    const scheme = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${scheme}://${location.host}/ws/examiner`);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;
    ws.onopen = () => {
      for (const pcm of queue.current.splice(0)) ws.send(bytesOf(pcm));
      if (endPending.current) ws.send(JSON.stringify({ type: "end" }));
    };
    ws.onmessage = (e) => {
      if (wsRef.current !== ws) return;
      let m: VoiceServerMessage;
      try {
        m = VoiceServerMessage.parse(JSON.parse(String(e.data)));
      } catch {
        return;
      }
      if (m.type === "transcript") {
        // Silence or a quick tap gives an empty transcript: keep what she typed.
        if (m.text.trim()) onTextRef.current(m.text, m.final);
        if (m.final) {
          retire(ws);
          if (!holding.current) setState("idle");
        }
      } else if (m.type === "error") {
        fail(m.message);
      }
    };
    ws.onclose = () => {
      if (wsRef.current !== ws) return;
      wsRef.current = null;
      if (!holding.current) setState((s) => (s === "error" ? s : "idle"));
    };
    ws.onerror = () => {
      if (wsRef.current === ws) fail("The examiner could not hear that. Try again, or type.");
    };
    setState("listening");
    await ptt.start();
  }, [ptt, fail, retire]);

  const stop = useCallback(() => {
    if (!holding.current) return;
    holding.current = false;
    ptt.stop(); // flushes the last partial chunk through onChunk
    const ws = wsRef.current;
    if (!ws) return;
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "end" }));
    else endPending.current = true;
    setState((s) => (s === "listening" ? "thinking" : s));
  }, [ptt]);

  useEffect(() => {
    if (ptt.state === "denied") fail("Allow the microphone in your browser settings, or type.");
    if (ptt.state === "unsupported") fail("This browser can't record here. Type your answer.");
  }, [ptt.state, fail]);

  useEffect(() => () => retire(wsRef.current), [retire]);

  return { state, error, start, stop };
}
