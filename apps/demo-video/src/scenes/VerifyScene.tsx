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
  const rowY = slide(frame, startFrame);
  const passed = frame >= passFrame;
  const checkScale = spring({ frame: frame - passFrame, fps, config: { damping: 12 }, durationInFrames: 20 });
  const barWidth = interpolate(frame, [startFrame + 10, passFrame], [0, 100], { extrapolateRight: "clamp" });

  return (
    <div
      style={{
        opacity: rowOp,
        transform: `translateY(${rowY}px)`,
        display: "flex",
        alignItems: "center",
        gap: 20,
        background: C.surface,
        border: `1px solid ${passed ? C.green + "66" : C.border}`,
        borderRadius: 12,
        padding: "16px 20px",
        width: 760,
        transition: "border-color 0.3s",
        boxShadow: passed ? `0 0 16px ${C.green}22` : "none",
      }}
    >
      {/* Check / spinner */}
      <div
        style={{
          width: 32,
          height: 32,
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
        {passed ? (
          <span style={{ color: C.green, fontSize: 14, fontWeight: 700 }}>✓</span>
        ) : (
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              border: `2px solid ${C.muted}`,
              borderTopColor: C.violet,
              animation: "spin 1s linear infinite",
            }}
          />
        )}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: C.sans, fontSize: 14, fontWeight: 600, color: C.text }}>{label}</div>
        <div style={{ fontFamily: C.mono, fontSize: 11, color: C.muted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {endpoint}
        </div>
        {/* Progress bar */}
        <div style={{ marginTop: 8, height: 3, background: C.dim, borderRadius: 2, overflow: "hidden" }}>
          <div
            style={{
              width: `${barWidth}%`,
              height: "100%",
              background: `linear-gradient(90deg, ${C.violet}, ${C.green})`,
              borderRadius: 2,
            }}
          />
        </div>
      </div>

      {/* Value */}
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div
          style={{
            fontFamily: C.mono,
            fontSize: 16,
            fontWeight: 700,
            color: passed ? C.green : C.muted,
          }}
        >
          {value}
        </div>
        <div style={{ fontFamily: C.sans, fontSize: 11, color: C.muted, marginTop: 2 }}>
          req. {threshold}
        </div>
      </div>
    </div>
  );
};

export const VerifyScene: React.FC = () => {
  const frame = useCurrentFrame();

  const titleOp = fade(frame, 0);
  const summaryOp = fade(frame, 195);
  const summaryY = slide(frame, 195);

  return (
    <AbsoluteFill style={{ background: C.bg, justifyContent: "center", alignItems: "center" }}>
      <Grid />
      <GlowDot x={960} y={540} color={C.green} size={600} />
      <Vignette />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28 }}>

        <div style={{ opacity: titleOp, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 1, background: C.green }} />
          <span style={{ fontFamily: C.sans, fontSize: 12, color: C.green, letterSpacing: "0.14em", textTransform: "uppercase" }}>
            Verifier · Condition Checks
          </span>
          <div style={{ width: 32, height: 1, background: C.green }} />
        </div>

        <CheckRow
          label="Health Check"
          endpoint="http://localhost:3003/health"
          value="HTTP 200"
          threshold="200"
          startFrame={20}
          passFrame={70}
        />
        <CheckRow
          label="Word Count"
          endpoint="http://localhost:3003/quality-check?jobId=..."
          value="312"
          threshold="≥ 100"
          startFrame={50}
          passFrame={115}
        />
        <CheckRow
          label="Confidence Score"
          endpoint="http://localhost:3003/quality-check?jobId=..."
          value="0.91"
          threshold="≥ 0.70"
          startFrame={80}
          passFrame={160}
        />

        {/* Pass rate summary */}
        <div
          style={{
            opacity: summaryOp,
            transform: `translateY(${summaryY}px)`,
            fontFamily: C.sans,
            fontSize: 14,
            color: C.green,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ fontSize: 20 }}>✓</span>
          <span>Pass rate 100% · threshold 80% · conditions met · releasing payment</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
