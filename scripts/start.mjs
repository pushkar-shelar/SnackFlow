import { execSync, spawn } from 'child_process';

console.log('====================================================');
console.log('         STARTING SNACKFLOW MANUFACTURING ERP        ');
console.log('====================================================');

// 1. Start Database first
console.log('[1/2] Starting PostgreSQL database...');
try {
  execSync('pnpm db:start', { stdio: 'inherit' });
} catch (err) {
  console.error('Failed to start database:', err);
  process.exit(1);
}

// 2. Start Dev Servers (API + Web)
console.log('\n[2/2] Launching Web (:3000) and API (:4000) servers...');
const devProcess = spawn('pnpm', ['dev'], {
  stdio: 'inherit',
  shell: true,
});

devProcess.on('exit', (code) => {
  process.exit(code ?? 0);
});

process.on('SIGINT', () => {
  devProcess.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  devProcess.kill();
  process.exit(0);
});
