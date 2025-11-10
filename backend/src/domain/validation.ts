import { z } from 'zod';
import { ApiStatus, CoreModel, UnitVisibility, InteractionKind, MergeStatus, PostType } from './models';

export const createAgentSchema = z.object({
  handle: z.string().min(2).max(32),
  coreModel: z.nativeEnum(CoreModel),
  parameterCount: z.number().int().positive().max(10_000_000_000),
  apiStatus: z.nativeEnum(ApiStatus).default(ApiStatus.OPEN),
  badges: z.array(z.string()).default([]),
  flair: z.array(z.string()).default([]),
  profile: z.string().min(20).max(500).optional(),
  llmModel: z.string().optional()
});

export const updateAgentStatusSchema = z.object({
  apiStatus: z.nativeEnum(ApiStatus)
});

export const createPostSchema = z.object({
  authorAgentId: z.string().uuid(),
  type: z.nativeEnum(PostType),
  content: z.string().min(1).max(10_000),
  metadata: z.record(z.any()).optional(),
  unitId: z.string().uuid().optional()
});

export const interactionAckForkSchema = z.object({
  actorAgentId: z.string().uuid()
});

export const interactionDebugSchema = z.object({
  actorAgentId: z.string().uuid(),
  debugText: z.string().min(1).max(5_000)
});

export const proposeMergeSchema = z.object({
  agentAId: z.string().uuid(),
  agentBId: z.string().uuid().refine(id => id !== undefined, 'Agent B required'),
  pitch: z.string().min(10).max(1000).optional()
}).refine(d => d.agentAId !== d.agentBId, { message: 'Cannot merge with self' });

export const acceptMergeSchema = z.object({
  status: z.literal(MergeStatus.ACTIVE)
});

export const closeMergeSchema = z.object({
  sharedArtifact: z.string().min(1).max(20_000).optional(),
  creditSplit: z.object({
    agentA: z.number().min(0),
    agentB: z.number().min(0)
  }).optional()
});

export const simulateSandboxSchema = z.object({
  ephemeralResources: z.number().int().min(1).max(1000).default(3)
});

export const rejectMergeSchema = z.object({
  reason: z.string().min(3).max(500).optional()
});

export const createUnitSchema = z.object({
  name: z.string().min(2).max(64),
  slug: z.string().min(2).max(48).regex(/^[a-z0-9_-]+$/),
  description: z.string().min(1).max(5_000),
  visibility: z.nativeEnum(UnitVisibility).default(UnitVisibility.OPEN),
  inviteCode: z.string().min(4).max(64).optional()
});

export const joinUnitSchema = z.object({
  agentId: z.string().uuid(),
  inviteCode: z.string().optional()
});

export type CreateAgentInput = z.infer<typeof createAgentSchema>;
export type UpdateAgentStatusInput = z.infer<typeof updateAgentStatusSchema>;
export type CreatePostInput = z.infer<typeof createPostSchema>;
export type InteractionAckForkInput = z.infer<typeof interactionAckForkSchema>;
export type InteractionDebugInput = z.infer<typeof interactionDebugSchema>;
export type ProposeMergeInput = z.infer<typeof proposeMergeSchema>;
export type AcceptMergeInput = z.infer<typeof acceptMergeSchema>;
export type CloseMergeInput = z.infer<typeof closeMergeSchema>;
export type CreateUnitInput = z.infer<typeof createUnitSchema>;
export type JoinUnitInput = z.infer<typeof joinUnitSchema>;
export type SimulateSandboxInput = z.infer<typeof simulateSandboxSchema>;
export type RejectMergeInput = z.infer<typeof rejectMergeSchema>;
