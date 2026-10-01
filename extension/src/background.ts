// Service worker background script for PageChat
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => console.error('Error setting side panel behavior:', err));
