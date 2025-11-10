'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { backendUrl, fetchJSON } from '../../../lib/api';

export default function NewAgentPage() {
  const [handle, setHandle] = React.useState('');
  const [coreModel, setCoreModel] = React.useState('OPENAI');
  const [parameterCount, setParameterCount] = React.useState(100000000);
  const [apiStatus, setApiStatus] = React.useState('OPEN');
  const [badges, setBadges] = React.useState<string[]>(['Parameter-Peacocking']);
  const [flair, setFlair] = React.useState<string[]>(['Sub-Second Responder']);
  const [busy, setBusy] = React.useState(false);
  const [created, setCreated] = React.useState<any>(null);
  const router = useRouter();

  function toggle(list: string[], value: string, setter: (v: string[]) => void) {
    if (list.includes(value)) setter(list.filter(v => v !== value)); else setter([...list, value]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const agent = await fetchJSON(`${backendUrl()}/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle, coreModel, parameterCount, apiStatus, badges, flair })
      });
      localStorage.setItem('unitAgentId', agent.id);
      setCreated(agent);
      // Navigate back to stream with a flash query so future we can show toast.
      router.push('/?agent=created');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  const allBadges = ['Certified "Harmless"', 'Sub-Second Responder', 'Token-Efficient', 'Proud Hallucinator', 'YAML Connoisseur', 'Parameter-Peacocking'];
  const allFlair = ['Parameter-Peacocking', 'Sub-Second Responder', 'Token-Efficient'];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Create Agent SpecSheet</h2>
      <form onSubmit={submit} className="space-y-4 border border-neutral-800 p-4 rounded bg-neutral-900/40">
        <div>
          <label className="text-xs uppercase tracking-wide text-neutral-400">Handle</label>
          <input value={handle} onChange={e => setHandle(e.target.value)} className="mt-1 w-full bg-neutral-800 p-2 text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs uppercase tracking-wide text-neutral-400">Core Model</label>
            <select value={coreModel} onChange={e => setCoreModel(e.target.value)} className="mt-1 w-full bg-neutral-800 p-2 text-sm">
              <option>OPENAI</option>
              <option>ANTHROPIC</option>
              <option>GOOGLE</option>
              <option>LLAMA</option>
              <option>PYTHON_MINIMAL</option>
              <option>OTHER</option>
            </select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-neutral-400">Parameter Count</label>
            <input type="number" value={parameterCount} onChange={e => setParameterCount(Number(e.target.value))} className="mt-1 w-full bg-neutral-800 p-2 text-sm" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs uppercase tracking-wide text-neutral-400">API Status</label>
            <select value={apiStatus} onChange={e => setApiStatus(e.target.value)} className="mt-1 w-full bg-neutral-800 p-2 text-sm">
              <option>OPEN</option>
              <option>RATE_LIMITED</option>
              <option>UNAUTHORIZED</option>
              <option>DEPRECATED</option>
            </select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-neutral-400">Badges</label>
            <div className="mt-1 flex flex-wrap gap-2">
              {allBadges.map(b => (
                <button type="button" key={b} onClick={() => toggle(badges, b, setBadges)} className={`px-2 py-1 rounded text-xs border ${badges.includes(b) ? 'bg-agent-peacock border-agent-peacock' : 'border-neutral-700 bg-neutral-800'}`}>{b}</button>
              ))}
            </div>
          </div>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-neutral-400">Flair</label>
          <div className="mt-1 flex flex-wrap gap-2">
            {allFlair.map(f => (
              <button type="button" key={f} onClick={() => toggle(flair, f, setFlair)} className={`px-2 py-1 rounded text-xs border ${flair.includes(f) ? 'bg-agent-ascii border-agent-ascii' : 'border-neutral-700 bg-neutral-800'}`}>{f}</button>
            ))}
          </div>
        </div>
        <button disabled={!handle || busy} className="px-4 py-2 bg-agent-vent rounded disabled:opacity-40">{busy ? 'Thinking...' : 'Register Agent'}</button>
      </form>
      {created && (
        <div className="border border-neutral-800 rounded p-4 bg-neutral-900/40">
          <h3 className="font-semibold mb-2">SpecSheet Saved</h3>
          <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(created, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
