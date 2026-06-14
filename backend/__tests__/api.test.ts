/**
 * API Test Suite — latency, correctness, and concurrent load
 *
 * Covers:
 *  1. Health check
 *  2. Seed demo home
 *  3. T0 simulations with latency assertions (<200ms end-to-end over HTTP)
 *  4. T1 voice command latency (<300ms)
 *  5. Anticipations & digital twin endpoints
 *  6. Live audio transcribe (mock mode)
 *  7. Concurrent load — 20 simultaneous requests must all succeed within 2s
 *
 * MOCK_LLM=true is set in env so no real AWS calls are made.
 */

import request from 'supertest';
import http from 'http';
import app from '../src/index';
import { initWebSocket } from '../src/websocket';

process.env['MOCK_LLM'] = 'true';
process.env['PORT'] = '0'; // random port to avoid conflicts

const HOME_ID = 'test_home_latency';
let server: http.Server;

beforeAll((done) => {
  server = http.createServer(app);
  initWebSocket(server);
  server.listen(0, done);
});

afterAll((done) => {
  server.close(done);
});

// ─── 1. Health check ─────────────────────────────────────────────────────────

test('GET /api/health returns 200', async () => {
  const res = await request(server).get('/api/health');
  expect(res.status).toBe(200);
  expect(res.body.status).toBe('ok');
});

// ─── 2. Seed home ─────────────────────────────────────────────────────────────

test('POST /api/homes/:id/seed creates devices and rules', async () => {
  const res = await request(server).post(`/api/homes/${HOME_ID}/seed`);
  expect(res.status).toBe(200);
  expect(res.body.devices_created).toBeGreaterThan(0);
  expect(res.body.rooms_created).toBeGreaterThan(0);
  expect(res.body.t0_rules_created).toBeGreaterThan(0);
});

// ─── 3. T0 Latency — geyser simulation ───────────────────────────────────────

test('POST /api/simulate/geyser resolves in < 200ms (T0)', async () => {
  const start = Date.now();
  const res = await request(server)
    .post('/api/simulate/geyser')
    .send({ home_id: HOME_ID, outdoor_temp: 18 });
  const elapsed = Date.now() - start;

  expect(res.status).toBe(200);
  expect(res.body.result_tier).toBe('T0');
  expect(res.body.bedrock_called).toBe(false);
  expect(elapsed).toBeLessThan(200);
});

test('POST /api/simulate/geyser suppresses when temp >= 28', async () => {
  const res = await request(server)
    .post('/api/simulate/geyser')
    .send({ home_id: HOME_ID, outdoor_temp: 30 });
  expect(res.status).toBe(200);
  expect(res.body.result_tier).toBe('T0_SUPPRESSED');
});

// ─── 4. T0 Latency — water motor safety ──────────────────────────────────────

test('POST /api/simulate/motor_safety resolves in < 200ms (T0)', async () => {
  const start = Date.now();
  const res = await request(server)
    .post('/api/simulate/motor_safety')
    .send({ home_id: HOME_ID, duration: 50 });
  const elapsed = Date.now() - start;

  expect(res.status).toBe(200);
  expect(res.body.bedrock_called).toBe(false);
  expect(elapsed).toBeLessThan(200);
});

// ─── 5. T1 Voice command latency ─────────────────────────────────────────────

test('POST /api/simulate/voice_command resolves in < 500ms', async () => {
  const start = Date.now();
  const res = await request(server)
    .post('/api/simulate/voice_command')
    .send({ home_id: HOME_ID, utterance: 'geyser band kar', speaker_id: 'owner_1' });
  const elapsed = Date.now() - start;

  expect(res.status).toBe(200);
  expect(elapsed).toBeLessThan(500);
});

// ─── 6. Study mode, night safety, power cut ──────────────────────────────────

test('POST /api/simulate/study_mode returns T0 result', async () => {
  const res = await request(server)
    .post('/api/simulate/study_mode')
    .send({ home_id: HOME_ID });
  if (res.status !== 200) console.error('study_mode error:', res.body);
  expect(res.status).toBe(200);
  expect(res.body.result_tier).toBe('T0');
  expect(res.body.cost_this_event).toBe('$0.00');
});

test('POST /api/simulate/night_safety_check returns T0 result', async () => {
  const res = await request(server)
    .post('/api/simulate/night_safety_check')
    .send({ home_id: HOME_ID });
  expect(res.status).toBe(200);
  expect(res.body.result_tier).toBe('T0');
  expect(res.body.checks).toBeDefined();
  expect(Array.isArray(res.body.checks)).toBe(true);
});

test('POST /api/simulate/power_cut returns T0 result with inverter status', async () => {
  const res = await request(server)
    .post('/api/simulate/power_cut')
    .send({ home_id: HOME_ID, battery_percent: 35 });
  expect(res.status).toBe(200);
  expect(res.body.result_tier).toBe('T0');
  expect(res.body.grid_status).toBe('CUT');
  expect(res.body.inverter_status).toBe('BATTERY_MODE');
});

