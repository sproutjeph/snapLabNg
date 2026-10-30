import type { IdentifyCard } from "../types";
import { IconClose } from "./icons";

/**
 * The Identify card: name, symbol (in words), what it does, how to use it, the usual mistake.
 * `bare` is the body alone, for a sheet that has its own heading and close button (a phone).
 */
export default function IdentifyFrame({
  card,
  onClose,
  bare,
}: {
  card: IdentifyCard;
  onClose(): void;
  bare?: boolean;
}) {
  const body = (
    <>
      <h2 className="sh-identify-name">{card.name}</h2>
      <p className="sh-identify-symbol">
        <span className="sh-label">Symbol</span>
        <span>{card.symbol}</span>
      </p>
      <dl className="sh-facts">
        <div>
          <dt className="sh-label">What it does</dt>
          <dd>{card.whatItDoes}</dd>
        </div>
        <div>
          <dt className="sh-label">How to use it</dt>
          <dd>{card.howToUse}</dd>
        </div>
        <div className="sh-fact-mistake">
          <dt className="sh-label">Common WAEC mistake</dt>
          <dd>{card.commonMistake}</dd>
        </div>
      </dl>
    </>
  );
  if (bare) return <div className="sh-identify">{body}</div>;
  return (
    <section className="sh-card sh-identify" aria-label={`Identify: ${card.name}`}>
      <div className="sh-card-head">
        <span className="sh-label">Identify</span>
        <button
          type="button"
          className="sh-icon-btn"
          aria-label="Close identify card"
          onClick={onClose}
        >
          <IconClose />
        </button>
      </div>
      <div className="sh-card-body">{body}</div>
    </section>
  );
}
