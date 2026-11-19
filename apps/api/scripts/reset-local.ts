import { execSync } from 'child_process';
import { URL } from 'url';

function main() {
  const dbUrl = process.env.DATABASE_URL || '';
  if (!dbUrl) {
    console.error('❌ Error: DATABASE_URL is not set.');
    process.exit(1);
  }

  try {
    const parsed = new URL(dbUrl);
    const host = parsed.hostname.toLowerCase();
    const allowedHosts = ['localhost', '127.0.0.1', 'postgres', 'snackflow-postgres'];

    if (!allowedHosts.includes(host)) {
      console.error(
        `🚨 REFUSING TO RESET NON-LOCAL DATABASE: Host "${host}" is not in allowed local hosts: ${allowedHosts.join(
          ', ',
        )}`,
      );
      process.exit(1);
    }

    console.log(`🧹 Safe local database reset targeting host "${host}"...`);
    execSync('npx prisma db push --force-reset', { stdio: 'inherit' });
    execSync('npx tsx scripts/apply-roles.ts', { stdio: 'inherit' });
    execSync('npx tsx prisma/seed.ts', { stdio: 'inherit' });
    console.log('✅ Local database reset and re-seeded successfully.');
  } catch (err) {
    console.error('Failed to parse or reset database:', err);
    process.exit(1);
  }
}

main();
