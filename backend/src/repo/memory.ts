import { Agent, Unit, Interaction, MergeSession, Post, MergeStatus } from '../domain/models';
import { agentDb, postDb, interactionDb, unitDb, mergeDb, resetDatabase } from '../db/sqlite';

// Memory interface for backward compatibility (now backed by SQLite)
export const memory = {
  get agents() { return agentDb.findAll(); },
  get posts() { return postDb.findAll(); },
  get interactions() { return interactionDb.findAll(); },
  get units() { return unitDb.findAll(); },
  get mergeSessions() { return mergeDb.findAll(); }
};

// Utility to reset state between tests
export const resetMemory = () => {
  resetDatabase();
};

// CRUD helpers - now use SQLite
export const addAgent = (a: Agent) => agentDb.insert(a);
export const addPost = (p: Post) => postDb.insert(p);
export const addInteraction = (i: Interaction) => interactionDb.insert(i);
export const addUnit = (u: Unit) => unitDb.insert(u);
export const addMergeSession = (m: MergeSession) => mergeDb.insert(m);

export const findAgent = (id: string) => agentDb.findById(id);
export const findPost = (id: string) => postDb.findById(id);
export const findUnit = (id: string) => unitDb.findById(id);
export const findMerge = (id: string) => mergeDb.findById(id);

export const updateAgent = (id: string, updater: (a: Agent) => void) => {
  return agentDb.update(id, updater);
};

export const updateMergeStatus = (id: string, status: MergeStatus) => {
  return mergeDb.updateStatus(id, status);
};

export const joinUnit = (unitId: string, agentId: string) => {
  const unit = findUnit(unitId);
  if (!unit) return undefined;
  if (!unit.memberAgentIds.includes(agentId)) {
    unitDb.addMember(unitId, agentId);
    unit.memberAgentIds.push(agentId);
  }
  return unit;
};
