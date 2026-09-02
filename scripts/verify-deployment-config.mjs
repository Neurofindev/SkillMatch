import { access, readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function text(path) {
  return (await readFile(path, 'utf8')).replace(/\r\n/g, '\n');
}

const publicHeaders = await text('public/_headers');
const builtHeaders = await text('dist/_headers');
const publicRedirects = (await text('public/_redirects')).trim();
const builtRedirects = (await text('dist/_redirects')).trim();
const envExample = await text('.env.example');

await access('dist/index.html');

assert(
  publicHeaders === builtHeaders,
  'dist/_headers ne correspond pas à public/_headers.',
);
assert(
  publicRedirects === '/* /index.html 200',
  'Le fallback SPA public est invalide.',
);
assert(builtRedirects === publicRedirects, 'Le fallback SPA manque dans dist.');

const requiredHeaderFragments = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "script-src 'self'",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "img-src 'self' data: blob: https://*.supabase.co",
  'Strict-Transport-Security: max-age=31536000',
  'X-Content-Type-Options: nosniff',
  'X-Frame-Options: DENY',
  'Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()',
];

for (const fragment of requiredHeaderFragments) {
  assert(
    publicHeaders.includes(fragment),
    `En-tête requis absent : ${fragment}`,
  );
}

assert(
  !publicHeaders.includes("'unsafe-eval'"),
  "La CSP ne doit pas autoriser 'unsafe-eval'.",
);
assert(
  !publicHeaders.includes('127.0.0.1'),
  'La CSP de production ne doit pas autoriser localhost.',
);

for (const line of publicHeaders.split('\n')) {
  assert(
    line.length <= 2_000,
    'Une ligne _headers dépasse la limite Cloudflare Pages de 2 000 caractères.',
  );
}

const declaredEnvKeys = envExample
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line))
  .map((line) => line.slice(0, line.indexOf('=')))
  .sort();

assert(
  JSON.stringify(declaredEnvKeys) ===
    JSON.stringify(['VITE_SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_URL']),
  `.env.example expose des clés inattendues : ${declaredEnvKeys.join(', ')}`,
);
assert(
  !/service_role|SUPABASE_ACCESS_TOKEN|CLOUDFLARE_API_TOKEN/i.test(envExample),
  '.env.example mentionne un secret serveur.',
);

console.log(
  'Configuration de déploiement : SPA, en-têtes, CSP, build et variables publiques valides.',
);
