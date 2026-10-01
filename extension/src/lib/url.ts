export function normalizeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    url.hash = ''; // Remove fragment

    // Strip common tracking parameters
    const paramsToStrip = ['fbclid', 'gclid', 'ref', 'ref_src'];
    const keys = Array.from(url.searchParams.keys());
    keys.forEach((key) => {
      if (key.startsWith('utm_') || paramsToStrip.includes(key.toLowerCase())) {
        url.searchParams.delete(key);
      }
    });

    url.hostname = url.hostname.toLowerCase();
    let href = url.toString();
    if (href.endsWith('/') && href.length > 8) {
      href = href.slice(0, -1);
    }
    return href;
  } catch (e) {
    return rawUrl.trim().toLowerCase();
  }
}
