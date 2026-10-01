import React, { useState } from 'react';

interface ChatInputProps {
  onSend: (text: string) => void;
  isStreaming: boolean;
  onStop: () => void;
  disabled: boolean;
}

export function ChatInput({ onSend, isStreaming, onStop, disabled }: ChatInputProps) {
  const [text, setText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim() && !disabled && !isStreaming) {
      onSend(text.trim());
      setText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ borderTop: '1px solid #1e293b', padding: '10px 12px', backgroundColor: '#0f172a', display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={disabled ? 'Indexing page...' : 'Ask anything about this page...'}
        disabled={disabled || isStreaming}
        rows={1}
        style={{
          flex: 1,
          backgroundColor: '#1e293b',
          color: '#f8fafc',
          border: '1px solid #334155',
          borderRadius: '8px',
          padding: '8px 12px',
          fontSize: '13px',
          resize: 'none',
          outline: 'none',
          maxHeight: '80px',
        }}
      />
      {isStreaming ? (
        <button
          type="button"
          onClick={onStop}
          style={{
            backgroundColor: '#dc2626',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 14px',
            fontSize: '12px',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          Stop
        </button>
      ) : (
        <button
          type="submit"
          disabled={disabled || !text.trim()}
          style={{
            backgroundColor: disabled || !text.trim() ? '#334155' : '#0284c7',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 14px',
            fontSize: '12px',
            fontWeight: 'bold',
            cursor: disabled || !text.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          Send
        </button>
      )}
    </form>
  );
}
