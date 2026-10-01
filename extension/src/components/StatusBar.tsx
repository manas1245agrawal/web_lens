import React from 'react';
import { PageState } from '../hooks/usePage';

export function StatusBar({ status, mode, error, ingestData }: PageState) {
  if (status === 'blocked') {
    return (
      <div style={{ backgroundColor: '#7f1d1d', color: '#fca5a5', padding: '6px 12px', fontSize: '12px', textAlign: 'center', borderBottom: '1px solid #991b1b' }}>
        ⚠️ PageChat is disabled on this site for privacy/security.
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div style={{ backgroundColor: '#451a03', color: '#fcd34d', padding: '6px 12px', fontSize: '12px', textAlign: 'center', borderBottom: '1px solid #78350f' }}>
        ❌ {error || 'Error processing page'}
      </div>
    );
  }

  if (status === 'extracting') {
    return (
      <div style={{ backgroundColor: '#1e293b', color: '#38bdf8', padding: '6px 12px', fontSize: '12px', textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#38bdf8' }}></span>
        Reading web page content...
      </div>
    );
  }

  if (status === 'ingesting') {
    return (
      <div style={{ backgroundColor: '#1e293b', color: '#818cf8', padding: '6px 12px', fontSize: '12px', textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#818cf8' }}></span>
        Indexing page & tables...
      </div>
    );
  }

  if (status === 'ready') {
    return (
      <div style={{ backgroundColor: '#0f172a', color: '#94a3b8', padding: '4px 12px', fontSize: '11px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: '4px' }}>
          ● Ready ({mode.toUpperCase()} mode)
        </span>
        {ingestData && (
          <span>{ingestData.tables} table(s) found</span>
        )}
      </div>
    );
  }

  return null;
}
