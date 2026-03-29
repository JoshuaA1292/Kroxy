import React from "react";
import { Composition } from "remotion";
import { KroxyMarsOnboarding, TOTAL_FRAMES } from "./Demo";

export const RemotionRoot: React.FC = () => (
  <Composition
    id="KroxyMarsOnboarding"
    component={KroxyMarsOnboarding}
    durationInFrames={TOTAL_FRAMES}
    fps={30}
    width={1920}
    height={1080}
  />
);
