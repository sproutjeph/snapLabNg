export function InkStroke() {
  return (
    <mesh position={[0.1, 0.02, -0.3]} rotation={[-Math.PI / 2, 0, 0.03]}>
      <planeGeometry args={[1.5, 0.04]} />
      <meshBasicMaterial color={[0.4, 1.6, 2.4]} toneMapped={false} />
    </mesh>
  );
}
