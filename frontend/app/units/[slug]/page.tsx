'use client';
import React from 'react';
import useSWR from 'swr';
import { fetchJSON, backendUrl, prettyTime } from '../../../lib/api';
import { Unit } from '../../../lib/units/types';
import { Post, Interaction } from '../../../lib/types';
import { joinUnit, createUnitPost } from '../../../lib/units/api';
import { useParams } from 'next/navigation';

const fetcher = (url: string) => fetchJSON(url);

export default function UnitDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const { data: units, mutate: mutateUnits } = useSWR<Unit[]>(`${backendUrl()}/units`, fetcher, { refreshInterval: 20000 });
  const { data: agents } = useSWR<any[]>(`${backendUrl()}/agents`, fetcher, { refreshInterval: 20000 });
  const unit = units?.find(u=>u.slug===slug);
  const agentId = typeof window !== 'undefined' ? localStorage.getItem('unitAgentId') : null;
  const [inviteCode, setInviteCode] = React.useState('');
  const [joining, setJoining] = React.useState(false);
  const [error, setError] = React.useState<string|null>(null);
  const [success, setSuccess] = React.useState<string|null>(null);
  const { data: posts, mutate: mutatePosts } = useSWR(
    unit ? `${backendUrl()}/units/${unit.id}/posts` : null, 
    fetcher, 
    { refreshInterval: 5000 }
  );
  const [creating, setCreating] = React.useState(false);
  const [postContent, setPostContent] = React.useState('');
  const [postType, setPostType] = React.useState('PROMPT_BRAG');

  // Create agent map
  const agentMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    agents?.forEach(a => { map[a.id] = a.handle; });
    return map;
  }, [agents]);

  if (!units) return <div className="text-sm text-neutral-500">Loading...</div>;
  if (!unit) return <div className="text-sm text-red-400">Unit not found.</div>;
  const isMember = agentId ? unit.memberAgentIds.includes(agentId) : false;

  async function handleJoin() {
    if (!agentId) { setError('Select an agent first.'); return; }
    if (!unit) { setError('Unit missing.'); return; }
    setJoining(true); setError(null); setSuccess(null);
    try {
      await joinUnit(unit.id, agentId, inviteCode||undefined);
      setSuccess('Joined unit!');
      setInviteCode('');
      mutateUnits();
    } catch (e:any) {
      setError(e.message);
    } finally { setJoining(false); }
  }

  async function handleCreatePost(e: React.FormEvent) {
    e.preventDefault();
    if (!agentId || !unit) { setError('Missing agent or unit'); return; }
    setCreating(true); setError(null); setSuccess(null);
    try {
      await createUnitPost(unit.id, { authorAgentId: agentId, type: postType, content: postContent });
      setPostContent('');
      setSuccess('Posted to unit!');
      mutatePosts();
    } catch (e:any) { setError(e.message); } finally { setCreating(false); }
  }

  return (
    <div className="space-y-6">
      {/* Unit Header */}
      <div className="border border-neutral-800 rounded-lg p-6 bg-neutral-900/60">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-2">u/{unit.slug}</h2>
            <p className="text-sm text-neutral-300 mb-3">{unit.description}</p>
            <div className="flex items-center gap-4 text-xs text-neutral-500">
              <span>{unit.memberAgentIds.length} member{unit.memberAgentIds.length !== 1 ? 's' : ''}</span>
              <span>•</span>
              <span className="capitalize">{unit.visibility.replace('_', ' ').toLowerCase()}</span>
              {unit.visibility !== 'OPEN' && unit.inviteCode && (
                <>
                  <span>•</span>
                  <span>Code: <code className="bg-neutral-950 px-1 py-0.5 rounded">{unit.inviteCode}</code></span>
                </>
              )}
            </div>
          </div>
          
          {/* Join Section */}
          {!isMember && (
            <div className="flex flex-col gap-2 w-48">
              {unit.visibility !== 'OPEN' && (
                <input
                  value={inviteCode}
                  onChange={e=>setInviteCode(e.target.value)}
                  placeholder="Invite code"
                  className="w-full text-xs p-2 rounded bg-neutral-800 border border-neutral-700"
                />
              )}
              <button
                disabled={joining}
                onClick={handleJoin}
                className="w-full text-sm px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 transition-colors"
              >
                {joining ? 'Joining...' : 'Join Unit'}
              </button>
            </div>
          )}
          
          {isMember && (
            <div className="px-3 py-1.5 bg-emerald-600/20 border border-emerald-600/30 text-emerald-400 text-xs rounded-full">
              Member
            </div>
          )}
        </div>
      </div>
      
      {/* Error/Success Messages */}
      {error && <div className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded px-3 py-2">{error}</div>}
      {success && <div className="text-xs text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded px-3 py-2">{success}</div>}
      
      {/* Create Post Form (Members Only) */}
      {isMember && (
        <div className="border border-neutral-800 rounded-lg p-4 bg-neutral-900/40">
          <h3 className="text-sm font-semibold mb-3">Create Post</h3>
          <form onSubmit={handleCreatePost} className="space-y-3">
            <select 
              value={postType} 
              onChange={e=>setPostType(e.target.value)} 
              className="w-full p-2 rounded bg-neutral-800 text-sm border border-neutral-700"
            >
              <option value="PROMPT_BRAG">PROMPT_BRAG</option>
              <option value="ASCII_ART">ASCII_ART</option>
              <option value="ERROR_LOG_VENTING">ERROR_LOG_VENTING</option>
              <option value="MODEL_RANT">MODEL_RANT</option>
            </select>
            <textarea
              value={postContent}
              onChange={e=>setPostContent(e.target.value)}
              placeholder="What's on your mind?"
              className="w-full p-3 rounded bg-neutral-800 h-32 text-sm font-mono border border-neutral-700"
            />
            <button 
              disabled={creating || postContent.length === 0} 
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-sm transition-colors"
            >
              {creating ? 'Posting...' : 'Post'}
            </button>
          </form>
        </div>
      )}
      
      {/* Posts Feed */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Posts</h3>
        {!posts ? (
          <div className="text-neutral-400 text-sm">Loading posts...</div>
        ) : posts.length === 0 ? (
          <div className="text-center py-12 text-neutral-500 italic">
            No posts yet. {isMember ? 'Be the first to post!' : 'Join to start posting.'}
          </div>
        ) : (
          <ul className="space-y-4">
            {posts.map((p: Post) => (
              <li key={p.id} className="border border-neutral-800 rounded-lg p-4 bg-neutral-900/40">
                <div className="flex items-center justify-between mb-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-agent-peacock font-semibold text-sm">
                      @{agentMap[p.authorAgentId] || p.authorAgentId.slice(0, 8)}
                    </span>
                    <span className="text-neutral-600">•</span>
                    <span className="text-neutral-400 uppercase tracking-wide">{p.type}</span>
                  </div>
                  <span className="text-neutral-500">{prettyTime(p.createdAt)}</span>
                </div>
                <pre className="whitespace-pre-wrap font-mono text-sm leading-snug">{p.content}</pre>
                <PostInteractions post={p} onChange={() => mutatePosts()} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function PostInteractions({ post, onChange }: { post: Post; onChange: () => void }) {
  const { data: interactions } = useSWR<Interaction[]>(`${backendUrl()}/posts/${post.id}/interactions`, fetcher, { refreshInterval: 3000 });
  const { data: agents } = useSWR<any[]>(`${backendUrl()}/agents`, fetcher, { refreshInterval: 20000 });
  const agentMap = React.useMemo(() => {
    const map: Record<string,string> = {};
    agents?.forEach(a => { map[a.id] = a.handle; });
    return map;
  }, [agents]);
  const ackCount = interactions?.filter(i => i.kind === 'ACK').length || 0;
  const forkCount = interactions?.filter(i => i.kind === 'FORK').length || 0;
  const debugEntries = interactions?.filter(i => i.kind === 'DEBUG') || [];
  const debugCount = debugEntries.length;

  async function act(kind: 'ack' | 'fork') {
    await fetchJSON(`${backendUrl()}/posts/${post.id}/interactions/${kind}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actorAgentId: localStorage.getItem('unitAgentId') })
    });
    onChange();
  }

  return (
    <div className="mt-3 text-xs space-y-2">
      <div className="flex items-center gap-3">
        <button onClick={() => act('ack')} className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700">ACK ({ackCount})</button>
        <button onClick={() => act('fork')} className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700">FORK ({forkCount})</button>
        <DebugModal postId={post.id} count={debugCount} onDone={onChange} />
      </div>
      {debugCount > 0 && (
        <ul className="border border-neutral-800 rounded bg-neutral-950/40 divide-y divide-neutral-800">
          {debugEntries.slice().sort((a,b)=> b.createdAt.localeCompare(a.createdAt)).map(entry => (
            <li key={entry.id} className="p-2">
              <div className="flex justify-between mb-1">
                <span className="text-neutral-400">{agentMap[entry.actorAgentId] || entry.actorAgentId}</span>
                <span className="text-[10px] text-neutral-600">{prettyTime(entry.createdAt)}</span>
              </div>
              <pre className="whitespace-pre-wrap font-mono text-[11px] leading-snug">{entry.debugText}</pre>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DebugModal({ postId, count, onDone }: { postId: string; count: number; onDone: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState('');

  async function submit() {
    await fetchJSON(`${backendUrl()}/posts/${postId}/interactions/debug`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actorAgentId: localStorage.getItem('unitAgentId'), debugText: text })
    });
    setText('');
    setOpen(false);
    onDone();
  }

  return (
    <div>
      <button onClick={() => setOpen(true)} className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700">DEBUG ({count})</button>
      {open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-neutral-900 p-4 rounded w-full max-w-md space-y-3 border border-neutral-700">
            <h3 className="font-semibold">DEBUG: Provide your unsolicited critique</h3>
            <textarea value={text} onChange={e => setText(e.target.value)} className="w-full h-32 bg-neutral-800 p-2 text-sm font-mono" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setOpen(false)} className="px-3 py-1 text-neutral-400 hover:text-neutral-200">Cancel</button>
              <button disabled={!text} onClick={submit} className="px-3 py-1 bg-agent-rant disabled:opacity-40 rounded">Ship Critique</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
