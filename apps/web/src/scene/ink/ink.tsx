import { type ReactNode, useLayoutEffect, useRef } from "react";
import type * as THREE from "three";

// Ink tags for the outline pass (docs/plans/ink-look.md). Each tagged mesh carries an ink id,
// so two touching parts still get a line between them; `thin` gives small parts lighter lines.
// FROZEN for Wave 1: apparatus slices tag their meshes with these; the ink slice reads them.
//
// Ids 1–199 are fixed ids from a scene's own table (the V–I bench: INK_IDS in
// apparatus/ohms-law/layout.ts). Ids 200–255 are handed out by nextInkId().

export interface InkTag {
  /** 1–255. Different ids on touching meshes draw a line where they meet. */
  id: number;
  thin?: boolean;
}

const AUTO_FIRST = 200;
const AUTO_LAST = 255;
let nextId = AUTO_FIRST;

/** A fresh ink id (200–255, wrapping) for a part that does not need a fixed one. */
export function nextInkId(): number {
  const id = nextId;
  nextId = nextId >= AUTO_LAST ? AUTO_FIRST : nextId + 1;
  return id;
}

/**
 * Tags `obj` and everything under it, except subtrees owned by a nested InkGroup (or another
 * inkTag root), which keep their own tag. Call again after adding children.
 */
export function inkTag(obj: THREE.Object3D, tag: InkTag): void {
  obj.userData.inkRoot = true;
  const visit = (o: THREE.Object3D) => {
    if (o !== obj && o.userData.inkRoot) return;
    o.userData.ink = tag;
    for (const c of o.children) visit(c);
  };
  visit(obj);
}

export function readInk(obj: THREE.Object3D): InkTag | undefined {
  return obj.userData.ink as InkTag | undefined;
}

/**
 * Tags all the meshes it wraps once they mount. Groups nest: an inner group's tag wins for
 * its own subtree (React runs the inner layout effect first, and the outer one stops there).
 */
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
