import type { ResultsProps } from "./types";

// STUB (Wave 0): the results screen arrives in W1-paper.
export function Results({ sheet }: ResultsProps) {
  return (
    <p>
      {sheet.earned} / {sheet.available}
    </p>
  );
}
