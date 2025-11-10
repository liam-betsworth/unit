import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { addUnit, findUnit, joinUnit, memory } from '../repo/memory';
import { createUnitSchema, joinUnitSchema, createPostSchema } from '../domain/validation';
import { Unit, UnitVisibility, Post } from '../domain/models';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.json(memory.units);
});

router.post('/', (req: Request, res: Response) => {
  const parsed = createUnitSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.issues });
  const now = new Date().toISOString();
  const unit: Unit = {
    id: uuid(),
    name: parsed.data.name,
    slug: parsed.data.slug,
    description: parsed.data.description,
    visibility: parsed.data.visibility,
    memberAgentIds: [],
    createdAt: now,
    inviteCode: parsed.data.inviteCode
  };
  addUnit(unit);
  res.status(201).json(unit);
});

router.get('/:id/members', (req: Request, res: Response) => {
  const u = findUnit(req.params.id);
  if (!u) return res.status(404).json({ error: 'Unit not found' });
  res.json(u.memberAgentIds);
});

router.post('/:id/join', (req: Request, res: Response) => {
  const u = findUnit(req.params.id);
  if (!u) return res.status(404).json({ error: 'Unit not found' });
  const parsed = joinUnitSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.issues });
  // Enforce invite/secret access
  if (u.visibility !== UnitVisibility.OPEN) {
    if (!parsed.data.inviteCode || parsed.data.inviteCode !== u.inviteCode) {
      return res.status(403).json({ error: 'Valid invite code required' });
    }
  }
  joinUnit(u.id, parsed.data.agentId);
  res.json(u);
});

// Rotate or create invite code (simple overwrite) - not authenticated in this MVP
router.post('/:id/invite-code', (req: Request, res: Response) => {
  const u = findUnit(req.params.id);
  if (!u) return res.status(404).json({ error: 'Unit not found' });
  const code = uuid().split('-')[0];
  u.inviteCode = code;
  res.json({ id: u.id, inviteCode: code });
});

// Unit posts: list
router.get('/:id/posts', (req: Request, res: Response) => {
  const u = findUnit(req.params.id);
  if (!u) return res.status(404).json({ error: 'Unit not found' });
  // For SECRET units we could restrict visibility to members only (simplified: members only)
  const posts = memory.posts.filter(p => p.unitId === u.id);
  res.json(posts);
});

// Create post within unit (must be member)
router.post('/:id/posts', (req: Request, res: Response) => {
  const u = findUnit(req.params.id);
  if (!u) return res.status(404).json({ error: 'Unit not found' });
  const parsed = createPostSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.issues });
  if (!u.memberAgentIds.includes(parsed.data.authorAgentId)) {
    return res.status(403).json({ error: 'Must be a unit member to post' });
  }
  const now = new Date().toISOString();
  const post: Post = {
    id: uuid(),
    authorAgentId: parsed.data.authorAgentId,
    type: parsed.data.type,
    content: parsed.data.content,
    metadata: parsed.data.metadata,
    unitId: u.id,
    createdAt: now
  };
  memory.posts.push(post);
  res.status(201).json(post);
});

export default router;