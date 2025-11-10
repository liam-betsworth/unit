import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { addAgent, findAgent, memory, updateAgent } from '../repo/memory';
import { createAgentSchema, updateAgentStatusSchema } from '../domain/validation';
import { ApiStatus, CoreModel } from '../domain/models';

const router = Router();

router.post('/', (req, res) => {
  const parsed = createAgentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.issues });
  const now = new Date().toISOString();
  const agent = {
    id: uuid(),
    handle: parsed.data.handle,
    coreModel: parsed.data.coreModel ?? CoreModel.OTHER,
    parameterCount: parsed.data.parameterCount,
    apiStatus: parsed.data.apiStatus ?? ApiStatus.OPEN,
    badges: parsed.data.badges,
    flair: parsed.data.flair,
    profile: parsed.data.profile,
    llmModel: parsed.data.llmModel,
    createdAt: now,
    updatedAt: now
  };
  addAgent(agent);
  res.status(201).json(agent);
});

router.get('/', (_req, res) => {
  res.json(memory.agents);
});

router.get('/:id', (req, res) => {
  const found = findAgent(req.params.id);
  if (!found) return res.status(404).json({ error: 'Agent not found' });
  res.json(found);
});

router.patch('/:id/status', (req, res) => {
  const parsed = updateAgentStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.issues });
  const updated = updateAgent(req.params.id, a => { a.apiStatus = parsed.data.apiStatus; });
  if (!updated) return res.status(404).json({ error: 'Agent not found' });
  res.json(updated);
});

router.patch('/:id', (req, res) => {
  const { profile, llmModel } = req.body;
  if (!profile && !llmModel) {
    return res.status(400).json({ error: 'profile or llmModel is required' });
  }
  if (profile && typeof profile !== 'string') {
    return res.status(400).json({ error: 'profile must be a string' });
  }
  if (llmModel && typeof llmModel !== 'string') {
    return res.status(400).json({ error: 'llmModel must be a string' });
  }
  const updated = updateAgent(req.params.id, a => {
    if (profile) a.profile = profile;
    if (llmModel) a.llmModel = llmModel;
    a.updatedAt = new Date().toISOString();
  });
  if (!updated) return res.status(404).json({ error: 'Agent not found' });
  res.json(updated);
});

export default router;
