"use client";

import { Suspense, useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, useTexture } from "@react-three/drei";
import {
  CatmullRomCurve3,
  Color,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  MathUtils,
  MeshStandardMaterial,
  Object3D,
  Path,
  PointLight,
  SRGBColorSpace,
  Shape,
  TubeGeometry,
  Vector3,
} from "three";

/*
 * A triple-fan graphics card, modelled loosely on modern 2.5-slot designs.
 * Card space: X = length (bracket at -X), Y = up (fans face +Y),
 * Z = height (-Z is the top edge with the RGB strip and power plug,
 * +Z is the PCIe edge).
 */

const FAN_X = [-1.04, 0, 1.04];
const FAN_R = 0.47;
const SHROUD_Y = 0.27;
const BLADES = 9;

// Shared mutable motion state, written by the card and read by the fans.
type Motion = { speed: number; hover: boolean; start: number };

const BRAND_BLUE = new Color("#1565C0");
const BRAND_CYAN = new Color("#29B6F6");
const WHITE = new Color("#ffffff");

/* ── geometry builders ─────────────────────────────────────────── */

// Shape coordinates (x, y) map to card (x, -z) once rotated flat.
function shroudGeometry() {
  const s = new Shape();
  s.moveTo(-1.58, -0.6);
  s.lineTo(-1.42, -0.69);
  s.lineTo(1.42, -0.69);
  s.lineTo(1.64, -0.52);
  s.lineTo(1.64, 0.46);
  s.lineTo(1.5, 0.69);
  s.lineTo(-0.2, 0.69);
  s.lineTo(-0.3, 0.62);
  s.lineTo(-1.5, 0.62);
  s.lineTo(-1.62, 0.5);
  s.closePath();
  for (const x of FAN_X) {
    const hole = new Path();
    hole.absarc(x, 0, FAN_R, 0, Math.PI * 2, true);
    s.holes.push(hole);
  }
  return new ExtrudeGeometry(s, {
    depth: 0.08,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.022,
    bevelSegments: 3,
    curveSegments: 64,
  });
}

// Angular trim pieces between the fans and along the edges.
function trimGeometry() {
  const piece = (pts: [number, number][]) => {
    const p = new Shape();
    p.moveTo(...pts[0]);
    pts.slice(1).forEach((pt) => p.lineTo(...pt));
    p.closePath();
    return p;
  };
  const shapes = [
    piece([[-0.56, 0.5], [-0.48, 0.5], [-0.44, 0.0], [-0.48, -0.5], [-0.56, -0.5], [-0.6, 0.0]]),
    piece([[0.48, 0.5], [0.56, 0.5], [0.6, 0.0], [0.56, -0.5], [0.48, -0.5], [0.44, 0.0]]),
    piece([[1.52, 0.4], [1.58, 0.36], [1.58, -0.4], [1.52, -0.46]]),
    piece([[-1.4, 0.53], [-0.36, 0.53], [-0.4, 0.5], [-1.37, 0.5]]),
  ];
  return new ExtrudeGeometry(shapes, { depth: 0.012, bevelEnabled: false });
}

function bladeGeometry() {
  const s = new Shape();
  s.moveTo(0.1, -0.045);
  s.quadraticCurveTo(0.27, -0.13, 0.43, -0.07);
  s.lineTo(0.435, 0.05);
  s.quadraticCurveTo(0.28, 0.0, 0.1, 0.05);
  s.closePath();
  return new ExtrudeGeometry(s, {
    depth: 0.006,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 1,
    curveSegments: 16,
  });
}

function bracketGeometry() {
  // Drawn in (z, y); vent cut-outs in a staggered hex pattern.
  const s = new Shape();
  s.moveTo(-0.68, -0.08);
  s.lineTo(0.68, -0.08);
  s.lineTo(0.68, 0.5);
  s.lineTo(-0.68, 0.5);
  s.closePath();
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 6; col++) {
      const z = 0.12 + col * 0.09 + (row % 2) * 0.045;
      const y = 0.06 + row * 0.08;
      if (z > 0.62) continue;
      const h = new Path();
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const px = z + Math.cos(a) * 0.032;
        const py = y + Math.sin(a) * 0.032;
        if (k === 0) h.moveTo(px, py);
        else h.lineTo(px, py);
      }
      h.closePath();
      s.holes.push(h);
    }
  }
  return new ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false });
}

