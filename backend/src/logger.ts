import crypto from 'crypto';

const originalLog = console.log;
const originalInfo = console.info;
const originalWarn = console.warn;
const originalError = console.error;

export const logsBuffer: string[] = [];
const MAX_LOGS = 3000;

function formatMsg(level: string, args: any[]): string {
  const timestamp = new Date().toISOString();
  const content = args.map(arg => {
    if (arg instanceof Error) {
      return arg.stack || arg.message;
    }
    return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
  }).join(' ');
  return `[${timestamp}] [${level}] ${content}`;
}

function addLog(level: string, args: any[]) {
  const line = formatMsg(level, args);
  logsBuffer.push(line);
  if (logsBuffer.length > MAX_LOGS) {
    logsBuffer.shift();
  }
}

console.log = (...args) => { originalLog(...args); addLog('INFO', args); };
console.info = (...args) => { originalInfo(...args); addLog('INFO', args); };
console.warn = (...args) => { originalWarn(...args); addLog('WARN', args); };
console.error = (...args) => { originalError(...args); addLog('ERROR', args); };

// Determine log key
export const LOGS_ACCESS_KEY = process.env.LOGS_ACCESS_KEY || 'admin_logs';

// Print to raw console
originalLog(`\n[LOGS] Interceptor activated. Logs endpoint: /${LOGS_ACCESS_KEY}/logs\n`);

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