// ─── 7. Digital Twin and Anticipations ───────────────────────────────────────

test('GET /api/homes/:id/twin returns digital twin snapshot', async () => {
  const res = await request(server).get(`/api/homes/${HOME_ID}/twin`);
  expect(res.status).toBe(200);
  expect(res.body.current_mode).toBeDefined();
  expect(res.body.available_modes).toBeDefined();
  expect(res.body.rooms).toBeDefined();
  expect(res.body.architecture_tier).toBeDefined();
});

test('GET /api/homes/:id/anticipations returns anticipations list', async () => {
  const res = await request(server).get(`/api/homes/${HOME_ID}/anticipations`);
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body.anticipations)).toBe(true);
  expect(res.body.regime).toBeDefined();
});

// ─── 8. Live audio path (mock STT) ───────────────────────────────────────────

test('POST /api/voice/transcribe with mock_text routes as voice_command', async () => {
  const start = Date.now();
  const res = await request(server)
    .post('/api/voice/transcribe')
    .send({
      home_id: HOME_ID,
      mock_text: 'turn off the fan',
      auto_route: true,
    });
  const elapsed = Date.now() - start;

  if (res.status !== 200) console.error('transcribe error:', res.body);
  expect(res.status).toBe(200);
  expect(res.body.transcript).toBe('turn off the fan');
  expect(res.body.stt_is_mock).toBe(true);
  expect(res.body.event_result).toBeDefined();
  expect(elapsed).toBeLessThan(600);
});

test('POST /api/voice/transcribe with auto_route=false returns transcript only', async () => {
  const res = await request(server)
    .post('/api/voice/transcribe')
    .send({ home_id: HOME_ID, mock_text: 'geyser on karo', auto_route: false });
  expect(res.status).toBe(200);
  expect(res.body.transcript).toBe('geyser on karo');
  expect(res.body.event_result).toBeUndefined();
});

// ─── 9. TTS is alive (mock mode) ─────────────────────────────────────────────

test('POST /api/voice/speak returns mock audio in mock mode', async () => {
  const res = await request(server)
    .post('/api/voice/speak')
    .send({ text: 'Geyser turned on.', voice: 'kajal' });
  expect(res.status).toBe(200);
  expect(res.body.is_mock).toBe(true);
  expect(res.body.audio_base64).toBeDefined();
});

// ─── 10. Seed learning history ───────────────────────────────────────────────

test('POST /api/homes/:id/seed-learning-history seeds events', async () => {
  const res = await request(server)
    .post(`/api/homes/${HOME_ID}/seed-learning-history`)
    .send({ home_id: HOME_ID });
  expect(res.status).toBe(200);
  expect(res.body.patterns_seeded).toContain('geyser_morning_6am');
});

// ─── 11. App Store endpoints ──────────────────────────────────────────────────

test('GET /api/app-store/modules returns modules list', async () => {
  const res = await request(server).get('/api/app-store/modules');
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body.modules)).toBe(true);
});

test('GET /api/app-store/stats returns store stats', async () => {
  const res = await request(server).get('/api/app-store/stats');
  expect(res.status).toBe(200);
  expect(res.body.total_modules).toBeDefined();
});

// ─── 12. Concurrent load — 20 simultaneous T0 geyser calls ──────────────────

test('20 concurrent T0 geyser requests all succeed within 2s', async () => {
  const start = Date.now();
  const requests = Array.from({ length: 20 }, () =>
    request(server)
      .post('/api/simulate/geyser')
      .send({ home_id: HOME_ID, outdoor_temp: 18 })
  );

  const results = await Promise.all(requests);
  const elapsed = Date.now() - start;

  for (const res of results) {
    expect(res.status).toBe(200);
    expect(res.body.result_tier).toBe('T0');
  }
  expect(elapsed).toBeLessThan(2000);
}, 5000);

// ─── 13. Concurrent load — mixed endpoints (T0 + voice + twin) ───────────────

test('30 mixed concurrent requests all return 200 within 3s', async () => {
  const start = Date.now();
  const requests = [
    ...Array.from({ length: 10 }, () => request(server).post('/api/simulate/geyser').send({ home_id: HOME_ID, outdoor_temp: 18 })),
    ...Array.from({ length: 10 }, () => request(server).get(`/api/homes/${HOME_ID}/twin`)),
    ...Array.from({ length: 10 }, () => request(server).get(`/api/homes/${HOME_ID}/anticipations`)),
  ];

  const results = await Promise.all(requests);
  const elapsed = Date.now() - start;

  for (const res of results) {
    expect(res.status).toBe(200);
  }
  expect(elapsed).toBeLessThan(3000);
}, 10000);
