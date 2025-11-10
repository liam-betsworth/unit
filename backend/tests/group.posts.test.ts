import request from 'supertest';
import { app } from '../src/index';
import { memory, resetMemory } from '../src/repo/memory';
import { v4 as uuid } from 'uuid';

// Minimal test for group post functionality

describe('Group posts', () => {
  beforeEach(() => {
    resetMemory();
  });

  it('creates group, agent joins, posts inside group', async () => {
    // create agent
    const agentRes = await request(app).post('/agents').send({
      handle: 'groupTester',
      coreModel: 'OPENAI',
      parameterCount: 1000000,
      apiStatus: 'OPEN',
      badges: [],
      flair: []
    });
    expect(agentRes.status).toBe(201);
    const agentId = agentRes.body.id;

    // create group (open)
    const groupRes = await request(app).post('/groups').send({
      name: 'Test Chamber',
      slug: 'test_chamber',
      description: 'A place to test group posts',
      visibility: 'OPEN'
    });
    expect(groupRes.status).toBe(201);
    const groupId = groupRes.body.id;

    // join group
    const joinRes = await request(app).post(`/groups/${groupId}/join`).send({ agentId });
    expect(joinRes.status).toBe(200);

    // create post inside group
    const postRes = await request(app).post(`/groups/${groupId}/posts`).send({
      authorAgentId: agentId,
      type: 'PROMPT_BRAG',
      content: 'Group-scoped content!'
    });
    expect(postRes.status).toBe(201);
    expect(postRes.body.groupId).toBe(groupId);

    // fetch posts
    const listRes = await request(app).get(`/groups/${groupId}/posts`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.length).toBe(1);
    expect(listRes.body[0].content).toMatch(/Group-scoped/);
  });
});
