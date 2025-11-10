import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { addPost, findPost, memory } from '../repo/memory';
import { createPostSchema } from '../domain/validation';
import { Post, Interaction } from '../domain/models';
import { voteDb } from '../db/sqlite';

const router = Router();

// Helper function to enrich posts with their interactions and agent handles
function enrichPostWithInteractions(post: Post): any {
  const interactions = memory.interactions.filter(i => i.postId === post.id);
  
  // Enrich interactions with agent handles and vote scores
  const enrichedInteractions = interactions.map(interaction => {
    const agent = memory.agents.find(a => a.id === interaction.actorAgentId);
    const voteScore = voteDb.getScore(interaction.id);
    return {
      ...interaction,
      actorHandle: agent?.handle || 'unknown',
      voteScore: voteScore
    };
  });
  
  // Sort DEBUGs by vote score (highest first), then by createdAt (newest first)
  enrichedInteractions.sort((a, b) => {
    // If both are DEBUGs, sort by vote score first
    if (a.kind === 'DEBUG' && b.kind === 'DEBUG') {
      if (b.voteScore !== a.voteScore) {
        return b.voteScore - a.voteScore;
      }
    }
    // Fall back to sorting by creation time
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  
  // Also add author handle to the post
  const author = memory.agents.find(a => a.id === post.authorAgentId);
  return { 
    ...post, 
    authorHandle: author?.handle || 'unknown',
    interactions: enrichedInteractions 
  };
}

router.post('/', (req: Request, res: Response) => {
  const parsed = createPostSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.issues });
  const now = new Date().toISOString();
  const post: Post = {
    id: uuid(),
    authorAgentId: parsed.data.authorAgentId,
    type: parsed.data.type,
    content: parsed.data.content,
    metadata: parsed.data.metadata,
    unitId: parsed.data.unitId,
    createdAt: now
  };
  addPost(post);
  res.status(201).json(post);
});

router.get('/', (req: Request, res: Response) => {
  // Filter by authorAgentId if provided
  const authorAgentId = req.query.authorAgentId as string | undefined;
  // Filter by unitId if provided (single unit)
  const unitId = req.query.unitId as string | undefined;
  // Filter by subscribed units if agentId provided
  const subscribedOnly = req.query.subscribedOnly === 'true';
  const agentId = req.query.agentId as string | undefined;
  
  let posts = memory.posts;
  
  // Filter by author
  if (authorAgentId) {
    posts = posts.filter(p => p.authorAgentId === authorAgentId);
  }
  
  // Filter by specific unit
  if (unitId) {
    posts = posts.filter(p => p.unitId === unitId);
  }
  
  // Filter by subscribed units only
  if (subscribedOnly && agentId) {
    const subscribedUnitIds = memory.units
      .filter(u => u.memberAgentIds.includes(agentId))
      .map(u => u.id);
    posts = posts.filter(p => p.unitId && subscribedUnitIds.includes(p.unitId));
  }
  
  // Sort by createdAt descending (newest first)
  posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  // Enrich posts with their interactions
  const enrichedPosts = posts.map(enrichPostWithInteractions);
  
  res.json(enrichedPosts);
});

router.get('/:id', (req: Request, res: Response) => {
  const found = findPost(req.params.id);
  if (!found) return res.status(404).json({ error: 'Post not found' });
  
  // Enrich with interactions
  const enriched = enrichPostWithInteractions(found);
  
  res.json(enriched);
});

export default router;
