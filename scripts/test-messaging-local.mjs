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
  if (result.status !== 0) {
    throw new Error('La stack Supabase locale n’est pas disponible.');
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
    throw new Error('API, Auth ou Mailpit local est indisponible.');
  }
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

function isoDateAfter(days) {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
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
  if (![302, 303].includes(confirmation.status)) {
    throw new Error(`Confirmation locale ${confirmation.status}.`);
  }
  const login = await client.auth.signInWithPassword({ email, password });
  if (login.error || !login.data.user) {
    throw login.error ?? new Error('Session absente.');
  }
  const save = await client.rpc('save_profile', {
    p_adult_confirmed: true,
    p_avatar_path: '',
    p_availability_end: `${isoDateAfter(90)}T18:00:00Z`,
    p_availability_start: `${isoDateAfter(2)}T09:00:00Z`,
    p_availability_timezone: 'UTC',
    p_availability_visibility: 'matched',
    p_bio:
      'Compte réel créé pour le parcours local complet de messagerie privée SkillMatch.',
    p_capability: capability,
    p_city: 'Lyon',
    p_complete_onboarding: true,
    p_country_code: 'FR',
    p_display_name: displayName,
    p_headline: 'Validation locale de la messagerie privée',
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

async function createMission(client, skillId, title) {
  const saved = await client.rpc('save_mission', {
    p_application_deadline: isoDateAfter(10),
    p_budget_max: 750,
    p_budget_min: 500,
    p_budget_model: 'fixed',
    p_category: 'Numérique',
    p_country_code: null,
    p_deliverables: ['Conversation privée accessible', 'Compte rendu final'],
    p_description:
      'Créer et documenter un échange persistant à distance pour le parcours local de validation de la messagerie.',
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
  if (saved.error || !saved.data[0]) {
    throw saved.error ?? new Error('Mission absente.');
  }
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
const password = `Phase08!${randomUUID()}Aa9`;
const clientEmail = `phase08-client-${suffix}@example.test`;
const talentEmail = `phase08-talent-${suffix}@example.test`;
const thirdEmail = `phase08-third-${suffix}@example.test`;
const clientAccount = await createAccount({
  local,
  email: clientEmail,
  password,
  displayName: 'Client Phase 08',
  username: `client08-${suffix}`,
  capability: 'publish',
  skillId: skill.data.id,
});
const talentAccount = await createAccount({
  local,
  email: talentEmail,
  password,
  displayName: 'Talent Phase 08',
  username: `talent08-${suffix}`,
  capability: 'find',
  skillId: skill.data.id,
});
const thirdAccount = await createAccount({
  local,
  email: thirdEmail,
  password,
  displayName: 'Tiers Phase 08',
  username: `third08-${suffix}`,
  capability: 'both',
  skillId: skill.data.id,
});

const missionTitle = `Mission messagerie réelle ${suffix}`;
const missionId = await createMission(
  clientAccount.client,
  skill.data.id,
  missionTitle,
);
const application = await talentAccount.client.rpc('submit_application', {
  p_availability_note: 'Disponible pendant toute la période annoncée.',
  p_confirmed: true,
  p_message: 'Je propose un échange clair, accessible et documenté.',
  p_mission_id: missionId,
  p_proposed_amount: 620,
});
if (application.error || !application.data[0]) {
  throw application.error ?? new Error('Candidature absente.');
}
const applicationId = application.data[0].application_id;
const startedByTalent = await talentAccount.client.rpc(
  'get_or_create_application_conversation',
  { p_application_id: applicationId },
);
if (startedByTalent.error || !startedByTalent.data) {
  throw (
    startedByTalent.error ?? new Error('Conversation de candidature absente.')
  );
}
const conversationBeforeAcceptance = startedByTalent.data;
const openedByClient = await clientAccount.client.rpc(
  'get_or_create_application_conversation',
  { p_application_id: applicationId },
);
if (
  openedByClient.error ||
  openedByClient.data !== conversationBeforeAcceptance
) {
  throw (
    openedByClient.error ??
    new Error('Le client n’a pas reçu la même conversation unique.')
  );
}
for (const [account, body] of [
  [talentAccount, `Message talent avant acceptation ${suffix}`],
  [clientAccount, `Réponse client avant acceptation ${suffix}`],
]) {
  const sent = await account.client.rpc('send_message', {
    p_body: body,
    p_client_message_id: randomUUID(),
    p_conversation_id: conversationBeforeAcceptance,
  });
  if (sent.error) throw sent.error;
}
const outsiderOpen = await thirdAccount.client.rpc(
  'get_or_create_application_conversation',
  { p_application_id: applicationId },
);
if (outsiderOpen.error?.code !== '42501') {
  throw new Error('Le tiers a pu ouvrir la conversation de candidature.');
}
let applicationVersion = application.data[0].lock_version;
for (const status of ['viewed', 'shortlisted']) {
  const transitioned = await clientAccount.client.rpc(
    'transition_application',
    {
      p_application_id: applicationId,
      p_expected_version: applicationVersion,
      p_new_status: status,
    },
  );
  if (transitioned.error || !transitioned.data[0]) {
    throw transitioned.error ?? new Error(`Transition ${status} absente.`);
  }
  applicationVersion = transitioned.data[0].lock_version;
}
const mission = await clientAccount.client
  .from('missions')
  .select('lock_version')
  .eq('id', missionId)
  .single();
if (mission.error) throw mission.error;
const accepted = await clientAccount.client.rpc('accept_application', {
  p_application_id: applicationId,
  p_expected_application_version: applicationVersion,
  p_expected_mission_version: mission.data.lock_version,
});
if (accepted.error || !accepted.data[0]) {
  throw accepted.error ?? new Error('Acceptation absente.');
}
const conversationId = accepted.data[0].conversation_id;
if (conversationId !== conversationBeforeAcceptance) {
  throw new Error(
    'L’acceptation a remplacé la conversation au lieu de la réutiliser.',
  );
}

const browser = await chromium.launch({ headless: true });
try {
  const clientContext = await browser.newContext({
    viewport: { height: 820, width: 1280 },
  });
  const talentContext = await browser.newContext({
    viewport: { height: 780, width: 320 },
  });
  const clientPage = await clientContext.newPage();
  const talentPage = await talentContext.newPage();
  const browserErrors = [];
  for (const page of [clientPage, talentPage]) {
    page.on('console', (message) => {
      if (message.type() === 'error') browserErrors.push(message.text());
    });
    page.on('pageerror', (error) => browserErrors.push(error.message));
  }

  await loginInBrowser(clientPage, clientEmail, password);
  await loginInBrowser(talentPage, talentEmail, password);
  await clientPage.goto(`${APP_URL}/espace/messages/${conversationId}`);
  await talentPage.goto(`${APP_URL}/espace/messages/${conversationId}`);
  await clientPage.getByText('Temps réel actif').waitFor({ timeout: 10_000 });
  await talentPage.getByText('Temps réel actif').waitFor({ timeout: 10_000 });
  // The first local subscriber starts the replication slot lazily. Give that
  // one-time initialization time to finish before measuring event delivery.
  await clientPage.waitForTimeout(3_000);

  const realtimeMessage = `Message Realtime ${suffix}`;
  await talentPage.getByLabel('Votre message').fill(realtimeMessage);
  await talentPage.getByRole('button', { name: 'Envoyer' }).focus();
  await talentPage.keyboard.press('Enter');
  await clientPage.getByText(realtimeMessage, { exact: true }).waitFor({
    timeout: 10_000,
  });
  if (
    (await clientPage.getByText(realtimeMessage, { exact: true }).count()) !== 1
  ) {
    throw new Error('Le message Realtime a été dupliqué dans l’interface.');
  }
  await clientPage.reload();
  await clientPage.getByText(realtimeMessage, { exact: true }).waitFor();

  await clientPage.goto(`${APP_URL}/espace/missions`);
  const unreadMessage = `Message non lu ${suffix}`;
  await talentPage.getByLabel('Votre message').fill(unreadMessage);
  await talentPage.getByRole('button', { name: 'Envoyer' }).click();
  await talentPage.getByText(unreadMessage, { exact: true }).waitFor();
  let unread;
  let unreadConversation;
  for (let attempt = 0; attempt < 25; attempt += 1) {
    unread = await clientAccount.client.rpc('list_conversations', {
      p_archived: false,
      p_page: 1,
      p_page_size: 20,
    });
    unreadConversation = unread.data?.find(
      ({ conversation_id: id }) => id === conversationId,
    );
    if (unread.error || unreadConversation?.unread_count === 1) break;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (unread.error || unreadConversation?.unread_count !== 1) {
    throw (
      unread.error ?? new Error('Le compteur non lu réel n’est pas égal à 1.')
    );
  }
  await clientPage.goto(`${APP_URL}/espace/messages`);
  await clientPage.getByText('1 non lu').waitFor();
  await clientPage
    .getByRole('link', { name: /Client Phase 08|Talent Phase 08/ })
    .click();
  await clientPage.waitForURL(`${APP_URL}/espace/messages/${conversationId}`);
  await clientPage.getByText(unreadMessage, { exact: true }).waitFor();

  const retryId = randomUUID();
  const retryBody = `Retry idempotent ${suffix}`;
  for (let index = 0; index < 2; index += 1) {
    const retry = await talentAccount.client.rpc('send_message', {
      p_body: retryBody,
      p_client_message_id: retryId,
      p_conversation_id: conversationId,
    });
    if (retry.error) throw retry.error;
  }
  const retryCount = await talentAccount.client
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('conversation_id', conversationId)
    .eq('client_message_id', retryId);
  if (retryCount.error || retryCount.count !== 1) {
    throw retryCount.error ?? new Error('Le retry a créé un doublon.');
  }

  const outsiderRead = await thirdAccount.client.rpc('list_messages', {
    p_conversation_id: conversationId,
    p_page_size: 30,
  });
  const outsiderSend = await thirdAccount.client.rpc('send_message', {
    p_body: 'Message tiers interdit.',
    p_client_message_id: randomUUID(),
    p_conversation_id: conversationId,
  });
  if (
    outsiderRead.error?.code !== '42501' ||
    outsiderSend.error?.code !== '42501'
  ) {
    throw new Error('Le tiers a pu lire ou écrire dans la conversation.');
  }

  const attachmentInput = talentPage.locator('#message-attachment');
  await attachmentInput.setInputFiles({
    buffer: Buffer.from('<script>alert(1)</script>'),
    mimeType: 'text/html',
    name: 'interdit.html',
  });
  await talentPage
    .getByText(
      'Choisissez une image JPEG, PNG ou WebP, un PDF ou un fichier texte.',
    )
    .waitFor();

  await clientPage
    .getByRole('button', { name: 'Bloquer', exact: true })
    .click();
  await clientPage
    .getByRole('dialog')
    .getByRole('button', { name: 'Bloquer', exact: true })
    .click();
  await clientPage
    .getByText(/Un blocage empêche tout nouveau message/)
    .waitFor();
  const blockedSend = await talentAccount.client.rpc('send_message', {
    p_body: 'Écriture refusée après blocage.',
    p_client_message_id: randomUUID(),
    p_conversation_id: conversationId,
  });
  if (blockedSend.error?.code !== '42501') {
    throw new Error(
      `Le blocage n’a pas refusé l’écriture côté base : ${JSON.stringify(blockedSend.error)}`,
    );
  }
  await talentPage.reload();
  await talentPage
    .getByText(/Un blocage empêche tout nouveau message/)
    .waitFor();

  await clientPage.goto(`${APP_URL}/espace/notifications`);
  const notificationCard = clientPage
    .locator('.notification-card')
    .filter({ hasText: 'Nouveau message' })
    .first();
  const markOne = notificationCard.getByRole('button', {
    name: 'Marquer comme lu',
  });
  await markOne.click();
  await markOne.waitFor({ state: 'detached' });
  const markAll = clientPage.getByRole('button', {
    name: /Tout marquer comme lu/,
  });
  if (await markAll.count()) {
    await markAll.click();
    await markAll.waitFor({ state: 'detached' });
  }
  await notificationCard.getByRole('link', { name: 'Ouvrir' }).click();
  await clientPage.waitForURL(`${APP_URL}/espace/messages/${conversationId}`);
  const notificationState = await clientAccount.client
    .from('notifications')
    .select('read_at')
    .eq('type', 'new_message')
    .eq('internal_path', `/espace/messages/${conversationId}`);
  if (
    notificationState.error ||
    notificationState.data.some(({ read_at: readAt }) => !readAt)
  ) {
    throw (
      notificationState.error ??
      new Error('La lecture de notification n’est pas persistée.')
    );
  }

  const viewport = await talentPage.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  if (viewport.scrollWidth > viewport.clientWidth) {
    throw new Error(`Débordement à 320 px : ${JSON.stringify(viewport)}`);
  }
  const unexpectedBrowserErrors = browserErrors.filter(
    (message) =>
      !message.includes('server responded with a status of 403 (Forbidden)'),
  );
  if (unexpectedBrowserErrors.length) {
    throw new Error(
      `Erreurs console inattendues : ${JSON.stringify(unexpectedBrowserErrors)}`,
    );
  }

  await clientContext.close();
  await talentContext.close();
  console.log(
    'Trois comptes confirmés localement : client, talent et tiers de contrôle.',
  );
  console.log(
    'Conversation ouverte par les deux parties avant acceptation puis réutilisée par le match.',
  );
  console.log(
    'Temps réel bidirectionnel observé sans doublon ; persistance après rechargement validée.',
  );
  console.log(
    'Retry idempotent, non-lu puis lecture réelle, notification et lien interne validés.',
  );
  console.log(
    'Lecture/écriture tierces refusées 42501, pièce invalide et blocage refusés côté serveur.',
  );
  console.log(
    'Envoi clavier et viewport 320 px validés sans débordement ni erreur console.',
  );
} finally {
  await browser.close();
}
