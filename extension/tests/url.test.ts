import { describe, it, expect } from 'vitest';
import { normalizeUrl } from '../src/lib/url';

describe('normalizeUrl', () => {
  it('strips fragments and tracking params', () => {
    const raw = 'https://Example.COM/blog/post?utm_source=twitter&fbclid=123#section-2';
    const normalized = normalizeUrl(raw);
    expect(normalized).toBe('https://example.com/blog/post');
  });

  it('preserves valid query parameters', () => {
    const raw = 'https://example.com/search?q=rag+chat';
    const normalized = normalizeUrl(raw);
    expect(normalized).toBe('https://example.com/search?q=rag+chat');
  });
});
