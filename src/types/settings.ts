export type RestoreBehavior = "remove-group" | "keep-group";
export type DefaultClickAction = "capture-current-window" | "open-manager";
export type ManagerGridDensityPreference = "compact" | "enhanced";

export interface ExtensionSettings {
  restoreBehavior: RestoreBehavior;
  defaultClickAction: DefaultClickAction;
  showCaptureFeedback: boolean;
  enableContextMenu: boolean;
  managerGridDensityPreference: ManagerGridDensityPreference;
}
