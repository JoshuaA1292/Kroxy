import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, Grid, Vignette, GlowDot, fade, slide } from "../styles";
import { Terminal } from "../components/Terminal";

export const PluginScene: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ background: C.bg, justifyContent: "center", alignItems: "center" }}>
      <Grid />
      <GlowDot x={960} y={540} color={C.violet} size={700} />
      <Vignette />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 32 }}>
        {/* Label */}
        <div style={{ opacity: fade(frame, 0), display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 1, background: C.violet }} />
          <span style={{ fontFamily: C.sans, fontSize: 12, color: C.violet, letterSpacing: "0.14em", textTransform: "uppercase" }}>
            Kroxy Plugin · Tool Call
          </span>
          <div style={{ width: 32, height: 1, background: C.violet }} />
        </div>

        <Terminal
          title="kroxy_hire"
          width={760}
          lines={[
            {
              start: 10,
              prefix: "→",
              text: 'kroxy_hire({ task: "Research AI payment startups", maxPrice: 3 })',
              color: C.cyan,
              speed: 2,
            },
            { start: 55, prefix: "  ", text: "Checking KROXY_AGENT_WALLET    ✓", color: C.green, speed: 4 },
            { start: 70, prefix: "  ", text: "Checking KROXY_DEMO_MODE       ✓ (demo)", color: C.green, speed: 4 },
            { start: 85, prefix: "  ", text: 'detectCapability("Research...") → research', color: C.muted, speed: 4 },
            { start: 105, prefix: "  ", text: "GET  /api/agents/find?capability=research&maxPrice=3", color: C.muted, speed: 3 },
            { start: 130, prefix: "←", text: '200  [ { name: "Nexus", pricingUsdc: "2.50", score: 94 } ]', color: C.green, speed: 3 },
            { start: 160, prefix: "  ", text: "Agent selected: Nexus  (reputation 94/100)", color: C.text, speed: 4 },
            { start: 180, prefix: "→", text: "POST /api/jobs  (with conditions → Nexus /quality-check)", color: C.muted, speed: 3 },
            { start: 210, prefix: "←", text: '201  { id: "job_1742658312_a4f", status: "OPEN" }', color: C.green, speed: 3 },
          ]}
        />

        {/* Condition chips */}
        <div
          style={{
            opacity: fade(frame, 215),
            transform: `translateY(${slide(frame, 215)})`,
            display: "flex",
            gap: 12,
          }}
        >
          {[
            { label: "health check", color: C.violet },
            { label: "wordCount ≥ 100", color: C.cyan },
            { label: "confidence ≥ 0.7", color: C.cyan },
          ].map(({ label, color }) => (
            <div
              key={label}
              style={{
                fontFamily: C.mono,
                fontSize: 12,
                color,
                background: `${color}18`,
                border: `1px solid ${color}44`,
                borderRadius: 8,
                padding: "5px 14px",
              }}
            >
              {label}
            </div>
          ))}
          <div style={{ fontFamily: C.sans, fontSize: 12, color: C.muted, display: "flex", alignItems: "center" }}>
            · verifier conditions locked into escrow
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
