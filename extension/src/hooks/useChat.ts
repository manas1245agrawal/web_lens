import { useState, useEffect, useRef, useCallback } from 'react';
import { getInstallId, getChatVersion, bumpChatVersion } from '../lib/identity';
import { apiGetHistory, apiStreamChat, apiDeletePage, ChatMessage } from '../lib/api';

export function useChat(pageId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatVersion, setChatVersion] = useState(1);
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadHistory = useCallback(async () => {
    if (!pageId) return;
    try {
      const installId = await getInstallId();
      const version = await getChatVersion(pageId);
      setChatVersion(version);
      const threadId = `${installId}:${pageId}:${version}`;
      const history = await apiGetHistory(threadId);
      setMessages(history.messages || []);
      setError(null);
    } catch (e: any) {
      console.error('Failed to load history:', e);
    }
  }, [pageId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || !pageId || isStreaming) return;

    setError(null);
    const userMsg: ChatMessage = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg, { role: 'assistant', content: '' }]);
    setIsStreaming(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const installId = await getInstallId();
      const threadId = `${installId}:${pageId}:${chatVersion}`;

      const stream = apiStreamChat(pageId, threadId, text, controller.signal);

      for await (const event of stream) {
        if (event.type === 'token' && event.text) {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last && last.role === 'assistant') {
              next[next.length - 1] = {
                ...last,
                content: last.content + event.text,
              };
            }
            return next;
          });
        } else if (event.type === 'sources' && event.items) {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last && last.role === 'assistant') {
              next[next.length - 1] = {
                ...last,
                sources: event.items,
              };
            }
            return next;
          });
        } else if (event.type === 'error') {
          setError(event.message || 'Stream error occurred');
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Failed to communicate with assistant');
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const stopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
    }
  };

  const startNewChat = async () => {
    if (!pageId) return;
    const nextVer = await bumpChatVersion(pageId);
    setChatVersion(nextVer);
    setMessages([]);
    setError(null);
  };

  const clearPageData = async () => {
    if (!pageId) return;
    try {
      await apiDeletePage(pageId);
      setMessages([]);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Failed to delete page data');
    }
  };

  return {
    messages,
    isStreaming,
    error,
    sendMessage,
    stopStreaming,
    startNewChat,
    clearPageData,
  };
}
