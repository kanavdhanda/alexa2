import http from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import routes from './routes/index';
import { initWebSocket } from './websocket';
import { financialSafety } from './financialSafety';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : []),
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.use('/api', routes);

app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}`, docs: '/api/health' });
});

export default app;

// Only start the server when run directly (not when imported by tests)
if (require.main === module) {
  const server = http.createServer(app);
  initWebSocket(server);

  server.listen(PORT, () => {
    const mockLabel = financialSafety.isMockMode() ? ' [MOCK_LLM=true — no real Bedrock calls]' : ' [LIVE — Bedrock enabled]';
    console.log(`\n╔══════════════════════════════════════════════════════════╗`);
    console.log(`║   Alexa+ India Context Layer — Backend API v2            ║`);
    console.log(`║   HTTP  → http://localhost:${PORT}/api/health              ║`);
    console.log(`║   WS    → ws://localhost:${PORT}/ws?home_id=demo_home_001  ║`);
    console.log(`║   T0 Rule Engine    : ACTIVE (<10ms, $0)                 ║`);
    console.log(`║   T1 Local NLU      : ACTIVE (<100ms, $0)                ║`);
    console.log(`║   T3 Bedrock Agent  : ${mockLabel.padEnd(32)}║`);
    console.log(`║   Amazon Polly TTS  : ${financialSafety.isMockMode() ? 'MOCK MODE                    ' : 'ACTIVE (Indian English voice) '}║`);
    console.log(`╚══════════════════════════════════════════════════════════╝\n`);
    console.log(`Quick start: POST http://localhost:${PORT}/api/homes/demo_home_001/seed`);
    console.log(`Then try:    POST http://localhost:${PORT}/api/simulate/geyser\n`);
  });

  process.on('SIGTERM', () => { server.close(() => process.exit(0)); });
  process.on('SIGINT',  () => { server.close(() => process.exit(0)); });
}
