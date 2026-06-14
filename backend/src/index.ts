import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import routes from './routes/index';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.use('/api', routes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found', docs: '/api/health' });
});

app.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════════════════════╗`);
  console.log(`║   Alexa+ India Context Layer — Backend API           ║`);
  console.log(`║   Running on http://localhost:${PORT}                  ║`);
  console.log(`║   T0 Rule Engine: ACTIVE (deterministic, <10ms)      ║`);
  console.log(`║   T3 Bedrock Agent: READY (Nova Micro / Haiku)       ║`);
  console.log(`╚══════════════════════════════════════════════════════╝\n`);
});

export default app;
