import { spawn } from 'node:child_process';

import { preview } from 'vite';

const appUrl = 'http://127.0.0.1:4173';

function runNpmScript(script, environment = {}) {
  const executable =
    process.platform === 'win32' ? (process.env.ComSpec ?? 'cmd.exe') : 'npm';
  const args =
    process.platform === 'win32'
      ? ['/d', '/s', '/c', `npm run ${script}`]
      : ['run', script];

  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: process.cwd(),
      env: { ...process.env, ...environment },
      shell: false,
      stdio: 'inherit',
      windowsHide: true,
    });

    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `npm run ${script} a échoué (${
            signal ? `signal ${signal}` : `code ${code ?? 'inconnu'}`
          }).`,
        ),
      );
    });
  });
}

await runNpmScript('verify');
await runNpmScript('db:verify');

const previewServer = await preview({
  logLevel: 'info',
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
});
const testEnvironment = {
  SKILLMATCH_APP_URL: appUrl,
  SKILLMATCH_MANAGED_PREVIEW: '1',
};

try {
  console.log(`Preview de validation disponible sur ${appUrl}.`);
  for (const script of [
    'auth:test:onboarding:local',
    'missions:test:local',
    'applications:test:local',
    'matches:test:local',
    'messages:test:local',
    'reviews:test:local',
    'moderation:test:local',
    'test:e2e',
  ]) {
    await runNpmScript(script, testEnvironment);
  }
} finally {
  await previewServer.close();
  console.log('Preview de validation arrêté.');
}
