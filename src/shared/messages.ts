export type RuntimeMessage =
  | { type: "capture/current-window" }
  | { type: "capture/current-tab" }
  | { type: "capture/selected-tabs" }
  | { type: "open/manager" }
  | { type: "open/options" };

export interface RuntimeResponse {
  ok: boolean;
  message: string;
}

export async function sendRuntimeMessage(
  message: RuntimeMessage
): Promise<RuntimeResponse> {
  return chrome.runtime.sendMessage(message);
}
