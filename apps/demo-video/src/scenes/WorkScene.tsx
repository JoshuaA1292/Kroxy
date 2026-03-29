import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, Grid, Vignette, GlowDot, fade, slide } from "../styles";
import { Terminal } from "../components/Terminal";

export const WorkScene: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ background: C.bg, justifyContent: "center", alignItems: "center" }}>
      <Grid />
      <GlowDot x={360} y={280} color={C.cyan} size={420} />
      <GlowDot x={1500} y={760} color={C.mars} size={320} />
      <Vignette />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 30 }}>
        <div style={{ opacity: fade(frame, 0), display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: C.sans, fontSize: 22, color: C.cyan, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700 }}>
            Step 4 · Mission Execution
          </span>
          <h2 style={{ margin: 0, fontFamily: C.sans, fontSize: 58, color: C.text, fontWeight: 800, letterSpacing: "-0.02em" }}>
            Specialist agents complete Mars workstreams in parallel
          </h2>
        </div>

        <Terminal
          title="mars-agent-squad runtime logs"
          width={1420}
          lines={[
            { start: 10, prefix: "▶", text: "[Nexus-Research] Webhook received: job_mars_2026_0412", color: C.cyan, speed: 3 },
            { start: 34, prefix: "✓", text: "[Atlas-Trajectory] Orbital insertion simulation started", color: C.green, speed: 3.5 },
            { start: 58, prefix: "✓", text: "[Helios-Habitat] Redundancy checklist + life-support model running", color: C.green, speed: 3.2 },
            { start: 84, prefix: "  ", text: "[Nexus-Research] web_search: Mars communication blackout mitigation", color: C.violet, speed: 3.1 },
            { start: 108, prefix: "  ", text: "[Atlas-Trajectory] monte-carlo runs complete: 20,000 trajectories", color: C.violet, speed: 3.3 },
            { start: 132, prefix: "  ", text: "[Helios-Habitat] system health score: 96 / 100", color: C.violet, speed: 3.6 },
            { start: 164, prefix: "✓", text: "[Squad] Mission package assembled: 3 reports + references + risk table", color: C.green, speed: 3.2 },
            { start: 194, prefix: "→", text: "POST /api/jobs/job_mars_2026_0412/deliver", color: C.muted, speed: 3.4 },
            { start: 220, prefix: "←", text: '200 { status: "COMPLETED" } · verifier sequence triggered', color: C.green, speed: 3.4 },
          ]}
        />

        <div
          style={{
            opacity: fade(frame, 220),
            transform: `translateY(${slide(frame, 220, 14)})`,
            display: "flex",
            alignItems: "center",
            gap: 18,
          }}
        >
          <div
            style={{
              fontFamily: C.mono,
              fontSize: 18,
              color: C.cyan,
              background: `${C.cyan}1b`,
              border: `1px solid ${C.cyan}55`,
              borderRadius: 10,
              padding: "8px 16px",
            }}
          >
            3 specialized agents
          </div>
          <div style={{ fontFamily: C.sans, fontSize: 24, color: C.muted }}>
            all deliverables uploaded with citations, metrics, and audit metadata
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
