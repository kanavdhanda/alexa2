process.env.MOCK_LLM = 'true';
import { parseKhataUtteranceMock, khataStore } from '../src/khata';

describe('khata mock parser — deterministic responses', () => {
  beforeEach(() => khataStore.reset());

  test('doodhwala: 2 liter milk delivery @ ₹60/L', () => {
    const result = parseKhataUtteranceMock('Doodhwala ne 2 liter doodh deliver kiya, ₹60 per liter');
    expect(result.vendor).toBe('doodhwala');
    expect(result.vendor_hi).toBe('दूधवाला');
    expect(result.kind).toBe('delivery');
    expect(result.quantity).toBe(2);
    expect(result.unit).toBe('liter');
    expect(result.amount_inr).toBe(120);
  });

  test('dhobi: 15 items missed pickup', () => {
    const result = parseKhataUtteranceMock('Dhobi ne 15 kapde nahi utha ke gaya');
    expect(result.vendor).toBe('dhobi');
    expect(result.vendor_hi).toBe('धोबी');
    expect(result.kind).toBe('missed');
    expect(result.quantity).toBe(15);
    expect(result.unit).toBe('items');
    expect(result.amount_inr).toBeGreaterThan(0);
  });

  test('maid: ₹500 payment', () => {
    const result = parseKhataUtteranceMock('Maid ko 500 rupees pay kiya');
    expect(result.vendor).toBe('maid');
    expect(result.vendor_hi).toBe('नौकरानी');
    expect(result.kind).toBe('payment');
    expect(result.amount_inr).toBe(500);
  });

  test('newspaper: 30 days delivery', () => {
    const result = parseKhataUtteranceMock('Newspaper wala 30 din ka bill laya');
    expect(result.vendor).toBe('newspaper');
    expect(result.vendor_hi).toBe('अखबार वाला');
    expect(result.kind).toBe('delivery');
    expect(result.quantity).toBe(30);
    expect(result.unit).toBe('days');
  });

  test('store: add entry, ledger shows subtotal per vendor', () => {
    const e1 = parseKhataUtteranceMock('Doodhwala ne 2 liter doodh deliver kiya, ₹60 per liter');
    const e2 = parseKhataUtteranceMock('Doodhwala ne 2 liter doodh deliver kiya, ₹60 per liter');
    khataStore.add('home1', e1);
    khataStore.add('home1', e2);

    const { vendors } = khataStore.ledger('home1');
    expect(vendors.length).toBe(1);
    expect(vendors[0].vendor).toBe('doodhwala');
    expect(vendors[0].subtotal_inr).toBe(240);
    expect(vendors[0].entries.length).toBe(2);
  });

  test('settle: total + upi_link', () => {
    const e1 = parseKhataUtteranceMock('Doodhwala ne 2 liter doodh deliver kiya, ₹60 per liter');
    const e2 = parseKhataUtteranceMock('Maid ko 500 rupees pay kiya');
    khataStore.add('home1', e1);
    khataStore.add('home1', e2);

    const { lines, total_inr, upi_link } = khataStore.settle('home1');
    expect(lines.length).toBe(2);
    expect(total_inr).toBe(620);
    expect(upi_link).toContain('upi://pay');
    expect(upi_link).toContain('am=620');
  });
});

describe('khata API routes (supertest)', () => {
  let app: any;
  let request: any;

  beforeAll(async () => {
    app = require('../src/index').default;
    request = require('supertest')(app);
    khataStore.reset();
  });

  test('POST /api/homes/:home_id/khata/log', async () => {
    const res = await request
      .post('/api/homes/test-home-1/khata/log')
      .send({ utterance: 'Doodhwala ne 2 liter doodh deliver kiya, ₹60 per liter' })
      .expect(200);

    expect(res.body).toHaveProperty('entry');
    expect(res.body).toHaveProperty('speech');
    expect(res.body).toHaveProperty('trace');
    expect(res.body.entry.vendor).toBe('doodhwala');
    expect(res.body.entry.amount_inr).toBe(120);
    expect(res.body.trace.tier_label).toBe('Thinks locally');
  });

  test('GET /api/homes/:home_id/khata/ledger', async () => {
    // Add an entry first
    await request
      .post('/api/homes/test-home-2/khata/log')
      .send({ utterance: 'Doodhwala ne 2 liter doodh deliver kiya, ₹60 per liter' })
      .expect(200);

    const res = await request
      .get('/api/homes/test-home-2/khata/ledger')
      .expect(200);

    expect(res.body).toHaveProperty('vendors');
    expect(res.body).toHaveProperty('month');
    expect(res.body.vendors.length).toBe(1);
    expect(res.body.vendors[0].vendor).toBe('doodhwala');
  });

  test('POST /api/homes/:home_id/khata/settle', async () => {
    // Add entries first
    await request
      .post('/api/homes/test-home-3/khata/log')
      .send({ utterance: 'Doodhwala ne 2 liter doodh deliver kiya, ₹60 per liter' })
      .expect(200);

    await request
      .post('/api/homes/test-home-3/khata/log')
      .send({ utterance: 'Maid ko 500 rupees pay kiya' })
      .expect(200);

    const res = await request
      .post('/api/homes/test-home-3/khata/settle')
      .expect(200);

    expect(res.body).toHaveProperty('lines');
    expect(res.body).toHaveProperty('total_inr');
    expect(res.body).toHaveProperty('upi_link');
    expect(res.body).toHaveProperty('speech');
    expect(res.body.total_inr).toBe(620);
    expect(res.body.upi_link).toContain('upi://pay');
  });
});
