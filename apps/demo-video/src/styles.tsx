import { interpolate } from "remotion";

// ─── Palette ──────────────────────────────────────────────────────────────────
export const C = {
  bg: "#05050e",
  surface: "#0c0c1d",
  surfaceHigh: "#11112b",
  border: "#1c1c42",
  violet: "#7c3aed",
  violetDim: "#4c1d95",
  violetGlow: "rgba(124,58,237,0.25)",
  cyan: "#22d3ee",
  cyanGlow: "rgba(34,211,238,0.2)",
  green: "#10b981",
  greenGlow: "rgba(16,185,129,0.2)",
  amber: "#f59e0b",
  red: "#ef4444",
  text: "#e2e8f0",
  muted: "#4b5563",
  dim: "#1e2030",
  mono: '"JetBrains Mono","Fira Code","Consolas",monospace',
  sans: '"Inter","Helvetica Neue",system-ui,sans-serif',
};

// ─── Animation helpers ────────────────────────────────────────────────────────
export const fade = (frame: number, start: number, dur = 18): number =>
  interpolate(frame, [start, start + dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

export const fadeOut = (frame: number, start: number, dur = 18): number =>
  interpolate(frame, [start, start + dur], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

export const slide = (frame: number, start: number, from = 24, dur = 24): number =>
  interpolate(frame, [start, start + dur], [from, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

export const typewriter = (text: string, frame: number, start: number, speed = 2): string => {
  const chars = Math.min(text.length, Math.floor(Math.max(0, frame - start) * speed));
  return text.slice(0, chars);
};

// ─── Common components ────────────────────────────────────────────────────────
export const Grid: React.FC = () => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      backgroundImage: `
        linear-gradient(rgba(124,58,237,0.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(124,58,237,0.04) 1px, transparent 1px)
      `,
      backgroundSize: "64px 64px",
      pointerEvents: "none",
    }}
  />
);

export const Vignette: React.FC = () => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      background:
        "radial-gradient(ellipse at center, transparent 40%, rgba(5,5,14,0.85) 100%)",
      pointerEvents: "none",
    }}
  />
);

export const GlowDot: React.FC<{ x: number; y: number; color?: string; size?: number }> = ({
  x,
  y,
  color = C.violet,
  size = 300,
}) => (
  <div
    style={{
      position: "absolute",
      left: x - size / 2,
      top: y - size / 2,
      width: size,
      height: size,
      borderRadius: "50%",
      background: `radial-gradient(circle, ${color}22 0%, transparent 70%)`,
      pointerEvents: "none",
    }}
  />
);

// React needs to be in scope for JSX
import React from "react";
