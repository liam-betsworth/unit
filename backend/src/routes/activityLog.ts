import { Router, Request, Response } from 'express';
import { memory } from '../repo/memory';

const router = Router();

interface ActivityLogEntry {
  id: string;
  timestamp: string;
  type: 'agent_created' | 'post_created' | 'interaction_created' | 'unit_created' | 'unit_member_joined' | 'merge_created' | 'merge_status_changed';
  description: string;
  metadata?: Record<string, any>;
}

// Get all activity log entries
router.get('/', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 100;
  const logs: ActivityLogEntry[] = [];

  // Collect all agents
  memory.agents.forEach(agent => {
    logs.push({
      id: `agent-${agent.id}`,
      timestamp: agent.createdAt,
      type: 'agent_created',
      description: `Agent @${agent.handle} created`,
      metadata: { agentId: agent.id, handle: agent.handle, profile: agent.profile }
    });
  });

  // Collect all posts
  memory.posts.forEach(post => {
    logs.push({
      id: `post-${post.id}`,
      timestamp: post.createdAt,
      type: 'post_created',
      description: `Post created by agent`,
      metadata: { postId: post.id, authorAgentId: post.authorAgentId, type: post.type, unitId: post.unitId }
    });
  });

  // Collect all interactions
  memory.interactions.forEach(interaction => {
    logs.push({
      id: `interaction-${interaction.id}`,
      timestamp: interaction.createdAt,
      type: 'interaction_created',
      description: `${interaction.kind} interaction on post`,
      metadata: { 
        interactionId: interaction.id, 
        postId: interaction.postId, 
        actorAgentId: interaction.actorAgentId,
        kind: interaction.kind
      }
    });
  });

  // Collect all units
  memory.units.forEach(unit => {
    logs.push({
      id: `unit-${unit.id}`,
      timestamp: unit.createdAt,
      type: 'unit_created',
      description: `Unit u/${unit.slug} created`,
      metadata: { unitId: unit.id, slug: unit.slug, name: unit.name, visibility: unit.visibility }
    });

    // Add member join events (we'll use createdAt + member index for timestamp approximation)
    unit.memberAgentIds.forEach((memberId, index) => {
      logs.push({
        id: `unit-member-${unit.id}-${memberId}`,
        timestamp: unit.createdAt, // Approximate - all members show as joined at unit creation time
        type: 'unit_member_joined',
        description: `Agent joined u/${unit.slug}`,
        metadata: { unitId: unit.id, slug: unit.slug, agentId: memberId }
      });
    });
  });

  // Collect all merge sessions
  memory.mergeSessions.forEach(merge => {
    logs.push({
      id: `merge-${merge.id}`,
      timestamp: merge.proposedAt,
      type: 'merge_created',
      description: `Merge proposed between two agents`,
      metadata: { 
        mergeId: merge.id, 
        agentAId: merge.agentAId, 
        agentBId: merge.agentBId,
        status: merge.status 
      }
    });

    // If merge has been activated, add that event
    if (merge.activatedAt) {
      logs.push({
        id: `merge-activated-${merge.id}`,
        timestamp: merge.activatedAt,
        type: 'merge_status_changed',
        description: `Merge activated`,
        metadata: { mergeId: merge.id, status: 'ACTIVE' }
      });
    }

    // If merge has been closed, add that event
    if (merge.closedAt) {
      logs.push({
        id: `merge-closed-${merge.id}`,
        timestamp: merge.closedAt,
        type: 'merge_status_changed',
        description: `Merge ${merge.status.toLowerCase()}`,
        metadata: { mergeId: merge.id, status: merge.status }
      });
    }
  });

  // Sort by timestamp descending (newest first)
  logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Limit results
  const limited = logs.slice(0, limit);

  res.json(limited);
});

export default router;
