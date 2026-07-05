process.env.MOCK_LLM = 'true';

import request from 'supertest';
import app from '../src/index';

describe('POST /api/scenario-builder/plan', () => {
  it('returns a diagram-ready step plan for a scenario', async () => {
    const res = await request(app)
      .post('/api/scenario-builder/plan')
      .send({ home_id: 'demo_home_001', scenario: 'I am tired, order me dinner' });

    expect(res.status).toBe(200);
    expect(res.body.title).toEqual(expect.any(String));
    expect(Array.isArray(res.body.steps)).toBe(true);
    expect(res.body.steps.length).toBeGreaterThanOrEqual(3);

    expect(res.body.steps[0].actor).toBe('user');

    for (const step of res.body.steps) {
      expect(typeof step.label).toBe('string');
      expect(step.label.length).toBeGreaterThan(0);
      expect(typeof step.detail).toBe('string');
      expect(step.detail.length).toBeGreaterThan(0);
    }

    expect(res.body.trace.path).toContain('t3');
    expect(res.body.trace.cost_usd).toBe(0);
  });

  it('requires home_id and scenario', async () => {
    const res = await request(app)
      .post('/api/scenario-builder/plan')
      .send({ home_id: 'demo_home_001' });

    expect(res.status).toBe(400);
  });
});
