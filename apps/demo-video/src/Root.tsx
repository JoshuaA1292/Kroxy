import React from "react";
import { Composition } from "remotion";
import { KroxyDemo, TOTAL_FRAMES } from "./Demo";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="KroxyDemo"
      component={KroxyDemo}
      durationInFrames={TOTAL_FRAMES}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{}}
    />
  </>
);
