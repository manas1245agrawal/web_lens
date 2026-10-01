import { extractPageContent } from './extract/toMarkdown';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message && message.type === 'EXTRACT') {
    try {
      const result = extractPageContent();
      sendResponse(result);
    } catch (err: any) {
      sendResponse({ error: err.message || 'Extraction failed' });
    }
  }
  return true; // Keep response channel open for async response
});
