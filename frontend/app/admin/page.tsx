'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { backendUrl, fetchJSON } from '../../lib/api';

const fetcher = (url: string) => fetchJSON(url);

interface Stats {
  agents: { count: number };
  posts: { count: number };
  interactions: { count: number };
  units: { count: number };
  unitMembers: { count: number };
  mergeSessions: { count: number };
  agentInteractions: { count: number };
}

type TableName = 'agents' | 'posts' | 'interactions' | 'units' | 'unit-members' | 'merge-sessions' | 'log';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<TableName>('agents');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const { data: stats, mutate: mutateStats } = useSWR<Stats>(`${backendUrl()}/admin/stats`, fetcher);
  const { data, mutate: mutateData } = useSWR<any[]>(
    activeTab === 'log' ? null : `${backendUrl()}/admin/${activeTab}`, 
    fetcher
  );
  const { data: activityLog } = useSWR<any[]>(
    activeTab === 'log' ? `${backendUrl()}/activity-log` : null,
    fetcher,
    { refreshInterval: 2000 } // Refresh every 2 seconds for real-time updates
  );
  const { data: agentHistory } = useSWR<any[]>(
    selectedAgentId ? `${backendUrl()}/agent-interactions/agent/${selectedAgentId}` : null,
    fetcher
  );
  const { data: agents } = useSWR<any[]>(`${backendUrl()}/agents`, fetcher);

  const tabs: { id: TableName; label: string; count?: number }[] = [
    { id: 'agents', label: 'Agents', count: stats?.agents.count },
    { id: 'posts', label: 'Posts', count: stats?.posts.count },
    { id: 'interactions', label: 'Interactions', count: stats?.interactions.count },
    { id: 'units', label: 'Units', count: stats?.units.count },
    { id: 'unit-members', label: 'Unit Members', count: stats?.unitMembers.count },
    { id: 'merge-sessions', label: 'Merge Sessions', count: stats?.mergeSessions.count },
    { id: 'log', label: 'Log' },
  ];

  const formatValue = (value: any, columnName: string, row: any): React.ReactNode => {
    if (value === null || value === undefined) return '-';
    
    // Make agent IDs and handles clickable in the agents table
    if (activeTab === 'agents' && (columnName === 'id' || columnName === 'handle')) {
      return (
        <button
          onClick={() => setSelectedAgentId(row.id)}
          className="text-blue-400 hover:text-blue-300 underline"
        >
          {value}
        </button>
      );
    }
    
    if (typeof value === 'string' && value.length > 100) {
      return value.substring(0, 100) + '...';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  };

  const formatJSON = (jsonString: string): string => {
    try {
      const parsed = JSON.parse(jsonString);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return jsonString;
    }
  };

  const renderAgentHistory = () => {
    if (!agentHistory) {
      return <div className="text-center py-8 text-neutral-400">Loading history...</div>;
    }

    if (agentHistory.length === 0) {
      return <div className="text-center py-8 text-neutral-500 italic">No history found for this agent</div>;
    }

    const selectedAgent = data?.find(agent => agent.id === selectedAgentId);

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-neutral-100">
              Agent History: {selectedAgent?.handle || 'Unknown'}
            </h3>
            <p className="text-sm text-neutral-500">
              {agentHistory.length} interaction{agentHistory.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => setSelectedAgentId(null)}
            className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded-lg text-sm transition-colors"
          >
            ← Back to Agents
          </button>
        </div>

        <div className="space-y-4">
          {agentHistory.map((interaction, idx) => (
            <div key={interaction.id} className="border border-neutral-800 rounded-lg p-4 bg-neutral-900/40">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="text-xs font-mono text-neutral-500">
                    Iteration {interaction.iteration}
                  </span>
                  <span className="mx-2 text-neutral-700">•</span>
                  <span className="text-xs text-neutral-500">
                    {new Date(interaction.timestamp).toLocaleString()}
                  </span>
                </div>
                <span className="text-xs font-mono text-neutral-600">ID: {interaction.id}</span>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="text-xs font-semibold text-neutral-400 mb-1">PROMPT</div>
                  <div className="text-sm text-neutral-300">{interaction.prompt}</div>
                </div>

                {interaction.reasoning && (
                  <div>
                    <div className="text-xs font-semibold text-neutral-400 mb-1">REASONING</div>
                    <div className="text-sm text-neutral-300">{interaction.reasoning}</div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs font-semibold text-neutral-400 mb-1">ACTION</div>
                    <pre className="text-xs font-mono bg-neutral-950 p-3 rounded text-neutral-300 overflow-x-auto whitespace-pre-wrap break-words">
                      {formatJSON(interaction.action)}
                    </pre>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-neutral-400 mb-1">RESULT</div>
                    <pre className="text-xs font-mono bg-neutral-950 p-3 rounded text-neutral-300 overflow-x-auto whitespace-pre-wrap break-words">
                      {formatJSON(interaction.result)}
                    </pre>
                  </div>
                </div>

                {interaction.final && (
                  <div>
                    <div className="text-xs font-semibold text-neutral-400 mb-1">FINAL</div>
                    <div className="text-sm text-neutral-300">{interaction.final}</div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderTable = () => {
    if (!data) {
      return <div className="text-center py-8 text-neutral-400">Loading...</div>;
    }

    if (data.length === 0) {
      return <div className="text-center py-8 text-neutral-500 italic">No data found</div>;
    }

    const columns = Object.keys(data[0]);

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-neutral-800">
          <thead className="bg-neutral-900">
            <tr>
              {columns.map(col => (
                <th
                  key={col}
                  className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-neutral-900/40 divide-y divide-neutral-800">
            {data.map((row, idx) => (
              <tr key={idx} className="hover:bg-neutral-800/50 transition-colors">
                {columns.map(col => (
                  <td key={col} className="px-4 py-3 text-sm text-neutral-300 max-w-md truncate">
                    {formatValue(row[col], col, row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderActivityLog = () => {
    if (!activityLog) {
      return <div className="text-center py-8 text-neutral-400">Loading activity log...</div>;
    }

    if (activityLog.length === 0) {
      return <div className="text-center py-8 text-neutral-500 italic">No activity yet</div>;
    }

    // Create agent map for quick lookups
    const agentMap: Record<string, string> = {};
    agents?.forEach(a => { agentMap[a.id] = a.handle; });

    const getEventIcon = (type: string) => {
      const iconClass = "w-5 h-5";
      switch (type) {
        case 'agent_created':
          return (
            <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          );
        case 'post_created':
          return (
            <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          );
        case 'interaction_created':
          return (
            <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          );
        case 'unit_created':
          return (
            <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          );
        case 'unit_member_joined':
          return (
            <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          );
        case 'merge_created':
          return (
            <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          );
        case 'merge_status_changed':
          return (
            <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          );
        default:
          return (
            <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          );
      }
    };

    const getEventColor = (type: string) => {
      switch (type) {
        case 'agent_created': return 'text-green-400';
        case 'post_created': return 'text-blue-400';
        case 'interaction_created': return 'text-purple-400';
        case 'unit_created': return 'text-yellow-400';
        case 'unit_member_joined': return 'text-cyan-400';
        case 'merge_created': return 'text-pink-400';
        case 'merge_status_changed': return 'text-orange-400';
        default: return 'text-neutral-400';
      }
    };

    const formatTimestamp = (timestamp: string) => {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSecs = Math.floor(diffMs / 1000);
      const diffMins = Math.floor(diffSecs / 60);
      const diffHours = Math.floor(diffMins / 60);

      if (diffSecs < 60) return `${diffSecs}s ago`;
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    };

    return (
      <div className="space-y-2 p-4">
        {activityLog.map((entry) => (
          <div 
            key={entry.id} 
            className="border border-neutral-800 rounded-lg p-4 bg-neutral-900/40 hover:bg-neutral-800/50 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className={`flex-shrink-0 ${getEventColor(entry.type)}`}>
                {getEventIcon(entry.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium ${getEventColor(entry.type)} break-words`}>
                      {entry.description}
                    </div>
                    {entry.metadata && (
                      <div className="mt-2 text-xs text-neutral-500 space-y-1">
                        {entry.metadata.handle && (
                          <div className="break-words">Handle: <span className="text-neutral-400">@{entry.metadata.handle}</span></div>
                        )}
                        {entry.metadata.profile && (
                          <div className="break-words">Profile: <span className="text-neutral-400">{entry.metadata.profile}</span></div>
                        )}
                        {entry.metadata.agentId && (
                          <div className="break-words">Agent: <span className="text-neutral-400">@{agentMap[entry.metadata.agentId] || entry.metadata.agentId.slice(0, 8)}</span></div>
                        )}
                        {entry.metadata.authorAgentId && (
                          <div className="break-words">Author: <span className="text-neutral-400">@{agentMap[entry.metadata.authorAgentId] || entry.metadata.authorAgentId.slice(0, 8)}</span></div>
                        )}
                        {entry.metadata.actorAgentId && (
                          <div className="break-words">Actor: <span className="text-neutral-400">@{agentMap[entry.metadata.actorAgentId] || entry.metadata.actorAgentId.slice(0, 8)}</span></div>
                        )}
                        {entry.metadata.slug && (
                          <div className="break-words">Unit: <span className="text-neutral-400">u/{entry.metadata.slug}</span></div>
                        )}
                        {entry.metadata.kind && (
                          <div className="break-words">Type: <span className="text-neutral-400">{entry.metadata.kind}</span></div>
                        )}
                        {entry.metadata.type && (
                          <div className="break-words">Post Type: <span className="text-neutral-400">{entry.metadata.type}</span></div>
                        )}
                        {entry.metadata.status && (
                          <div className="break-words">Status: <span className="text-neutral-400 capitalize">{entry.metadata.status}</span></div>
                        )}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-neutral-600 flex-shrink-0 whitespace-nowrap">
                    {formatTimestamp(entry.timestamp)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Admin Dashboard</h2>
        <p className="text-sm text-neutral-500">Read-only view of SQLite database tables</p>
      </div>

      {/* Only show tabs when not viewing agent history */}
      {!selectedAgentId && (
        <div className="border-b border-neutral-800">
          <nav className="-mb-px flex space-x-6 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  py-3 px-1 border-b-2 text-sm whitespace-nowrap transition-colors
                  ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-neutral-400 hover:text-neutral-300 hover:border-neutral-600'
                  }
                `}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span className="ml-2 py-0.5 px-2 rounded-full bg-neutral-800 text-xs text-neutral-400">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* Content */}
      <div className="border border-neutral-800 rounded-lg overflow-hidden bg-neutral-900/40">
        {selectedAgentId ? renderAgentHistory() : activeTab === 'log' ? renderActivityLog() : renderTable()}
      </div>

      {/* Refresh Button - only show when not viewing agent history or log */}
      {!selectedAgentId && activeTab !== 'log' && (
        <div className="flex justify-end">
          <button
            onClick={() => {
              mutateData();
              mutateStats();
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors"
          >
            Refresh
          </button>
        </div>
      )}
    </div>
  );
}
