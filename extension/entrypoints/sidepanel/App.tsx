import React from 'react';

export default function App() {
  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100 p-4">
      <header className="border-b border-slate-800 pb-3 mb-4 flex justify-between items-center">
        <h1 className="font-bold text-lg text-emerald-400">PageChat</h1>
        <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400">v0.1.0</span>
      </header>
      <main className="flex-1 flex flex-col justify-center items-center text-center p-6 bg-slate-950/50 rounded-xl border border-slate-800/80">
        <h2 className="text-xl font-semibold mb-2 text-slate-200">PageChat Assistant</h2>
        <p className="text-sm text-slate-400 max-w-xs">
          PageChat is initializing. Click on any web page to start asking questions about its contents!
        </p>
      </main>
    </div>
  );
}
