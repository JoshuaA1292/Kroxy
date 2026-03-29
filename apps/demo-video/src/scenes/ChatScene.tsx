import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, Grid, Vignette, GlowDot, fade, slide, typewriter } from "../styles";

const MSG =
  "Mission to Mars kickoff: hire specialists for trajectory design, habitat safety, and communications reliability. Budget cap: 120 USDC.";

export const ChatScene: React.FC = () => {
  const frame = useCurrentFrame();

  const titleOpacity = fade(frame, 0);
  const titleY = slide(frame, 0, 18, 20);

  const bubbleOpacity = fade(frame, 20);
  const bubbleY = slide(frame, 20, 24, 24);
  const typed = typewriter(MSG, frame, 30, 2.8);
  const showCursor = typed.length < MSG.length;

  const agentOpacity = fade(frame, 110);
  const agentY = slide(frame, 110, 20);
  const agentText = typewriter(
    "Copy that. I am opening Kroxy and hiring the top mission-ready agent team now.",
    frame,
    120,
    3.8,
  );

  const toolBadgeOpacity = fade(frame, 150);
  const toolBadgeY = slide(frame, 150, 16);

  return (
    <AbsoluteFill style={{ background: C.bg, justifyContent: "center", alignItems: "center" }}>
      <Grid />
      <GlowDot x={1450} y={270} color={C.mars} size={420} />
      <GlowDot x={440} y={720} color={C.violet} size={360} />
      <Vignette />

      <div style={{ width: 1440, display: "flex", flexDirection: "column", gap: 36 }}>
        <div
          style={{
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <span
            style={{
              fontFamily: C.sans,
              fontSize: 23,
              color: C.cyan,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 700,
            }}
          >
            Step 1 · Mission Brief
          </span>
          <h2
            style={{
              margin: 0,
              fontFamily: C.sans,
              fontSize: 66,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              color: C.text,
            }}
          >
            Define the Mars objective in one prompt
          </h2>
        </div>

        <div
          style={{
            opacity: bubbleOpacity,
            transform: `translateY(${bubbleY}px)`,
            alignSelf: "flex-end",
            maxWidth: 1220,
          }}
        >
          <div
            style={{
              background: `linear-gradient(135deg, ${C.violet}ee, ${C.violetDim}ee)`,
              borderRadius: "26px 26px 8px 26px",
              padding: "24px 30px",
              boxShadow: `0 0 36px ${C.violetGlow}`,
            }}
          >
            <p style={{ fontFamily: C.sans, fontSize: 34, color: C.text, margin: 0, lineHeight: 1.34, fontWeight: 500 }}>
              {typed}
              {showCursor && (
                <span
                  style={{
                    display: "inline-block",
                    width: 12,
                    height: "1em",
                    background: "white",
                    marginLeft: 3,
                    verticalAlign: "middle",
                    opacity: Math.sin(frame / 8) > 0 ? 1 : 0,
                  }}
                />
              )}
            </p>
          </div>
          <div style={{ fontFamily: C.sans, fontSize: 18, color: C.muted, marginTop: 10, textAlign: "right" }}>Mission Control</div>
        </div>

        <div
          style={{
            opacity: agentOpacity,
            transform: `translateY(${agentY}px)`,
            alignSelf: "flex-start",
            maxWidth: 1200,
          }}
        >
          <div
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: "26px 26px 26px 8px",
              padding: "24px 30px",
            }}
          >
            <p style={{ fontFamily: C.sans, fontSize: 32, color: C.text, margin: 0, lineHeight: 1.34, fontWeight: 500 }}>
              {agentText}
            </p>
          </div>
          <div style={{ fontFamily: C.sans, fontSize: 18, color: C.muted, marginTop: 10 }}>OpenClaw Command Agent</div>
        </div>

        <div
          style={{
            opacity: toolBadgeOpacity,
            transform: `translateY(${toolBadgeY}px)`,
            alignSelf: "center",
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: C.surfaceHigh,
            border: `1px solid ${C.violet}66`,
            borderRadius: 14,
            padding: "14px 24px",
            boxShadow: `0 0 26px ${C.violetGlow}`,
          }}
        >
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: C.violet, boxShadow: `0 0 14px ${C.violet}` }} />
          <span style={{ fontFamily: C.mono, fontSize: 24, color: C.violet, fontWeight: 700 }}>kroxy_hire</span>
          <span style={{ fontFamily: C.sans, fontSize: 20, color: C.muted }}>launching mission hiring flow</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
