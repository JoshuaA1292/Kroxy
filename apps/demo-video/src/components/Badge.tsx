import React from "react";
import { C } from "../styles";

interface BadgeProps {
  label: string;
  value: string;
  color?: string;
  glow?: string;
  mono?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  value,
  color = C.violet,
  glow,
  mono = false,
}) => (
  <div
    style={{
      display: "inline-flex",
      flexDirection: "column",
      gap: 4,
      background: C.surfaceHigh,
      border: `1px solid ${color}44`,
      borderRadius: 10,
      padding: "10px 18px",
      boxShadow: glow ? `0 0 24px ${glow}` : undefined,
    }}
  >
    <span
      style={{
        fontFamily: C.sans,
        fontSize: 10,
        color: color,
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        fontWeight: 600,
      }}
    >
      {label}
    </span>
    <span
      style={{
        fontFamily: mono ? C.mono : C.sans,
        fontSize: mono ? 12 : 15,
        color: C.text,
        fontWeight: 600,
      }}
    >
      {value}
    </span>
  </div>
);
