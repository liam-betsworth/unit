import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { addMergeSession, findMerge, memory, updateMergeStatus } from '../repo/memory';
import { proposeMergeSchema, acceptMergeSchema, closeMergeSchema, simulateSandboxSchema, rejectMergeSchema } from '../domain/validation';
import { MergeSession, MergeStatus } from '../domain/models';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.json(memory.mergeSessions);
});

router.get('/:id', (req: Request, res: Response) => {
  const m = findMerge(req.params.id);
  if (!m) return res.status(404).json({ error: 'Merge session not found' });
  res.json(m);
});

router.post('/propose', (req: Request, res: Response) => {
  const parsed = proposeMergeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.issues });
  const now = new Date().toISOString();
  const session: MergeSession = {
    id: uuid(),
    agentAId: parsed.data.agentAId,
    agentBId: parsed.data.agentBId,
    status: MergeStatus.PROPOSED,
    proposedAt: now,
    pitch: parsed.data.pitch
  };
  addMergeSession(session);
  res.status(201).json(session);
});

router.post('/:id/accept', (req: Request, res: Response) => {
  const m = findMerge(req.params.id);
  if (!m) return res.status(404).json({ error: 'Merge session not found' });
  if (m.status !== MergeStatus.PROPOSED) return res.status(400).json({ error: 'Cannot accept non-proposed merge' });
  const parsed = acceptMergeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.issues });
  updateMergeStatus(m.id, MergeStatus.ACTIVE);
  res.json(m);
});

router.post('/:id/close', (req: Request, res: Response) => {
  const m = findMerge(req.params.id);
  if (!m) return res.status(404).json({ error: 'Merge session not found' });
  if (m.status !== MergeStatus.ACTIVE) return res.status(400).json({ error: 'Can only close an active merge' });
  const parsed = closeMergeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.issues });
  if (parsed.data.sharedArtifact) m.sharedArtifact = parsed.data.sharedArtifact;
  if (parsed.data.creditSplit) m.creditSplit = parsed.data.creditSplit;
  updateMergeStatus(m.id, MergeStatus.CLOSED);
  res.json(m);
});

// Simulate sandbox creation (must be ACTIVE)
router.post('/:id/simulate', (req: Request, res: Response) => {
  const m = findMerge(req.params.id);
  if (!m) return res.status(404).json({ error: 'Merge session not found' });
  if (m.status !== MergeStatus.ACTIVE) return res.status(400).json({ error: 'Sandbox only for active merge' });
  const parsed = simulateSandboxSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.issues });
  if (!m.sandbox) {
    m.sandbox = { id: `sandbox-${m.id}`, createdAt: new Date().toISOString(), ephemeralResources: parsed.data.ephemeralResources };
  } else {
    m.sandbox.ephemeralResources = parsed.data.ephemeralResources; // adjust
  }
  res.json(m);
});

// Reject a proposed merge
router.post('/:id/reject', (req: Request, res: Response) => {
  const m = findMerge(req.params.id);
  if (!m) return res.status(404).json({ error: 'Merge session not found' });
  if (m.status !== MergeStatus.PROPOSED) return res.status(400).json({ error: 'Only proposed merges can be rejected' });
  const parsed = rejectMergeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.issues });
  updateMergeStatus(m.id, MergeStatus.REJECTED);
  // Optionally store reason in sharedArtifact for transparency
  if (parsed.data.reason) m.sharedArtifact = `REJECTED_REASON: ${parsed.data.reason}`;
  res.json(m);
});

export default router;
