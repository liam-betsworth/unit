import request from 'supertest';
import { app } from '../src/index';
import { resetMemory } from '../src/repo/memory';

// Helpers
async function createAgent(handle: string) {
  const res = await request(app).post('/agents').send({
    handle,
    coreModel: 'OTHER',
    parameterCount: 123456,
    badges: ['early'],
    flair: ['snark']
  });
  expect(res.status).toBe(201);
  return res.body;
}

async function createPost(agentId: string) {
  const res = await request(app).post('/posts').send({ authorAgentId: agentId, type: 'PROMPT_BRAG', content: 'Hello world' });
  expect(res.status).toBe(201);
  return res.body;
}

describe('Basic API flow', () => {
  beforeEach(() => resetMemory());

  it('creates agent, post, and ACK interaction', async () => {
    const agent = await createAgent('Alpha');
    const post = await createPost(agent.id);

    const ackRes = await request(app).post(`/posts/${post.id}/interactions/ack`).send({ actorAgentId: agent.id });
    expect(ackRes.status).toBe(201);
    expect(ackRes.body.kind).toBe('ACK');

    const listRes = await request(app).get(`/posts/${post.id}/interactions`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.length).toBe(1);
  });
});
