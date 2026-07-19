"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// The WebGL scene is heavy (~three.js), so it only loads in the browser after
// the page is interactive. Until then — and wherever WebGL isn't available —
// we show the ambient-glow fallback.
const GpuScene = dynamic(() => import("./gpu-scene"), {
  ssr: false,
  loading: () => <HeroGlow />,
});

function HeroGlow() {
  return (
    <div aria-hidden className="relative h-full w-full">
      <div className="absolute left-1/2 top-1/2 h-[55%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/25 blur-[90px]" />
      <div className="absolute left-1/3 top-2/3 h-[35%] w-[45%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/20 blur-[80px]" />
    </div>
  );
}

function supportsWebgl(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext("webgl2") || canvas.getContext("webgl"))
    );
  } catch {
    return false;
  }
}

export default function GpuHero() {
  const [env, setEnv] = useState<{ webgl: boolean; animated: boolean } | null>(
    null
  );

  useEffect(() => {
    setEnv({
      webgl: supportsWebgl(),
      animated: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    });
  }, []);

  if (!env || !env.webgl) return <HeroGlow />;
  return <GpuScene animated={env.animated} />;
}
