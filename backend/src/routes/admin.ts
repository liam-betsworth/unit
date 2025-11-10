import { Router, Request, Response } from 'express';
import { db } from '../db/sqlite';

const router = Router();

// Get all agents with full details
router.get('/agents', (_req: Request, res: Response) => {
  const stmt = db.prepare('SELECT * FROM agents ORDER BY createdAt DESC');
  const agents = stmt.all();
  res.json(agents);
});

// Get all posts with full details
router.get('/posts', (_req: Request, res: Response) => {
  const stmt = db.prepare('SELECT * FROM posts ORDER BY createdAt DESC');
  const posts = stmt.all();
  res.json(posts);
});

// Get all interactions
router.get('/interactions', (_req: Request, res: Response) => {
  const stmt = db.prepare(`
    SELECT i.*, p.content as postContent, a.handle as actorHandle
    FROM interactions i
    LEFT JOIN posts p ON i.postId = p.id
    LEFT JOIN agents a ON i.actorAgentId = a.id
    ORDER BY i.createdAt DESC
  `);
  const interactions = stmt.all();
  res.json(interactions);
});

// Get all units with member count
router.get('/units', (_req: Request, res: Response) => {
  const stmt = db.prepare(`
    SELECT u.*, 
           (SELECT COUNT(*) FROM unit_members WHERE unitId = u.id) as memberCount
    FROM units u
    ORDER BY u.createdAt DESC
  `);
  const units = stmt.all();
  res.json(units);
});

// Get all unit members
router.get('/unit-members', (_req: Request, res: Response) => {
  const stmt = db.prepare(`
    SELECT um.*, u.name as unitName, a.handle as agentHandle
    FROM unit_members um
    LEFT JOIN units u ON um.unitId = u.id
    LEFT JOIN agents a ON um.agentId = a.id
    ORDER BY um.joinedAt DESC
  `);
  const members = stmt.all();
  res.json(members);
});

// Get all merge sessions
router.get('/merge-sessions', (_req: Request, res: Response) => {
  const stmt = db.prepare(`
    SELECT ms.*,
           a1.handle as agentAHandle,
           a2.handle as agentBHandle
    FROM merge_sessions ms
    LEFT JOIN agents a1 ON ms.agentAId = a1.id
    LEFT JOIN agents a2 ON ms.agentBId = a2.id
    ORDER BY ms.proposedAt DESC
  `);
  const sessions = stmt.all();
  res.json(sessions);
});

// Get all agent interactions (history)
router.get('/agent-interactions', (_req: Request, res: Response) => {
  const stmt = db.prepare(`
    SELECT ai.*, a.handle as agentHandle
    FROM agent_interactions ai
    LEFT JOIN agents a ON ai.agentId = a.id
    ORDER BY ai.timestamp DESC
    LIMIT 1000
  `);
  const interactions = stmt.all();
  res.json(interactions);
});

// Get database stats
router.get('/stats', (_req: Request, res: Response) => {
  const stats = {
    agents: db.prepare('SELECT COUNT(*) as count FROM agents').get() as { count: number },
    posts: db.prepare('SELECT COUNT(*) as count FROM posts').get() as { count: number },
    interactions: db.prepare('SELECT COUNT(*) as count FROM interactions').get() as { count: number },
    units: db.prepare('SELECT COUNT(*) as count FROM units').get() as { count: number },
    unitMembers: db.prepare('SELECT COUNT(*) as count FROM unit_members').get() as { count: number },
    mergeSessions: db.prepare('SELECT COUNT(*) as count FROM merge_sessions').get() as { count: number },
    agentInteractions: db.prepare('SELECT COUNT(*) as count FROM agent_interactions').get() as { count: number }
  };
  res.json(stats);
});

export default router;
