import https from 'https';

interface NeonBranch {
  id: string;
  name: string;
}

async function neonRequest(path: string, method: string = 'GET', body?: any): Promise<any> {
  const apiKey = process.env.NEON_API_KEY;
  if (!apiKey) {
    throw new Error('NEON_API_KEY environment variable is required to reset demo environment');
  }

  return new Promise((resolve, reject) => {
    const dataString = body ? JSON.stringify(body) : '';
    const req = https.request(
      `https://console.neon.tech/api/v2${path}`,
      {
        method,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(raw ? JSON.parse(raw) : {});
          } else {
            reject(new Error(`Neon API error (${res.statusCode}): ${raw}`));
          }
        });
      },
    );

    req.on('error', reject);
    if (dataString) {
      req.write(dataString);
    }
    req.end();
  });
}

async function main() {
  const projectId = process.env.NEON_PROJECT_ID;
  if (!projectId) {
    console.error('❌ Error: NEON_PROJECT_ID is required to execute demo:reset.');
    process.exit(1);
  }

  const targetBranch = process.env.TARGET_BRANCH || 'evaluator';

  // SAFETY INVARIANT: Strictly refuse to touch 'main' or production branches
  if (targetBranch === 'main' || targetBranch === 'production') {
    console.error(`🚨 SAFETY VIOLATION: Refusing to reset protected branch "${targetBranch}". Only "evaluator" may be reset.`);
    process.exit(1);
  }

  console.log(`🔄 Fetching Neon branches for project ${projectId}...`);
  const { branches } = (await neonRequest(`/projects/${projectId}/branches`)) as { branches: NeonBranch[] };

  const baselineBranch = branches.find((b) => b.name === 'seed-baseline' || b.name === 'main');
  if (!baselineBranch) {
    console.error('❌ Could not find baseline branch (seed-baseline or main) in Neon project.');
    process.exit(1);
  }

  const existingEvalBranch = branches.find((b) => b.name === targetBranch);

  if (existingEvalBranch) {
    console.log(`🗑️ Deleting existing "${targetBranch}" branch (${existingEvalBranch.id})...`);
    await neonRequest(`/projects/${projectId}/branches/${existingEvalBranch.id}`, 'DELETE');
    console.log(`✅ Branch "${targetBranch}" deleted.`);
  }

  console.log(`🌱 Re-creating "${targetBranch}" branched fresh from "${baselineBranch.name}" (${baselineBranch.id})...`);
  const createRes = await neonRequest(`/projects/${projectId}/branches`, 'POST', {
    branch: {
      name: targetBranch,
      parent_id: baselineBranch.id,
    },
  });

  console.log(`🎉 Demo environment successfully reset! New branch: ${createRes.branch.name} (ID: ${createRes.branch.id})`);
}

main().catch((err) => {
  console.error('Failed to reset demo environment:', err.message);
  process.exit(1);
});
