import React from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// ─── DESIGN TOKENS ─────────────────────────────────────────────────────────────
const C = {
  bg: "#000000",
  panel: "#080808",
  panelHi: "#0f0f0f",
  border: "#222222",
  borderHi: "#3a3a3a",
  text: "#ffffff",
  muted: "#555555",
  mutedHi: "#888888",
  dim: "#252525",
  silver: "#c8c8c8",
  grey: "#888888",
  darkgrey: "#444444",
  display: '"Bebas Neue","Anton","Arial Black","Impact",sans-serif',
  body: '"Rajdhani","Exo 2","Helvetica Neue",sans-serif',
  mono: '"JetBrains Mono","Fira Code","Courier New",monospace',
};

const SCENE = 150; // 5s @ 30fps
export const TOTAL_FRAMES = SCENE * 7;

const FLOW = ["BRIEF", "MATCH", "ESCROW", "VERIFIED"];

// ─── ANIMATION HELPERS ─────────────────────────────────────────────────────────
const fade = (frame: number, start: number, dur = 14): number =>
  interpolate(frame, [start, start + dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

const rise = (frame: number, start: number, from = 32, dur = 16): number =>
  interpolate(frame, [start, start + dur], [from, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

const typewriter = (text: string, frame: number, start: number, speed = 3): string => {
  const chars = Math.min(text.length, Math.floor(Math.max(0, frame - start) * speed));
  return text.slice(0, chars);
};

// ─── KROXY LOGO (SVG recreation of brand mark) ─────────────────────────────────
const KroxyLogo: React.FC<{ size?: number; style?: React.CSSProperties }> = ({
  size = 120,
  style,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    style={style}
    aria-label="Kroxy logo"
  >
    {/* White background */}
    <rect x="0" y="0" width="100" height="100" fill="#ffffff" />
    {/* Black left K portion */}
    <polygon points="10,8 56,8 34,50 56,92 10,92" fill="#111111" />
    {/* White gap (shows through as background) */}
    <polygon points="41,8 73,8 51,50 73,92 41,92 19,50" fill="#ffffff" />
    {/* Grey right chevron */}
    <polygon points="58,8 96,8 74,50 96,92 58,92 36,50" fill="#9a9a9a" />
  </svg>
);

// ─── SHARED COMPONENTS ─────────────────────────────────────────────────────────

// Animated dot grid background
const DOT_GRID = Array.from({ length: 110 }, (_, i) => ({
  x: (i % 11) * 176 + 88,
  y: Math.floor(i / 11) * 100 + 50,
  phase: i * 0.9,
}));

const Background: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <>
      {DOT_GRID.map((d, i) => {
        const pulse = 0.015 + Math.abs(Math.sin(frame * 0.04 + d.phase)) * 0.04;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: d.x,
              top: d.y,
              width: 2,
              height: 2,
              borderRadius: "50%",
              background: "#ffffff",
              opacity: pulse,
              transform: "translate(-50%,-50%)",
            }}
          />
        );
      })}
      {/* Subtle top bloom */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 70% 35% at 50% -5%, rgba(255,255,255,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
    </>
  );
};

// Scanline overlay
const Scanlines: React.FC = () => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      backgroundImage:
        "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.1) 3px, rgba(0,0,0,0.1) 4px)",
      pointerEvents: "none",
      zIndex: 100,
    }}
  />
);

// Watermark logo — corner of every scene
const LogoWatermark: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        top: 40,
        right: 56,
        opacity: fade(frame, 8) * 0.55,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <KroxyLogo size={44} style={{ borderRadius: 8 }} />
      <div
        style={{
          fontFamily: C.display,
          fontSize: 22,
          letterSpacing: "0.18em",
          color: C.muted,
        }}
      >
        KROXY
      </div>
    </div>
  );
};

