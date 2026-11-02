import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ConclusionCard, type ConclusionCardProps } from "./ConclusionCard";

function findByTestId(
  node: ReactNode,
  testId: string,
): ReactElement<Record<string, unknown>> | null {
  if (!isValidElement(node)) return null;
  const props = node.props as Record<string, unknown>;
  if (props["data-testid"] === testId) {
    return node as ReactElement<Record<string, unknown>>;
  }
  const children = props.children as ReactNode;
  if (Array.isArray(children)) {
    for (const child of children) {
      const found = findByTestId(child, testId);
      if (found) return found;
    }
  } else if (children) {
    return findByTestId(children, testId);
  }
  return null;
}

describe("ConclusionCard", () => {
  const sampleProps: ConclusionCardProps = {
    title: "Ohm's Law Verified",
    lines: [
      "The potential difference V is directly proportional to the current I at constant temperature.",
      "The straight line through the origin confirms Ohm's law for wire XY.",
      "The slope ΔV/ΔI gives the resistance of the wire XY in ohms.",
    ],
    onReplay: () => {},
    onHome: () => {},
  };

  it("renders the conclusion card, title, sentence lines and both action buttons", () => {
    const html = renderToStaticMarkup(createElement(ConclusionCard, sampleProps));
    expect(html).toContain('data-testid="conclusion"');
    expect(html).toContain("Ohm&#x27;s Law Verified");
    for (const line of sampleProps.lines) {
      expect(html).toContain(line.replaceAll("'", "&#x27;"));
    }
    expect(html).toContain('data-testid="conclusion-replay"');
    expect(html).toContain('data-testid="conclusion-home"');
  });

  it("invokes onReplay and onHome when Replay and Home buttons are clicked", () => {
    const onReplay = vi.fn();
    const onHome = vi.fn();
    const tree = ConclusionCard({ ...sampleProps, onReplay, onHome });

    const replayBtn = findByTestId(tree, "conclusion-replay");
    const homeBtn = findByTestId(tree, "conclusion-home");

    if (!replayBtn || !homeBtn) throw new Error("buttons not found");

    (replayBtn.props.onClick as () => void)();
    expect(onReplay).toHaveBeenCalledTimes(1);
    expect(onHome).not.toHaveBeenCalled();

    (homeBtn.props.onClick as () => void)();
    expect(onHome).toHaveBeenCalledTimes(1);
  });
});
