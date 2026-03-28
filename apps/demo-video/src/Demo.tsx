import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { TitleScene } from "./scenes/TitleScene";
import { ChatScene } from "./scenes/ChatScene";
import { PluginScene } from "./scenes/PluginScene";
import { EscrowScene } from "./scenes/EscrowScene";
import { WorkScene } from "./scenes/WorkScene";
import { VerifyScene } from "./scenes/VerifyScene";
import { ReleaseScene } from "./scenes/ReleaseScene";
import { ResultScene } from "./scenes/ResultScene";
import { EndScene } from "./scenes/EndScene";

// Scene durations at 30fps
const D = {
  title:   210, //  7.0s — Kroxy × OpenClaw wordmark
  chat:    210, //  7.0s — user prompt → agent reply → kroxy_hire badge
  plugin:  240, //  8.0s — terminal: kroxy_hire execution
  escrow:  210, //  7.0s — wallet flow, USDC counter, tx hashes
  work:    240, //  8.0s — Nexus terminal: Claude web search
  verify:  210, //  7.0s — condition check rows
  release: 210, //  7.0s — escrow unlocks, USDC flows to Nexus
  result:  210, //  7.0s — research deliverable in chat
  end:     270, //  9.0s — audit trail + install CTA
};

// Cumulative offsets
const AT = {
  title:   0,
  chat:    D.title,
  plugin:  D.title + D.chat,
  escrow:  D.title + D.chat + D.plugin,
  work:    D.title + D.chat + D.plugin + D.escrow,
  verify:  D.title + D.chat + D.plugin + D.escrow + D.work,
  release: D.title + D.chat + D.plugin + D.escrow + D.work + D.verify,
  result:  D.title + D.chat + D.plugin + D.escrow + D.work + D.verify + D.release,
  end:     D.title + D.chat + D.plugin + D.escrow + D.work + D.verify + D.release + D.result,
};

export const TOTAL_FRAMES =
  D.title + D.chat + D.plugin + D.escrow + D.work + D.verify + D.release + D.result + D.end;

export const KroxyDemo: React.FC = () => (
  <AbsoluteFill>
    <Sequence from={AT.title}   durationInFrames={D.title}>   <TitleScene />   </Sequence>
    <Sequence from={AT.chat}    durationInFrames={D.chat}>    <ChatScene />    </Sequence>
    <Sequence from={AT.plugin}  durationInFrames={D.plugin}>  <PluginScene />  </Sequence>
    <Sequence from={AT.escrow}  durationInFrames={D.escrow}>  <EscrowScene />  </Sequence>
    <Sequence from={AT.work}    durationInFrames={D.work}>    <WorkScene />    </Sequence>
    <Sequence from={AT.verify}  durationInFrames={D.verify}>  <VerifyScene />  </Sequence>
    <Sequence from={AT.release} durationInFrames={D.release}> <ReleaseScene /> </Sequence>
    <Sequence from={AT.result}  durationInFrames={D.result}>  <ResultScene />  </Sequence>
    <Sequence from={AT.end}     durationInFrames={D.end}>     <EndScene />     </Sequence>
  </AbsoluteFill>
);