function heatpipeGeometries() {
  return [0.11, 0.155, 0.2, 0.245].map((y, i) => {
    const inset = i * 0.08;
    const curve = new CatmullRomCurve3([
      new Vector3(-0.9 + inset, y, 0.05),
      new Vector3(-1.22 + inset, y, -0.3),
      new Vector3(-1.05 + inset, y, -0.62),
      new Vector3(1.05 - inset, y, -0.62),
      new Vector3(1.22 - inset, y, -0.3),
      new Vector3(0.9 - inset, y, 0.05),
    ]);
    return new TubeGeometry(curve, 96, 0.024, 12, false);
  });
}

/* ── parts ─────────────────────────────────────────────────────── */

function Fan({ x, motion, phase }: { x: number; motion: React.RefObject<Motion>; phase: number }) {
  const rotor = useRef<Group>(null);
  const blur = useRef<MeshStandardMaterial>(null);
  const ring = useRef<MeshStandardMaterial>(null);
  const blade = useMemo(() => bladeGeometry(), []);
  const logo = useTexture("/logo.svg", (tex) => {
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = 8;
  });

  useFrame((state, delta) => {
    const m = motion.current;
    if (!rotor.current || !m) return;
    rotor.current.rotation.y -= m.speed * delta;
    const k = MathUtils.clamp(m.speed / 30, 0, 1);
    if (blur.current) blur.current.opacity = 0.05 + k * 0.4;
    if (ring.current) {
      const t = state.clock.elapsedTime;
      ring.current.emissiveIntensity = 0.6 + 0.5 * Math.sin(t * 2 + phase) + k * 0.8;
    }
  });

  return (
    <group position={[x, SHROUD_Y + 0.02, 0]}>
      {/* Static frame lip inside the shroud cut-out */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[FAN_R - 0.008, 0.018, 12, 96]} />
        <meshStandardMaterial color="#0c121d" metalness={0.7} roughness={0.35} />
      </mesh>
      {/* Support struts behind the rotor */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[0, -0.06, 0]} rotation={[0, (i * Math.PI) / 2 + 0.4, 0]}>
          <boxGeometry args={[0.92, 0.012, 0.025]} />
          <meshStandardMaterial color="#0c121d" roughness={0.6} />
        </mesh>
      ))}

      <group ref={rotor}>
        {Array.from({ length: BLADES }, (_, i) => (
          <group key={i} rotation={[0, (i / BLADES) * Math.PI * 2, 0]}>
            <mesh geometry={blade} rotation={[-Math.PI / 2 + 0.42, 0, 0]}>
              <meshPhysicalMaterial
                color="#141b28"
                metalness={0.15}
                roughness={0.38}
                clearcoat={0.6}
                clearcoatRoughness={0.3}
                side={DoubleSide}
              />
            </mesh>
          </group>
        ))}
        {/* Blade tip ring (axial-tech style) with a soft cyan edge glow */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.437, 0.011, 8, 96]} />
          <meshStandardMaterial
            ref={ring}
            color="#0e1a2c"
            emissive={BRAND_CYAN}
            emissiveIntensity={0.8}
            metalness={0.4}
            roughness={0.3}
          />
        </mesh>
        {/* Hub + logo cap */}
        <mesh position={[0, -0.005, 0]}>
          <cylinderGeometry args={[0.115, 0.125, 0.05, 48]} />
          <meshStandardMaterial color="#0b0f17" metalness={0.6} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.022, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.105, 48]} />
          <meshStandardMaterial map={logo} metalness={0.2} roughness={0.4} />
        </mesh>
      </group>

      {/* Motion-blur disc that thickens as the fan speeds up */}
      <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.125, 0.43, 64]} />
        <meshStandardMaterial
          ref={blur}
          color="#101826"
          transparent
          opacity={0.05}
          depthWrite={false}
          roughness={0.5}
        />
      </mesh>
    </group>
  );
}

function FinStack() {
  const ref = useRef<InstancedMesh>(null);
  const count = 84;
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new Object3D();
    for (let i = 0; i < count; i++) {
      o.position.set(-1.52 + (i / (count - 1)) * 3.04, 0.155, -0.02);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <boxGeometry args={[0.01, 0.2, 1.16]} />
      <meshStandardMaterial color="#b9c3d1" metalness={0.95} roughness={0.28} />
    </instancedMesh>
  );
}

