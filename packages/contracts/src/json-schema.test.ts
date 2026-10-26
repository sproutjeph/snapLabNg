import { describe, expect, it } from "vitest";
import { blueprintJsonSchema, readingsJsonSchema } from "./json-schema";

type Node = Record<string, unknown>;

/** Visit every schema node: properties, items, anyOf, and $ref into $defs. */
function walk(root: Node, visit: (n: Node) => void): void {
  const defs = (root.$defs ?? {}) as Record<string, Node>;
  const seen = new Set<Node>();
  const go = (n: unknown): void => {
    if (!n || typeof n !== "object") return;
    let node = n as Node;
    if (typeof node.$ref === "string") {
      const target = defs[node.$ref.replace("#/$defs/", "")];
      if (!target) throw new Error(`unresolved $ref ${node.$ref}`);
      node = target;
    }
    if (seen.has(node)) return;
    seen.add(node);
    visit(node);
    for (const p of Object.values((node.properties ?? {}) as Record<string, Node>)) go(p);
    go(node.items);
    go(node.additionalProperties);
    go(node.not);
    for (const key of ["anyOf", "allOf", "oneOf", "prefixItems"]) {
      for (const b of (node[key] ?? []) as Node[]) go(b);
    }
  };
  go(root);
}

const isObject = (n: Node) => n.type === "object" || n.properties !== undefined;
const schemas = [
  ["blueprint", blueprintJsonSchema],
  ["readings", readingsJsonSchema],
] as const;

describe("emitted JSON Schema", () => {
  it("sets additionalProperties: false on every object in both schemas", () => {
    for (const [, s] of schemas) {
      let count = 0;
      walk(s as Node, (n) => {
        if (!isObject(n)) return;
        count++;
        expect(n.additionalProperties).toBe(false);
      });
      expect(count).toBeGreaterThan(1);
    }
  });

  it("lists every property in required on every object in both schemas", () => {
    for (const [, s] of schemas) {
      walk(s as Node, (n) => {
        if (!isObject(n)) return;
        const keys = Object.keys((n.properties ?? {}) as object).sort();
        expect([...((n.required ?? []) as string[])].sort()).toEqual(keys);
      });
    }
  });

  it("puts experiment as the first property of the blueprint schema", () => {
    const props = (blueprintJsonSchema as Node).properties as object;
    expect(Object.keys(props)[0]).toBe("experiment");
  });

  it("has an object (not anyOf) at the root of both schemas", () => {
    for (const [, s] of schemas) {
      expect((s as Node).type).toBe("object");
      expect((s as Node).anyOf).toBeUndefined();
    }
  });

  it("emits the experiment enum as meter_bridge, titration, glass_block, unknown", () => {
    const props = (blueprintJsonSchema as Node).properties as Record<string, Node>;
    expect(props.experiment?.enum).toEqual(["meter_bridge", "titration", "glass_block", "unknown"]);
  });
});
