export type RestoreBehavior = "remove-group" | "keep-group";
export type DefaultClickAction = "capture-current-window" | "open-manager";
export type ManagerGridDensityPreference = "compact" | "enhanced";
export type ManagerSidebarPreference = "expanded" | "collapsed";

export interface ExtensionSettings {
  restoreBehavior: RestoreBehavior;
  defaultClickAction: DefaultClickAction;
  showCaptureFeedback: boolean;
  enableContextMenu: boolean;
  managerGridDensityPreference: ManagerGridDensityPreference;
  managerSidebarPreference: ManagerSidebarPreference;
}
