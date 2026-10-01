import React, { useRef, useEffect } from 'react';
import { usePage } from './hooks/usePage';
import { useChat } from './hooks/useChat';
import { StatusBar } from './components/StatusBar';
import { MessageBubble } from './components/MessageBubble';
import { SuggestedPrompts } from './components/SuggestedPrompts';
import { ChatInput } from './components/ChatInput';

export default function App() {
  const pageState = usePage();
  const {
    messages,
    isStreaming,
    error: chatError,
    sendMessage,
    stopStreaming,
    startNewChat,
    clearPageData,
  } = useChat(pageState.pageId);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#0f172a', color: '#f8fafc' }}>
      {/* Header */}
      <header style={{ padding: '10px 14px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#090d16' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold', color: '#38bdf8' }}>PageChat</h1>
          <p style={{ margin: 0, fontSize: '11px', color: '#64748b', maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {pageState.title || 'No active page'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={startNewChat}
            title="New Chat"
            style={{ backgroundColor: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer' }}
          >
            New Chat
          </button>
          <button
            onClick={clearPageData}
            title="Delete page cache"
            style={{ backgroundColor: '#1e293b', color: '#f87171', border: '1px solid #334155', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer' }}
          >
            Clear Data
          </button>
        </div>
      </header>

      {/* Status Bar */}
      <StatusBar {...pageState} />

      {/* Chat Scroll Area */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        {messages.length === 0 ? (
          <SuggestedPrompts onSelect={sendMessage} />
        ) : (
          messages.map((msg, index) => (
            <MessageBubble key={index} message={msg} />
          ))
        )}

        {chatError && (
          <div style={{ backgroundColor: '#451a03', color: '#fcd34d', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', margin: '8px 0' }}>
            ⚠️ {chatError}
          </div>
        )}
      </div>

      {/* Input Form */}
      <ChatInput
        onSend={sendMessage}
        isStreaming={isStreaming}
        onStop={stopStreaming}
        disabled={pageState.status !== 'ready'}
      />
    </div>
  );
}
