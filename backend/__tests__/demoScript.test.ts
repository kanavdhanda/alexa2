import request from 'supertest';
import app from '../src/index';

it('demo script returns ordered steps with captions', async () => {
  const res = await request(app).get('/api/demo/script');
  expect(res.body.steps.length).toBeGreaterThanOrEqual(5);
  for (const s of res.body.steps) {
    expect(s.caption).toBeTruthy();
    expect(s.endpoint).toMatch(/^\/api\//);
    expect(s.dwell_ms).toBeGreaterThan(2000);
  }
});

it('poll endpoint returns buffered events after a simulate', async () => {
  await request(app).post('/api/homes/demo_home_001/seed');
  const before = await request(app).get('/api/homes/demo_home_001/poll?since=0');
  await request(app).post('/api/simulate/geyser').send({ home_id: 'demo_home_001', outdoor_temp: 18 });
  const after = await request(app).get(`/api/homes/demo_home_001/poll?since=${before.body.latest_seq}`);
  expect(after.body.events.length).toBeGreaterThan(0);
});
