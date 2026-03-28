import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { C, Grid, Vignette, GlowDot, fade, slide } from "../styles";

export const ReleaseScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOp = fade(frame, 0);

  // Lock icon dissolves open
  const lockScale = spring({ frame: frame - 20, fps, config: { damping: 14, stiffness: 80 }, durationInFrames: 30 });
  const lockOp = fade(frame, 10);
  const unlockOp = fade(frame, 50);
  const unlockScale = spring({ frame: frame - 50, fps, config: { damping: 10, stiffness: 120 }, durationInFrames: 25 });

  // USDC flow animation
  const flowOp = fade(frame, 65);
  const usdcX = interpolate(frame, [75, 145], [0, 260], { extrapolateRight: "clamp" });
  const usdcScale = spring({ frame: frame - 75, fps, config: { damping: 12 }, durationInFrames: 40 });

  // Nexus wallet receive animation
  const receiveOp = fade(frame, 145);
  const receiveScale = spring({ frame: frame - 145, fps, config: { damping: 10, stiffness: 150 }, durationInFrames: 25 });
  const receiveGlow = interpolate(frame, [145, 175], [0, 1], { extrapolateRight: "clamp" });

  // Summary line
  const summaryOp = fade(frame, 185);
  const summaryY = slide(frame, 185);

  // Tx badge
  const txOp = fade(frame, 205);

  return (
    <AbsoluteFill style={{ background: C.bg, justifyContent: "center", alignItems: "center" }}>
      <Grid />
      <GlowDot x={960} y={540} color={C.green} size={700} />
      <GlowDot x={400} y={300} color={C.amber} size={300} />
      <Vignette />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 48 }}>

        {/* Label */}
        <div style={{ opacity: titleOp, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 1, background: C.green }} />
          <span style={{ fontFamily: C.sans, fontSize: 12, color: C.green, letterSpacing: "0.14em", textTransform: "uppercase" }}>
            Escrow · Payment Released
          </span>
          <div style={{ width: 32, height: 1, background: C.green }} />
        </div>

        {/* Flow diagram */}
        <div style={{ display: "flex", alignItems: "center", gap: 0, position: "relative" }}>

          {/* Escrow contract */}
          <div
            style={{
              opacity: lockOp,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: 20,
                background: frame >= 50
                  ? `linear-gradient(135deg, ${C.green}33, ${C.green}11)`
                  : `linear-gradient(135deg, ${C.amber}33, ${C.amber}11)`,
                border: `2px solid ${frame >= 50 ? C.green + "88" : C.amber + "88"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 32,
                boxShadow: frame >= 50 ? `0 0 40px ${C.green}44` : `0 0 32px ${C.amber}44`,
                transform: `scale(${lockScale})`,
                transition: "background 0.3s, border-color 0.3s",
              }}
            >
              {frame >= 50 ? "🔓" : "🔒"}
            </div>
            <span style={{ fontFamily: C.mono, fontSize: 11, color: frame >= 50 ? C.green : C.amber }}>
              Smart Contract
            </span>
          </div>

          {/* Arrow + flying USDC token */}
          <div style={{ position: "relative", width: 300, height: 60, display: "flex", alignItems: "center" }}>
            {/* Track line */}
            <div
              style={{
                position: "absolute",
                left: 0,
                width: "100%",
                height: 2,
                background: `linear-gradient(90deg, ${C.amber}44, ${C.green}44)`,
                opacity: flowOp,
              }}
            />
            {/* Flying USDC pill */}
            {frame >= 75 && (
              <div
                style={{
                  position: "absolute",
                  left: usdcX,
                  transform: `translateX(-50%) scale(${usdcScale})`,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: `linear-gradient(90deg, ${C.amber}33, ${C.green}33)`,
                  border: `1px solid ${C.green}88`,
                  borderRadius: 20,
                  padding: "6px 14px",
                  whiteSpace: "nowrap",
                  boxShadow: `0 0 20px ${C.green}44`,
                }}
              >
                <span style={{ fontFamily: C.sans, fontSize: 13, fontWeight: 700, color: C.green }}>
                  $2.50 USDC
                </span>
              </div>
            )}
          </div>

          {/* Nexus wallet */}
          <div
            style={{
              opacity: fade(frame, 0),
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                background: frame >= 145
                  ? `${C.cyan}33`
                  : `${C.cyan}22`,
                border: `2px solid ${C.cyan}${frame >= 145 ? "cc" : "66"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 32,
                boxShadow: frame >= 145 ? `0 0 40px ${C.cyan}66, 0 0 80px ${C.cyan}22` : `0 0 16px ${C.cyan}22`,
                transform: frame >= 145 ? `scale(${receiveScale})` : "scale(1)",
              }}
            >
              🔬
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: C.sans, fontSize: 13, fontWeight: 600, color: C.text }}>Nexus</div>
              <div style={{ fontFamily: C.mono, fontSize: 11, color: C.muted, marginTop: 2 }}>0x7099...79C8</div>
              <div
                style={{
                  opacity: receiveOp,
                  fontFamily: C.sans,
                  fontSize: 14,
                  color: C.green,
                  fontWeight: 700,
                  marginTop: 4,
                  transform: `scale(${receiveScale})`,
                  textShadow: `0 0 12px ${C.green}`,
                }}
              >
                +$2.50 USDC
              </div>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div
          style={{
            opacity: summaryOp,
            transform: `translateY(${summaryY}px)`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              fontFamily: C.sans,
              fontSize: 18,
              fontWeight: 700,
              color: C.green,
              display: "flex",
              alignItems: "center",
              gap: 10,
              textShadow: `0 0 24px ${C.green}66`,
            }}
          >
            <span style={{ fontSize: 24 }}>✓</span>
            Payment released automatically
          </div>
          <div style={{ fontFamily: C.sans, fontSize: 13, color: C.muted }}>
            Conditions verified · escrow settled on Base
          </div>
        </div>

        {/* Tx hash */}
        <div
          style={{
            opacity: txOp,
            fontFamily: C.mono,
            fontSize: 11,
            color: C.muted,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ color: C.green }}>tx</span>
          <span>0x4a3f...e91b</span>
          <span>·</span>
          <span>Base Mainnet</span>
          <span>·</span>
          <span>confirmed in 2.1s</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
