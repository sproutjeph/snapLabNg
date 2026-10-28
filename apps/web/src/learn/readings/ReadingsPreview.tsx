import { Canvas } from "@react-three/fiber";
import { createOhmsLaw, paramsFromSeed } from "@snaplab/engine";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { QualityTier } from "../../apparatus/meter-bridge/types";
import { OHMS_LAW_LAYOUT } from "../../apparatus/ohms-law/layout";
import { Meter } from "../../apparatus/ohms-law/Meter";
import { WireBoard } from "../../apparatus/ohms-law/WireBoard";
import { InkComposer } from "../../scene/ink/InkComposer";
import { InkLights } from "../../scene/ink/InkLights";
import { PaperDesk } from "../../scene/ink/PaperDesk";
import { ReadySignal } from "../../scene/ReadySignal";
import { TerminalProvider } from "../terminals";
import type { LessonMode, OhmsLawVisualState, ProcedureNote } from "../types";
import { OhmsLawNotebook } from "./OhmsLawNotebook";
import { useParallaxNote } from "./parallax";
import { clampEye, type LoupeTarget, MAX_EYE_DEG, type RuleEnd } from "./poses";
import { ReadingLoupe } from "./ReadingLoupe";
import "./readings.css";
import { emptyOhmsLawRecord, setCell, setHeader, setLength, setPrecaution } from "./record";

// ?readings=1 — the readings slice on its own, with a fake bench state.
//   &deg=<n>                     both needles to n degrees
//   &loupe=ammeter|voltmeter|rule-x|rule-y   opens a loupe     &eye=<deg>  sets the eye
//   &fill=1                      notebook with sample text      &panel=notebook  hides the canvas
//   &mode=exam                   exam mode (no placeholders, no notes)     &quality=low|mid|high

function fakeState(deg: number | null): OhmsLawVisualState {
  const params = paramsFromSeed(1);
  const readout = { ...createOhmsLaw(params).readout };
  if (deg !== null) {
    readout.ammeterDeg = deg;
    readout.voltmeterDeg = deg;
  }
  return {
    readout,
    keyClosed: false,
    plugsIn: params.boxCoilsOhm.map(() => true),
    leads: [],
    pendingFrom: null,
    pointer: new THREE.Vector3(),
    ring: null,
    highlight: null,
    hintMissing: [],
    hintExtra: [],
  };
}

function sampleRecord(mode: LessonMode) {
  let r = emptyOhmsLawRecord(mode);
  r = setLength(r, "62.5 cm");
  r = setHeader(setHeader(setHeader(r, "R", "R/Ω"), "I", "I/A"), "V", "V/V");
  const rows: [string, string, string][] = [
    ["0", "0.30", "1.50"],
    ["1", "0.25", "1.45"],
    ["5", "0.15", "1.40"],
  ];
  rows.forEach(([R, I, V], i) => {
    r = setCell(setCell(setCell(r, i, "R", R), i, "I", I), i, "V", V);
  });
  r = setPrecaution(r, 0, "I ensured the connections were tight and clean.");
  return r;
}

const LOUPES: Record<string, { target: LoupeTarget; end: RuleEnd }> = {
  ammeter: { target: "ammeter", end: "X" },
  voltmeter: { target: "voltmeter", end: "X" },
  "rule-x": { target: "rule", end: "X" },
  "rule-y": { target: "rule", end: "Y" },
};

