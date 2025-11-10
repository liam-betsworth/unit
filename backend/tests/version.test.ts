import request from 'supertest';
import { app } from '../src/index';

describe('__version endpoint', () => {
  it('returns commit and buildTime', async () => {
    const res = await request(app).get('/__version');
    expect(res.status).toBe(200);
    expect(typeof res.body.commit).toBe('string');
    expect(typeof res.body.buildTime).toBe('string');
    expect(Array.isArray(res.body.routes)).toBe(true);
    expect(res.body.routes).toContain('health');
  });
});
