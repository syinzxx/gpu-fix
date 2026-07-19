"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import type { Group } from "three";

const FAN_BLADES = 9;

function Fan({
  position,
  animated,
}: {
  position: [number, number, number];
  animated: boolean;
}) {
  const blades = useRef<Group>(null);

  useFrame((_, delta) => {
    if (animated && blades.current) blades.current.rotation.y -= delta * 8;
  });

  return (
    <group position={position}>
      {/* Outer ring with a faint cyan glow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.44, 0.035, 12, 48]} />
        <meshStandardMaterial
          color="#1e293b"
          emissive="#22d3ee"
          emissiveIntensity={0.35}
          metalness={0.6}
          roughness={0.35}
        />
      </mesh>
      {/* Hub */}
      <mesh>
        <cylinderGeometry args={[0.13, 0.13, 0.07, 24]} />
        <meshStandardMaterial color="#0b1120" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Blades */}
      <group ref={blades}>
        {Array.from({ length: FAN_BLADES }, (_, i) => {
          const angle = (i / FAN_BLADES) * Math.PI * 2;
          return (
            <group key={i} rotation={[0, angle, 0]}>
              <mesh position={[0.26, 0, 0]} rotation={[0, 0.55, 0.28]}>
                <boxGeometry args={[0.34, 0.015, 0.13]} />
                <meshStandardMaterial
                  color="#111c33"
                  metalness={0.3}
                  roughness={0.5}
                />
              </mesh>
            </group>
          );
        })}
      </group>
    </group>
  );
}

function GpuCard({ animated }: { animated: boolean }) {
  const group = useRef<Group>(null);

  useFrame((state, delta) => {
    const g = group.current;
    if (!g || !animated) return;
    const t = state.clock.elapsedTime;
    // Gentle float + idle sway, nudged toward the mouse position. The sway and
    // pointer ranges are kept small enough that the card never leaves the
    // camera frustum at scale 1.2 with the camera at z=5.2.
    g.position.y = Math.sin(t * 0.8) * 0.06;
    const targetY = -0.55 + Math.sin(t * 0.25) * 0.12 + state.pointer.x * 0.18;
    const targetX = 0.5 - state.pointer.y * 0.15;
    const ease = Math.min(1, delta * 3);
    g.rotation.y += (targetY - g.rotation.y) * ease;
    g.rotation.x += (targetX - g.rotation.x) * ease;
  });

  const fins = Array.from({ length: 13 }, (_, i) => -1.3 + i * 0.217);

  return (
    <group ref={group} rotation={[0.5, -0.55, 0]} scale={1.2}>
      {/* PCB */}
      <mesh>
        <boxGeometry args={[3.2, 0.07, 1.6]} />
        <meshStandardMaterial color="#131c31" metalness={0.4} roughness={0.6} />
      </mesh>
      {/* Backplate */}
      <mesh position={[0, -0.055, 0]}>
        <boxGeometry args={[3.1, 0.035, 1.55]} />
        <meshStandardMaterial color="#26334d" metalness={0.8} roughness={0.35} />
      </mesh>
      {/* Heatsink fins between PCB and shroud */}
      {fins.map((x) => (
        <mesh key={x} position={[x, 0.14, 0]}>
          <boxGeometry args={[0.05, 0.2, 1.5]} />
          <meshStandardMaterial
            color="#3b4a66"
            metalness={0.9}
            roughness={0.3}
          />
        </mesh>
      ))}
      {/* Fan shroud */}
      <mesh position={[0, 0.27, 0]}>
        <boxGeometry args={[3.15, 0.1, 1.58]} />
        <meshStandardMaterial color="#1b2540" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Fans */}
      <Fan position={[-0.72, 0.33, 0]} animated={animated} />
      <Fan position={[0.72, 0.33, 0]} animated={animated} />
      {/* RGB accent strip along the front edge */}
      <mesh position={[0, 0.3, -0.82]}>
        <boxGeometry args={[2.9, 0.045, 0.045]} />
        <meshStandardMaterial
          color="#8b5cf6"
          emissive="#8b5cf6"
          emissiveIntensity={2.2}
          toneMapped={false}
        />
      </mesh>
      {/* Gold PCIe edge connector on the rear edge */}
      <mesh position={[-0.4, -0.05, 0.84]}>
        <boxGeometry args={[1.7, 0.06, 0.1]} />
        <meshStandardMaterial color="#d4a437" metalness={1} roughness={0.25} />
      </mesh>
      {/* I/O bracket */}
      <mesh position={[-1.62, 0.1, 0]}>
        <boxGeometry args={[0.05, 0.42, 1.55]} />
        <meshStandardMaterial color="#8fa3c4" metalness={0.9} roughness={0.3} />
      </mesh>
      {/* Power connector nub */}
      <mesh position={[1.05, 0.35, 0.55]}>
        <boxGeometry args={[0.35, 0.12, 0.2]} />
        <meshStandardMaterial color="#0b1120" roughness={0.6} />
      </mesh>
    </group>
  );
}

export default function GpuScene({ animated }: { animated: boolean }) {
  return (
    <Canvas
      camera={{ position: [0, 1.1, 5.5], fov: 40 }}
      onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
      frameloop={animated ? "always" : "demand"}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      aria-hidden
    >
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 6, 3]} intensity={1.6} />
      <pointLight position={[-3, 2.5, -2]} color="#8b5cf6" intensity={35} />
      <pointLight position={[3, -1, 2.5]} color="#22d3ee" intensity={25} />
      <GpuCard animated={animated} />
      <ContactShadows
        position={[0, -1.15, 0]}
        opacity={0.45}
        scale={7}
        blur={2.6}
        far={2.5}
        color="#000000"
      />
    </Canvas>
  );
}
