// STUB (Wave 0): ?look=ohms-law|meter-bridge. W1-look fills this in.
export default function LookPreview() {
  const which = new URLSearchParams(location.search).get("look");
  return <p>look preview: {which === "meter-bridge" ? "meter-bridge" : "ohms-law"}</p>;
}
