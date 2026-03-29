import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, Grid, Vignette, GlowDot, fade, slide, typewriter } from "../styles";

const FINDINGS = [
  "Trajectory plan reached 94/100 reliability across 20,000 Monte Carlo runs.",
  "Habitat architecture includes triple-redundant oxygen and thermal loops.",
  "Communication strategy covers blackout windows with relay orbit contingencies.",
];

const SUMMARY_TEXT =
  "Mars mission package delivered. Your hired specialist agents produced a validated launch plan with risk controls, citations, and operational checklists. All outputs meet escrow quality thresholds.";

export const ResultScene: React.FC = () => {
  const frame = useCurrentFrame();

  const titleOp = fade(frame, 0);

  const bubbleOp = fade(frame, 20);
  const bubbleY = slide(frame, 20, 20);

  const cardOp = fade(frame, 60);
  const cardY = slide(frame, 60, 20);

  const finding1Op = fade(frame, 92);
  const finding2Op = fade(frame, 118);
  const finding3Op = fade(frame, 144);

  const summary = typewriter(SUMMARY_TEXT, frame, 100, 3.1);

  const statsOp = fade(frame, 168);
  const statsY = slide(frame, 168, 14);

  return (
    <AbsoluteFill style={{ background: C.bg, justifyContent: "center", alignItems: "center" }}>
      <Grid />
      <GlowDot x={280} y={420} color={C.violet} size={420} />
      <GlowDot x={1540} y={620} color={C.cyan} size={390} />
      <Vignette />

      <div style={{ width: 1520, display: "flex", flexDirection: "column", gap: 26 }}>
        <div style={{ opacity: titleOp, display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontFamily: C.sans, fontSize: 22, color: C.violet, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700 }}>
            Step 7 · Mission Deliverable
          </span>
          <h2 style={{ margin: 0, fontFamily: C.sans, fontSize: 58, color: C.text, fontWeight: 800, letterSpacing: "-0.02em" }}>
            Mission to Mars briefing arrives in your chat
          </h2>
        </div>

        <div
          style={{
            opacity: bubbleOp,
            transform: `translateY(${bubbleY}px)`,
            alignSelf: "flex-start",
            maxWidth: 1360,
          }}
        >
          <div
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: "24px 24px 24px 8px",
              padding: "22px 28px",
            }}
          >
            <p style={{ fontFamily: C.sans, fontSize: 31, color: C.text, margin: 0, lineHeight: 1.35, fontWeight: 500 }}>
              {summary}
            </p>
          </div>
          <div style={{ fontFamily: C.sans, fontSize: 18, color: C.muted, marginTop: 10 }}>OpenClaw Command Agent</div>
        </div>

        <div
          style={{
            opacity: cardOp,
            transform: `translateY(${cardY}px)`,
            background: C.surfaceHigh,
            border: `1px solid ${C.violet}55`,
            borderRadius: 16,
            padding: "24px 28px",
            boxShadow: `0 0 44px ${C.violet}20`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <span style={{ fontFamily: C.sans, fontSize: 21, fontWeight: 700, color: C.violet, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Mars Mission Findings
            </span>
            <div style={{ display: "flex", gap: 10 }}>
              <span style={{ fontFamily: C.mono, fontSize: 18, color: C.cyan, background: `${C.cyan}1c`, border: `1px solid ${C.cyan}55`, borderRadius: 8, padding: "6px 12px" }}>
                3 specialist reports
              </span>
              <span style={{ fontFamily: C.mono, fontSize: 18, color: C.green, background: `${C.green}1c`, border: `1px solid ${C.green}55`, borderRadius: 8, padding: "6px 12px" }}>
                quality score 0.94
              </span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {FINDINGS.map((finding, i) => {
              const ops = [finding1Op, finding2Op, finding3Op];
              return (
                <div
                  key={i}
                  style={{
                    opacity: ops[i],
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      background: `${C.green}24`,
                      border: `1px solid ${C.green}77`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  >
                    <span style={{ fontSize: 14, color: C.green }}>✓</span>
                  </div>
                  <span style={{ fontFamily: C.sans, fontSize: 27, color: C.text, lineHeight: 1.35 }}>
                    {finding}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div
          style={{
            opacity: statsOp,
            transform: `translateY(${statsY}px)`,
            display: "flex",
            gap: 14,
          }}
        >
          {[
            { label: "Agents hired", value: "3 specialists", color: C.cyan },
            { label: "Escrow settled", value: "120 USDC", color: C.amber },
            { label: "Checks passed", value: "9 / 9", color: C.green },
            { label: "Total runtime", value: "6m 12s", color: C.muted },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              style={{
                flex: 1,
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                padding: "14px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div style={{ fontFamily: C.sans, fontSize: 18, color: C.muted }}>{label}</div>
              <div style={{ fontFamily: C.mono, fontSize: 27, fontWeight: 700, color }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
