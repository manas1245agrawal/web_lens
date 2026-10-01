export function isBlockedUrl(url: string): boolean {
  if (!url) return true;
  const lower = url.toLowerCase();

  if (
    lower.startsWith('chrome://') ||
    lower.startsWith('chrome-extension://') ||
    lower.startsWith('edge://') ||
    lower.startsWith('about:')
  ) {
    return true;
  }

  const blockedDomains = [
    'mail.google.com',
    'outlook.live.com',
    'outlook.office.com',
    'chase.com',
    'bankofamerica.com',
    'wellsfargo.com',
    'paypal.com',
  ];

  try {
    const parsed = new URL(url);
    return blockedDomains.some(
      (domain) => parsed.hostname === domain || parsed.hostname.endsWith('.' + domain)
    );
  } catch (e) {
    return false;
  }
}