export default function ReadingsPreview() {
  const search = useMemo(() => new URLSearchParams(location.search), []);
  const q = search.get("quality");
  const quality: QualityTier = q === "low" || q === "mid" ? q : "high";
  const mode: LessonMode = search.get("mode") === "exam" ? "exam" : "practice";
  const degParam = search.get("deg");
  const params = useMemo(() => paramsFromSeed(1), []);
  const state = useRef(fakeState(degParam === null ? null : Number(degParam)));
  const L = OHMS_LAW_LAYOUT;

  const [loupe, setLoupe] = useState<string | null>(search.get("loupe"));
  const [eye, setEye] = useState(clampEye(Number(search.get("eye") ?? 0)));
  const [record, setRecord] = useState(() =>
    search.get("fill") === "1" ? sampleRecord(mode) : emptyOhmsLawRecord(mode),
  );
  const [notes, setNotes] = useState<ProcedureNote[]>([]);

  // A stand-in for the real bench: only the two members the note needs.
  const bench = useMemo(
    () => ({
      mode,
      addNote(n: Omit<ProcedureNote, "id" | "atS">) {
        setNotes((prev) => [...prev, { ...n, id: `n${prev.length}`, atS: 0 }]);
      },
    }),
    [mode],
  );
  const parallax = useParallaxNote(bench);
  const open = loupe ? LOUPES[loupe] : undefined;

  // Only a meter loupe's eye angle counts for the mirror-line note; the rule has no mirror.
  const meterOpen = open?.target === "ammeter" || open?.target === "voltmeter";
  useEffect(() => parallax.setEye(meterOpen ? eye : 0), [parallax, eye, meterOpen]);

  const common = { state, quality };
  return (
    <div className={`olr-preview${search.get("panel") === "notebook" ? " olr-notebook-only" : ""}`}>
      <div className="olr-stage">
        <Canvas
          dpr={quality === "low" ? 1 : [1, 2]}
          gl={{ antialias: true }}
          camera={{ fov: 40, position: [0, 0.95, 1.05], near: 0.02, far: 20 }}
          onCreated={({ camera }) => camera.lookAt(0, 0, -0.05)}
        >
          <InkLights quality={quality} />
          <TerminalProvider>
            <PaperDesk quality={quality} />
            <Meter
              {...common}
              kind="ammeter"
              fullScale={params.ammeter.fullScale}
              division={params.ammeter.division}
              position={L.ammeter.position}
              onTap={() => setLoupe("ammeter")}
            />
            <Meter
              {...common}
              kind="voltmeter"
              fullScale={params.voltmeter.fullScale}
              division={params.voltmeter.division}
              position={L.voltmeter.position}
              onTap={() => setLoupe("voltmeter")}
            />
            <WireBoard
              {...common}
              wire={params.wire}
              position={L.wire.position}
              onRuleTap={() => setLoupe("rule-x")}
            />
          </TerminalProvider>
          <ReadingLoupe
            target={open?.target ?? null}
            eyeDeg={eye}
            ruleEnd={open?.end ?? "X"}
            wire={params.wire}
          />
          <InkComposer quality={quality} />
          <ReadySignal />
        </Canvas>
        <div className="olr-bar">
          {Object.keys(LOUPES).map((k) => (
            <button
              key={k}
              type="button"
              className="olr-btn"
              aria-pressed={loupe === k}
              onClick={() => setLoupe(loupe === k ? null : k)}
            >
              {k === "rule-x" ? "Rule at X" : k === "rule-y" ? "Rule at Y" : k}
            </button>
          ))}
          <label className="olr-eye">
            <span>
              Eye {eye > 0 ? "+" : ""}
              {Math.round(eye)}°
            </span>
            <input
              type="range"
              min={-MAX_EYE_DEG}
              max={MAX_EYE_DEG}
              step={1}
              value={eye}
              aria-label="Eye position"
              onChange={(e) => setEye(Number(e.target.value))}
            />
          </label>
        </div>
      </div>
      <div className="olr-side">
        {notes.length > 0 && (
          <ul className="olr-notes" data-testid="notes">
            {notes.map((n) => (
              <li key={n.id}>{n.text}</li>
            ))}
          </ul>
        )}
        <OhmsLawNotebook
          value={record}
          onChange={setRecord}
          mode={mode}
          onReadingEdit={({ row, col }) => parallax.reading(`${row}${col}`)}
        />
      </div>
    </div>
  );
}
