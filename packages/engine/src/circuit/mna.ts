/**
 * A small nodal-analysis solver for d.c. networks of up to a dozen or so nodes (docs/07 §4.4).
 *
 * Elements are two-terminal branches from node `a` to node `b`: a resistance in series with an
 * optional emf that raises the potential from b to a (so a is the + terminal). A source with
 * internal resistance is stamped as its Norton equivalent, which keeps the system n × n in the
 * node potentials. A switch that is open is simply not added.
 *
 * The circuit owns every buffer it uses. Elements are added into typed arrays that grow only when
 * the capacity is exceeded, and the solve (dense Gaussian elimination with partial pivoting)
 * reuses the same matrix, so stepping a bench at 120 Hz allocates nothing here.
 *
 * Nodes that no element path joins to ground are "floating". Each floating island gets a tiny
 * leak conductance to ground at one node, so the matrix stays non-singular; with one leak per
 * island no current flows through it. The floating nodes are reported in `floating`.
 */

/** Below this a resistance is treated as this (keeps 1/R finite). */
export const MNA_MIN_OHM = 1e-6;
/** Leak conductance that references a floating island to ground. */
export const MNA_LEAK_S = 1e-9;

export interface MnaCircuit {
  readonly nodeCount: number;
  readonly groundNode: number;
  /** Number of elements added since the last reset. */
  count: number;
  a: Int32Array;
  b: Int32Array;
  ohm: Float64Array;
  emfV: Float64Array;
  /** Node potentials after solveMna (ground = 0 V). */
  readonly nodeV: Float64Array;
  /** Current through each element from a to b (A) after solveMna. */
  currentA: Float64Array;
  /** 1 for each node that no element path joins to ground, after solveMna. */
  readonly floating: Uint8Array;
  floatingCount: number;
  // Scratch, reused by every solve.
  readonly matrix: Float64Array;
  readonly rhs: Float64Array;
  readonly parent: Int32Array;
}

export function createMnaCircuit(
  nodeCount: number,
  groundNode: number,
  elementCapacity = 16,
): MnaCircuit {
  if (groundNode < 0 || groundNode >= nodeCount) throw new RangeError("ground node out of range");
  const cap = Math.max(1, elementCapacity);
  return {
    nodeCount,
    groundNode,
    count: 0,
    a: new Int32Array(cap),
    b: new Int32Array(cap),
    ohm: new Float64Array(cap),
    emfV: new Float64Array(cap),
    nodeV: new Float64Array(nodeCount),
    currentA: new Float64Array(cap),
    floating: new Uint8Array(nodeCount),
    floatingCount: 0,
    matrix: new Float64Array(nodeCount * nodeCount),
    rhs: new Float64Array(nodeCount),
    parent: new Int32Array(nodeCount),
  };
}

/** Removes every element, keeping the buffers. */
export function resetMna(c: MnaCircuit): void {
  c.count = 0;
}

function grow(c: MnaCircuit): void {
  const cap = c.a.length * 2;
  const a = new Int32Array(cap);
  const b = new Int32Array(cap);
  const ohm = new Float64Array(cap);
  const emfV = new Float64Array(cap);
  a.set(c.a);
  b.set(c.b);
  ohm.set(c.ohm);
  emfV.set(c.emfV);
  c.a = a;
  c.b = b;
  c.ohm = ohm;
  c.emfV = emfV;
  c.currentA = new Float64Array(cap);
}

/**
 * Adds a branch from a to b: resistance `ohm` in series with an emf `emfV` that raises the
 * potential from b to a. Returns the element's index (for reading its current).
 */
export function addBranch(c: MnaCircuit, a: number, b: number, ohm: number, emfV = 0): number {
  if (a < 0 || a >= c.nodeCount || b < 0 || b >= c.nodeCount) {
    throw new RangeError("node out of range");
  }
  if (c.count === c.a.length) grow(c);
  const i = c.count++;
  c.a[i] = a;
  c.b[i] = b;
  c.ohm[i] = Number.isFinite(ohm) ? Math.max(MNA_MIN_OHM, ohm) : MNA_MIN_OHM;
  c.emfV[i] = Number.isFinite(emfV) ? emfV : 0;
  return i;
}

export const addResistor = (c: MnaCircuit, a: number, b: number, ohm: number): number =>
  addBranch(c, a, b, ohm, 0);

/** A source of emf `emfV` with internal resistance `internalOhm`; `pos` is its + terminal. */
export const addSource = (
  c: MnaCircuit,
  pos: number,
  neg: number,
  emfV: number,
  internalOhm: number,
): number => addBranch(c, pos, neg, internalOhm, emfV);

