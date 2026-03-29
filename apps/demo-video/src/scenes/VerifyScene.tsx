import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { C, Grid, Vignette, GlowDot, fade, slide } from "../styles";

interface CheckRowProps {
  label: string;
  endpoint: string;
  value: string;
  threshold: string;
  startFrame: number;
  passFrame: number;
}

const CheckRow: React.FC<CheckRowProps> = ({ label, endpoint, value, threshold, startFrame, passFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const rowOp = fade(frame, startFrame);
  const rowY = slide(frame, startFrame, 16);
  const passed = frame >= passFrame;
  const checkScale = spring({ frame: frame - passFrame, fps, config: { damping: 12 }, durationInFrames: 20 });
  const barWidth = interpolate(frame, [startFrame + 12, passFrame], [0, 100], { extrapolateRight: "clamp" });

  return (
    <div
      style={{
        opacity: rowOp,
        transform: `translateY(${rowY}px)`,
        display: "flex",
        alignItems: "center",
        gap: 26,
        background: C.surface,
        border: `1px solid ${passed ? C.green + "88" : C.border}`,
        borderRadius: 16,
        padding: "20px 24px",
        width: 1420,
        boxShadow: passed ? `0 0 22px ${C.green}24` : "none",
      }}
    >
      <div
        style={{
          width: 46,
          height: 46,
          borderRadius: "50%",
          background: passed ? `${C.green}22` : `${C.muted}22`,
          border: `2px solid ${passed ? C.green : C.muted}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transform: passed ? `scale(${checkScale})` : "scale(1)",
        }}
      >
        <span style={{ color: passed ? C.green : C.muted, fontSize: 23, fontWeight: 700 }}>{passed ? "✓" : "…"}</span>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: C.sans, fontSize: 31, fontWeight: 700, color: C.text }}>{label}</div>
        <div
          style={{
            fontFamily: C.mono,
            fontSize: 18,
            color: C.muted,
            marginTop: 6,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {endpoint}
        </div>
        <div style={{ marginTop: 12, height: 6, background: C.dim, borderRadius: 3, overflow: "hidden" }}>
          <div
            style={{
              width: `${barWidth}%`,
              height: "100%",
              background: `linear-gradient(90deg, ${C.violet}, ${C.green})`,
              borderRadius: 3,
            }}
          />
        </div>
      </div>

      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div
          style={{
            fontFamily: C.mono,
            fontSize: 34,
            fontWeight: 700,
            color: passed ? C.green : C.muted,
            letterSpacing: "-0.02em",
          }}
        >
          {value}
        </div>
        <div style={{ fontFamily: C.sans, fontSize: 18, color: C.muted, marginTop: 4 }}>
          required {threshold}
        </div>
      </div>
    </div>
  );
};

export const VerifyScene: React.FC = () => {
  const frame = useCurrentFrame();

  const titleOp = fade(frame, 0);
  const summaryOp = fade(frame, 176);
  const summaryY = slide(frame, 176, 14);

  return (
    <AbsoluteFill style={{ background: C.bg, justifyContent: "center", alignItems: "center" }}>
      <Grid />
      <GlowDot x={960} y={540} color={C.green} size={640} />
      <Vignette />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 26 }}>
        <div style={{ opacity: titleOp, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: C.sans, fontSize: 22, color: C.green, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700 }}>
            Step 5 · Mission Verification
          </span>
          <h2 style={{ margin: 0, fontFamily: C.sans, fontSize: 58, color: C.text, fontWeight: 800, letterSpacing: "-0.02em" }}>
            Kroxy checks quality rules before any payout
          </h2>
        </div>

        <CheckRow
          label="Trajectory simulation score"
          endpoint="GET /verify/job_mars_2026_0412/trajectory"
          value="94 / 100"
          threshold=">= 85"
          startFrame={20}
          passFrame={65}
        />
        <CheckRow
          label="Habitat resilience report completeness"
          endpoint="GET /verify/job_mars_2026_0412/habitat"
          value="complete"
          threshold="complete"
          startFrame={52}
          passFrame={108}
        />
        <CheckRow
          label="Citation package + confidence envelope"
          endpoint="GET /verify/job_mars_2026_0412/research"
          value="27 refs"
          threshold=">= 20"
          startFrame={84}
          passFrame={156}
        />

        <div
          style={{
            opacity: summaryOp,
            transform: `translateY(${summaryY}px)`,
            fontFamily: C.sans,
            fontSize: 30,
            color: C.green,
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontWeight: 700,
          }}
        >
          <span style={{ fontSize: 38 }}>✓</span>
          <span>Pass rate 100% · threshold 80% · mission approved for auto-settlement</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
