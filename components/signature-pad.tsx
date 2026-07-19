"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Button } from "@/components/ui";

/**
 * Small canvas signature pad. Draws with mouse or touch (via the unified
 * Pointer Events API), and writes a PNG data URL into a hidden input on
 * every stroke end so it rides along with the surrounding <form> as a plain
 * field. Degrades gracefully: if nothing is drawn, the hidden input stays
 * empty and the server treats that as "no signature".
 */
export function SignaturePad({ name = "intakeSignature" }: { name?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [hasSignature, setHasSignature] = useState(false);

  function getPoint(e: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    lastPointRef.current = getPoint(e);
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !lastPointRef.current) return;
    const point = getPoint(e);
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPointRef.current = point;
  }

  function commitStroke() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    const canvas = canvasRef.current;
    if (!canvas || !inputRef.current) return;
    inputRef.current.value = canvas.toDataURL("image/png");
    setHasSignature(true);
  }

  function handleClear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (inputRef.current) inputRef.current.value = "";
    setHasSignature(false);
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={500}
        height={180}
        className="w-full touch-none rounded-lg bg-slate-50 ring-1 ring-slate-200"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={commitStroke}
        onPointerLeave={commitStroke}
      />
      <input ref={inputRef} type="hidden" name={name} />
      <div className="mt-2 flex items-center justify-between">
        <p className="text-xs text-slate-400">
          {hasSignature ? "Signature captured" : "Sign above with mouse or finger"}
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={handleClear}>
          Clear
        </Button>
      </div>
    </div>
  );
}
