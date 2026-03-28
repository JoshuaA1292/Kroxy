import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { C, Grid, Vignette, GlowDot, fade, slide, typewriter } from "../styles";
import { Badge } from "../components/Badge";

const TX = "0x4a3f...e91b";
const ESCROW_ID = "0x7c3a...d4f2";

const Wallet: React.FC<{
  label: string;
  address: string;
  amount?: string;
  color: string;
  opacity: number;
  translateY: number;
}> = ({ label, address, amount, color, opacity, translateY }) => (
  <div
    style={{
      opacity,
      transform: `translateY(${translateY}px)`,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 10,
    }}
  >
    <div
      style={{
        width: 72,
        height: 72,
        borderRadius: "50%",
        background: `${color}22`,
        border: `2px solid ${color}66`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 28,
      }}
    >
      {label === "OpenClaw" ? "🤖" : "🔬"}
    </div>
    <div style={{ textAlign: "center" }}>
      <div style={{ fontFamily: C.sans, fontSize: 14, fontWeight: 600, color: C.text }}>{label}</div>
      <div style={{ fontFamily: C.mono, fontSize: 11, color: C.muted, marginTop: 2 }}>{address}</div>
      {amount && (
        <div style={{ fontFamily: C.sans, fontSize: 13, color: color, fontWeight: 600, marginTop: 4 }}>
          {amount}
        </div>
      )}
    </div>
  </div>
);

export const EscrowScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOp = fade(frame, 0);
  const walletAOp = fade(frame, 15);
  const walletAY = slide(frame, 15);

  // Arrow + lock animation
  const lockScale = spring({ frame: frame - 50, fps, config: { damping: 12, stiffness: 100 }, durationInFrames: 40 });
  const lockOpacity = fade(frame, 50);
  const arrowWidth = interpolate(frame, [50, 90], [0, 180], { extrapolateRight: "clamp" });

  const walletBOp = fade(frame, 90);
  const walletBY = slide(frame, 90);

  // USDC counter
  const usdcValue = interpolate(frame, [100, 150], [0, 2.5], { extrapolateRight: "clamp" });
  const usdcOp = fade(frame, 100);

  // Tx hashes
  const txOp = fade(frame, 155);
  const txY = slide(frame, 155);
  const escrowText = typewriter(ESCROW_ID, frame, 160, 4);
  const txText = typewriter(TX, frame, 175, 4);

  // Base chain label
  const chainOp = fade(frame, 135);

  return (
    <AbsoluteFill style={{ background: C.bg, justifyContent: "center", alignItems: "center" }}>
      <Grid />
      <GlowDot x={960} y={400} color={C.amber} size={500} />
      <GlowDot x={960} y={540} color={C.violet} size={300} />
      <Vignette />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 48 }}>

        {/* Label */}
        <div style={{ opacity: titleOp, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 1, background: C.amber }} />
          <span style={{ fontFamily: C.sans, fontSize: 12, color: C.amber, letterSpacing: "0.14em", textTransform: "uppercase" }}>
            Locking USDC Escrow on Base
          </span>
          <div style={{ width: 32, height: 1, background: C.amber }} />
        </div>

        {/* Wallet flow diagram */}
        <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
          <Wallet
            label="OpenClaw"
            address="0x3163...b736"
            color={C.violet}
            opacity={walletAOp}
            translateY={walletAY}
          />

          {/* Arrow + lock */}
          <div style={{ display: "flex", alignItems: "center", position: "relative" }}>
            <div style={{ width: arrowWidth, height: 2, background: `linear-gradient(90deg, ${C.violet}, ${C.amber})` }} />

            {/* Lock icon (escrow contract) */}
            <div
              style={{
                opacity: lockOpacity,
                transform: `scale(${lockScale})`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                position: "absolute",
                left: "50%",
                transform: `translateX(-50%) scale(${lockScale})`,
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 14,
                  background: `linear-gradient(135deg, ${C.amber}33, ${C.amber}11)`,
                  border: `2px solid ${C.amber}88`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  boxShadow: `0 0 32px ${C.amber}44`,
                }}
              >
                🔒
              </div>
              <span style={{ fontFamily: C.mono, fontSize: 11, color: C.amber, whiteSpace: "nowrap" }}>
                Smart Contract
              </span>
            </div>

            <div style={{ width: arrowWidth, height: 2, background: `linear-gradient(90deg, ${C.amber}, ${C.cyan})`, marginLeft: arrowWidth }} />
          </div>

          <Wallet
            label="Nexus"
            address="0x7099...79C8"
            color={C.cyan}
            opacity={walletBOp}
            translateY={walletBY}
          />
        </div>

        {/* USDC amount */}
        <div
          style={{
            opacity: usdcOp,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span
            style={{
              fontFamily: C.sans,
              fontSize: 52,
              fontWeight: 800,
              color: C.amber,
              textShadow: `0 0 32px ${C.amber}66`,
            }}
          >
            ${usdcValue.toFixed(2)} USDC
          </span>
          <div style={{ opacity: chainOp }}>
            <span style={{ fontFamily: C.sans, fontSize: 13, color: C.muted }}>
              locked on Base · awaiting delivery conditions
            </span>
          </div>
        </div>

        {/* Tx hashes */}
        <div
          style={{
            opacity: txOp,
            transform: `translateY(${txY}px)`,
            display: "flex",
            gap: 16,
          }}
        >
          <Badge label="Escrow ID" value={escrowText} color={C.amber} mono />
          <Badge label="Tx Hash" value={txText} color={C.violet} mono />
        </div>

      </div>
    </AbsoluteFill>
  );
};
