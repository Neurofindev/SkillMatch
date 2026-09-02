import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

import { createClient } from '@supabase/supabase-js';

function readLocalStatus() {
  const executable = process.platform === 'win32' ? process.env.ComSpec : 'npx';
  const args =
    process.platform === 'win32'
      ? ['/d', '/s', '/c', 'npx supabase status -o json']
      : ['supabase', 'status', '-o', 'json'];
  const result = spawnSync(executable, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: '1' },
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error('La stack Supabase locale n’est pas disponible.');
  }
  const status = JSON.parse(result.stdout);
  const apiUrl = status.API_URL ?? status.api_url;
  const anonKey =
    status.PUBLISHABLE_KEY ??
    status.publishable_key ??
    status.ANON_KEY ??
    status.anon_key;
  if (!apiUrl || !anonKey) {
    throw new Error(
      `La configuration publique locale est introuvable (${Object.keys(status).join(', ')}).`,
    );
  }
  return { anonKey, apiUrl };
}

const { anonKey, apiUrl } = readLocalStatus();
const client = createClient(apiUrl, anonKey, {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
});

const runId = randomUUID();
const password = `Phase04!${randomUUID()}Aa9`;
const emails = [
  `phase04-${runId}-one@example.test`,
  `phase04-${runId}-two@example.test`,
];

const results = [];
for (const email of emails) {
  const { data, error } = await client.auth.signUp({
    email,
    options: {
      data: { adult_confirmed: true, initial_capability: 'both' },
      emailRedirectTo: 'http://127.0.0.1:5173/auth/retour',
    },
    password,
  });
  if (error || !data.user) {
    throw new Error(
      `Inscription locale refusée (${error?.code ?? 'sans-identifiant'}).`,
    );
  }
  results.push(data);
}

if (results[0].user?.id === results[1].user?.id) {
  throw new Error('Les deux inscriptions ont reçu la même identité.');
}
if (results.some((result) => result.session !== null)) {
  throw new Error(
    'Une session a été ouverte avant la confirmation e-mail locale.',
  );
}

const preConfirmationLogin = await client.auth.signInWithPassword({
  email: emails[0],
  password,
});
if (!preConfirmationLogin.error) {
  throw new Error(
    'La connexion avant confirmation e-mail aurait dû être refusée.',
  );
}

console.log('Auth local : 2 inscriptions publiques distinctes créées.');
console.log('Confirmation e-mail locale : requise avant toute session.');
console.log('Connexion avant confirmation : refusée comme attendu.');
