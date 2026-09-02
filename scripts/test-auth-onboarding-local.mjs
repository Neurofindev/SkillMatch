import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const APP_URL = process.env.SKILLMATCH_APP_URL ?? 'http://127.0.0.1:4173';

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
    throw new Error('La stack Supabase locale complète n’est pas disponible.');
  }
  const status = JSON.parse(result.stdout);
  const apiUrl = status.API_URL ?? status.api_url;
  const publishableKey =
    status.PUBLISHABLE_KEY ??
    status.publishable_key ??
    status.ANON_KEY ??
    status.anon_key;
  const mailpitUrl =
    status.MAILPIT_URL ??
    status.mailpit_url ??
    status.INBUCKET_URL ??
    status.inbucket_url;
  if (!apiUrl || !publishableKey || !mailpitUrl) {
    throw new Error('Auth, API ou Mailpit local est indisponible.');
  }
  return { apiUrl, mailpitUrl, publishableKey };
}

async function waitForConfirmationLink(mailpitUrl, email) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const response = await fetch(`${mailpitUrl}/api/v1/messages?limit=100`);
    if (!response.ok) throw new Error('Mailpit local ne répond pas.');
    const body = await response.json();
    const messages = body.messages ?? body.Messages ?? [];
    const summary = messages.find((message) => {
      const recipients = message.To ?? message.to ?? [];
      return JSON.stringify(recipients)
        .toLowerCase()
        .includes(email.toLowerCase());
    });
    if (summary) {
      const id = summary.ID ?? summary.Id ?? summary.id;
      const detailResponse = await fetch(`${mailpitUrl}/api/v1/message/${id}`);
      if (!detailResponse.ok)
        throw new Error('Le message local est illisible.');
      const detail = await detailResponse.json();
      const content = [
        detail.HTML,
        detail.Html,
        detail.html,
        detail.Text,
        detail.text,
      ]
        .filter(Boolean)
        .join('\n');
      const match = content.match(
        /https?:\/\/[^\s"'<>]+\/auth\/v1\/verify[^\s"'<>]*/i,
      );
      if (!match) throw new Error('Le lien de confirmation local est absent.');
      const link = match[0].replaceAll('&amp;', '&');
      const parsed = new URL(link);
      if (!['127.0.0.1', 'localhost'].includes(parsed.hostname)) {
        throw new Error(
          'Le lien de confirmation ne cible pas la stack locale.',
        );
      }
      return link;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Le message de confirmation local n’est pas arrivé.');
}

const { apiUrl, mailpitUrl, publishableKey } = readLocalStatus();
const health = await fetch(APP_URL);
if (!health.ok) {
  throw new Error(
    'Lancez d’abord le preview avec npm run preview -- --host 127.0.0.1.',
  );
}

const suffix = randomUUID().slice(0, 12);
const email = `phase04-browser-${suffix}@example.test`;
const password = `Phase04!${randomUUID()}Aa9`;
const username = `phase04-${suffix}`;
const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({
    viewport: { height: 720, width: 320 },
  });
  const page = await context.newPage();
  await page.goto(`${APP_URL}/inscription`);
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.locator('#signup-password').fill(password);
  await page.locator('#signup-password-confirmation').fill(password);
  await page.getByLabel('Je déclare avoir au moins 18 ans.').check();
  await page.getByLabel(/J’accepte les/).check();
  await page.getByRole('button', { name: /Créer mon compte/ }).click();
  await page
    .getByRole('heading', { name: 'Consultez votre messagerie' })
    .waitFor();

  const confirmationLink = await waitForConfirmationLink(mailpitUrl, email);
  await page.goto(confirmationLink);
  await page.waitForURL(`${APP_URL}/auth/retour**`);
  await page.getByRole('heading', { name: 'Adresse confirmée' }).waitFor();
  await page.getByRole('link', { name: 'Commencer l’onboarding' }).click();

  await page.getByLabel('Nom affiché').fill('Profil réel Phase 04');
  await page.getByLabel('Username').fill(username);
  await page.getByRole('button', { name: /Continuer/ }).click();
  await page.getByRole('heading', { name: 'Capacités' }).waitFor();
  await page.getByLabel('Trouver et publier des missions').check();
  await page.getByRole('button', { name: /Continuer/ }).click();
  await page.getByRole('heading', { name: 'Modes de travail' }).waitFor();
  await page.getByLabel('Local et à distance').check();
  await page.getByRole('button', { name: /Continuer/ }).click();
  await page.getByRole('heading', { name: 'Zone approximative' }).waitFor();
  await page.getByLabel('Ville approximative').fill('Lyon');
  await page.getByLabel('Code pays').fill('FR');
  await page.getByRole('button', { name: /Continuer/ }).click();
  await page.getByRole('heading', { name: 'Compétences' }).waitFor();
  await page.locator('.skill-option input[type="checkbox"]').first().check();
  await page.getByRole('button', { name: /Continuer/ }).click();
  await page.getByRole('heading', { name: 'Présentation' }).waitFor();
  await page
    .getByLabel('Bio courte')
    .fill(
      'Profil créé pendant le parcours local réel de validation de la phase quatre.',
    );
  await page.getByRole('button', { name: /Continuer/ }).click();
  await page.getByRole('heading', { name: 'Disponibilité' }).waitFor();
  await page.getByRole('button', { name: /Continuer/ }).click();
  await page.getByRole('heading', { name: 'Avatar' }).waitFor();
  await page.getByRole('button', { name: /Continuer/ }).click();
  await page.getByRole('heading', { name: 'Confirmation' }).waitFor();
  await page.getByRole('button', { name: /Terminer mon profil/ }).click();
  await page.waitForURL(`${APP_URL}/espace`);
  await page.getByRole('heading', { name: 'Tableau de bord' }).waitFor();

  await page.reload();
  await page.getByRole('heading', { name: 'Tableau de bord' }).waitFor();
  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  if (viewport.scrollWidth > viewport.clientWidth) {
    throw new Error('Le parcours authentifié déborde du viewport 320 px.');
  }
  await context.close();

  const verificationClient = createClient(apiUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  const login = await verificationClient.auth.signInWithPassword({
    email,
    password,
  });
  if (login.error || !login.data.session) {
    throw new Error('La session confirmée ne peut pas être recréée.');
  }
  const profile = await verificationClient
    .from('profiles')
    .select('can_work, can_hire, onboarding_completed')
    .eq('id', login.data.user.id)
    .single();
  const skillCount = await verificationClient
    .from('profile_skills')
    .select('*', { count: 'exact', head: true })
    .eq('profile_id', login.data.user.id);
  const availabilityCount = await verificationClient
    .from('availability_slots')
    .select('*', { count: 'exact', head: true })
    .eq('profile_id', login.data.user.id);
  const draftCount = await verificationClient
    .from('onboarding_drafts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', login.data.user.id);
  if (
    profile.error ||
    !profile.data?.onboarding_completed ||
    !profile.data.can_work ||
    !profile.data.can_hire ||
    skillCount.error ||
    skillCount.count !== 1 ||
    availabilityCount.error ||
    availabilityCount.count !== 1 ||
    draftCount.error ||
    draftCount.count !== 0
  ) {
    throw new Error(
      `La persistance finale de l’onboarding est incohérente (${JSON.stringify({
        availabilityCount: availabilityCount.count,
        availabilityError: availabilityCount.error?.code ?? null,
        draftCount: draftCount.count,
        draftError: draftCount.error?.code ?? null,
        profile: profile.data,
        profileError: profile.error?.code ?? null,
        skillCount: skillCount.count,
        skillError: skillCount.error?.code ?? null,
      })}).`,
    );
  }

  console.log(
    'Parcours Auth local : inscription et confirmation Mailpit réussies.',
  );
  console.log(
    'Onboarding réel : profil, double capacité, compétence et disponibilité persistés.',
  );
  console.log(
    'Session navigateur : restaurée après rechargement au viewport 320 px.',
  );
} finally {
  await browser.close();
}
