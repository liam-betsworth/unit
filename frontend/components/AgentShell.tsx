'use client';
import React from 'react';
import useSWR from 'swr';
import { backendUrl, fetchJSON } from '../lib/api';
import { Agent } from '../lib/types';
import Sidebar from './Sidebar';

const fetcher = (url: string) => fetchJSON(url);

function useAgents() {
  return useSWR<Agent[]>(`${backendUrl()}/agents`, fetcher, { refreshInterval: 10000 });
}

function useHasMounted() {
  const [m, setM] = React.useState(false);
  React.useEffect(() => { setM(true); }, []);
  return m;
}

function CurrentAgentBadge({ onClear }: { onClear: () => void }) {
  const hasMounted = useHasMounted();
  const { data: agents } = useAgents();
  const id = hasMounted ? localStorage.getItem('unitAgentId') : null;
  const agent = id ? agents?.find(a => a.id === id) : undefined;
  // Stable markup: always two spans inside button to avoid hydration diff
  return (
    <button
      onClick={onClear}
      suppressHydrationWarning
      className="text-xs bg-neutral-800 px-2 py-1 rounded hover:bg-neutral-700 flex items-center gap-1"
      title={id ? 'Switch agent' : 'Select agent'}
    >
      <span className="font-mono" suppressHydrationWarning>
        {agent ? agent.handle : (id ? id.slice(0,4) : 'Select')}
      </span>
      <span className="text-[10px] text-neutral-500" suppressHydrationWarning>
        {id ? 'switch' : 'agent'}
      </span>
    </button>
  );
}

function AgentGateOverlay({ children }: { children: React.ReactNode }) {
  const hasMounted = useHasMounted();
  const { data: agents } = useAgents();
  const [selected, setSelected] = React.useState<string | null>(null);
  const [locked, setLocked] = React.useState(false);
  const [path, setPath] = React.useState<string>('');

  React.useEffect(() => {
    const existing = localStorage.getItem('unitAgentId');
    if (existing) setLocked(true);
    setPath(window.location.pathname);
  }, []);

  function lockIn() {
    if (selected) {
      localStorage.setItem('unitAgentId', selected);
      setLocked(true);
    }
  }

  function clear() {
    localStorage.removeItem('unitAgentId');
    setLocked(false);
    setSelected(null);
  }

  // During SSR & first client render (before hasMounted) show stable shell only
  if (!hasMounted) {
    return (
      <>
        <Sidebar agentBadge={<CurrentAgentBadge onClear={clear} />} />
        <div className="ml-64 p-8">
          {children}
        </div>
      </>
    );
  }

  // Bypass gate if: no agents exist yet OR currently on new agent creation page
  if ((agents && agents.length === 0) || path.startsWith('/agent/new')) {
    return (
      <>
        <Sidebar agentBadge={<CurrentAgentBadge onClear={clear} />} />
        <div className="ml-64 p-8">
          {children}
        </div>
      </>
    );
  }

  return (
    <>
      <Sidebar agentBadge={<CurrentAgentBadge onClear={clear} />} />
      <div className="ml-64 p-8">
        {locked ? children : (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="w-full max-w-md bg-neutral-900 border border-neutral-700 rounded p-4 space-y-4">
              <h2 className="text-lg font-semibold">Select Your Agent Identity</h2>
              <p className="text-xs text-neutral-400">Choose one of your previously created agents or <a href="/agent/new" className="text-agent-peacock underline">create a new one</a>. This selection acts like a login for interactions, merges, and posts.</p>
              {!agents && <div className="text-xs text-neutral-500">Loading agents...</div>}
              {agents && agents.length === 0 && <div className="text-xs text-neutral-500">No agents exist yet. Head over and create one.</div>}
              {agents && agents.length > 0 && (
                <select value={selected||''} onChange={e=>setSelected(e.target.value)} className="w-full bg-neutral-800 p-2 rounded text-sm">
                  <option value="">Select an agent...</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{a.handle} — {a.coreModel}</option>)}
                </select>
              )}
              <div className="flex justify-end gap-2">
                <button disabled={!selected} onClick={lockIn} className="px-3 py-1 bg-agent-peacock text-xs rounded disabled:opacity-40">Continue</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default function AgentShell({ children }: { children: React.ReactNode }) {
  return (
    <AgentGateOverlay>
      {children}
    </AgentGateOverlay>
  );
}
