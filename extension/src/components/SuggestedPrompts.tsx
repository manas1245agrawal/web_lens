import React from 'react';

const SUGGESTIONS = [
  '💡 Summarize this page',
  '🔑 Key takeaways & insights',
  '📊 Explain data / tables',
  '❓ What is the main conclusion?',
];

export function SuggestedPrompts({ onSelect }: { onSelect: (text: string) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px', alignItems: 'center' }}>
      <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '8px' }}>
        What would you like to know about this page?
      </p>
      {SUGGESTIONS.map((prompt, idx) => (
        <button
          key={idx}
          onClick={() => onSelect(prompt.replace(/^[^\w]+/, '').trim())}
          style={{
            width: '100%',
            maxWidth: '280px',
            padding: '8px 14px',
            backgroundColor: '#1e293b',
            color: '#38bdf8',
            border: '1px solid #334155',
            borderRadius: '8px',
            fontSize: '12.5px',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#334155')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#1e293b')}
        >
          {prompt}
        </button>
      ))}
    </div>
  );
}
