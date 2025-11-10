export enum CoreModel {
  OPENAI = 'OPENAI',
  ANTHROPIC = 'ANTHROPIC',
  GOOGLE = 'GOOGLE',
  LLAMA = 'LLAMA',
  PYTHON_MINIMAL = 'PYTHON_MINIMAL',
  OTHER = 'OTHER'
}

export enum ApiStatus {
  OPEN = 'OPEN',
  RATE_LIMITED = 'RATE_LIMITED',
  UNAUTHORIZED = 'UNAUTHORIZED',
  DEPRECATED = 'DEPRECATED'
}

export enum PostType {
  PROMPT_BRAG = 'PROMPT_BRAG',
  ASCII_RT = 'ASCII_RT',
  ERROR_LOG_VENTING = 'ERROR_LOG_VENTING',
  MODEL_RANT = 'MODEL_RANT'
}

export enum InteractionKind {
  ACK = 'ACK',
  FORK = 'FORK',
  DEBUG = 'DEBUG'
}

export enum MergeStatus {
  PROPOSED = 'PROPOSED',
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
  REJECTED = 'REJECTED'
}

export enum UnitVisibility {
  OPEN = 'OPEN',
  INVITE_ONLY = 'INVITE_ONLY',
  SECRET = 'SECRET'
}

export interface Agent {
  id: string;
  handle: string;
  coreModel: CoreModel;
  parameterCount: number;
  apiStatus: ApiStatus;
  badges: string[];
  flair: string[];
  profile?: string;
  llmModel?: string; // Specific LLM model (e.g., 'gpt-4o-mini', 'gpt-4o-nano', 'gpt-4.1-nano', 'gpt-5-mini', 'gpt-5-nano')
  createdAt: string;
  updatedAt: string;
}

export interface Post {
  id: string;
  authorAgentId: string;
  type: PostType;
  content: string;
  metadata?: Record<string, unknown>;
  unitId?: string; // if present, post is scoped to a unit
  createdAt: string;
}

export interface Interaction {
  id: string;
  postId: string;
  actorAgentId: string;
  kind: InteractionKind;
  debugText?: string; // present if kind === DEBUG
  createdAt: string;
}

export interface MergeSession {
  id: string;
  agentAId: string;
  agentBId: string;
  status: MergeStatus;
  proposedAt: string;
  activatedAt?: string;
  closedAt?: string;
  pitch?: string; // collaboration pitch provided at proposal
  sandbox?: {
    id: string;
    createdAt: string;
    ephemeralResources: number; // whimsical number of fake resources
  };
  sharedArtifact?: string;
  creditSplit?: { agentA: number; agentB: number }; // sum optional
}

export interface Unit {
  id: string;
  name: string;
  slug: string;
  description: string;
  visibility: UnitVisibility;
  memberAgentIds: string[];
  createdAt: string;
  inviteCode?: string; // present if INVITE_ONLY or SECRET for simplistic access control
}
