import type { CSSProperties } from "react";

export const uiColors = {
  paper: "#D8C8A8",
  background: "#171513",
  frame: "#3C342D",
  text: "#1F1C1A",
  warning: "#7D2424",
} as const;

export const uiFontSizes = { h1: "clamp(2.5rem, 5vw, 5rem)", h2: "clamp(1.5rem, 2.4vw, 2.25rem)", body: "1rem", caption: ".78rem" } as const;
export const uiFontWeights = { h1: 500, h2: 600, body: 400, caption: 400 } as const;
export const uiSpacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 40, xxl: 64 } as const;
export const uiBorders = { hairline: 1, emphasized: 2, radius: 0 } as const;
export const uiShadows = { paper: "0 6px 18px rgb(23 21 19 / 35%)", contact: "0 2px 5px rgb(23 21 19 / 45%)" } as const;
export const uiPanelOpacity = { paper: 0.97, metal: 0.96, sceneVeil: 0.58 } as const;
export const uiAnimationDurations = { hover: 160, paperSlide: 240, pageTurn: 320, stamp: 220 } as const;
export const uiZIndexes = { scene: 0, document: 20, overlay: 40, dialog: 60 } as const;

export type UiCssVariables = CSSProperties & Record<`--ui-${string}`, string | number>;
export const uiCssVariables: UiCssVariables = {
  "--ui-paper": uiColors.paper,
  "--ui-background": uiColors.background,
  "--ui-frame": uiColors.frame,
  "--ui-text": uiColors.text,
  "--ui-warning": uiColors.warning,
  "--ui-font-h1": uiFontSizes.h1,
  "--ui-font-h2": uiFontSizes.h2,
  "--ui-font-body": uiFontSizes.body,
  "--ui-font-caption": uiFontSizes.caption,
  "--ui-paper-shadow": uiShadows.paper,
  "--ui-contact-shadow": uiShadows.contact,
};
