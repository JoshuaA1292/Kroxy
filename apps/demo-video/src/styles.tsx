import React from "react";
import { interpolate } from "remotion";

// ─── Palette ──────────────────────────────────────────────────────────────────
export const C = {
  bg: "#070a15",
  surface: "#111930",
  surfaceHigh: "#182140",
  border: "#2a3458",
  violet: "#8c6dff",
  violetDim: "#4a3699",
  violetGlow: "rgba(140,109,255,0.26)",
  cyan: "#47c9ff",
  cyanGlow: "rgba(71,201,255,0.24)",
  green: "#2ddf8f",
  greenGlow: "rgba(45,223,143,0.24)",
  amber: "#ffb23e",
  mars: "#ff7a3d",
  marsGlow: "rgba(255,122,61,0.25)",
  red: "#ff5d5d",
  text: "#f5f7ff",
  muted: "#98a4c7",
  dim: "#202a4a",
  mono: '"JetBrains Mono","Fira Code","Consolas",monospace',
  sans: '"Sora","Avenir Next","Poppins",system-ui,sans-serif',
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
        radial-gradient(circle at 15% 10%, rgba(255,122,61,0.08) 0%, transparent 35%),
        radial-gradient(circle at 80% 85%, rgba(71,201,255,0.1) 0%, transparent 45%),
        linear-gradient(rgba(140,109,255,0.05) 1px, transparent 1px),
        linear-gradient(90deg, rgba(140,109,255,0.05) 1px, transparent 1px)
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
        "radial-gradient(ellipse at center, transparent 36%, rgba(7,10,21,0.9) 100%)",
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
