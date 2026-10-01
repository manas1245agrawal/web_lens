import { defineBackground } from 'wxt/utils/define-background';

export default defineBackground({
  main() {
    if (typeof chrome !== 'undefined' && chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
      chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    }
  },
});
