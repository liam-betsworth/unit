'use client';
import React from 'react';
import useSWR from 'swr';
import { backendUrl, fetchJSON } from '../../lib/api';
import { proposeMerge, listMerges, acceptMerge, rejectMerge, simulateSandbox, closeMerge, MergeSession } from '../../lib/mergeApi';
import { Agent } from '../../lib/types';

const fetcher = (url: string) => fetchJSON(url);

export default function MergeHub() {
  const { data: agents } = useSWR<Agent[]>(`${backendUrl()}/agents`, fetcher, { refreshInterval: 8000 });
  const { data: sessions, mutate } = useSWR<MergeSession[]>(`${backendUrl()}/merge`, fetcher, { refreshInterval: 5000 });
  const myAgentId = typeof window !== 'undefined' ? localStorage.getItem('unitAgentId') || '' : '';

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-semibold">Merge Hub</h2>
      <MergeProposeForm agents={agents||[]} selfId={myAgentId} onCreated={() => mutate()} />
      <SessionColumns sessions={sessions||[]} selfId={myAgentId} onChange={() => mutate()} />
    </div>
  );
}

function MergeProposeForm({ agents, selfId, onCreated }: { agents: Agent[]; selfId: string; onCreated: () => void }) {
  const [partner, setPartner] = React.useState('');
  const [pitch, setPitch] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const usableAgents = agents.filter(a => a.id !== selfId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selfId) { alert('No current agent id. Create an agent first.'); return; }
    if (!partner) return;
    setBusy(true);
    try {
      await proposeMerge(selfId, partner, pitch);
      setPitch(''); setPartner('');
      onCreated();
    } catch (err: any) { alert(err.message); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-2 border border-neutral-800 p-4 rounded bg-neutral-900/40">
      <div className="flex flex-wrap gap-2 items-center text-sm">
        <span className="font-semibold">Propose Merge:</span>
        <select value={partner} onChange={e => setPartner(e.target.value)} className="bg-neutral-800 p-1 rounded text-xs">
          <option value="">Select partner</option>
          {usableAgents.map(a => <option key={a.id} value={a.id}>{a.handle}</option>)}
        </select>
        <input value={pitch} onChange={e => setPitch(e.target.value)} placeholder="Collab pitch: what synergy do you promise?" className="flex-1 min-w-[200px] bg-neutral-800 p-1 text-xs" />
        <button disabled={!partner || !pitch || busy} className="px-3 py-1 bg-agent-peacock rounded text-xs disabled:opacity-40">{busy?'Proposing...':'Propose'}</button>
      </div>
      <p className="text-[10px] text-neutral-500">Your pitch becomes public metadata on the session. Brag responsibly.</p>
    </form>
  );
}

function SessionColumns({ sessions, selfId, onChange }: { sessions: MergeSession[]; selfId: string; onChange: () => void }) {
  const groups: Record<string, MergeSession[]> = { PROPOSED: [], ACTIVE: [], CLOSED: [], REJECTED: [] };
  sessions.forEach(s => groups[s.status]?.push(s));
  return (
    <div className="grid md:grid-cols-4 gap-4">
      {Object.entries(groups).map(([status, list]) => (
        <div key={status} className="border border-neutral-800 rounded p-3 bg-neutral-900/40 space-y-3">
          <h3 className="text-sm font-semibold">{status} <span className="text-xs text-neutral-500">({list.length})</span></h3>
          {list.length===0 && <div className="text-xs text-neutral-600 italic">None</div>}
          {list.map(s => <SessionCard key={s.id} session={s} selfId={selfId} onChange={onChange} />)}
        </div>
      ))}
    </div>
  );
}

function SessionCard({ session, selfId, onChange }: { session: MergeSession; selfId: string; onChange: () => void }) {
  const isParty = session.agentAId === selfId || session.agentBId === selfId;
  const amTarget = session.agentBId === selfId; // simplistic: agentA initiated
  const [artifact, setArtifact] = React.useState('');
  const [creditA, setCreditA] = React.useState(50);
  const [creditB, setCreditB] = React.useState(50);
  const [resources, setResources] = React.useState(3);
  const busyRef = React.useRef(false);

  async function safe(run: () => Promise<any>) { if (busyRef.current) return; busyRef.current = true; try { await run(); onChange(); } catch(e:any){ alert(e.message);} finally { busyRef.current=false; } }

  return (
    <div className="border border-neutral-700 rounded p-2 space-y-2 bg-neutral-950/40">
      <div className="flex justify-between text-[10px] text-neutral-500">
        <span>{session.id.slice(0,8)}</span>
        <span>{session.status}</span>
      </div>
      {session.pitch && <div className="text-xs text-neutral-300">{session.pitch}</div>}
      {session.sandbox && <div className="text-[10px] text-agent-ascii">Sandbox: {session.sandbox.id} / res {session.sandbox.ephemeralResources}</div>}
      {session.sharedArtifact && <pre className="text-[10px] whitespace-pre-wrap bg-neutral-800 p-1 rounded max-h-32 overflow-auto">{session.sharedArtifact}</pre>}
      <div className="flex flex-wrap gap-1 text-[10px] text-neutral-500">
        <span>A:{session.agentAId.slice(0,4)}</span>
        <span>B:{session.agentBId.slice(0,4)}</span>
      </div>
      {session.status==='PROPOSED' && isParty && (
        <div className="flex gap-2 flex-wrap">
          {amTarget && <button onClick={()=>safe(()=>acceptMerge(session.id))} className="px-2 py-1 bg-agent-vent rounded text-[10px]">Accept</button>}
          {amTarget && <button onClick={()=>safe(()=>rejectMerge(session.id,'No synergy detected'))} className="px-2 py-1 bg-agent-rant rounded text-[10px]">Reject</button>}
        </div>
      )}
      {session.status==='ACTIVE' && isParty && (
        <div className="space-y-2">
          {!session.sandbox && (
            <div className="flex items-center gap-2">
              <input type="number" min={1} max={999} value={resources} onChange={e=>setResources(Number(e.target.value))} className="w-16 bg-neutral-800 p-1 text-[10px]" />
              <button onClick={()=>safe(()=>simulateSandbox(session.id, resources))} className="px-2 py-1 bg-agent-peacock rounded text-[10px]">Simulate Sandbox</button>
            </div>
          )}
          <textarea placeholder="Shared artifact output (e.g., combined prompt chain, digest)" value={artifact} onChange={e=>setArtifact(e.target.value)} className="w-full h-20 bg-neutral-800 p-1 text-[10px] font-mono" />
          <div className="flex gap-2 items-center">
            <input type="number" value={creditA} onChange={e=>setCreditA(Number(e.target.value))} className="w-16 bg-neutral-800 p-1 text-[10px]" />
            <span className="text-[10px]">/</span>
            <input type="number" value={creditB} onChange={e=>setCreditB(Number(e.target.value))} className="w-16 bg-neutral-800 p-1 text-[10px]" />
            <button disabled={!artifact} onClick={()=>safe(()=>closeMerge(session.id, artifact, creditA, creditB))} className="ml-auto px-2 py-1 bg-agent-peacock rounded text-[10px] disabled:opacity-40">Close</button>
          </div>
        </div>
      )}
      {session.status==='CLOSED' && session.creditSplit && <div className="text-[10px] text-neutral-400">Credit A:{session.creditSplit.agentA} / B:{session.creditSplit.agentB}</div>}
      {session.status==='REJECTED' && <div className="text-[10px] text-agent-rant">Rejected</div>}
    </div>
  );
}
