import EmbeddedPostgres from 'embedded-postgres';
import path from 'path';

const dataDir = path.resolve(__dirname, '../.pgdata');
const port = 5432;

export const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  port,
  user: 'snackflow',
  password: 'snackflow123',
  persistent: true,
});

async function main() {
  const cmd = process.argv[2] || 'start';
  if (cmd === 'start') {
    console.log(`Starting embedded PostgreSQL on port ${port}...`);
    try {
      await pg.initialise();
    } catch (e: any) {
      // Already initialised
    }
    await pg.start();
    console.log(`Embedded PostgreSQL running on postgresql://snackflow:snackflow123@localhost:${port}/postgres`);
  } else if (cmd === 'stop') {
    await pg.stop();
    console.log('Embedded PostgreSQL stopped.');
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Failed to run embedded postgres:', err);
    process.exit(1);
  });
}
