import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { C, Grid, Vignette, GlowDot, fade, slide, typewriter } from "../styles";
import { Badge } from "../components/Badge";

const TX = "0x8af4...11c9";
const ESCROW_ID = "0x33cd...9b7e";

const Wallet: React.FC<{
  label: string;
  address: string;
  amount?: string;
  color: string;
  icon: string;
  opacity: number;
  translateY: number;
}> = ({ label, address, amount, color, icon, opacity, translateY }) => (
  <div
    style={{
      opacity,
      transform: `translateY(${translateY}px)`,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 14,
      minWidth: 300,
    }}
  >
    <div
      style={{
        width: 110,
        height: 110,
        borderRadius: "50%",
        background: `${color}24`,
        border: `2px solid ${color}77`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 44,
        fontFamily: C.sans,
        color,
        fontWeight: 800,
      }}
    >
      {icon}
    </div>
    <div style={{ textAlign: "center" }}>
      <div style={{ fontFamily: C.sans, fontSize: 30, fontWeight: 700, color: C.text }}>{label}</div>
      <div style={{ fontFamily: C.mono, fontSize: 18, color: C.muted, marginTop: 4 }}>{address}</div>
      {amount && (
        <div style={{ fontFamily: C.sans, fontSize: 24, color, fontWeight: 700, marginTop: 8 }}>
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
  const walletAY = slide(frame, 15, 24);

  const lockScale = spring({ frame: frame - 52, fps, config: { damping: 12, stiffness: 100 }, durationInFrames: 40 });
  const lockOpacity = fade(frame, 52);
  const railWidth = interpolate(frame, [52, 95], [0, 520], { extrapolateRight: "clamp" });

  const walletBOp = fade(frame, 96);
  const walletBY = slide(frame, 96, 24);

  const usdcValue = interpolate(frame, [108, 158], [0, 120], { extrapolateRight: "clamp" });
  const usdcOp = fade(frame, 108);

  const txOp = fade(frame, 166);
  const txY = slide(frame, 166, 18);
  const escrowText = typewriter(ESCROW_ID, frame, 172, 4);
  const txText = typewriter(TX, frame, 188, 4);

  const chainOp = fade(frame, 138);

  return (
    <AbsoluteFill style={{ background: C.bg, justifyContent: "center", alignItems: "center" }}>
      <Grid />
      <GlowDot x={960} y={380} color={C.mars} size={560} />
      <GlowDot x={960} y={560} color={C.violet} size={360} />
      <Vignette />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 48 }}>
        <div style={{ opacity: titleOp, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: C.sans, fontSize: 22, color: C.amber, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700 }}>
            Step 3 · Secure Mission Budget
          </span>
          <h2 style={{ margin: 0, fontFamily: C.sans, fontSize: 58, color: C.text, fontWeight: 800, letterSpacing: "-0.02em" }}>
            Lock 120 USDC in conditional escrow on Base
          </h2>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 38 }}>
          <Wallet
            label="Mission Control"
            address="0x3163...b736"
            amount="Budget: 120 USDC"
            color={C.violet}
            icon="MC"
            opacity={walletAOp}
            translateY={walletAY}
          />

          <div style={{ width: 620, height: 180, position: "relative", display: "flex", justifyContent: "center", alignItems: "center" }}>
            <div style={{ width: railWidth, height: 4, borderRadius: 4, background: `linear-gradient(90deg, ${C.violet}, ${C.amber}, ${C.cyan})` }} />

            <div
              style={{
                opacity: lockOpacity,
                transform: `scale(${lockScale})`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
                position: "absolute",
              }}
            >
              <div
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 18,
                  background: `linear-gradient(135deg, ${C.amber}44, ${C.amber}18)`,
                  border: `2px solid ${C.amber}99`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 44,
                  boxShadow: `0 0 34px ${C.amber}55`,
                }}
              >
                🔒
              </div>
              <span style={{ fontFamily: C.mono, fontSize: 18, color: C.amber, whiteSpace: "nowrap" }}>
                Escrow Smart Contract
              </span>
            </div>
          </div>

          <Wallet
            label="Mars Agent Squad"
            address="0x7099...79C8"
            color={C.cyan}
            icon="MS"
            opacity={walletBOp}
            translateY={walletBY}
          />
        </div>

        <div
          style={{
            opacity: usdcOp,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              fontFamily: C.sans,
              fontSize: 78,
              fontWeight: 900,
              color: C.amber,
              textShadow: `0 0 34px ${C.amber}66`,
              letterSpacing: "-0.02em",
            }}
          >
            ${usdcValue.toFixed(2)} USDC
          </span>
          <div style={{ opacity: chainOp }}>
            <span style={{ fontFamily: C.sans, fontSize: 24, color: C.muted }}>
              funds locked on Base until all mission checks pass
            </span>
          </div>
        </div>

        <div
          style={{
            opacity: txOp,
            transform: `translateY(${txY}px)`,
            display: "flex",
            gap: 20,
          }}
        >
          <Badge label="Escrow ID" value={escrowText} color={C.amber} mono />
          <Badge label="Tx Hash" value={txText} color={C.violet} mono />
        </div>
      </div>
    </AbsoluteFill>
  );
};
