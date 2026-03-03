"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type SignaturePadProps = {
  width?: number;
  height?: number;
  onSave: (base64DataUrl: string) => void;
  onCancel?: () => void;
};

export function SignaturePad({
  width = 480,
  height = 180,
  onSave,
  onCancel,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hasStroke, setHasStroke] = useState(false);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111827";
  }, []);

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const draw = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const point = getPoint(e);
    if (!point) return;
    isDrawingRef.current = true;
    lastPointRef.current = point;
    setHasStroke(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const point = getPoint(e);
    const last = lastPointRef.current;
    if (!point || !last) return;
    draw(last, point);
    lastPointRef.current = point;
  };

  const handlePointerUp = () => {
    isDrawingRef.current = false;
    lastPointRef.current = null;
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStroke(false);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasStroke) return;
    const dataUrl = canvas.toDataURL("image/png");
    onSave(dataUrl);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] p-2">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="h-[180px] w-full touch-none rounded-[10px] bg-white"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="drainer-button drainer-button-ghost h-10 px-4 text-xs"
          onClick={handleClear}
        >
          Clear
        </Button>
        <Button
          type="button"
          size="sm"
          className="drainer-button drainer-button-primary h-10 px-4 text-xs"
          onClick={handleSave}
          disabled={!hasStroke}
        >
          Save
        </Button>
        {onCancel ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="drainer-button drainer-button-ghost h-10 px-4 text-xs"
            onClick={onCancel}
          >
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function SignaturePreview({
  dataUrl,
  height = 80,
}: {
  dataUrl: string | null;
  height?: number;
}) {
  if (!dataUrl) return null;
  return (
    <img
      src={dataUrl}
      alt="Signature"
      className="rounded-[10px] border border-[var(--border)] bg-white object-contain"
      style={{ height }}
    />
  );
}
