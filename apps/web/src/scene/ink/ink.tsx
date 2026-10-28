import { type ReactNode, useLayoutEffect, useRef } from "react";
import type * as THREE from "three";

// Ink tags for the outline pass (docs/plans/ink-look.md). Each tagged mesh carries an ink id,
// so two touching parts still get a line between them; `thin` gives small parts lighter lines.
// FROZEN for Wave 1: apparatus slices tag their meshes with these; the ink slice reads them.

export interface InkTag {
  /** 1–255. Different ids on touching meshes draw a line where they meet. */
  id: number;
  thin?: boolean;
}

let nextId = 1;

/** A fresh ink id for a part that does not need a fixed one (wraps after 255). */
export function nextInkId(): number {
  const id = nextId;
  nextId = nextId >= 255 ? 1 : nextId + 1;
  return id;
}

/** Tags `obj` and every mesh under it. Call again after adding children. */
export function inkTag(obj: THREE.Object3D, tag: InkTag): void {
  obj.traverse((o) => {
    o.userData.ink = tag;
  });
}

export function readInk(obj: THREE.Object3D): InkTag | undefined {
  return obj.userData.ink as InkTag | undefined;
}

/** Tags all the meshes it wraps once they mount. */
export function InkGroup({
  id,
  thin,
  children,
}: {
  id?: number;
  thin?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);
  const auto = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    auto.current ??= nextInkId();
    inkTag(ref.current, { id: id ?? auto.current, thin: thin ?? false });
  });
  return <group ref={ref}>{children}</group>;
}
