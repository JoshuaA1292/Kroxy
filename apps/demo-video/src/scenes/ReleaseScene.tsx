import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { C, Grid, Vignette, GlowDot, fade, slide } from "../styles";

export const ReleaseScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOp = fade(frame, 0);
  const isUnlocked = frame >= 52;

  const lockScale = spring({ frame: frame - 20, fps, config: { damping: 14, stiffness: 80 }, durationInFrames: 30 });
  const flowOp = fade(frame, 66);
  const usdcX = interpolate(frame, [76, 148], [0, 340], { extrapolateRight: "clamp" });
  const usdcScale = spring({ frame: frame - 76, fps, config: { damping: 12 }, durationInFrames: 40 });

  const receiveOp = fade(frame, 146);
  const receiveScale = spring({ frame: frame - 146, fps, config: { damping: 10, stiffness: 150 }, durationInFrames: 25 });

  const summaryOp = fade(frame, 182);
  const summaryY = slide(frame, 182, 14);

  const txOp = fade(frame, 202);

  return (
    <AbsoluteFill style={{ background: C.bg, justifyContent: "center", alignItems: "center" }}>
      <Grid />
      <GlowDot x={960} y={540} color={C.green} size={760} />
      <GlowDot x={340} y={280} color={C.amber} size={320} />
      <Vignette />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 44 }}>
        <div style={{ opacity: titleOp, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: C.sans, fontSize: 22, color: C.green, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700 }}>
            Step 6 · Auto Settlement
          </span>
          <h2 style={{ margin: 0, fontFamily: C.sans, fontSize: 58, color: C.text, fontWeight: 800, letterSpacing: "-0.02em" }}>
            Escrow unlocks and pays the Mars team instantly
          </h2>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 0, position: "relative" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
              minWidth: 280,
            }}
          >
            <div
              style={{
                width: 118,
                height: 118,
                borderRadius: 24,
                background: isUnlocked
                  ? `linear-gradient(135deg, ${C.green}38, ${C.green}16)`
                  : `linear-gradient(135deg, ${C.amber}38, ${C.amber}16)`,
                border: `2px solid ${isUnlocked ? C.green + "aa" : C.amber + "aa"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 50,
                boxShadow: isUnlocked ? `0 0 44px ${C.green}4f` : `0 0 36px ${C.amber}4f`,
                transform: `scale(${lockScale})`,
              }}
            >
              {isUnlocked ? "🔓" : "🔒"}
            </div>
            <span style={{ fontFamily: C.mono, fontSize: 20, color: isUnlocked ? C.green : C.amber }}>
              Escrow Contract
            </span>
          </div>

          <div style={{ position: "relative", width: 420, height: 76, display: "flex", alignItems: "center" }}>
            <div
              style={{
                position: "absolute",
                left: 0,
                width: "100%",
                height: 4,
                borderRadius: 4,
                background: `linear-gradient(90deg, ${C.amber}66, ${C.green}66)`,
                opacity: flowOp,
              }}
            />
            {frame >= 76 && (
              <div
                style={{
                  position: "absolute",
                  left: usdcX,
                  transform: `translateX(-50%) scale(${usdcScale})`,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: `linear-gradient(90deg, ${C.amber}40, ${C.green}40)`,
                  border: `1px solid ${C.green}99`,
                  borderRadius: 22,
                  padding: "10px 18px",
                  whiteSpace: "nowrap",
                  boxShadow: `0 0 24px ${C.green}4f`,
                }}
              >
                <span style={{ fontFamily: C.sans, fontSize: 24, fontWeight: 700, color: C.green }}>120 USDC</span>
              </div>
            )}
          </div>

          <div
            style={{
              opacity: fade(frame, 0),
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
              minWidth: 280,
            }}
          >
            <div
              style={{
                width: 118,
                height: 118,
                borderRadius: "50%",
                background: frame >= 146 ? `${C.cyan}3d` : `${C.cyan}26`,
                border: `2px solid ${C.cyan}${frame >= 146 ? "ff" : "77"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 44,
                fontFamily: C.sans,
                color: C.cyan,
                fontWeight: 800,
                boxShadow: frame >= 146 ? `0 0 40px ${C.cyan}66, 0 0 90px ${C.cyan}24` : `0 0 16px ${C.cyan}24`,
                transform: frame >= 146 ? `scale(${receiveScale})` : "scale(1)",
              }}
            >
              MS
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: C.sans, fontSize: 28, fontWeight: 700, color: C.text }}>Mars Agent Squad</div>
              <div style={{ fontFamily: C.mono, fontSize: 18, color: C.muted, marginTop: 4 }}>0x7099...79C8</div>
              <div
                style={{
                  opacity: receiveOp,
                  fontFamily: C.sans,
                  fontSize: 30,
                  color: C.green,
                  fontWeight: 800,
                  marginTop: 8,
                  transform: `scale(${receiveScale})`,
                  textShadow: `0 0 14px ${C.green}`,
                }}
              >
                +120 USDC
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            opacity: summaryOp,
            transform: `translateY(${summaryY}px)`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              fontFamily: C.sans,
              fontSize: 40,
              fontWeight: 800,
              color: C.green,
              display: "flex",
              alignItems: "center",
              gap: 12,
              textShadow: `0 0 26px ${C.green}66`,
            }}
          >
            <span style={{ fontSize: 44 }}>✓</span>
            Payment released with zero manual approval
          </div>
          <div style={{ fontFamily: C.sans, fontSize: 25, color: C.muted }}>
            all mission conditions verified · settlement confirmed on Base
          </div>
        </div>

        <div
          style={{
            opacity: txOp,
            fontFamily: C.mono,
            fontSize: 19,
            color: C.muted,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ color: C.green }}>tx</span>
          <span>0x8af4...11c9</span>
          <span>·</span>
          <span>Base Mainnet</span>
          <span>·</span>
          <span>confirmed in 2.3s</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
