export type RestoreBehavior = "remove-group" | "keep-group";
export type DefaultClickAction = "capture-current-window" | "open-manager";

export interface ExtensionSettings {
  restoreBehavior: RestoreBehavior;
  defaultClickAction: DefaultClickAction;
  showCaptureFeedback: boolean;
  enableContextMenu: boolean;
}
