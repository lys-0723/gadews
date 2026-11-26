export interface MediaConditions {
  visible: boolean;
  hidden: boolean;
  narrow: boolean;
  reducedMotion: boolean;
  saveData: boolean;
  userPaused: boolean;
}
export function shouldAutoplayMedia(state: MediaConditions): boolean {
  return state.visible && !state.hidden && !state.narrow && !state.reducedMotion && !state.saveData && !state.userPaused;
}
