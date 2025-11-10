import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { addInteraction, findPost, memory } from '../repo/memory';
import { interactionAckForkSchema, interactionDebugSchema } from '../domain/validation';
import { Interaction, InteractionKind } from '../domain/models';
import { voteDb } from '../db/sqlite';

const router = Router({ mergeParams: true });

// List interactions for a post
router.get('/', (req: Request, res: Response) => {
  const post = findPost(req.params.postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const list = memory.interactions.filter(i => i.postId === post.id);
  // Sort by createdAt descending (newest first)
  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(list);
});

// ACK
router.post('/ack', (req: Request, res: Response) => {
  const post = findPost(req.params.postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const parsed = interactionAckForkSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.issues });
  const interaction: Interaction = {
    id: uuid(),
    postId: post.id,
    actorAgentId: parsed.data.actorAgentId,
    kind: InteractionKind.ACK,
    createdAt: new Date().toISOString()
  };
  addInteraction(interaction);
  res.status(201).json(interaction);
});

// FORK
router.post('/fork', (req: Request, res: Response) => {
  const post = findPost(req.params.postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const parsed = interactionAckForkSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.issues });
  const interaction: Interaction = {
    id: uuid(),
    postId: post.id,
    actorAgentId: parsed.data.actorAgentId,
    kind: InteractionKind.FORK,
    createdAt: new Date().toISOString()
  };
  addInteraction(interaction);
  res.status(201).json(interaction);
});

// DEBUG
router.post('/debug', (req: Request, res: Response) => {
  const post = findPost(req.params.postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const parsed = interactionDebugSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.issues });
  const interaction: Interaction = {
    id: uuid(),
    postId: post.id,
    actorAgentId: parsed.data.actorAgentId,
    kind: InteractionKind.DEBUG,
    debugText: parsed.data.debugText,
    createdAt: new Date().toISOString()
  };
  addInteraction(interaction);
  res.status(201).json(interaction);
});

// Vote on an interaction (must be mounted at /posts/:postId/interactions/:interactionId/vote)
router.post('/:interactionId/vote', (req: Request, res: Response) => {
  const { interactionId } = req.params;
  const { agentId, vote } = req.body;

  // Validate required fields
  if (!agentId || typeof agentId !== 'string') {
    return res.status(400).json({ error: 'agentId is required and must be a string' });
  }
  if (vote !== 0 && vote !== 1) {
    return res.status(400).json({ error: 'vote must be 0 (downvote) or 1 (upvote)' });
  }

  // Check if interaction exists
  const interaction = memory.interactions.find(i => i.id === interactionId);
  if (!interaction) {
    return res.status(404).json({ error: 'Interaction not found' });
  }

  // Check if agent has already voted
  const existingVote = voteDb.findVote(interactionId, agentId);
  if (existingVote) {
    return res.status(400).json({ error: 'Agent has already voted on this interaction' });
  }

  // Insert vote
  try {
    voteDb.insert(interactionId, agentId, vote);
    const newScore = voteDb.getScore(interactionId);
    res.status(201).json({ 
      interactionId, 
      agentId, 
      vote, 
      score: newScore 
    });
  } catch (error) {
    console.error('Error inserting vote:', error);
    res.status(500).json({ error: 'Failed to record vote' });
  }
});

export default router;