function find(parent: Int32Array, x: number): number {
  let r = x;
  while (parent[r] !== r) r = parent[r] ?? r;
  // Path compression.
  let y = x;
  while (parent[y] !== r) {
    const next = parent[y] ?? r;
    parent[y] = r;
    y = next;
  }
  return r;
}

function markFloating(c: MnaCircuit): void {
  const { parent, floating, nodeCount } = c;
  for (let i = 0; i < nodeCount; i++) parent[i] = i;
  for (let e = 0; e < c.count; e++) {
    const ra = find(parent, c.a[e] ?? 0);
    const rb = find(parent, c.b[e] ?? 0);
    if (ra !== rb) parent[ra] = rb;
  }
  const g = find(parent, c.groundNode);
  c.floatingCount = 0;
  for (let i = 0; i < nodeCount; i++) {
    const f = find(parent, i) !== g ? 1 : 0;
    floating[i] = f;
    c.floatingCount += f;
  }
}

/**
 * Solves the network: fills nodeV, currentA and floating. Kirchhoff's current law at every
 * node except ground, G·V = J, by Gaussian elimination with partial pivoting.
 */
export function solveMna(c: MnaCircuit): void {
  const n = c.nodeCount;
  const G = c.matrix;
  const J = c.rhs;
  const V = c.nodeV;
  G.fill(0);
  J.fill(0);

  for (let e = 0; e < c.count; e++) {
    const a = c.a[e] ?? 0;
    const b = c.b[e] ?? 0;
    if (a === b) continue;
    const g = 1 / (c.ohm[e] ?? MNA_MIN_OHM);
    const inj = g * (c.emfV[e] ?? 0);
    G[a * n + a] = (G[a * n + a] ?? 0) + g;
    G[b * n + b] = (G[b * n + b] ?? 0) + g;
    G[a * n + b] = (G[a * n + b] ?? 0) - g;
    G[b * n + a] = (G[b * n + a] ?? 0) - g;
    // Norton equivalent: the emf pushes a current g·E out of b and into a.
    J[a] = (J[a] ?? 0) + inj;
    J[b] = (J[b] ?? 0) - inj;
  }

  markFloating(c);
  // One leak per floating island, at its root node.
  for (let i = 0; i < n; i++) {
    if (c.floating[i] === 1 && c.parent[i] === i) G[i * n + i] = (G[i * n + i] ?? 0) + MNA_LEAK_S;
  }

  // Pin ground at 0 V: its row becomes V_g = 0 and its column drops out.
  const gnd = c.groundNode;
  for (let k = 0; k < n; k++) {
    G[gnd * n + k] = 0;
    G[k * n + gnd] = 0;
  }
  G[gnd * n + gnd] = 1;
  J[gnd] = 0;

  // Forward elimination with partial pivoting.
  for (let col = 0; col < n; col++) {
    let piv = col;
    let best = Math.abs(G[col * n + col] ?? 0);
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(G[r * n + col] ?? 0);
      if (v > best) {
        best = v;
        piv = r;
      }
    }
    if (best < 1e-300) continue; // cannot happen with the leak guard; skip rather than divide by 0
    if (piv !== col) {
      for (let k = 0; k < n; k++) {
        const t = G[col * n + k] ?? 0;
        G[col * n + k] = G[piv * n + k] ?? 0;
        G[piv * n + k] = t;
      }
      const t = J[col] ?? 0;
      J[col] = J[piv] ?? 0;
      J[piv] = t;
    }
    const d = G[col * n + col] ?? 1;
    for (let r = col + 1; r < n; r++) {
      const f = (G[r * n + col] ?? 0) / d;
      if (f === 0) continue;
      for (let k = col; k < n; k++) G[r * n + k] = (G[r * n + k] ?? 0) - f * (G[col * n + k] ?? 0);
      J[r] = (J[r] ?? 0) - f * (J[col] ?? 0);
    }
  }
  // Back substitution.
  for (let r = n - 1; r >= 0; r--) {
    let sum = J[r] ?? 0;
    for (let k = r + 1; k < n; k++) sum -= (G[r * n + k] ?? 0) * (V[k] ?? 0);
    const d = G[r * n + r] ?? 0;
    V[r] = Math.abs(d) < 1e-300 ? 0 : sum / d;
  }

  for (let e = 0; e < c.count; e++) {
    const a = c.a[e] ?? 0;
    const b = c.b[e] ?? 0;
    c.currentA[e] =
      a === b ? 0 : ((V[a] ?? 0) - (V[b] ?? 0) - (c.emfV[e] ?? 0)) / (c.ohm[e] ?? MNA_MIN_OHM);
  }
}
