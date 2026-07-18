export type GameOverlay =
  | { kind: "none" }
  | { kind: "settlement" }
  | { kind: "roomEvent"; roomId: string }
  | { kind: "floorSelect" }
  | { kind: "storage" };

export type GameFlowState = {
  screen: "title" | "intro" | "destiny" | "run" | "dead" | "complete";
  paused: boolean;
  overlay: GameOverlay;
};

export type GameFlowAction =
  | { type: "OPEN_INTRO" }
  | { type: "OPEN_DESTINY" }
  | { type: "RETURN_REGISTRATION" }
  | { type: "START_RUN" }
  | { type: "RESTORE_RUN" }
  | { type: "TOGGLE_PAUSE" }
  | { type: "OPEN_OVERLAY"; overlay: Exclude<GameOverlay, { kind: "none" }> }
  | { type: "CLOSE_OVERLAY"; kind?: GameOverlay["kind"] }
  | { type: "DIE" }
  | { type: "COMPLETE_DEMO" }
  | { type: "RETURN_TITLE" }
  | { type: "EXIT_TO_TITLE" }
  | { type: "RESTART" };

export const INITIAL_GAME_FLOW: GameFlowState = {
  screen: "title",
  paused: false,
  overlay: { kind: "none" },
};

export function gameFlowReducer(state: GameFlowState, action: GameFlowAction): GameFlowState {
  switch (action.type) {
    case "OPEN_INTRO":
      return state.screen === "title" ? { screen: "intro", paused: false, overlay: { kind: "none" } } : state;
    case "OPEN_DESTINY":
      return state.screen === "intro" ? { screen: "destiny", paused: false, overlay: { kind: "none" } } : state;
    case "RETURN_REGISTRATION":
      return state.screen === "destiny" ? { screen: "intro", paused: false, overlay: { kind: "none" } } : state;
    case "START_RUN":
      return state.screen === "destiny" ? { screen: "run", paused: false, overlay: { kind: "none" } } : state;
    case "RESTORE_RUN":
      return state.screen === "title" ? { screen: "run", paused: false, overlay: { kind: "none" } } : state;
    case "TOGGLE_PAUSE":
      return state.screen === "run" && state.overlay.kind === "none" ? { ...state, paused: !state.paused } : state;
    case "OPEN_OVERLAY":
      if (state.screen !== "run") return state;
      if (action.overlay.kind !== "settlement" && state.overlay.kind !== "none") return state;
      return { ...state, paused: false, overlay: action.overlay };
    case "CLOSE_OVERLAY":
      if (state.screen !== "run" || state.overlay.kind === "none") return state;
      if (action.kind && action.kind !== state.overlay.kind) return state;
      return { ...state, overlay: { kind: "none" } };
    case "DIE":
      return state.screen === "run" ? { screen: "dead", paused: false, overlay: { kind: "none" } } : state;
    case "COMPLETE_DEMO":
      return state.screen === "run" ? { screen: "complete", paused: false, overlay: { kind: "none" } } : state;
    case "RETURN_TITLE":
      return state.screen === "complete" ? INITIAL_GAME_FLOW : state;
    case "EXIT_TO_TITLE":
      return state.screen === "run" || state.screen === "dead" ? INITIAL_GAME_FLOW : state;
    case "RESTART":
      return state.screen === "dead" || state.screen === "complete" ? { screen: "intro", paused: false, overlay: { kind: "none" } } : state;
  }
}
