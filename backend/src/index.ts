import './logger'; // Capture all logs first
import http from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import routes from './routes/index';
import { initWebSocket } from './websocket';
import { initNightlyBatch } from './nightlyBatch';
import { financialSafety } from './financialSafety';
import { logsBuffer, LOGS_ACCESS_KEY, escapeHtml } from './logger';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : []),
];

app.use(cors({
  origin: true,
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

// Admin Logs Page
app.get(`/${LOGS_ACCESS_KEY}/logs`, (req, res) => {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Alexa+ Backend Logs</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body {
            background-color: #0b0c10;
            color: #c5c6c7;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            padding: 20px;
            font-size: 13px;
            line-height: 1.5;
          }
          h1 {
            font-size: 18px;
            margin-bottom: 20px;
            border-bottom: 2px solid #1f2833;
            padding-bottom: 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            color: #66fcf1;
          }
          .actions {
            display: flex;
            gap: 10px;
          }
          button {
            background: #1f2833;
            color: #66fcf1;
            border: 1px solid #66fcf1;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
            transition: all 0.2s ease;
          }
          button:hover {
            background: #66fcf1;
            color: #0b0c10;
          }
          .log-container {
            display: flex;
            flex-direction: column;
            gap: 4px;
            background: #151922;
            padding: 15px;
            border-radius: 8px;
            border: 1px solid #1f2833;
            max-height: 80vh;
            overflow-y: auto;
          }
          .log-line {
            white-space: pre-wrap;
            word-break: break-all;
            border-bottom: 1px solid #202b3c;
            padding-bottom: 4px;
          }
          .level-WARN { color: #f5b041; }
          .level-ERROR { color: #ec7063; font-weight: bold; }
          .level-INFO { color: #c5c6c7; }
        </style>
      </head>
      <body>
        <h1>
          <span>Alexa+ India Backend Logs (Newest to Oldest)</span>
          <div class="actions">
            <button onclick="window.location.reload()">Refresh</button>
            <button onclick="clearLogs()">Clear</button>
          </div>
        </h1>
        <div class="log-container">
          ${
            logsBuffer.slice().reverse().map(line => {
              let cls = 'level-INFO';
              if (line.includes('[WARN]')) cls = 'level-WARN';
              if (line.includes('[ERROR]')) cls = 'level-ERROR';
              return `<div class="log-line ${cls}">${escapeHtml(line)}</div>`;
            }).join('')
          }
        </div>
        <script>
          function clearLogs() {
            if (confirm('Clear all logs?')) {
              fetch('/${LOGS_ACCESS_KEY}/logs/clear', { method: 'POST' })
                .then(() => window.location.reload());
            }
          }
        </script>
      </body>
    </html>
  `;
  res.send(html);
});

app.post(`/${LOGS_ACCESS_KEY}/logs/clear`, (req, res) => {
  logsBuffer.length = 0;
  res.sendStatus(200);
});

app.use('/api', routes);

app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}`, docs: '/api/health' });
});

export default app;

// Only start the server when run directly (not when imported by tests)
if (require.main === module) {
  const server = http.createServer(app);
  const ws = initWebSocket(server);
  initNightlyBatch(ws);

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
