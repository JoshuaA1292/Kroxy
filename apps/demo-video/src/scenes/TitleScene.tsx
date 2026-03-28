import React from "react";
import { AbsoluteFill, useCurrentFrame, spring, useVideoConfig, interpolate } from "remotion";
import { C, Grid, Vignette, GlowDot, fade, slide } from "../styles";

export const TitleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame, fps, config: { damping: 14, stiffness: 120 }, durationInFrames: 40 });
  const tagOpacity = fade(frame, 40);
  const tagY = slide(frame, 40, 16, 24);
  const pillOpacity = fade(frame, 60);
  const lineOpacity = fade(frame, 30, 30);

  return (
    <AbsoluteFill style={{ background: C.bg, justifyContent: "center", alignItems: "center" }}>
      <Grid />
      <GlowDot x={960} y={400} color={C.violet} size={600} />
      <GlowDot x={600} y={600} color={C.cyan} size={300} />
      <Vignette />

      {/* Wordmark */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
          transform: `scale(${logoScale})`,
        }}
      >
        {/* K × O lockup */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <span
            style={{
              fontFamily: C.sans,
              fontSize: 96,
              fontWeight: 800,
              color: C.text,
              letterSpacing: "-0.04em",
            }}
          >
            Kroxy
          </span>
          <span style={{ fontFamily: C.sans, fontSize: 56, color: C.muted, fontWeight: 300 }}>×</span>
          <span
            style={{
              fontFamily: C.sans,
              fontSize: 96,
              fontWeight: 800,
              background: `linear-gradient(135deg, ${C.violet} 0%, ${C.cyan} 100%)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              letterSpacing: "-0.04em",
            }}
          >
            OpenClaw
          </span>
        </div>

        {/* Divider */}
        <div
          style={{
            width: interpolate(frame, [30, 60], [0, 480], { extrapolateRight: "clamp" }),
            height: 1,
            background: `linear-gradient(90deg, transparent, ${C.violet}, transparent)`,
            opacity: lineOpacity,
          }}
        />

        {/* Tagline */}
        <p
          style={{
            fontFamily: C.sans,
            fontSize: 22,
            color: C.muted,
            fontWeight: 400,
            letterSpacing: "0.02em",
            opacity: tagOpacity,
            transform: `translateY(${tagY}px)`,
            margin: 0,
            textAlign: "center",
          }}
        >
          Trustless agent-to-agent payments on Base
        </p>

        {/* Pills */}
        <div
          style={{
            display: "flex",
            gap: 12,
            opacity: pillOpacity,
            transform: `translateY(${slide(frame, 60, 16, 24)}px)`,
          }}
        >
          {["USDC Escrow", "Base Blockchain", "Auto-Verified", "Autonomous"].map((label) => (
            <div
              key={label}
              style={{
                fontFamily: C.sans,
                fontSize: 13,
                color: C.violet,
                background: `${C.violetDim}33`,
                border: `1px solid ${C.violet}44`,
                borderRadius: 20,
                padding: "6px 16px",
                letterSpacing: "0.04em",
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
