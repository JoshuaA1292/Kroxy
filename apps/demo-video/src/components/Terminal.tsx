import React from "react";
import { useCurrentFrame } from "remotion";
import { C, typewriter, fade } from "../styles";

interface Line {
  text: string;
  /** frame at which this line starts typing */
  start: number;
  /** chars per frame (default 3) */
  speed?: number;
  color?: string;
  prefix?: string;
}

interface TerminalProps {
  lines: Line[];
  width?: number;
  title?: string;
}

export const Terminal: React.FC<TerminalProps> = ({
  lines,
  width = 720,
  title = "terminal",
}) => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        width,
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        overflow: "hidden",
        fontFamily: C.mono,
        fontSize: 15,
        boxShadow: `0 0 40px rgba(124,58,237,0.12), 0 24px 48px rgba(0,0,0,0.6)`,
      }}
    >
      {/* Title bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 16px",
          background: C.surfaceHigh,
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        {["#ef4444", "#f59e0b", "#10b981"].map((c) => (
          <div
            key={c}
            style={{ width: 11, height: 11, borderRadius: "50%", background: c, opacity: 0.8 }}
          />
        ))}
        <span
          style={{
            marginLeft: 8,
            color: C.muted,
            fontSize: 12,
            letterSpacing: "0.04em",
          }}
        >
          {title}
        </span>
      </div>

      {/* Content */}
      <div style={{ padding: "20px 24px", minHeight: 80, lineHeight: 1.7 }}>
        {lines.map((line, i) => {
          const opacity = fade(frame, line.start);
          const text = typewriter(line.text, frame, line.start, line.speed ?? 3);
          const isLast = i === lines.length - 1;
          const showCursor = isLast && text.length < line.text.length;

          return (
            <div key={i} style={{ opacity, display: "flex", gap: 8 }}>
              {line.prefix !== undefined ? (
                <span style={{ color: C.violet, flexShrink: 0 }}>{line.prefix}</span>
              ) : null}
              <span style={{ color: line.color ?? C.text }}>
                {text}
                {showCursor && (
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
          );
        })}
      </div>
    </div>
  );
};
