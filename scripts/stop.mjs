import { execSync } from 'child_process';

console.log('Stopping all SnackFlow services...');

// 1. Stop embedded Postgres cleanly if running
try {
  execSync('pnpm db:stop', { stdio: 'inherit' });
} catch {
  // Continue even if db:stop was already stopped
}

// 2. Terminate any lingering processes on ports 3000, 4000, 5555, 5432
const ports = [3000, 4000, 5555, 5432];
for (const port of ports) {
  try {
    if (process.platform === 'win32') {
      execSync(
        `powershell -Command "Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"`,
        { stdio: 'ignore' }
      );
    } else {
      execSync(`lsof -ti:${port} | xargs kill -9`, { stdio: 'ignore' });
    }
  } catch {
    // Ignore errors if port is not in use
  }
}

console.log('All SnackFlow services (Web :3000, API :4000, Studio :5555, DB :5432) have been stopped successfully.');
