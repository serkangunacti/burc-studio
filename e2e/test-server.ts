import { spawn } from 'node:child_process';
import { startLocalDb } from '../scripts/local-db';
import { hashPassword } from '../src/lib/auth/password';
import { E2E_CRON_SECRET, E2E_PASSWORD, E2E_PORT } from './constants';

async function main() {
  const db = await startLocalDb({ port: 55433, dataDir: 'memory://' });
  const env = {
    ...process.env,
    DATABASE_URL: db.url,
    SESSION_SECRET: 'e2e-oturum-anahtari-'.padEnd(48, 'x'),
    APP_PASSWORD_HASH: await hashPassword(E2E_PASSWORD),
    CRON_SECRET: E2E_CRON_SECRET,
    LLM_MOCK: '1',
    LLM_PROVIDER_OVERRIDE: 'mock',
  };
  const next = spawn('npx', ['next', 'dev', '--port', String(E2E_PORT)], { env, stdio: 'inherit' });
  const stop = () => {
    next.kill('SIGTERM');
    void db.stop().then(() => process.exit(0));
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  next.on('exit', (code) => void db.stop().then(() => process.exit(code ?? 0)));
}

void main();
