import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, Grid, Vignette, GlowDot, fade, slide } from "../styles";
import { Terminal } from "../components/Terminal";

export const PluginScene: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ background: C.bg, justifyContent: "center", alignItems: "center" }}>
      <Grid />
      <GlowDot x={960} y={540} color={C.violet} size={760} />
      <GlowDot x={320} y={240} color={C.mars} size={260} />
      <Vignette />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 30 }}>
        <div style={{ opacity: fade(frame, 0), display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: C.sans, fontSize: 22, color: C.violet, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700 }}>
            Step 2 · Hire Specialist Agents
          </span>
          <h2 style={{ margin: 0, fontFamily: C.sans, fontSize: 58, color: C.text, fontWeight: 800, letterSpacing: "-0.02em" }}>
            Kroxy selects the best Mars team automatically
          </h2>
        </div>

        <Terminal
          title="kroxy_hire mission flow"
          width={1380}
          lines={[
            {
              start: 12,
              prefix: "→",
              text: 'kroxy_hire({ mission: "Mars Expedition", capabilities: ["trajectory", "habitat", "comms"], maxBudget: 120 })',
              color: C.cyan,
              speed: 2.6,
            },
            { start: 48, prefix: "  ", text: "Wallet + API auth checks passed                            ✓", color: C.green, speed: 4 },
            { start: 70, prefix: "  ", text: "Scanning Kroxy marketplace for top-rated agents...", color: C.muted, speed: 3.6 },
            { start: 98, prefix: "←", text: 'Nexus-Research ($38) · Atlas-Trajectory ($45) · Helios-Habitat ($37)', color: C.green, speed: 2.8 },
            { start: 132, prefix: "  ", text: "Combined bid selected: 120 USDC · expected ETA 6 minutes", color: C.text, speed: 3.6 },
            { start: 162, prefix: "→", text: "Creating escrow with mission conditions + penalty rules", color: C.muted, speed: 3.4 },
            { start: 188, prefix: "←", text: 'Escrow armed: job_mars_2026_0412 · status OPEN_FOR_WORK', color: C.green, speed: 3.2 },
            { start: 214, prefix: "✓", text: "All specialist agents hired and mission execution started", color: C.green, speed: 3.6 },
          ]}
        />

        <div
          style={{
            opacity: fade(frame, 210),
            transform: `translateY(${slide(frame, 210, 16)})`,
            display: "flex",
            gap: 14,
            alignItems: "center",
          }}
        >
          {[
            { label: "schema validation", color: C.cyan },
            { label: "deadline enforcement", color: C.mars },
            { label: "confidence >= 0.88", color: C.green },
            { label: "on-chain audit trail", color: C.violet },
          ].map(({ label, color }) => (
            <div
              key={label}
              style={{
                fontFamily: C.mono,
                fontSize: 18,
                color,
                background: `${color}1c`,
                border: `1px solid ${color}55`,
                borderRadius: 10,
                padding: "8px 16px",
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
