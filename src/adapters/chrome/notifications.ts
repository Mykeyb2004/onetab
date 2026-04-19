export interface NotificationAdapter {
  showCaptureFeedback(message: string): Promise<void>;
}

export const chromeNotificationsAdapter: NotificationAdapter = {
  async showCaptureFeedback(message) {
    await chrome.notifications.create({
      type: "basic",
      iconUrl: chrome.runtime.getURL("icon.svg"),
      title: "TabVault",
      message
    });
  }
};
