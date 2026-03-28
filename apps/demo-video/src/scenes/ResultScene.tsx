import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, Grid, Vignette, GlowDot, fade, slide, typewriter } from "../styles";

const FINDINGS = [
  "Base's USDC settlement layer enables sub-cent agent micropayments",
  "A2A escrow removes trust requirements between autonomous agents",
  "Conditional release tied to verified output quality, not manual review",
];

const SUMMARY_TEXT =
  "AI agent-to-agent payment protocols are maturing rapidly. Kroxy's escrow model on Base enables autonomous agents to transact with quality guarantees — no human intermediary needed.";

export const ResultScene: React.FC = () => {
  const frame = useCurrentFrame();

  const titleOp = fade(frame, 0);

  // Agent bubble with result
  const bubbleOp = fade(frame, 20);
  const bubbleY = slide(frame, 20);

  // Deliverable card
  const cardOp = fade(frame, 60);
  const cardY = slide(frame, 60, 20);

  // Key findings appear one by one
  const finding1Op = fade(frame, 90);
  const finding2Op = fade(frame, 115);
  const finding3Op = fade(frame, 140);

  // Summary typewriter
  const summary = typewriter(SUMMARY_TEXT, frame, 100, 3);

  // Stats row
  const statsOp = fade(frame, 165);
  const statsY = slide(frame, 165);

  return (
    <AbsoluteFill style={{ background: C.bg, justifyContent: "center", alignItems: "center" }}>
      <Grid />
      <GlowDot x={300} y={400} color={C.violet} size={400} />
      <GlowDot x={1500} y={600} color={C.cyan} size={350} />
      <Vignette />

      <div style={{ width: 900, display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Label */}
        <div style={{ opacity: titleOp, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 1, background: C.violet }} />
          <span style={{ fontFamily: C.sans, fontSize: 12, color: C.violet, letterSpacing: "0.14em", textTransform: "uppercase" }}>
            OpenClaw · Research Delivered
          </span>
        </div>

        {/* Agent reply bubble */}
        <div
          style={{
            opacity: bubbleOp,
            transform: `translateY(${bubbleY}px)`,
            alignSelf: "flex-start",
            maxWidth: 620,
          }}
        >
          <div
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: "18px 18px 18px 4px",
              padding: "14px 20px",
            }}
          >
            <p style={{ fontFamily: C.sans, fontSize: 15, color: C.text, margin: 0, lineHeight: 1.6 }}>
              {summary}
            </p>
          </div>
          <div style={{ fontFamily: C.sans, fontSize: 11, color: C.muted, marginTop: 6 }}>
            Agent · OpenClaw
          </div>
        </div>

        {/* Deliverable card */}
        <div
          style={{
            opacity: cardOp,
            transform: `translateY(${cardY}px)`,
            background: C.surfaceHigh,
            border: `1px solid ${C.violet}44`,
            borderRadius: 14,
            padding: "20px 24px",
            boxShadow: `0 0 40px ${C.violet}18`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ fontFamily: C.sans, fontSize: 12, fontWeight: 600, color: C.violet, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Key Findings
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ fontFamily: C.mono, fontSize: 11, color: C.cyan, background: `${C.cyan}18`, border: `1px solid ${C.cyan}44`, borderRadius: 6, padding: "3px 10px" }}>
                312 words
              </span>
              <span style={{ fontFamily: C.mono, fontSize: 11, color: C.green, background: `${C.green}18`, border: `1px solid ${C.green}44`, borderRadius: 6, padding: "3px 10px" }}>
                0.91 confidence
              </span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {FINDINGS.map((finding, i) => {
              const ops = [finding1Op, finding2Op, finding3Op];
              return (
                <div
                  key={i}
                  style={{
                    opacity: ops[i],
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: `${C.green}22`,
                      border: `1px solid ${C.green}66`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    <span style={{ fontSize: 10, color: C.green }}>✓</span>
                  </div>
                  <span style={{ fontFamily: C.sans, fontSize: 13, color: C.text, lineHeight: 1.5 }}>
                    {finding}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Stats row */}
        <div
          style={{
            opacity: statsOp,
            transform: `translateY(${statsY}px)`,
            display: "flex",
            gap: 16,
          }}
        >
          {[
            { label: "Agent hired", value: "Nexus", color: C.cyan },
            { label: "Amount paid", value: "$2.50 USDC", color: C.amber },
            { label: "Verified by", value: "Kroxy Escrow", color: C.violet },
            { label: "Time elapsed", value: "~120s", color: C.muted },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              style={{
                flex: 1,
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <div style={{ fontFamily: C.sans, fontSize: 11, color: C.muted }}>{label}</div>
              <div style={{ fontFamily: C.mono, fontSize: 14, fontWeight: 700, color }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
