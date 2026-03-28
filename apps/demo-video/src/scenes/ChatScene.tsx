import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { C, Grid, Vignette, GlowDot, fade, slide, typewriter } from "../styles";

const MSG = 'Research the top AI payment startups right now. Budget: $3 USDC.';

export const ChatScene: React.FC = () => {
  const frame = useCurrentFrame();

  const labelOpacity = fade(frame, 0);
  const bubbleOpacity = fade(frame, 20);
  const bubbleY = slide(frame, 20, 20, 20);
  const typed = typewriter(MSG, frame, 30, 2.5);
  const showCursor = typed.length < MSG.length;

  const agentOpacity = fade(frame, 110);
  const agentY = slide(frame, 110, 16);
  const agentText = typewriter("On it. Searching for specialist agents on Kroxy…", frame, 120, 4);

  const toolBadgeOpacity = fade(frame, 145);
  const toolBadgeY = slide(frame, 145, 16);

  return (
    <AbsoluteFill style={{ background: C.bg, justifyContent: "center", alignItems: "center" }}>
      <Grid />
      <GlowDot x={1400} y={300} color={C.cyan} size={400} />
      <GlowDot x={400} y={700} color={C.violet} size={300} />
      <Vignette />

      <div style={{ width: 680, display: "flex", flexDirection: "column", gap: 32 }}>

        {/* Section label */}
        <div style={{ opacity: labelOpacity, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 1, background: C.violet }} />
          <span style={{ fontFamily: C.sans, fontSize: 12, color: C.violet, letterSpacing: "0.14em", textTransform: "uppercase" }}>
            OpenClaw · Agent Chat
          </span>
        </div>

        {/* User bubble */}
        <div
          style={{
            opacity: bubbleOpacity,
            transform: `translateY(${bubbleY}px)`,
            alignSelf: "flex-end",
            maxWidth: 520,
          }}
        >
          <div
            style={{
              background: `linear-gradient(135deg, ${C.violet}cc, ${C.violetDim}cc)`,
              borderRadius: "18px 18px 4px 18px",
              padding: "14px 20px",
              boxShadow: `0 0 24px ${C.violetGlow}`,
            }}
          >
            <p style={{ fontFamily: C.sans, fontSize: 17, color: C.text, margin: 0, lineHeight: 1.5 }}>
              {typed}
              {showCursor && (
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: "1em",
                    background: "white",
                    marginLeft: 2,
                    verticalAlign: "middle",
                    opacity: Math.sin(frame / 8) > 0 ? 1 : 0,
                  }}
                />
              )}
            </p>
          </div>
          <div style={{ fontFamily: C.sans, fontSize: 11, color: C.muted, marginTop: 6, textAlign: "right" }}>
            You
          </div>
        </div>

        {/* Agent reply */}
        <div
          style={{
            opacity: agentOpacity,
            transform: `translateY(${agentY}px)`,
            alignSelf: "flex-start",
            maxWidth: 520,
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
            <p style={{ fontFamily: C.sans, fontSize: 17, color: C.text, margin: 0, lineHeight: 1.5 }}>
              {agentText}
            </p>
          </div>
          <div style={{ fontFamily: C.sans, fontSize: 11, color: C.muted, marginTop: 6 }}>
            Agent · OpenClaw
          </div>
        </div>

        {/* Tool invocation badge */}
        <div
          style={{
            opacity: toolBadgeOpacity,
            transform: `translateY(${toolBadgeY}px)`,
            alignSelf: "center",
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: C.surfaceHigh,
            border: `1px solid ${C.violet}55`,
            borderRadius: 10,
            padding: "8px 18px",
            boxShadow: `0 0 20px ${C.violetGlow}`,
          }}
        >
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.violet, boxShadow: `0 0 8px ${C.violet}` }} />
          <span style={{ fontFamily: C.mono, fontSize: 13, color: C.violet }}>
            kroxy_hire
          </span>
          <span style={{ fontFamily: C.sans, fontSize: 12, color: C.muted }}>
            · calling tool
          </span>
        </div>

      </div>
    </AbsoluteFill>
  );
};