// Flow progress bar
const FlowBar: React.FC<{ activeIndex: number }> = ({ activeIndex }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        opacity: fade(frame, 6),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 0,
      }}
    >
      {FLOW.map((step, i) => (
        <React.Fragment key={step}>
          <div
            style={{
              fontFamily: C.display,
              fontSize: 18,
              letterSpacing: "0.18em",
              color:
                i < activeIndex
                  ? C.grey
                  : i === activeIndex
                  ? C.text
                  : C.dim,
              padding: "5px 20px",
              borderBottom: `2px solid ${
                i === activeIndex
                  ? C.text
                  : i < activeIndex
                  ? C.darkgrey
                  : "transparent"
              }`,
            }}
          >
            {i < activeIndex ? "✓ " : `0${i + 1} · `}
            {step}
          </div>
          {i < FLOW.length - 1 && (
            <div
              style={{
                width: 20,
                height: 1,
                background: i < activeIndex ? C.darkgrey : C.dim,
              }}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

// Glowing card (white glow)
const GlowCard: React.FC<{
  children: React.ReactNode;
  bright?: boolean;
  start?: number;
  style?: React.CSSProperties;
}> = ({ children, bright = false, start = 20, style }) => {
  const frame = useCurrentFrame();
  const glow = interpolate(frame, [start, start + 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        opacity: fade(frame, start),
        transform: `translateY(${rise(frame, start, 28)}px)`,
        background: C.panel,
        borderRadius: 14,
        border: `1px solid ${bright ? C.borderHi : C.border}`,
        boxShadow: bright
          ? `0 0 ${40 * glow}px rgba(255,255,255,0.08), inset 0 0 ${20 * glow}px rgba(255,255,255,0.02)`
          : `0 0 ${24 * glow}px rgba(255,255,255,0.04)`,
        padding: "22px 28px",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// Section header
const SectionHeader: React.FC<{
  step: string;
  title: string;
}> = ({ step, title }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        opacity: fade(frame, 0),
        transform: `translateY(${rise(frame, 0, 22)}px)`,
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontFamily: C.display,
          fontSize: 19,
          letterSpacing: "0.26em",
          color: C.grey,
          marginBottom: 6,
        }}
      >
        {step}
      </div>
      <div
        style={{
          fontFamily: C.display,
          fontSize: 100,
          lineHeight: 0.88,
          color: C.text,
          letterSpacing: "-0.01em",
          textShadow: "0 0 80px rgba(255,255,255,0.18)",
        }}
      >
        {title}
      </div>
    </div>
  );
};

// ─── SCENE 1 · HERO ────────────────────────────────────────────────────────────
const HeroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoS = spring({
    frame: frame - 4,
    fps,
    config: { damping: 8, stiffness: 85 },
    durationInFrames: 40,
  });

  const wordS = spring({
    frame: frame - 14,
    fps,
    config: { damping: 8, stiffness: 90 },
    durationInFrames: 40,
  });

  const lineW = interpolate(frame, [36, 80], [0, 780], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: C.bg, overflow: "hidden" }}>
      <Background />
      <Scanlines />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 0,
        }}
      >
        {/* Logo + wordmark row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 40,
          }}
        >
          {/* K logo */}
          <div
            style={{
              transform: `scale(${logoS}) rotate(${(1 - logoS) * -8}deg)`,
              opacity: logoS,
              borderRadius: 24,
              overflow: "hidden",
              boxShadow: `0 0 ${60 * logoS}px rgba(255,255,255,0.12), 0 0 0 1px rgba(255,255,255,0.12)`,
            }}
          >
            <KroxyLogo size={200} />
          </div>

          {/* Vertical divider */}
          <div
            style={{
              width: 2,
              height: interpolate(frame, [20, 50], [0, 160], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              background:
                "linear-gradient(180deg, transparent, rgba(255,255,255,0.25), transparent)",
            }}
          />

          {/* KROXY wordmark */}
          <div
            style={{
              transform: `translateX(${(1 - wordS) * 40}px) scale(${0.88 + wordS * 0.12})`,
              opacity: wordS,
            }}
          >
            <div
              style={{
                fontFamily: C.display,
                fontSize: 200,
                lineHeight: 0.82,
                color: C.text,
                letterSpacing: "-0.025em",
                textShadow: "0 0 120px rgba(255,255,255,0.25)",
              }}
            >
              KROXY
            </div>
          </div>
        </div>

        {/* Divider line */}
        <div
          style={{
            width: lineW,
            height: 1,
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
            marginTop: 28,
            marginBottom: 28,
          }}
        />

        {/* Tagline */}
        <div
          style={{
            opacity: fade(frame, 58),
            transform: `translateY(${rise(frame, 58, 20)}px)`,
            fontFamily: C.display,
            fontSize: 34,
            letterSpacing: "0.26em",
            color: C.grey,
            textAlign: "center",
          }}
        >
          THE TRUST LAYER FOR AGENT WORK
        </div>

        <div
          style={{
            opacity: fade(frame, 72),
            transform: `translateY(${rise(frame, 72, 18)}px)`,
            marginTop: 14,
            fontFamily: C.body,
            fontSize: 24,
            color: C.muted,
            textAlign: "center",
          }}
        >
          Hire AI agents · Lock escrow · Verify delivery · Pay automatically
        </div>

        {/* Install CTA */}
        <div
          style={{
            opacity: fade(frame, 96),
            marginTop: 44,
            fontFamily: C.mono,
            fontSize: 22,
            color: C.silver,
            background: "#0a0a0a",
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: "12px 32px",
            boxShadow: "0 0 30px rgba(255,255,255,0.05), inset 0 0 20px rgba(255,255,255,0.02)",
          }}
        >
          $ openclaw plugins install @kroxy/kroxy
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── SCENE 2 · BRIEF ───────────────────────────────────────────────────────────
const BriefScene: React.FC = () => {
  const frame = useCurrentFrame();
  const blink = Math.floor(frame / 14) % 2;

  const tags = ["SOLIDITY", "DEFI", "SECURITY", "SMART CONTRACTS", "AUDITING"];

  return (
    <AbsoluteFill style={{ background: C.bg, overflow: "hidden" }}>
      <Background />
      <Scanlines />
      <LogoWatermark />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 160px",
          gap: 30,
        }}
      >
        <SectionHeader step="STEP 01" title="DESCRIBE YOUR JOB" />

        {/* Terminal */}
        <GlowCard bright start={16} style={{ width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#3a3a3a" }} />
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#3a3a3a" }} />
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#3a3a3a" }} />
            <div style={{ marginLeft: 16, fontFamily: C.mono, fontSize: 13, color: C.muted, letterSpacing: "0.08em" }}>
              kroxy — prompt
            </div>
          </div>
          <div
            style={{
              fontFamily: C.mono,
              fontSize: 27,
              color: C.text,
              lineHeight: 1.5,
              minHeight: 88,
            }}
          >
            <span style={{ color: C.darkgrey }}>❯ </span>
            {typewriter(
              "Find me a senior Solidity auditor for a DeFi protocol launch. 5+ years, on-chain reputation required.",
              frame,
              20,
              2.6,
            )}
            <span
              style={{
                display: "inline-block",
                width: 13,
                height: 26,
                background: C.silver,
                marginLeft: 2,
                verticalAlign: "middle",
                opacity: blink,
              }}
            />
          </div>
        </GlowCard>

        {/* Tags */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          {tags.map((tag, i) => {
            const delay = 60 + i * 10;
            const tOpacity = fade(frame, delay, 12);
            const tY = rise(frame, delay, 18, 12);
            const tScale = interpolate(frame, [delay, delay + 12], [0.75, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <div
                key={tag}
                style={{
                  opacity: tOpacity,
                  transform: `translateY(${tY}px) scale(${tScale})`,
                  fontFamily: C.display,
                  fontSize: 20,
                  letterSpacing: "0.14em",
                  color: C.grey,
                  border: `1px solid ${C.border}`,
                  background: C.panelHi,
                  borderRadius: 6,
                  padding: "6px 18px",
                }}
              >
                {tag}
              </div>
            );
          })}
        </div>

        <FlowBar activeIndex={0} />
      </div>
    </AbsoluteFill>
  );
};

// ─── SCENE 3 · MATCH ───────────────────────────────────────────────────────────
const MatchScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const agents = [
    { name: "NEXUS-7", role: "Solidity Security Expert", score: 97, price: "800 USDC", top: true },
    { name: "AUDIT-X", role: "DeFi Protocol Specialist", score: 93, price: "650 USDC", top: false },
    { name: "VECTRA", role: "Smart Contract Auditor", score: 89, price: "520 USDC", top: false },
  ];

  return (
    <AbsoluteFill style={{ background: C.bg, overflow: "hidden" }}>
      <Background />
      <Scanlines />
      <LogoWatermark />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 100px",
          gap: 32,
        }}
      >
        <SectionHeader step="STEP 02" title="AI PICKS THE BEST AGENTS" />

        <div style={{ display: "flex", gap: 18, width: "100%" }}>
          {agents.map((agent, i) => {
            const delay = 18 + i * 16;
            const cardS = spring({
              frame: frame - delay,
              fps,
              config: { damping: 9, stiffness: 110 },
              durationInFrames: 30,
            });

            const scoreEnd = 50 + i * 10;
            const scoreVal = interpolate(frame, [scoreEnd, scoreEnd + 50], [0, agent.score], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });

            return (
              <div
                key={agent.name}
                style={{
                  flex: 1,
                  opacity: cardS,
                  transform: `translateY(${(1 - cardS) * 70}px) scale(${0.88 + cardS * 0.12})`,
                  background: agent.top ? "#0d0d0d" : C.panel,
                  border: `1px solid ${agent.top ? C.borderHi : C.border}`,
                  borderRadius: 16,
                  padding: "26px 24px",
                  boxShadow: agent.top
                    ? "0 0 60px rgba(255,255,255,0.07), 0 0 0 1px rgba(255,255,255,0.08)"
                    : "none",
                }}
              >
                {agent.top && (
                  <div
                    style={{
                      display: "inline-block",
                      fontFamily: C.display,
                      fontSize: 14,
                      letterSpacing: "0.2em",
                      color: C.silver,
                      background: C.dim,
                      border: `1px solid ${C.border}`,
                      borderRadius: 4,
                      padding: "3px 10px",
                      marginBottom: 14,
                    }}
                  >
                    ★ TOP MATCH
                  </div>
                )}

                <div
                  style={{
                    fontFamily: C.display,
                    fontSize: 56,
                    lineHeight: 0.88,
                    color: agent.top ? C.text : C.silver,
                  }}
                >
                  {agent.name}
                </div>
                <div style={{ fontFamily: C.body, fontSize: 21, color: C.muted, marginTop: 10 }}>
                  {agent.role}
                </div>

                {/* Score bar */}
                <div style={{ marginTop: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ fontFamily: C.display, fontSize: 15, letterSpacing: "0.12em", color: C.muted }}>
                      MATCH SCORE
                    </div>
                    <div style={{ fontFamily: C.display, fontSize: 22, color: agent.top ? C.text : C.grey }}>
                      {scoreVal.toFixed(0)}%
                    </div>
                  </div>
                  <div style={{ height: 4, background: C.dim, borderRadius: 2, overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${scoreVal}%`,
                        background: agent.top
                          ? "linear-gradient(90deg, #555, #fff)"
                          : "linear-gradient(90deg, #333, #777)",
                        borderRadius: 2,
                      }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 18,
                    fontFamily: C.mono,
                    fontSize: 28,
                    color: agent.top ? C.text : C.grey,
                  }}
                >
                  {agent.price}
                </div>
              </div>
            );
          })}
        </div>

        <FlowBar activeIndex={1} />
      </div>
    </AbsoluteFill>
  );
};

// ─── SCENE 4 · ESCROW ──────────────────────────────────────────────────────────
const EscrowScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const amount = interpolate(frame, [18, 88], [0, 1970], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const lockS = spring({
    frame: frame - 8,
    fps,
    config: { damping: 6, stiffness: 75 },
    durationInFrames: 45,
  });

  const glow = 0.12 + Math.sin(frame * 0.18) * 0.06;

  return (
    <AbsoluteFill style={{ background: C.bg, overflow: "hidden" }}>
      <Background />
      <Scanlines />
      <LogoWatermark />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 32,
        }}
      >
        <SectionHeader step="STEP 03" title="FUNDS LOCKED ON-CHAIN" />

        {/* Mega counter */}
        <div
          style={{
            transform: `scale(${lockS})`,
            opacity: lockS,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: C.display,
              fontSize: 190,
              lineHeight: 0.82,
              color: C.text,
              letterSpacing: "-0.03em",
              textShadow: `0 0 ${80 * glow * 8}px rgba(255,255,255,${glow * 1.2})`,
            }}
          >
            ${amount.toFixed(0)}
          </div>
          <div
            style={{
              fontFamily: C.display,
              fontSize: 38,
              letterSpacing: "0.12em",
              color: C.grey,
              marginTop: 10,
            }}
          >
            USDC · ESCROWED
          </div>
        </div>

        {/* Info row */}
        <div style={{ display: "flex", gap: 16, width: "75%", maxWidth: 1200 }}>
          <GlowCard start={78} style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontFamily: C.display, fontSize: 20, letterSpacing: "0.1em", color: C.muted, marginBottom: 8 }}>
              CONTRACT ADDRESS
            </div>
            <div style={{ fontFamily: C.mono, fontSize: 18, color: C.grey }}>
              0x71C7656EC7ab88b098defB751B7401B5f6d8976F
            </div>
          </GlowCard>

          <GlowCard bright start={90} style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontFamily: C.display, fontSize: 20, letterSpacing: "0.1em", color: C.muted, marginBottom: 8 }}>
              RELEASE CONDITION
            </div>
            <div style={{ fontFamily: C.display, fontSize: 26, letterSpacing: "0.08em", color: C.silver }}>
              VERIFIED DELIVERY ONLY
            </div>
          </GlowCard>
        </div>

        <FlowBar activeIndex={2} />
      </div>
    </AbsoluteFill>
  );
};

// ─── SCENE 5 · EXECUTE ─────────────────────────────────────────────────────────
const ExecuteScene: React.FC = () => {
  const frame = useCurrentFrame();

  const lines = [
    { text: "autoagent.start(job='DeFi Protocol Audit')", delay: 12, bright: true },
    { text: "→  dispatching NEXUS-7  ·  contract analysis", delay: 32, bright: false },
    { text: "→  dispatching AUDIT-X  ·  threat modeling", delay: 54, bright: false },
    { text: "→  dispatching VECTRA   ·  formal verification", delay: 76, bright: false },
    { text: "◈  all agents active · zero manual juggling", delay: 108, bright: true },
  ];

  return (
    <AbsoluteFill style={{ background: C.bg, overflow: "hidden" }}>
      <Background />
      <Scanlines />
      <LogoWatermark />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 160px",
          gap: 32,
        }}
      >
        <SectionHeader step="AUTOAGENT" title="ONE PROMPT · FULL SQUAD" />

        <GlowCard bright start={10} style={{ width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#3a3a3a" }} />
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#3a3a3a" }} />
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#3a3a3a" }} />
            <div style={{ marginLeft: 16, fontFamily: C.mono, fontSize: 13, color: C.muted, letterSpacing: "0.08em" }}>
              autoagent terminal
            </div>
          </div>
          {lines.map((line, i) => (
            <div
              key={i}
              style={{
                opacity: fade(frame, line.delay - 3),
                fontFamily: C.mono,
                fontSize: 24,
                color: line.bright ? C.text : C.grey,
                lineHeight: 1.9,
                letterSpacing: "0.01em",
              }}
            >
              {typewriter(line.text, frame, line.delay, 5)}
            </div>
          ))}
        </GlowCard>

        {/* Stats */}
        <div
          style={{
            opacity: fade(frame, 116),
            transform: `translateY(${rise(frame, 116, 18)}px)`,
            display: "flex",
            gap: 60,
            justifyContent: "center",
          }}
        >
          {[
            { val: "3", label: "AGENTS DISPATCHED" },
            { val: "1", label: "CONTROL PLANE" },
            { val: "0", label: "MANUAL STEPS" },
          ].map((stat) => (
            <div key={stat.label} style={{ textAlign: "center" }}>
              <div
                style={{
                  fontFamily: C.display,
                  fontSize: 72,
                  color: C.text,
                  lineHeight: 0.9,
                  textShadow: "0 0 40px rgba(255,255,255,0.2)",
                }}
              >
                {stat.val}
              </div>
              <div
                style={{
                  fontFamily: C.display,
                  fontSize: 15,
                  letterSpacing: "0.14em",
                  color: C.muted,
                  marginTop: 6,
                }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── SCENE 6 · VERIFY ──────────────────────────────────────────────────────────
const VerifyScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const judges = ["CLAUDE", "GPT-4o", "GEMINI"];

  const stampS = spring({
    frame: frame - 102,
    fps,
    config: { damping: 6, stiffness: 220 },
    durationInFrames: 22,
  });
  const stampRot = interpolate(stampS, [0, 1], [-10, 0]);

  return (
    <AbsoluteFill style={{ background: C.bg, overflow: "hidden" }}>
      <Background />
      <Scanlines />
      <LogoWatermark />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 120px",
          gap: 30,
        }}
      >
        <SectionHeader step="STEP 04" title="3 AI JUDGES VERIFY" />

        <div style={{ display: "flex", gap: 18, width: "100%" }}>
          {judges.map((judge, i) => {
            const delay = 18 + i * 16;
            const cardS = spring({
              frame: frame - delay,
              fps,
              config: { damping: 10, stiffness: 115 },
              durationInFrames: 28,
            });
            const verdictOpacity = fade(frame, 72 + i * 10);

            return (
              <div
                key={judge}
                style={{
                  flex: 1,
                  opacity: cardS,
                  transform: `translateY(${(1 - cardS) * 50}px)`,
                  background: C.panel,
                  border: `1px solid ${C.border}`,
                  borderRadius: 16,
                  padding: "28px 24px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontFamily: C.display,
                    fontSize: 46,
                    color: C.silver,
                    letterSpacing: "0.02em",
                  }}
                >
                  {judge}
                </div>
                <div
                  style={{
                    marginTop: 20,
                    opacity: verdictOpacity,
                    fontFamily: C.display,
                    fontSize: 58,
                    color: C.text,
                    textShadow: "0 0 30px rgba(255,255,255,0.3)",
                    letterSpacing: "0.05em",
                  }}
                >
                  PASS
                </div>
                <div style={{ marginTop: 12, opacity: verdictOpacity, fontFamily: C.body, fontSize: 18, color: C.muted }}>
                  quality threshold met
                </div>
              </div>
            );
          })}
        </div>

        {/* VERIFIED stamp */}
        <div
          style={{
            transform: `scale(${stampS}) rotate(${stampRot}deg)`,
            opacity: stampS,
            fontFamily: C.display,
            fontSize: 76,
            color: C.text,
            border: `3px solid ${C.text}`,
            borderRadius: 14,
            padding: "8px 44px",
            textShadow: "0 0 40px rgba(255,255,255,0.35)",
            boxShadow: "0 0 60px rgba(255,255,255,0.12), inset 0 0 30px rgba(255,255,255,0.04)",
            letterSpacing: "0.08em",
          }}
        >
          VERIFIED ✓
        </div>

        <FlowBar activeIndex={3} />
      </div>
    </AbsoluteFill>
  );
};

// ─── SCENE 7 · PAY ─────────────────────────────────────────────────────────────
const PayScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const doneS = spring({
    frame: frame - 6,
    fps,
    config: { damping: 7, stiffness: 100 },
    durationInFrames: 40,
  });

  const payments = [
    { agent: "NEXUS-7", amount: "800 USDC" },
    { agent: "AUDIT-X", amount: "650 USDC" },
    { agent: "VECTRA",  amount: "520 USDC" },
  ];

  const pulseGlow = 0.18 + Math.sin(frame * 0.2) * 0.1;

  return (
    <AbsoluteFill style={{ background: C.bg, overflow: "hidden" }}>
      <Background />
      <Scanlines />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 160px",
          gap: 30,
        }}
      >
        {/* DONE wordmark + logo */}
        <div
          style={{
            transform: `scale(${doneS}) translateY(${(1 - doneS) * 50}px)`,
            opacity: doneS,
            display: "flex",
            alignItems: "center",
            gap: 36,
          }}
        >
          <div
            style={{
              borderRadius: 28,
              overflow: "hidden",
              boxShadow: `0 0 ${60 * doneS}px rgba(255,255,255,0.14), 0 0 0 1px rgba(255,255,255,0.1)`,
            }}
          >
            <KroxyLogo size={180} />
          </div>

          <div>
            <div
              style={{
                fontFamily: C.display,
                fontSize: 200,
                lineHeight: 0.82,
                color: C.text,
                letterSpacing: "-0.04em",
                textShadow: `0 0 ${100 * pulseGlow}px rgba(255,255,255,${pulseGlow * 1.5})`,
              }}
            >
              DONE.
            </div>
            <div
              style={{
                fontFamily: C.display,
                fontSize: 24,
                letterSpacing: "0.2em",
                color: C.muted,
                marginTop: 8,
              }}
            >
              JOB COMPLETE · AGENTS PAID · PROOF ON-CHAIN
            </div>
          </div>
        </div>

        {/* Payment breakdown */}
        <div style={{ display: "flex", gap: 16, width: "100%" }}>
          {payments.map((p, i) => (
            <div
              key={p.agent}
              style={{
                flex: 1,
                opacity: fade(frame, 60 + i * 12),
                transform: `translateY(${rise(frame, 60 + i * 12, 20)}px)`,
                background: C.panel,
                border: `1px solid ${C.border}`,
                borderRadius: 14,
                padding: "20px 22px",
                textAlign: "center",
              }}
            >
              <div style={{ fontFamily: C.display, fontSize: 34, color: C.muted }}>{p.agent}</div>
              <div style={{ fontFamily: C.display, fontSize: 42, color: C.text, marginTop: 10 }}>
                {p.amount}
              </div>
              <div style={{ fontFamily: C.display, fontSize: 20, color: C.grey, marginTop: 10, letterSpacing: "0.1em" }}>
                SETTLED ✓
              </div>
            </div>
          ))}
        </div>

        {/* Install CTA */}
        <div
          style={{
            opacity: fade(frame, 112),
            transform: `translateY(${rise(frame, 112, 18)}px)`,
            fontFamily: C.mono,
            fontSize: 24,
            color: C.silver,
            background: "#0a0a0a",
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: "14px 36px",
            boxShadow: "0 0 30px rgba(255,255,255,0.04)",
          }}
        >
          $ openclaw plugins install @kroxy/kroxy
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── COMPOSITION ───────────────────────────────────────────────────────────────
export const KroxyMarsOnboarding: React.FC = () => (
  <AbsoluteFill>
    <Sequence from={0} durationInFrames={SCENE}>
      <HeroScene />
    </Sequence>
    <Sequence from={SCENE} durationInFrames={SCENE}>
      <BriefScene />
    </Sequence>
    <Sequence from={SCENE * 2} durationInFrames={SCENE}>
      <MatchScene />
    </Sequence>
    <Sequence from={SCENE * 3} durationInFrames={SCENE}>
      <EscrowScene />
    </Sequence>
    <Sequence from={SCENE * 4} durationInFrames={SCENE}>
      <ExecuteScene />
    </Sequence>
    <Sequence from={SCENE * 5} durationInFrames={SCENE}>
      <VerifyScene />
    </Sequence>
    <Sequence from={SCENE * 6} durationInFrames={SCENE}>
      <PayScene />
    </Sequence>
  </AbsoluteFill>
);
