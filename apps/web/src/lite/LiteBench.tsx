import { useEffect, useMemo, useRef, useState } from "react";
import { type BenchSetup, createBenchController } from "../apparatus/meter-bridge/benchController";
import {
  clientXToCm,
  cmToSvgX,
  isDrag,
  needleAngle,
  VIEWBOX_HEIGHT,
  VIEWBOX_WIDTH,
  WIRE_END_X,
  WIRE_START_X,
  WIRE_Y,
} from "./geometry";

export interface LiteBenchProps {
  setup: BenchSetup;
  plugLabels: string[];
  unknownLabel: string;
}

export default function LiteBench({ setup, plugLabels, unknownLabel }: LiteBenchProps) {
  const [controller] = useState(() => createBenchController(setup));

  const svgRef = useRef<SVGSVGElement | null>(null);
  const needleRef = useRef<SVGLineElement | null>(null);
  const jockeyGroupRef = useRef<SVGGElement | null>(null);
  const jockeyWirePathRef = useRef<SVGPathElement | null>(null);
  const plugPinRefs = useRef<Array<SVGCircleElement | null>>([]);
  const plugBtnRefs = useRef<Array<SVGGElement | null>>([]);
  const keyPlugRef = useRef<SVGRectElement | null>(null);
  const keyBtnRef = useRef<SVGGElement | null>(null);
  const keyTextRef = useRef<SVGTextElement | null>(null);
  const scrapesPathRef = useRef<SVGPathElement | null>(null);
  const scrapesCountRef = useRef(0);

  const pointerState = useRef<{
    active: boolean;
    downClientX: number;
    lastCm: number;
    isDragging: boolean;
    svgRect: DOMRect | null;
  }>({
    active: false,
    downClientX: 0,
    lastCm: 0,
    isDragging: false,
    svgRect: null,
  });

  const plugSlots = useMemo(
    () =>
      plugLabels.map((lbl, idx) => ({
        id: `plug-station-${lbl}-${idx}`,
        lbl,
        idx,
      })),
    [plugLabels],
  );

  // Zero-setState rAF physics & visual synchronization loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dtSeconds = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      controller.advance(dtSeconds);
      const visual = controller.visual;

      // 1. Galvanometer needle rotation around dial center (600, 150)
      const deg = needleAngle(visual.needleDeg);
      needleRef.current?.setAttribute("transform", `rotate(${deg} 600 150)`);

      // 2. Jockey position and knife-edge contact
      const jx = cmToSvgX(visual.jockeyCm);
      const jy = visual.jockeyDown ? WIRE_Y : WIRE_Y - 15;
      jockeyGroupRef.current?.setAttribute("transform", `translate(${jx} ${jy})`);
      jockeyWirePathRef.current?.setAttribute(
        "d",
        `M 640 160 C 660 240, ${jx} 300, ${jx} ${jy - 35}`,
      );

      // 3. Plug box pegs
      for (let i = 0; i < visual.plugsIn.length; i++) {
        const inState = visual.plugsIn[i] ?? true;
        const pin = plugPinRefs.current[i];
        if (pin) {
          pin.setAttribute("opacity", inState ? "1" : "0.15");
        }
        const btn = plugBtnRefs.current[i];
        if (btn) {
          btn.setAttribute("aria-pressed", inState ? "true" : "false");
        }
      }

      // 4. Plug key state
      const keyPlug = keyPlugRef.current;
      if (keyPlug) {
        keyPlug.setAttribute("opacity", visual.keyClosed ? "1" : "0.15");
      }
      const keyBtn = keyBtnRef.current;
      if (keyBtn) {
        keyBtn.setAttribute("aria-pressed", visual.keyClosed ? "true" : "false");
      }
      const keyText = keyTextRef.current;
      if (keyText) {
        keyText.textContent = visual.keyClosed ? "CLOSED" : "OPEN";
      }

      // 5. Scrapes along the wire
      if (visual.scrapesCm.length !== scrapesCountRef.current) {
        scrapesCountRef.current = visual.scrapesCm.length;
        const d = visual.scrapesCm
          .map(([from, to]) => `M ${cmToSvgX(from)} ${WIRE_Y} L ${cmToSvgX(to)} ${WIRE_Y}`)
          .join(" ");
        scrapesPathRef.current?.setAttribute("d", d);
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(animId);
    };
  }, [controller]);

  // Wire pointer hit handlers with setPointerCapture
  const handleWirePointerDown = (e: React.PointerEvent<SVGRectElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = svgRef.current?.getBoundingClientRect() ?? null;
    const initialCm = clientXToCm(e.clientX, rect?.left ?? 0, rect?.width ?? VIEWBOX_WIDTH);
    pointerState.current = {
      active: true,
      downClientX: e.clientX,
      lastCm: initialCm,
      isDragging: false,
      svgRect: rect,
    };
  };

  const handleWirePointerMove = (e: React.PointerEvent<SVGRectElement>) => {
    const s = pointerState.current;
    if (!s.active || !s.svgRect) return;

    const dx = e.clientX - s.downClientX;
    if (!s.isDragging && isDrag(dx)) {
      s.isDragging = true;
    }

    if (s.isDragging) {
      const currentCm = clientXToCm(e.clientX, s.svgRect.left, s.svgRect.width);
      controller.handlers.onWireDrag(s.lastCm, currentCm);
      s.lastCm = currentCm;
    }
  };

  const handleWirePointerUp = (e: React.PointerEvent<SVGRectElement>) => {
    const s = pointerState.current;
    if (s.active && !s.isDragging && s.svgRect) {
      const tapCm = clientXToCm(e.clientX, s.svgRect.left, s.svgRect.width);
      controller.handlers.onWireTap(tapCm);
    }
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture was already released
    }
    pointerState.current.active = false;
    pointerState.current.svgRect = null;
  };

  const handleWirePointerCancel = (e: React.PointerEvent<SVGRectElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
    pointerState.current.active = false;
    pointerState.current.svgRect = null;
  };

  // Generate metre ruler tick marks
  const rulerTicks: React.ReactNode[] = [];
  for (let cm = 0; cm <= 100; cm++) {
    const x = cmToSvgX(cm);
    const isMajor = cm % 10 === 0;
    const isMedium = cm % 5 === 0;
    const tickHeight = isMajor ? 18 : isMedium ? 12 : 6;
    rulerTicks.push(
      <line
        key={`tick-${cm}`}
        x1={x}
        y1={WIRE_Y + 8}
        x2={x}
        y2={WIRE_Y + 8 + tickHeight}
        stroke="#4a3728"
        strokeWidth={isMajor ? 1.5 : 1}
      />,
    );
    if (isMajor) {
      rulerTicks.push(
        <text
          key={`num-${cm}`}
          x={x}
          y={WIRE_Y + 38}
          fontSize="11"
          fontWeight="600"
          fill="#3b2b1d"
          textAnchor="middle"
          fontFamily="system-ui, sans-serif"
        >
          {cm}
        </text>,
      );
    }
  }

  // Generate galvanometer dial ticks (-30 to +30, ticks every 5, numbers every 10)
  const dialTicks: React.ReactNode[] = [];
  for (let val = -30; val <= 30; val += 5) {
    const angle = (val / 30) * 40; // ±40 deg dial arc
    const rad = ((angle - 90) * Math.PI) / 180;
    const isNumbered = val % 10 === 0;
    const tickLen = isNumbered ? 12 : 7;
    const x1 = 600 + Math.cos(rad) * 78;
    const y1 = 150 + Math.sin(rad) * 78;
    const x2 = 600 + Math.cos(rad) * (78 - tickLen);
    const y2 = 150 + Math.sin(rad) * (78 - tickLen);

    dialTicks.push(
      <line
        key={`dial-tick-${val}`}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="#1e293b"
        strokeWidth={isNumbered ? 1.8 : 1.2}
      />,
    );

    if (isNumbered) {
      const lx = 600 + Math.cos(rad) * 52;
      const ly = 150 + Math.sin(rad) * 52;
      dialTicks.push(
        <text
          key={`dial-num-${val}`}
          x={lx}
          y={ly + 4}
          fontSize="10"
          fontWeight="bold"
          fill="#0f172a"
          textAnchor="middle"
          fontFamily="system-ui, sans-serif"
        >
          {val === 0 ? "0" : val > 0 ? `+${val}` : `${val}`}
        </text>,
      );
    }
  }

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "100%",
        overflowX: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        backgroundColor: "#0f172a",
        color: "#f8fafc",
        padding: "16px 8px",
        boxSizing: "border-box",
        minHeight: "100vh",
        userSelect: "none",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <header style={{ textAlign: "center", marginBottom: "8px" }}>
        <h1
          style={{
            fontSize: "1.25rem",
            fontWeight: "700",
            margin: "0 0 4px 0",
            letterSpacing: "0.025em",
          }}
        >
          Metre bridge (Lite)
        </h1>
        <p
          style={{
            fontSize: "0.875rem",
            color: "#94a3b8",
            margin: 0,
          }}
        >
          A 2D bench for phones that can't run the 3D lab.
        </p>
      </header>

      <div
        style={{
          width: "100%",
          maxWidth: "1100px",
          position: "relative",
        }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
          style={{
            width: "100%",
            height: "auto",
            display: "block",
            touchAction: "none",
          }}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Interactive Metre Bridge 2D Lab"
        >
          <defs>
            {/* Wooden Board Gradient */}
            <linearGradient id="woodGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3d2817" />
              <stop offset="50%" stopColor="#2c1a0e" />
              <stop offset="100%" stopColor="#1f1208" />
            </linearGradient>

            {/* Metre Ruler Gradient */}
            <linearGradient id="rulerGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f5deb3" />
              <stop offset="100%" stopColor="#e2c992" />
            </linearGradient>

            {/* Brass / Copper Gradient */}
            <linearGradient id="copperGradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#eab308" />
              <stop offset="50%" stopColor="#ca8a04" />
              <stop offset="100%" stopColor="#854d0e" />
            </linearGradient>

            {/* Resistor body gradient */}
            <linearGradient id="resistorGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#334155" />
              <stop offset="50%" stopColor="#64748b" />
              <stop offset="100%" stopColor="#1e293b" />
            </linearGradient>
          </defs>

          {/* 1. Large Wooden Base Bench */}
          <rect
            x="40"
            y="40"
            width="1120"
            height="620"
            rx="16"
            fill="url(#woodGradient)"
            stroke="#170f07"
            strokeWidth="4"
          />

          {/* 2. Metre Ruler */}
          <rect
            x={WIRE_START_X}
            y={WIRE_Y + 8}
            width={WIRE_END_X - WIRE_START_X}
            height="36"
            fill="url(#rulerGradient)"
            stroke="#8c6d46"
            strokeWidth="1.5"
            rx="2"
          />
          {rulerTicks}

          {/* 3. Thick Copper Strips */}
          {/* Left L-Strip */}
          <path
            d={`M 75 435 L 125 435 L 125 330 L 320 330 L 320 295 L 75 295 Z`}
            fill="url(#copperGradient)"
            stroke="#713f12"
            strokeWidth="2"
          />
          {/* Central Straight Strip */}
          <path
            d={`M 440 295 L 760 295 L 760 330 L 440 330 Z`}
            fill="url(#copperGradient)"
            stroke="#713f12"
            strokeWidth="2"
          />
          {/* Right L-Strip */}
          <path
            d={`M 880 295 L 1125 295 L 1125 435 L 1075 435 L 1075 330 L 880 330 Z`}
            fill="url(#copperGradient)"
            stroke="#713f12"
            strokeWidth="2"
          />

          {/* Terminal Terminals Bolts A, B, C */}
          <circle cx="100" cy={WIRE_Y} r="7" fill="#fbbf24" stroke="#78350f" strokeWidth="2" />
          <circle cx="600" cy="312.5" r="7" fill="#fbbf24" stroke="#78350f" strokeWidth="2" />
          <circle cx="1100" cy={WIRE_Y} r="7" fill="#fbbf24" stroke="#78350f" strokeWidth="2" />

          {/* Terminal Text Labels */}
          <text
            x="70"
            y={WIRE_Y + 5}
            fontSize="18"
            fontWeight="bold"
            fill="#fef08a"
            textAnchor="middle"
            fontFamily="system-ui, sans-serif"
          >
            A
          </text>
          <text
            x="600"
            y="285"
            fontSize="18"
            fontWeight="bold"
            fill="#fef08a"
            textAnchor="middle"
            fontFamily="system-ui, sans-serif"
          >
            B
          </text>
          <text
            x="1130"
            y={WIRE_Y + 5}
            fontSize="18"
            fontWeight="bold"
            fill="#fef08a"
            textAnchor="middle"
            fontFamily="system-ui, sans-serif"
          >
            C
          </text>

          {/* Left Gap Label R and Right Gap Label X */}
          <text
            x="380"
            y="275"
            fontSize="16"
            fontWeight="bold"
            fill="#cbd5e1"
            textAnchor="middle"
            fontFamily="system-ui, sans-serif"
          >
            Gap (R)
          </text>
          <text
            x="820"
            y="275"
            fontSize="16"
            fontWeight="bold"
            fill="#cbd5e1"
            textAnchor="middle"
            fontFamily="system-ui, sans-serif"
          >
            Gap ({unknownLabel})
          </text>

          {/* 4. Left Gap: Resistance Plug Box */}
          <g transform="translate(265, 140)">
            {/* Box Body */}
            <rect
              x="0"
              y="0"
              width="230"
              height="100"
              rx="6"
              fill="#451a03"
              stroke="#270e02"
              strokeWidth="2"
            />
            <text
              x="115"
              y="22"
              fontSize="12"
              fontWeight="bold"
              fill="#fde68a"
              textAnchor="middle"
              fontFamily="system-ui, sans-serif"
              letterSpacing="0.05em"
            >
              RESISTANCE BOX (R)
            </text>

            {/* Plugs row */}
            {plugSlots.map((slot) => {
              const px = 25 + slot.idx * 38;
              const py = 50;
              return (
                // biome-ignore lint/a11y/useSemanticElements: SVG <g> requires role="button" for vector apparatus controls
                <g
                  key={slot.id}
                  ref={(el) => {
                    plugBtnRefs.current[slot.idx] = el;
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Toggle ${slot.lbl} Ohm resistance plug`}
                  style={{ cursor: "pointer", outline: "none" }}
                  onClick={() => controller.handlers.onPlugToggle(slot.idx)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      controller.handlers.onPlugToggle(slot.idx);
                    }
                  }}
                >
                  {/* Brass socket ring */}
                  <circle
                    cx={px}
                    cy={py}
                    r="13"
                    fill="#ca8a04"
                    stroke="#713f12"
                    strokeWidth="1.5"
                  />
                  {/* Socket hole */}
                  <circle cx={px} cy={py} r="8" fill="#18181b" />
                  {/* Plug Peg (in = brass plug visible, out = dim/removed) */}
                  <circle
                    ref={(el) => {
                      plugPinRefs.current[slot.idx] = el;
                    }}
                    cx={px}
                    cy={py}
                    r="7.5"
                    fill="#fef08a"
                    stroke="#a16207"
                    strokeWidth="1.5"
                    opacity={setup.plugsIn[slot.idx] ? 1 : 0.15}
                  />
                  <text
                    x={px}
                    y={py + 30}
                    fontSize="11"
                    fontWeight="bold"
                    fill="#fef08a"
                    textAnchor="middle"
                    fontFamily="system-ui, sans-serif"
                  >
                    {slot.lbl}Ω
                  </text>
                </g>
              );
            })}
          </g>

          {/* Connection wires from Left Gap Copper to Plug Box */}
          <path
            d="M 320 312.5 L 320 255 L 285 255 L 285 240"
            stroke="#94a3b8"
            strokeWidth="3"
            fill="none"
          />
          <path
            d="M 440 312.5 L 440 255 L 475 255 L 475 240"
            stroke="#94a3b8"
            strokeWidth="3"
            fill="none"
          />

          {/* 5. Right Gap: Unknown Resistor (X) */}
          <g transform="translate(760, 150)">
            <rect
              x="0"
              y="0"
              width="120"
              height="80"
              rx="8"
              fill="#1e293b"
              stroke="#475569"
              strokeWidth="2"
            />
            {/* Resistor cylinder */}
            <rect
              x="20"
              y="25"
              width="80"
              height="30"
              rx="6"
              fill="url(#resistorGradient)"
              stroke="#0f172a"
              strokeWidth="1.5"
            />
            <text
              x="60"
              y="45"
              fontSize="16"
              fontWeight="bold"
              fill="#38bdf8"
              textAnchor="middle"
              fontFamily="system-ui, sans-serif"
            >
              {unknownLabel}
            </text>
            <text
              x="60"
              y="70"
              fontSize="10"
              fill="#94a3b8"
              textAnchor="middle"
              fontFamily="system-ui, sans-serif"
            >
              Unknown resistance
            </text>
          </g>

          {/* Connection wires from Right Gap Copper to Resistor */}
          <path
            d="M 760 312.5 L 760 255 L 780 255 L 780 230"
            stroke="#94a3b8"
            strokeWidth="3"
            fill="none"
          />
          <path
            d="M 880 312.5 L 880 255 L 860 255 L 860 230"
            stroke="#94a3b8"
            strokeWidth="3"
            fill="none"
          />

          {/* 6. Centre-Zero Galvanometer */}
          <g transform="translate(0, 0)">
            {/* Housing */}
            <rect
              x="490"
              y="28"
              width="220"
              height="140"
              rx="12"
              fill="#020617"
              stroke="#334155"
              strokeWidth="2.5"
            />
            {/* Semicircular dial face */}
            <path
              d="M 515 150 A 85 85 0 0 1 685 150 Z"
              fill="#f8fafc"
              stroke="#cbd5e1"
              strokeWidth="1.5"
            />
            {dialTicks}

            {/* Galvanometer Name */}
            <text
              x="600"
              y="48"
              fontSize="10"
              fontWeight="bold"
              fill="#94a3b8"
              textAnchor="middle"
              fontFamily="system-ui, sans-serif"
              letterSpacing="0.08em"
            >
              CENTRE-ZERO GALVANOMETER
            </text>

            {/* Deflection Needle */}
            <line
              ref={needleRef}
              x1="600"
              y1="150"
              x2="600"
              y2="76"
              stroke="#dc2626"
              strokeWidth="2"
              strokeLinecap="round"
            />
            {/* Pivot cap */}
            <circle cx="600" cy="150" r="5" fill="#0f172a" stroke="#cbd5e1" strokeWidth="1.5" />

            {/* Terminals at base of Galvanometer */}
            <circle cx="560" cy="160" r="4" fill="#fbbf24" />
            <circle cx="640" cy="160" r="4" fill="#fbbf24" />
          </g>

          {/* Wire from Terminal B to Galvanometer negative terminal */}
          <path
            d="M 600 305 L 600 210 L 560 210 L 560 160"
            stroke="#ef4444"
            strokeWidth="2.5"
            fill="none"
          />

          {/* Flexible Lead from Galvanometer positive terminal to Jockey */}
          <path
            ref={jockeyWirePathRef}
            d={`M 640 160 C 660 250, ${cmToSvgX(50)} 300, ${cmToSvgX(50)} ${WIRE_Y - 45}`}
            stroke="#3b82f6"
            strokeWidth="2.5"
            fill="none"
          />

          {/* 7. Leclanché Cell & Plug Key Circuit (Connected between A and C via bottom loop) */}
          {/* Wire from A down to Leclanché Cell */}
          <path d={`M 100 435 L 100 560 L 340 560`} stroke="#64748b" strokeWidth="3" fill="none" />

          {/* Leclanché Cell */}
          <g transform="translate(340, 530)">
            <rect
              x="0"
              y="0"
              width="120"
              height="60"
              rx="6"
              fill="#1e293b"
              stroke="#475569"
              strokeWidth="2"
            />
            {/* Battery Plate Symbols */}
            <line x1="48" y1="15" x2="48" y2="45" stroke="#f8fafc" strokeWidth="3" />
            <line x1="58" y1="22" x2="58" y2="38" stroke="#f8fafc" strokeWidth="6" />
            <line x1="68" y1="15" x2="68" y2="45" stroke="#f8fafc" strokeWidth="3" />
            <line x1="78" y1="22" x2="78" y2="38" stroke="#f8fafc" strokeWidth="6" />
            <text
              x="60"
              y="54"
              fontSize="10"
              fontWeight="bold"
              fill="#cbd5e1"
              textAnchor="middle"
              fontFamily="system-ui, sans-serif"
            >
              LECLANCHÉ CELL
            </text>
          </g>

          {/* Wire between Cell and Plug Key */}
          <path d="M 460 560 L 750 560" stroke="#64748b" strokeWidth="3" fill="none" />

          {/* Plug Key (Switch) */}
          {/* biome-ignore lint/a11y/useSemanticElements: SVG <g> requires role="button" for vector apparatus controls */}
          <g
            ref={keyBtnRef}
            transform="translate(750, 530)"
            role="button"
            tabIndex={0}
            aria-label="Toggle plug key"
            style={{ cursor: "pointer", outline: "none" }}
            onClick={() => controller.handlers.onKeyToggle()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                controller.handlers.onKeyToggle();
              }
            }}
          >
            <rect
              x="0"
              y="0"
              width="120"
              height="60"
              rx="6"
              fill="#334155"
              stroke="#64748b"
              strokeWidth="2"
            />
            {/* Brass blocks with gap */}
            <rect x="20" y="24" width="30" height="12" fill="#ca8a04" />
            <rect x="70" y="24" width="30" height="12" fill="#ca8a04" />
            {/* Plug Pin inserted across gap */}
            <rect
              ref={keyPlugRef}
              x="46"
              y="18"
              width="28"
              height="24"
              rx="3"
              fill="#fef08a"
              stroke="#a16207"
              strokeWidth="2"
              opacity="0.15"
            />
            <text
              x="60"
              y="53"
              fontSize="10"
              fontWeight="bold"
              fill="#fef08a"
              textAnchor="middle"
              fontFamily="system-ui, sans-serif"
            >
              KEY: <tspan ref={keyTextRef}>OPEN</tspan>
            </text>
          </g>

          {/* Wire from Key to C */}
          <path
            d={`M 870 560 L 1100 560 L 1100 435`}
            stroke="#64748b"
            strokeWidth="3"
            fill="none"
          />

          {/* 8. Constantan Wire */}
          <line
            x1={WIRE_START_X}
            y1={WIRE_Y}
            x2={WIRE_END_X}
            y2={WIRE_Y}
            stroke="#94a3b8"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Scrapes overlay path on wire */}
          <path
            ref={scrapesPathRef}
            stroke="#8b0000"
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
          />

          {/* 9. Jockey Component */}
          <g ref={jockeyGroupRef} transform={`translate(${cmToSvgX(50)} ${WIRE_Y - 15})`}>
            {/* Jockey Handle */}
            <rect
              x="-6"
              y="-42"
              width="12"
              height="28"
              rx="2"
              fill="#1e293b"
              stroke="#0f172a"
              strokeWidth="1.5"
            />
            {/* Brass Shaft */}
            <rect x="-3" y="-14" width="6" height="10" fill="#eab308" />
            {/* Knife-Edge Triangle (Tip at 0, 0) */}
            <polygon points="0,0 -7,-6 7,-6" fill="#fbbf24" stroke="#854d0e" strokeWidth="1" />
          </g>

          {/* 10. Wire Hit Area (60px tall transparent rect over the wire) */}
          <rect
            x={WIRE_START_X}
            y={WIRE_Y - 30}
            width={WIRE_END_X - WIRE_START_X}
            height="60"
            fill="transparent"
            pointerEvents="all"
            cursor="pointer"
            style={{ touchAction: "none" }}
            onPointerDown={handleWirePointerDown}
            onPointerMove={handleWirePointerMove}
            onPointerUp={handleWirePointerUp}
            onPointerCancel={handleWirePointerCancel}
            aria-label="Metre bridge wire hit area"
          />
        </svg>
      </div>

      <div
        style={{
          marginTop: "12px",
          textAlign: "center",
          maxWidth: "600px",
          padding: "0 12px",
        }}
      >
        <p
          style={{
            fontSize: "1rem",
            fontWeight: "500",
            color: "#e2e8f0",
            margin: "0 0 6px 0",
            lineHeight: 1.4,
          }}
        >
          Close the key, then tap the wire to find where the needle reads zero. Don't slide the
          jockey.
        </p>
        <p
          style={{
            fontSize: "0.8rem",
            color: "#64748b",
            margin: 0,
          }}
        >
          Tap the resistance box plugs to remove or insert coils. Click the plug key to complete the
          circuit.
        </p>
      </div>
    </div>
  );
}
