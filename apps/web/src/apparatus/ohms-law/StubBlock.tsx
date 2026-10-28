// A plain block standing in for a part until its apparatus slice models it (Wave 0 only).
export function StubBlock({
  size,
  colour,
}: {
  size: readonly [number, number, number];
  colour: string;
}) {
  return (
    <mesh position-y={size[1] / 2} castShadow receiveShadow>
      <boxGeometry args={[size[0], size[1], size[2]]} />
      <meshStandardMaterial color={colour} roughness={0.85} />
    </mesh>
  );
}
