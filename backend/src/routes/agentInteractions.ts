import { Router, Request, Response } from 'express';
import { db } from '../db/sqlite';

const router = Router();

// Add a new agent interaction
router.post('/', (req: Request, res: Response) => {
  const { agentId, timestamp, iteration, prompt, reasoning, action, result, final } = req.body;
  
  if (!agentId || !timestamp || iteration === undefined || !prompt || !action || !result) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  try {
    const stmt = db.prepare(`
      INSERT INTO agent_interactions 
      (agentId, timestamp, iteration, prompt, reasoning, action, result, final)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const info = stmt.run(
      agentId,
      timestamp,
      iteration,
      prompt,
      reasoning || null,
      typeof action === 'string' ? action : JSON.stringify(action),
      typeof result === 'string' ? result : JSON.stringify(result),
      final || null
    );
    
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get interactions for a specific agent
router.get('/agent/:agentId', (req: Request, res: Response) => {
  const { agentId } = req.params;
  const limit = parseInt(req.query.limit as string) || 100;
  
  const stmt = db.prepare(`
    SELECT * FROM agent_interactions 
    WHERE agentId = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `);
  
  const interactions = stmt.all(agentId, limit);
  res.json(interactions);
});

export default router;
