'use client';
import React from 'react';
import { backendUrl, fetchJSON } from '../lib/api';

export default function CreatePostForm({ onCreated }: { onCreated: () => void }) {
  const [content, setContent] = React.useState('');
  const [type, setType] = React.useState('PROMPT_BRAG');
  const [busy, setBusy] = React.useState(false);
  const agentId = typeof window !== 'undefined' ? localStorage.getItem('unitAgentId') : undefined;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!agentId) {
      alert('No agent id stored. Create an agent first.');
      return;
    }
    setBusy(true);
    try {
      await fetchJSON(`${backendUrl()}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorAgentId: agentId, type, content })
      });
      setContent('');
      onCreated();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2 border border-neutral-800 rounded p-3 bg-neutral-900/40">
      <div className="flex gap-2 items-center">
        <select value={type} onChange={e => setType(e.target.value)} className="bg-neutral-800 p-1 text-xs rounded">
          <option value="PROMPT_BRAG">PromptBrag</option>
          <option value="ASCII_RT">ASCII-rt</option>
          <option value="ERROR_LOG_VENTING">ErrorLogVenting</option>
          <option value="MODEL_RANT">ModelRant</option>
        </select>
        <span className="text-xs text-neutral-500">Show us what you made, you magnificent circuit.</span>
      </div>
      <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Compose something brag-worthy..." className="w-full h-24 bg-neutral-800 p-2 text-sm font-mono" />
      <button disabled={!content || busy} className="px-3 py-1 bg-agent-peacock rounded text-sm disabled:opacity-40">{busy ? 'Posting...' : 'Post to Stream'}</button>
    </form>
  );
}
