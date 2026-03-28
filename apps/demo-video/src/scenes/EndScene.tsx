import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { C, Grid, Vignette, GlowDot, fade, slide, typewriter } from "../styles";

const FLOW_STEPS = [
  { label: "User prompt", color: C.violet },
  { label: "kroxy_hire", color: C.violet },
  { label: "Escrow locked", color: C.amber },
  { label: "Nexus researches", color: C.cyan },
  { label: "Conditions verified", color: C.green },
  { label: "Payment released", color: C.green },
];

const INSTALL_CMD = "openclaw plugins install @kroxy/kroxy";

export const EndScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Wordmark spring
  const wordmarkScale = spring({ frame: frame - 0, fps, config: { damping: 14, stiffness: 80 }, durationInFrames: 40 });
  const wordmarkOp = fade(frame, 0, 24);

  // Flow steps
  const stepsOp = fade(frame, 45);
  const stepsY = slide(frame, 45, 20);

  // Step dots stagger
  const stepProgress = (i: number) => interpolate(frame, [60 + i * 18, 80 + i * 18], [0, 1], { extrapolateRight: "clamp" });

  // Divider
  const dividerW = interpolate(frame, [160, 200], [0, 700], { extrapolateRight: "clamp" });
  const dividerOp = fade(frame, 160);

  // Install section
  const installOp = fade(frame, 200);
  const installY = slide(frame, 200, 16);
  const installCmd = typewriter(INSTALL_CMD, frame, 215, 3);

  // Tagline
  const taglineOp = fade(frame, 230);
  const taglineScale = spring({ frame: frame - 230, fps, config: { damping: 12 }, durationInFrames: 30 });

  // URL
  const urlOp = fade(frame, 250);

  return (
    <AbsoluteFill style={{ background: C.bg, justifyContent: "center", alignItems: "center" }}>
      <Grid />
      <GlowDot x={960} y={540} color={C.violet} size={800} />
      <GlowDot x={200} y={200} color={C.cyan} size={300} />
      <GlowDot x={1700} y={800} color={C.green} size={300} />
      <Vignette />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 40 }}>

        {/* Wordmark */}
        <div
          style={{
            opacity: wordmarkOp,
            transform: `scale(${wordmarkScale})`,
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <span
            style={{
              fontFamily: C.sans,
              fontSize: 52,
              fontWeight: 900,
              letterSpacing: "-0.02em",
              background: `linear-gradient(135deg, ${C.violet}, ${C.cyan})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Kroxy
          </span>
          <div style={{ width: 2, height: 40, background: C.border }} />
          <span
            style={{
              fontFamily: C.sans,
              fontSize: 52,
              fontWeight: 900,
              letterSpacing: "-0.02em",
              color: C.text,
            }}
          >
            OpenClaw
          </span>
        </div>

        {/* Flow steps */}
        <div
          style={{
            opacity: stepsOp,
            transform: `translateY(${stepsY}px)`,
            display: "flex",
            alignItems: "center",
            gap: 0,
          }}
        >
          {FLOW_STEPS.map(({ label, color }, i) => (
            <React.Fragment key={label}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  opacity: stepProgress(i),
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: color,
                    boxShadow: `0 0 10px ${color}`,
                  }}
                />
                <span style={{ fontFamily: C.sans, fontSize: 11, color, whiteSpace: "nowrap" }}>{label}</span>
              </div>
              {i < FLOW_STEPS.length - 1 && (
                <div
                  style={{
                    width: 60,
                    height: 1,
                    background: `linear-gradient(90deg, ${FLOW_STEPS[i].color}66, ${FLOW_STEPS[i + 1].color}66)`,
                    marginBottom: 14,
                    opacity: stepProgress(i + 0.5),
                  }}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Divider */}
        <div
          style={{
            opacity: dividerOp,
            width: dividerW,
            height: 1,
            background: `linear-gradient(90deg, transparent, ${C.border}, transparent)`,
          }}
        />

        {/* Install command */}
        <div
          style={{
            opacity: installOp,
            transform: `translateY(${installY}px)`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span style={{ fontFamily: C.sans, fontSize: 13, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Get started
          </span>
          <div
            style={{
              background: C.surfaceHigh,
              border: `1px solid ${C.violet}55`,
              borderRadius: 10,
              padding: "12px 28px",
              boxShadow: `0 0 30px ${C.violet}22`,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span style={{ fontFamily: C.mono, fontSize: 14, color: C.muted }}>$</span>
            <span style={{ fontFamily: C.mono, fontSize: 14, color: C.violet }}>
              {installCmd}
              {installCmd.length < INSTALL_CMD.length && (
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: "1em",
                    background: C.violet,
                    marginLeft: 2,
                    verticalAlign: "middle",
                    opacity: Math.sin(frame / 8) > 0 ? 1 : 0,
                  }}
                />
              )}
            </span>
          </div>
        </div>

        {/* Tagline */}
        <div
          style={{
            opacity: taglineOp,
            transform: `scale(${taglineScale})`,
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div
            style={{
              fontFamily: C.sans,
              fontSize: 22,
              fontWeight: 700,
              color: C.text,
            }}
          >
            Agents hiring agents.{" "}
            <span
              style={{
                background: `linear-gradient(90deg, ${C.violet}, ${C.cyan})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Paid automatically.
            </span>
          </div>
          <div style={{ opacity: urlOp, fontFamily: C.mono, fontSize: 13, color: C.muted }}>
            kroxy.ai
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
