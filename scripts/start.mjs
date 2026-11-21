import net from 'net';
import { spawn } from 'child_process';

console.log('====================================================');
console.log('         STARTING SNACKFLOW MANUFACTURING ERP        ');
console.log('====================================================');

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(400);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, '127.0.0.1');
  });
}

async function waitForPort(port, timeoutMs = 25000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    if (await isPortOpen(port)) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

async function main() {
  let dbProcess = null;

  // 1. Check if database is already running on port 5432
  const dbAlreadyRunning = await isPortOpen(5432);
  if (dbAlreadyRunning) {
    console.log('[1/2] PostgreSQL database is already active on port 5432.');
  } else {
    console.log('[1/2] Starting PostgreSQL database daemon...');
    dbProcess = spawn('pnpm', ['db:start'], {
      stdio: 'pipe',
      shell: true,
    });

    dbProcess.stdout?.on('data', (d) => {
      const msg = d.toString();
      if (msg.includes('running on postgresql') || msg.includes('ready to accept connections')) {
        process.stdout.write(msg);
      }
    });

    const isReady = await waitForPort(5432, 25000);
    if (!isReady) {
      console.error('Failed to connect to PostgreSQL on port 5432 within 25s.');
      if (dbProcess) dbProcess.kill();
      process.exit(1);
    }
    console.log('PostgreSQL is ready and accepting connections on port 5432.');
  }

  // 2. Launch Dev Servers (API + Web)
  console.log('\n[2/2] Launching Web (:3000) and API (:4000) servers...');
  const devProcess = spawn('pnpm', ['dev'], {
    stdio: 'inherit',
    shell: true,
  });

  const cleanup = () => {
    console.log('\nShutting down SnackFlow servers...');
    try {
      devProcess.kill();
    } catch {}
    if (dbProcess) {
      try {
        dbProcess.kill();
      } catch {}
    }
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  devProcess.on('exit', (code) => {
    if (dbProcess) {
      try {
        dbProcess.kill();
      } catch {}
    }
    process.exit(code ?? 0);
  });
}

main().catch((err) => {
  console.error('Failed to start SnackFlow:', err);
  process.exit(1);
});