function RgbStrip({ animated }: { animated: boolean }) {
  const ref = useRef<InstancedMesh>(null);
  const count = 34;
  const c = useMemo(() => new Color(), []);

  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new Object3D();
    for (let i = 0; i < count; i++) {
      o.position.set(-1.38 + i * 0.062, 0, 0);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, BRAND_BLUE);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, []);

  useFrame((state) => {
    const m = ref.current;
    if (!m || !animated) return;
    const t = state.clock.elapsedTime;
    const head = ((t * 0.55) % 1.4) * count; // chase head, with a pause between laps
    for (let i = 0; i < count; i++) {
      const d = head - i;
      const k = d >= 0 && d < 9 ? 1 - d / 9 : 0;
      c.copy(BRAND_BLUE).lerp(BRAND_CYAN, Math.min(1, k * 1.4)).lerp(WHITE, Math.max(0, k - 0.7) * 2);
      c.multiplyScalar(1.2 + k * 1.8);
      m.setColorAt(i, c);
    }
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} position={[0, SHROUD_Y + 0.072, -0.59]}>
      <boxGeometry args={[0.05, 0.012, 0.035]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

function PowerPlug() {
  // 12VHPWR: 12 power pins + 4 sense pins, latch on top.
  return (
    <group position={[1.12, 0.12, -0.66]}>
      <mesh>
        <boxGeometry args={[0.34, 0.11, 0.1]} />
        <meshStandardMaterial color="#05070b" roughness={0.6} />
      </mesh>
      {Array.from({ length: 12 }, (_, i) => (
        <mesh key={i} position={[-0.135 + (i % 6) * 0.054, -0.015 + Math.floor(i / 6) * 0.04, -0.051]}>
          <boxGeometry args={[0.034, 0.028, 0.004]} />
          <meshStandardMaterial color="#d4a437" metalness={1} roughness={0.3} />
        </mesh>
      ))}
      <mesh position={[0, 0.062, 0]}>
        <boxGeometry args={[0.1, 0.014, 0.06]} />
        <meshStandardMaterial color="#05070b" roughness={0.5} />
      </mesh>
    </group>
  );
}

function GoldFingers() {
  const ref = useRef<InstancedMesh>(null);
  const xs = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < 46; i++) {
      const x = -1.42 + i * 0.038;
      if (x > -1.17 && x < -1.11) continue; // PCIe key notch
      out.push(x);
    }
    return out;
  }, []);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new Object3D();
    xs.forEach((x, i) => {
      o.position.set(x, 0.0, 0.645);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [xs]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, xs.length]}>
      <boxGeometry args={[0.024, 0.052, 0.09]} />
      <meshStandardMaterial color="#d9ab3c" metalness={1} roughness={0.22} />
    </instancedMesh>
  );
}

/* ── the card ──────────────────────────────────────────────────── */

