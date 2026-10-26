export function Desk() {
  return (
    <mesh position={[0, -0.15, 0]} receiveShadow>
      <boxGeometry args={[8, 0.3, 5]} />
      <meshStandardMaterial color="#7a5232" roughness={0.7} />
    </mesh>
  );
}
