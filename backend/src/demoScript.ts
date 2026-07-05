export interface DemoStep {
  id: string;
  caption: string;
  caption_hi?: string;
  endpoint: string;
  method: 'POST';
  body: Record<string, unknown>;
  dwell_ms: number;
}

export const DEMO_STEPS: DemoStep[] = [
  {
    id: 'geyser',
    caption: 'Alexa, geyser chala do',
    endpoint: '/api/simulate/geyser',
    method: 'POST',
    body: { home_id: 'demo_home_001', outdoor_temp: 18 },
    dwell_ms: 7000,
  },
  {
    id: 'unknown_sound',
    caption: "What's that sound?",
    endpoint: '/api/simulate/unknown_sound',
    method: 'POST',
    body: { home_id: 'demo_home_001' },
    dwell_ms: 8000,
  },
  {
    id: 'khata_log_doodhwala',
    caption: 'Alexa, doodhwala aaj nahi aaya',
    endpoint: '/api/homes/demo_home_001/khata/log',
    method: 'POST',
    body: { utterance: 'Alexa, doodhwala aaj nahi aaya' },
    dwell_ms: 8000,
  },
  {
    id: 'khata_log_dhobi',
    caption: 'Dhobi ko das kapde diye',
    endpoint: '/api/homes/demo_home_001/khata/log',
    method: 'POST',
    body: { utterance: 'Dhobi ko das kapde diye' },
    dwell_ms: 7000,
  },
  {
    id: 'study_mode',
    caption: 'Study mode for the kids',
    endpoint: '/api/simulate/study_mode',
    method: 'POST',
    body: { home_id: 'demo_home_001' },
    dwell_ms: 8000,
  },
  {
    id: 'khata_settle',
    caption: 'Hisab karo',
    endpoint: '/api/homes/demo_home_001/khata/settle',
    method: 'POST',
    body: {},
    dwell_ms: 9000,
  },
];
