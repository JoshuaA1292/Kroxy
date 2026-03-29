import React from "react";
import { AbsoluteFill, useCurrentFrame, spring, useVideoConfig, interpolate } from "remotion";
import { C, Grid, Vignette, GlowDot, fade, slide } from "../styles";

const FEATURES = [
  "Find specialist agents",
  "Lock mission budget in USDC escrow",
  "Auto-verify every deliverable",
  "Release payment + reputation updates",
];

export const TitleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame, fps, config: { damping: 14, stiffness: 120 }, durationInFrames: 40 });
  const headingOpacity = fade(frame, 24);
  const headingY = slide(frame, 24, 22, 26);
  const tagOpacity = fade(frame, 45);
  const featureOpacity = fade(frame, 70);

  return (
    <AbsoluteFill style={{ background: C.bg, justifyContent: "center", alignItems: "center" }}>
      <Grid />
      <GlowDot x={1020} y={340} color={C.mars} size={700} />
      <GlowDot x={580} y={680} color={C.cyan} size={360} />
      <Vignette />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 30,
          width: 1660,
          transform: `scale(${logoScale})`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
          <span
            style={{
              fontFamily: C.sans,
              fontSize: 122,
              fontWeight: 900,
              color: C.text,
              letterSpacing: "-0.04em",
            }}
          >
            Kroxy
          </span>
          <span style={{ fontFamily: C.sans, fontSize: 72, color: C.muted, fontWeight: 300 }}>×</span>
          <span
            style={{
              fontFamily: C.sans,
              fontSize: 122,
              fontWeight: 900,
              background: `linear-gradient(135deg, ${C.violet} 0%, ${C.cyan} 60%, ${C.mars} 100%)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              letterSpacing: "-0.04em",
            }}
          >
            OpenClaw
          </span>
        </div>

        <div
          style={{
            width: interpolate(frame, [28, 62], [0, 1180], { extrapolateRight: "clamp" }),
            height: 2,
            background: `linear-gradient(90deg, transparent, ${C.violet}, ${C.cyan}, ${C.mars}, transparent)`,
            opacity: headingOpacity,
          }}
        />

        <h1
          style={{
            fontFamily: C.sans,
            fontSize: 86,
            color: C.text,
            fontWeight: 800,
            lineHeight: 1.08,
            margin: 0,
            textAlign: "center",
            letterSpacing: "-0.03em",
            opacity: headingOpacity,
            transform: `translateY(${headingY}px)`,
          }}
        >
          Onboarding: Hire AI Agents for
          <span
            style={{
              display: "block",
              background: `linear-gradient(90deg, ${C.mars}, ${C.amber})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Mission to Mars
          </span>
        </h1>

        <p
          style={{
            fontFamily: C.sans,
            fontSize: 33,
            color: C.muted,
            fontWeight: 500,
            letterSpacing: "0.01em",
            opacity: tagOpacity,
            margin: 0,
            textAlign: "center",
            maxWidth: 1480,
          }}
        >
          Follow the full workflow from mission brief to automatic USDC payout, all enforced on-chain.
        </p>

        <div
          style={{
            display: "flex",
            gap: 14,
            flexWrap: "wrap",
            justifyContent: "center",
            opacity: featureOpacity,
          }}
        >
          {FEATURES.map((label) => (
            <div
              key={label}
              style={{
                fontFamily: C.sans,
                fontSize: 22,
                color: C.text,
                background: `${C.surfaceHigh}cc`,
                border: `1px solid ${C.violet}55`,
                borderRadius: 24,
                padding: "12px 24px",
                letterSpacing: "0.01em",
                boxShadow: `0 0 20px ${C.violetGlow}`,
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
