import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, Grid, Vignette, GlowDot, fade, slide } from "../styles";
import { Terminal } from "../components/Terminal";

export const WorkScene: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ background: C.bg, justifyContent: "center", alignItems: "center" }}>
      <Grid />
      <GlowDot x={400} y={300} color={C.cyan} size={400} />
      <GlowDot x={1400} y={700} color={C.violet} size={300} />
      <Vignette />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 32 }}>

        {/* Label */}
        <div style={{ opacity: fade(frame, 0), display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 1, background: C.cyan }} />
          <span style={{ fontFamily: C.sans, fontSize: 12, color: C.cyan, letterSpacing: "0.14em", textTransform: "uppercase" }}>
            Nexus Agent · Claude Research
          </span>
          <div style={{ width: 32, height: 1, background: C.cyan }} />
        </div>

        <Terminal
          title="nexus — provider agent"
          width={820}
          lines={[
            { start: 10, prefix: "▶", text: "[Nexus] Webhook received: JOB_POSTED job_1742658312_a4f", color: C.cyan, speed: 3 },
            { start: 40, prefix: "  ", text: "[Nexus] Bid submitted: $2.50 USDC, eta 120s", color: C.muted, speed: 4 },
            { start: 65, prefix: "✓", text: "[Nexus] Bid accepted — escrow locked, work starting", color: C.green, speed: 3 },
            { start: 90, prefix: "  ", text: '[Nexus] Calling claude-sonnet-4-6 with web_search...', color: C.muted, speed: 3 },
            { start: 115, prefix: "  ", text: "web_search: 'AI payment startups 2026'", color: C.violet, speed: 3 },
            { start: 140, prefix: "  ", text: "web_search: 'agent to agent payment protocols Base'", color: C.violet, speed: 3 },
            { start: 165, prefix: "  ", text: "web_search: 'USDC micropayments autonomous agents'", color: C.violet, speed: 3 },
            { start: 195, prefix: "✓", text: "[Nexus] Research complete — wordCount: 312, confidence: 0.91", color: C.green, speed: 3 },
            { start: 218, prefix: "→", text: "POST /api/jobs/job_1742658312_a4f/deliver", color: C.muted, speed: 3 },
            { start: 235, prefix: "←", text: '200  { status: "COMPLETED" }  · escrow evaluation triggered', color: C.green, speed: 3 },
          ]}
        />

        {/* Model badge */}
        <div
          style={{
            opacity: fade(frame, 240),
            transform: `translateY(${slide(frame, 240)})`,
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div
            style={{
              fontFamily: C.mono,
              fontSize: 12,
              color: C.cyan,
              background: `${C.cyan}15`,
              border: `1px solid ${C.cyan}44`,
              borderRadius: 8,
              padding: "5px 14px",
            }}
          >
            claude-sonnet-4-6
          </div>
          <div style={{ fontFamily: C.sans, fontSize: 12, color: C.muted }}>
            + web_search_20250305 · 3 searches · 312 words · confidence 0.91
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
