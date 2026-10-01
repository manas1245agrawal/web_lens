import { useState, useEffect, useCallback } from 'react';
import { normalizeUrl } from '../lib/url';
import { sha256Hex } from '../lib/hash';
import { isBlockedUrl } from '../lib/denylist';
import { apiIngest, IngestResponse } from '../lib/api';

export interface PageState {
  status: 'idle' | 'extracting' | 'ingesting' | 'ready' | 'blocked' | 'error';
  url: string;
  title: string;
  pageId: string;
  mode: 'full' | 'rag';
  error: string | null;
  ingestData: IngestResponse | null;
}

export function usePage() {
  const [state, setState] = useState<PageState>({
    status: 'idle',
    url: '',
    title: '',
    pageId: '',
    mode: 'rag',
    error: null,
    ingestData: null,
  });

  const processActiveTab = useCallback(async () => {
    if (typeof chrome === 'undefined' || !chrome.tabs) {
      // Dev environment fallback
      const devUrl = 'http://localhost/sample-blog';
      const norm = normalizeUrl(devUrl);
      const devPageId = await sha256Hex(`dev-install|${norm}`);
      setState({
        status: 'ready',
        url: devUrl,
        title: 'Sample Dev Page',
        pageId: devPageId,
        mode: 'full',
        error: null,
        ingestData: null,
      });
      return;
    }

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id || !tab.url) {
        setState((s) => ({ ...s, status: 'error', error: 'No active web page found' }));
        return;
      }

      if (isBlockedUrl(tab.url)) {
        setState((s) => ({
          ...s,
          status: 'blocked',
          url: tab.url || '',
          title: tab.title || '',
          error: 'PageChat is disabled on this page for security.',
        }));
        return;
      }

      setState((s) => ({ ...s, status: 'extracting', url: tab.url || '', title: tab.title || '' }));

      // Inject & execute extractor script
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['extractor.js'],
      }).catch(() => {}); // script might already be injected

      // Send message to extractor script
      const extracted = await new Promise<any>((resolve) => {
        chrome.tabs.sendMessage(tab.id!, { type: 'EXTRACT' }, (res) => {
          if (chrome.runtime.lastError) {
            resolve({ error: chrome.runtime.lastError.message });
          } else {
            resolve(res);
          }
        });
      });

      if (!extracted || extracted.error || !extracted.markdown) {
        setState((s) => ({
          ...s,
          status: 'error',
          error: extracted?.error || 'Failed to extract content from page',
        }));
        return;
      }

      setState((s) => ({ ...s, status: 'ingesting' }));

      const contentHash = await sha256Hex(extracted.markdown);
      const ingestRes = await apiIngest({
        url: extracted.url || tab.url,
        title: extracted.title || tab.title || 'Untitled',
        markdown: extracted.markdown,
        content_hash: contentHash,
      });

      setState({
        status: 'ready',
        url: extracted.url || tab.url,
        title: extracted.title || tab.title || 'Untitled',
        pageId: ingestRes.page_id,
        mode: ingestRes.mode,
        error: null,
        ingestData: ingestRes,
      });
    } catch (err: any) {
      setState((s) => ({
        ...s,
        status: 'error',
        error: err.message || 'Error processing page',
      }));
    }
  }, []);

  useEffect(() => {
    processActiveTab();

    if (typeof chrome !== 'undefined' && chrome.tabs) {
      const handleTabUpdate = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
        if (changeInfo.status === 'complete' || changeInfo.url) {
          processActiveTab();
        }
      };

      const handleTabActivated = () => {
        processActiveTab();
      };

      chrome.tabs.onUpdated.addListener(handleTabUpdate);
      chrome.tabs.onActivated.addListener(handleTabActivated);

      return () => {
        chrome.tabs.onUpdated.removeListener(handleTabUpdate);
        chrome.tabs.onActivated.removeListener(handleTabActivated);
      };
    }
  }, [processActiveTab]);

  return { ...state, refresh: processActiveTab };
}
