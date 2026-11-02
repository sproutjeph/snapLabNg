import { lazy, Suspense } from "react";

// The live 3D bench on the Ohm's law card (docs/plans/guided-demo.md, contract 5): the same parts
// and layout the practical opens on. Lazy, so the home page's first paint is the baked poster.
const HomeBench3D = lazy(() => import("./HomeBench3D"));

/** The same file as HomeBench3D's POSTER_SRC; kept literal so this module stays out of the 3D chunk. */
const POSTER_SRC = "/home/ohms-law-poster.webp";

const poster = (
  <img className="hp-still" src={POSTER_SRC} alt="" width={1600} height={1100} decoding="async" />
);

export function Bench3DSlot() {
  return (
    <Suspense fallback={poster}>
      <HomeBench3D />
    </Suspense>
  );
}

export default Bench3DSlot;
