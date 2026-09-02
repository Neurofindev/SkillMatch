import { spawnSync } from 'node:child_process';

function runSupabase(args, timeout = 180_000) {
  const executable = process.platform === 'win32' ? process.env.ComSpec : 'npx';
  const commandArgs =
    process.platform === 'win32'
      ? ['/d', '/s', '/c', `npx supabase ${args.join(' ')}`]
      : ['supabase', ...args];
  return spawnSync(executable, commandArgs, {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: '1' },
    maxBuffer: 10 * 1024 * 1024,
    shell: false,
    timeout,
  });
}

const start = runSupabase(['start']);
if (start.status !== 0) {
  const diagnostic = `${start.stdout}\n${start.stderr}`
    .trim()
    .split('\n')
    .filter(
      (line) =>
        !/(_?KEY|SECRET|PASSWORD|postgresql:\/\/|DB_URL|API_URL)/i.test(line),
    )
    .slice(-5)
    .join(' ');
  throw new Error(
    `La stack Supabase locale complète n’a pas pu démarrer${diagnostic ? ` : ${diagnostic}` : '.'}`,
  );
}

const status = runSupabase(['status', '-o', 'json'], 30_000);
if (status.status !== 0) {
  throw new Error('La stack a démarré mais son état ne peut pas être vérifié.');
}
const values = JSON.parse(status.stdout);
if (!values.API_URL || !(values.PUBLISHABLE_KEY || values.ANON_KEY)) {
  throw new Error(
    'La stack locale ne fournit pas Auth/API et sa clé publique.',
  );
}

console.log(
  'Stack Supabase locale complète active (Auth, API, Storage et Mailpit).',
);
