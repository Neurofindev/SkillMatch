import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const APP_URL = process.env.SKILLMATCH_APP_URL ?? 'http://127.0.0.1:5173';

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
  if (result.status !== 0)
    throw new Error('La stack Supabase locale n’est pas disponible.');
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
  if (!apiUrl || !publishableKey || !mailpitUrl)
    throw new Error('API, Auth ou Mailpit local est indisponible.');
  return { apiUrl, mailpitUrl, publishableKey };
}

async function waitForConfirmationLink(mailpitUrl, email) {
  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline) {
    const response = await fetch(`${mailpitUrl}/api/v1/messages?limit=100`);
    if (!response.ok) throw new Error('Mailpit local ne répond pas.');
    const body = await response.json();
    const messages = body.messages ?? body.Messages ?? [];
    const summary = messages.find((message) =>
      JSON.stringify(message.To ?? message.to ?? [])
        .toLowerCase()
        .includes(email.toLowerCase()),
    );
    if (summary) {
      const id = summary.ID ?? summary.Id ?? summary.id;
      const detail = await (
        await fetch(`${mailpitUrl}/api/v1/message/${id}`)
      ).json();
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
      return match[0].replaceAll('&amp;', '&');
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`E-mail local absent pour ${email}.`);
}

async function createAccount({
  local,
  email,
  password,
  displayName,
  username,
  capability,
  skillId,
}) {
  const client = createClient(local.apiUrl, local.publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  const signup = await client.auth.signUp({
    email,
    options: { emailRedirectTo: `${APP_URL}/auth/retour` },
    password,
  });
  if (signup.error) throw signup.error;
  const confirmationLink = await waitForConfirmationLink(
    local.mailpitUrl,
    email,
  );
  const confirmation = await fetch(confirmationLink, { redirect: 'manual' });
  if (![302, 303].includes(confirmation.status))
    throw new Error(`Confirmation locale ${confirmation.status}.`);
  const login = await client.auth.signInWithPassword({ email, password });
  if (login.error || !login.data.user)
    throw login.error ?? new Error('Session absente.');
  const save = await client.rpc('save_profile', {
    p_adult_confirmed: true,
    p_avatar_path: '',
    p_availability_end: `${isoDateAfter(90)}T18:00:00Z`,
    p_availability_start: `${isoDateAfter(2)}T09:00:00Z`,
    p_availability_timezone: 'UTC',
    p_availability_visibility: 'matched',
    p_bio:
      'Compte réel créé pour le parcours local complet de suivi de mission SkillMatch.',
    p_capability: capability,
    p_city: 'Lyon',
    p_complete_onboarding: true,
    p_country_code: 'FR',
    p_display_name: displayName,
    p_headline: 'Validation locale du suivi de mission',
    p_profile_id: login.data.user.id,
    p_show_approximate_location: true,
    p_skill_ids: [skillId],
    p_skill_levels: ['advanced'],
    p_username: username,
    p_work_preference: 'both',
  });
  if (save.error) throw save.error;
  return { client, user: login.data.user };
}

function isoDateAfter(days) {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

async function createMission(client, skillId, title) {
  const saved = await client.rpc('save_mission', {
    p_application_deadline: isoDateAfter(10),
    p_budget_max: 750,
    p_budget_min: 500,
    p_budget_model: 'fixed',
    p_category: 'Numérique',
    p_country_code: null,
    p_deliverables: ['Interface accessible', 'Compte rendu final'],
    p_description:
      'Concevoir et documenter une interface accessible entièrement réalisable à distance pour le parcours de validation local.',
    p_ends_on: isoDateAfter(45),
    p_expected_version: null,
    p_flexible_schedule: true,
    p_mission_id: null,
    p_presence_details: null,
    p_public_city: null,
    p_public_region: null,
    p_publish: true,
    p_required_level: 'advanced',
    p_skill_ids: [skillId],
    p_skill_levels: ['advanced'],
    p_starts_on: isoDateAfter(15),
    p_title: title,
    p_wizard_draft_id: null,
    p_work_mode: 'remote',
  });
  if (saved.error || !saved.data[0])
    throw saved.error ?? new Error('Mission absente.');
  return saved.data[0].mission_id;
}

async function loginInBrowser(page, email, password) {
  await page.goto(`${APP_URL}/connexion`);
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL(`${APP_URL}/espace`);
}

const local = readLocalStatus();
const health = await fetch(APP_URL);
if (!health.ok)
  throw new Error(`L’application locale ne répond pas sur ${APP_URL}.`);
const anonymous = createClient(local.apiUrl, local.publishableKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const skill = await anonymous
  .from('skills')
  .select('id')
  .eq('slug', 'developpement-react')
  .single();
if (skill.error) throw skill.error;

const suffix = randomUUID().slice(0, 8);
const password = `Phase07!${randomUUID()}Aa9`;
const clientEmail = `phase07-client-${suffix}@example.test`;
const talentEmail = `phase07-talent-${suffix}@example.test`;
const thirdEmail = `phase07-third-${suffix}@example.test`;
const clientAccount = await createAccount({
  local,
  email: clientEmail,
  password,
  displayName: 'Client Phase 07',
  username: `client07-${suffix}`,
  capability: 'publish',
  skillId: skill.data.id,
});
const talentAccount = await createAccount({
  local,
  email: talentEmail,
  password,
  displayName: 'Talent Phase 07',
  username: `talent07-${suffix}`,
  capability: 'find',
  skillId: skill.data.id,
});
const thirdAccount = await createAccount({
  local,
  email: thirdEmail,
  password,
  displayName: 'Tiers Phase 07',
  username: `third07-${suffix}`,
  capability: 'both',
  skillId: skill.data.id,
});
const missionTitle = `Mission suivi réel ${suffix}`;
const missionId = await createMission(
  clientAccount.client,
  skill.data.id,
  missionTitle,
);
const application = await talentAccount.client.rpc('submit_application', {
  p_availability_note: 'Disponible pendant toute la période annoncée.',
  p_confirmed: true,
  p_message:
    'Je propose une réalisation accessible, testée au clavier et documentée selon les livrables.',
  p_mission_id: missionId,
  p_proposed_amount: 620,
});
if (application.error || !application.data[0])
  throw application.error ?? new Error('Candidature absente.');
const applicationId = application.data[0].application_id;

const browser = await chromium.launch({ headless: true });
try {
  const clientContext = await browser.newContext({
    viewport: { height: 820, width: 1280 },
  });
  const clientPage = await clientContext.newPage();
  await loginInBrowser(clientPage, clientEmail, password);
  await clientPage.goto(`${APP_URL}/espace/candidatures?vue=recues`);
  let applicationCard = clientPage
    .locator('.application-card')
    .filter({ hasText: 'Talent Phase 07' });
  await applicationCard
    .getByRole('button', { name: /Présélectionner/ })
    .click();
  await applicationCard.getByText('Présélectionnée').waitFor();
  applicationCard = clientPage
    .locator('.application-card')
    .filter({ hasText: 'Talent Phase 07' });
  await applicationCard
    .getByRole('button', { name: 'Accepter', exact: true })
    .click();
  await clientPage
    .getByText('Les autres candidatures encore ouvertes seront refusées')
    .waitFor();
  await clientPage
    .getByRole('button', { name: 'Accepter cette candidature' })
    .click();
  await clientPage.waitForURL(/\/espace\/matches\/[0-9a-f-]+$/);
  const matchId = clientPage.url().split('/').at(-1);
  if (!matchId) throw new Error('Identifiant de match absent.');
  await clientPage.getByText('Budget informatif figé').waitFor();
  await clientPage
    .getByText(
      'SkillMatch facilite la mise en relation et ne traite aucun paiement.',
    )
    .waitFor();

  const persisted = await clientAccount.client
    .from('matches')
    .select('id, conversations(id), agreements(id)')
    .eq('id', matchId)
    .single();
  if (
    persisted.error ||
    persisted.data.conversations.length !== 1 ||
    persisted.data.agreements.length !== 1
  ) {
    throw (
      persisted.error ?? new Error('Match, conversation ou accord non unique.')
    );
  }
  const members = await clientAccount.client
    .from('conversation_members')
    .select('*', { count: 'exact', head: true })
    .eq('conversation_id', persisted.data.conversations[0].id);
  if (members.error || members.count !== 2)
    throw members.error ?? new Error('Les deux membres ne sont pas persistés.');
  const retry = await clientAccount.client.rpc('accept_application', {
    p_application_id: applicationId,
    p_expected_application_version: 1,
    p_expected_mission_version: 1,
  });
  if (retry.error || retry.data[0]?.match_id !== matchId)
    throw (
      retry.error ?? new Error('Le double clic logique n’est pas idempotent.')
    );

  await clientPage
    .getByRole('button', { name: 'Confirmer l’accord', exact: true })
    .focus();
  await clientPage.keyboard.press('Enter');
  await clientPage
    .getByRole('button', { name: 'Confirmer cet accord' })
    .click();
  await clientPage.getByText('Client : confirmé').waitFor();
  await clientPage.reload();
  await clientPage.getByText('Client : confirmé').waitFor();

  const talentContext = await browser.newContext({
    viewport: { height: 780, width: 320 },
  });
  const talentPage = await talentContext.newPage();
  await loginInBrowser(talentPage, talentEmail, password);
  await talentPage.goto(`${APP_URL}/espace/matches/${matchId}`);
  await talentPage
    .getByRole('button', { name: 'Confirmer l’accord', exact: true })
    .click();
  await talentPage
    .getByRole('button', { name: 'Confirmer cet accord' })
    .click();
  await talentPage.getByText('Talent : confirmé').waitFor();
  await talentPage
    .getByRole('button', { name: 'Démarrer la mission', exact: true })
    .click();
  await talentPage
    .getByRole('dialog')
    .getByRole('button', { name: 'Démarrer la mission' })
    .click();
  await talentPage.getByRole('heading', { name: 'Ajouter au suivi' }).waitFor();
  await talentPage.getByLabel('Type d’événement').selectOption('delivery');
  await talentPage
    .locator('#progress-note')
    .fill('Interface accessible et compte rendu final livrés.');
  await talentPage
    .getByRole('button', { name: 'Enregistrer dans la chronologie' })
    .click();
  await talentPage.waitForTimeout(1_000);
  const deliveryEvent = await talentAccount.client
    .from('mission_events')
    .select('id')
    .eq('mission_id', missionId)
    .eq('event_type', 'delivery_submitted');
  if (deliveryEvent.error || deliveryEvent.data.length !== 1) {
    const visibleErrors = await talentPage
      .locator('.field-error')
      .allTextContents();
    throw (
      deliveryEvent.error ??
      new Error(
        `Livraison non persistée ; erreurs UI=${JSON.stringify(visibleErrors)}`,
      )
    );
  }
  await talentPage.reload();
  await talentPage
    .getByText('Interface accessible et compte rendu final livrés.')
    .waitFor();
  await talentPage
    .locator('#completion-note')
    .fill('Mission terminée et livrée selon le périmètre.');
  await talentPage
    .getByRole('button', { name: 'Enregistrer ma décision' })
    .click();
  await talentPage.getByText('Votre décision de fin').waitFor();

  await clientPage.reload();
  await clientPage.getByRole('heading', { name: 'Ajouter au suivi' }).waitFor();
  await clientPage
    .locator('#progress-note')
    .fill('Livraison reçue et vérifiée avec le talent.');
  await clientPage
    .getByRole('button', { name: 'Enregistrer dans la chronologie' })
    .click();
  await clientPage
    .locator('#completion-note')
    .fill('Livrables reçus et conformes à l’accord.');
  await clientPage
    .getByRole('button', { name: 'Enregistrer ma décision' })
    .click();
  await clientPage
    .getByRole('button', { name: 'Clôturer la mission', exact: true })
    .click();
  await clientPage
    .getByRole('dialog')
    .getByRole('button', { name: 'Clôturer la mission' })
    .click();
  await clientPage
    .getByText('Mission terminée et clôturée par les états réels.')
    .waitFor();
  await clientPage.reload();
  await clientPage.getByText('Mission clôturée').waitFor();

  const unauthorized = await thirdAccount.client.rpc('get_match_workspace', {
    p_match_id: matchId,
  });
  if (!unauthorized.error || unauthorized.error.code !== '42501')
    throw new Error('Le tiers a pu lire l’espace de match.');
  const finalState = await clientAccount.client
    .from('matches')
    .select('status, missions(status), agreements(status)')
    .eq('id', matchId)
    .single();
  if (
    finalState.error ||
    finalState.data.status !== 'completed' ||
    finalState.data.missions.status !== 'completed' ||
    finalState.data.agreements[0]?.status !== 'completed'
  ) {
    throw (
      finalState.error ?? new Error('La clôture atomique n’est pas persistée.')
    );
  }
  const viewport = await talentPage.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  if (viewport.scrollWidth > viewport.clientWidth)
    throw new Error(`Débordement à 320 px : ${JSON.stringify(viewport)}`);

  await clientContext.close();
  await talentContext.close();
  console.log(
    'Trois comptes confirmés localement : client, talent et tiers de contrôle.',
  );
  console.log(
    'Acceptation UI confirmée, retry idempotent, match/conversation/accord uniques et deux membres.',
  );
  console.log(
    'Accord confirmé séparément, démarrage, livraison, avancement, deux confirmations et clôture persistés.',
  );
  console.log(
    'Accès tiers refusé avec 42501 ; clavier et viewport 320 px vérifiés sans débordement.',
  );
} finally {
  await browser.close();
}