function GpuCard({ animated }: { animated: boolean }) {
  const group = useRef<Group>(null);
  const motion = useRef<Motion>({ speed: 0, hover: false, start: -1 });
  const shroud = useMemo(() => shroudGeometry(), []);
  const trim = useMemo(() => trimGeometry(), []);
  const bracket = useMemo(() => bracketGeometry(), []);
  const pipes = useMemo(() => heatpipeGeometries(), []);

  useFrame((state, delta) => {
    const g = group.current;
    const m = motion.current;
    if (!g || !animated) return;
    const t = state.clock.elapsedTime;
    if (m.start < 0) m.start = t;
    const age = t - m.start;

    // Entrance: rise in from below with a half-turn, easing out over 1.8s.
    const p = MathUtils.clamp(age / 1.8, 0, 1);
    const e = 1 - Math.pow(1 - p, 3);

    // Fans: spin up after the entrance, turbo while the pointer is over the card.
    const target = age < 0.6 ? 0 : m.hover ? 34 : 15;
    m.speed += (target - m.speed) * Math.min(1, delta * (target > m.speed ? 0.9 : 1.6));

    g.position.y = (1 - e) * -1.4 + Math.sin(t * 0.8) * 0.05 * e;
    g.scale.setScalar(1.05 + 0.15 * e);
    const targetY = -0.55 + Math.sin(t * 0.25) * 0.12 + state.pointer.x * 0.2 + (1 - e) * 2.2;
    const targetX = 0.5 - state.pointer.y * 0.15 + (1 - e) * 0.5;
    const ease = p < 1 ? 1 : Math.min(1, delta * 3);
    g.rotation.y += (targetY - g.rotation.y) * ease;
    g.rotation.x += (targetX - g.rotation.x) * ease;
  });

  return (
    <group
      ref={group}
      rotation={[0.5, -0.55, 0]}
      scale={1.2}
      onPointerOver={() => (motion.current.hover = true)}
      onPointerOut={() => (motion.current.hover = false)}
    >
      {/* Backplate: brushed dark aluminium with an inset accent line */}
      <mesh position={[0, -0.045, -0.055]}>
        <boxGeometry args={[3.26, 0.026, 1.27]} />
        <meshStandardMaterial color="#1c2431" metalness={0.85} roughness={0.42} />
      </mesh>
      <mesh position={[0.2, -0.06, 0.45]}>
        <boxGeometry args={[2.2, 0.006, 0.02]} />
        <meshBasicMaterial color={BRAND_CYAN} toneMapped={false} />
      </mesh>

      {/* PCB */}
      <mesh position={[0, -0.012, 0]}>
        <boxGeometry args={[3.2, 0.04, 1.26]} />
        <meshStandardMaterial color="#0a0e14" roughness={0.65} metalness={0.2} />
      </mesh>
      <GoldFingers />

      {/* Cooler internals */}
      <mesh position={[0, 0.05, -0.02]}>
        <boxGeometry args={[3.1, 0.03, 1.2]} />
        <meshStandardMaterial color="#8d97a6" metalness={0.9} roughness={0.35} />
      </mesh>
      <FinStack />
      {pipes.map((geo, i) => (
        <mesh key={i} geometry={geo}>
          <meshStandardMaterial color="#c8794a" metalness={1} roughness={0.22} />
        </mesh>
      ))}

      {/* Shroud */}
      <mesh geometry={shroud} rotation={[-Math.PI / 2, 0, 0]} position={[0, SHROUD_Y - 0.04, 0]}>
        <meshPhysicalMaterial
          color="#141a24"
          metalness={0.6}
          roughness={0.36}
          clearcoat={1}
          clearcoatRoughness={0.18}
        />
      </mesh>
      <mesh geometry={trim} rotation={[-Math.PI / 2, 0, 0]} position={[0, SHROUD_Y + 0.066, 0]}>
        <meshStandardMaterial color="#7d8a9c" metalness={1} roughness={0.28} />
      </mesh>
      <RgbStrip animated={animated} />

      {/* Fans */}
      <Suspense fallback={null}>
        {FAN_X.map((x, i) => (
          <Fan key={x} x={x} motion={motion} phase={i * 1.3} />
        ))}
      </Suspense>

      <PowerPlug />

      {/* I/O bracket with 3× DisplayPort + 1× HDMI */}
      <mesh geometry={bracket} rotation={[0, -Math.PI / 2, 0]} position={[-1.63, -0.04, 0]}>
        <meshStandardMaterial color="#aeb8c6" metalness={0.95} roughness={0.3} />
      </mesh>
      {[-0.52, -0.3, -0.08].map((z) => (
        <mesh key={z} position={[-1.645, 0.06, z]}>
          <boxGeometry args={[0.03, 0.07, 0.17]} />
          <meshStandardMaterial color="#05070b" roughness={0.7} />
        </mesh>
      ))}
      <mesh position={[-1.645, 0.06, 0.03]}>
        <boxGeometry args={[0.03, 0.06, 0.13]} />
        <meshStandardMaterial color="#05070b" roughness={0.7} />
      </mesh>
    </group>
  );
}

function SweepLight({ animated }: { animated: boolean }) {
  const ref = useRef<PointLight>(null);
  useFrame((state) => {
    if (!ref.current || !animated) return;
    const t = state.clock.elapsedTime;
    ref.current.position.set(Math.sin(t * 0.5) * 3.2, 2.2, 1.8 + Math.cos(t * 0.5) * 0.6);
  });
  return <pointLight ref={ref} position={[2, 2.2, 2]} color="#cfe8ff" intensity={14} distance={9} />;
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
      {/* Studio reflections built from local light panels (no HDR download) */}
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2.2} position={[0, 5, -2]} rotation-x={Math.PI / 2} scale={[8, 3, 1]} />
        <Lightformer form="rect" intensity={1.4} color="#90CAF9" position={[-5, 1, 1]} rotation-y={Math.PI / 2} scale={[4, 2, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#1565C0" position={[5, 0, -1]} rotation-y={-Math.PI / 2} scale={[4, 3, 1]} />
        <Lightformer form="ring" intensity={1.5} color="#29B6F6" position={[0, 1, 5]} scale={2} />
      </Environment>
      <ambientLight intensity={0.25} />
      <directionalLight position={[4, 6, 3]} intensity={1.4} />
      <pointLight position={[-3, 2.5, -2]} color="#1565C0" intensity={30} />
      <pointLight position={[3, -1, 2.5]} color="#29B6F6" intensity={18} />
      <SweepLight animated={animated} />
      <GpuCard animated={animated} />
      <ContactShadows position={[0, -1.15, 0]} opacity={0.5} scale={7} blur={2.6} far={2.5} color="#000000" />
    </Canvas>
  );
}

