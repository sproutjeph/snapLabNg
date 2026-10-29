import { emptyOhmsLawRecord } from "../readings/record";
import type { Director, DirectorOptions } from "./types";

// STUB (Wave 0): the real director arrives in W1-director. Contract: learn/script/types.ts.
export function createDirector(opts: DirectorOptions): Director {
  const listeners = new Set<() => void>();
  return {
    state: {
      mode: opts.mode,
      beat: 0,
      playing: false,
      speed: 1,
      caption: "",
      waiting: false,
      hint: 0,
      finished: false,
      act: null,
      actT: 0,
      loupe: null,
    },
    demoRecord: emptyOhmsLawRecord("practice"),
    play() {},
    pause() {},
    next() {},
    prev() {},
    seek() {},
    setSpeed() {},
    showMe() {},
    advance() {},
    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    dispose() {
      listeners.clear();
    },
  };
}
