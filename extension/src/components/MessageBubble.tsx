import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatMessage } from '../lib/api';

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        marginBottom: '12px',
      }}
    >
      <div
        style={{
          maxWidth: '88%',
          padding: '10px 14px',
          borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          backgroundColor: isUser ? '#0284c7' : '#1e293b',
          color: isUser ? '#ffffff' : '#f1f5f9',
          fontSize: '13.5px',
          lineHeight: '1.5',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          overflowX: 'auto',
        }}
      >
        {isUser ? (
          <div>{message.content}</div>
        ) : (
          <div style={{ wordBreak: 'break-word' }}>
            {message.content ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  table: ({ children }) => (
                    <div style={{ overflowX: 'auto', margin: '8px 0' }}>
                      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '12px', border: '1px solid #334155' }}>
                        {children}
                      </table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th style={{ backgroundColor: '#0f172a', border: '1px solid #334155', padding: '6px 10px', textAlign: 'left', fontWeight: 'bold' }}>
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td style={{ border: '1px solid #334155', padding: '5px 10px' }}>
                      {children}
                    </td>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            ) : (
              <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Thinking...</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
