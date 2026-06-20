import React, { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  size: number;
  color: string;
}

const COLORS = ["#E7C067", "#F5D27A", "#5BD6A0", "#D7263D", "#7CB8E8", "#FFFFFF"];

/** Lightweight canvas confetti burst. Renders nothing if reduced motion is preferred. */
export const Confetti: React.FC<{ active: boolean; durationMs?: number }> = ({
  active,
  durationMs = 3500,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = (canvas.width = window.innerWidth * dpr);
    const H = (canvas.height = window.innerHeight * dpr);

    const count = 140;
    const particles: Particle[] = Array.from({ length: count }, () => ({
      x: Math.random() * W,
      y: -Math.random() * H * 0.4,
      vx: (Math.random() - 0.5) * 2.4 * dpr,
      vy: (2 + Math.random() * 3.5) * dpr,
      rot: Math.random() * Math.PI,
      vrot: (Math.random() - 0.5) * 0.3,
      size: (5 + Math.random() * 6) * dpr,
      color: COLORS[(Math.random() * COLORS.length) | 0]!,
    }));

    const start = performance.now();
    let raf = 0;
    const draw = (now: number) => {
      const elapsed = now - start;
      ctx.clearRect(0, 0, W, H);
      const fade = Math.max(0, 1 - Math.max(0, elapsed - durationMs * 0.6) / (durationMs * 0.4));
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.03 * dpr;
        p.rot += p.vrot;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
      if (elapsed < durationMs) {
        raf = requestAnimationFrame(draw);
      } else {
        ctx.clearRect(0, 0, W, H);
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [active, durationMs]);

  if (!active) return null;
  return <canvas ref={canvasRef} className="confetti-canvas" aria-hidden="true" />;
};
