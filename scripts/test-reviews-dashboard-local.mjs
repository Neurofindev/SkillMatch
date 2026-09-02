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
      'Compte réel créé pour valider les avis et le tableau de bord SkillMatch.',
    p_capability: capability,
    p_city: 'Lyon',
    p_complete_onboarding: true,
    p_country_code: 'FR',
    p_display_name: displayName,
    p_headline: 'Validation locale des avis vérifiés',
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
    p_deliverables: ['Interface accessible', 'Compte rendu final'],
    p_description:
      'Concevoir et documenter une interface accessible pour le parcours local de validation des avis.',
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

async function getWorkspace(client, matchId) {
  const result = await client.rpc('get_match_workspace', {
    p_match_id: matchId,
  });
  if (result.error || !result.data) {
    throw result.error ?? new Error('Espace de match absent.');
  }
  return result.data;
}

async function completeCollaboration(clientAccount, talentAccount, matchId) {
  let workspace = await getWorkspace(clientAccount.client, matchId);
  let result = await clientAccount.client.rpc('confirm_agreement', {
    p_agreement_id: workspace.agreement.id,
    p_expected_version: workspace.agreement.lockVersion,
  });
  if (result.error) throw result.error;

  workspace = await getWorkspace(talentAccount.client, matchId);
  result = await talentAccount.client.rpc('confirm_agreement', {
    p_agreement_id: workspace.agreement.id,
    p_expected_version: workspace.agreement.lockVersion,
  });
  if (result.error) throw result.error;

  workspace = await getWorkspace(clientAccount.client, matchId);
  result = await clientAccount.client.rpc('start_match', {
    p_expected_agreement_version: workspace.agreement.lockVersion,
    p_expected_mission_version: workspace.mission.lockVersion,
    p_match_id: matchId,
  });
  if (result.error) throw result.error;

  const message = await talentAccount.client.rpc('send_message', {
    p_body: 'Message réel non lu pour le tableau de bord de la phase 09.',
    p_client_message_id: randomUUID(),
    p_conversation_id: workspace.match.conversationId,
  });
  if (message.error) throw message.error;

  for (const account of [talentAccount, clientAccount]) {
    const completion = await account.client.rpc(
      'submit_completion_confirmation',
      {
        p_decision: 'confirmed',
        p_match_id: matchId,
        p_note:
          'Livrables reçus et mission terminée pour la validation locale.',
      },
    );
    if (completion.error) throw completion.error;
  }

  workspace = await getWorkspace(clientAccount.client, matchId);
  const completed = await clientAccount.client.rpc('complete_match', {
    p_expected_agreement_version: workspace.agreement.lockVersion,
    p_expected_mission_version: workspace.mission.lockVersion,
    p_match_id: matchId,
  });
  if (completed.error) throw completed.error;
}

async function loginInBrowser(page, email, password) {
  await page.goto(`${APP_URL}/connexion`);
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL(`${APP_URL}/espace`);
  await page.getByRole('heading', { name: 'Tableau de bord' }).waitFor();
}

const local = readLocalStatus();
const health = await fetch(APP_URL);
if (!health.ok) {
  throw new Error(`L’application locale ne répond pas sur ${APP_URL}.`);
}
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
const password = `Phase09!${randomUUID()}Aa9`;
const clientEmail = `phase09-client-${suffix}@example.test`;
const talentEmail = `phase09-talent-${suffix}@example.test`;
const thirdEmail = `phase09-third-${suffix}@example.test`;
const clientAccount = await createAccount({
  local,
  email: clientEmail,
  password,
  displayName: 'Client Phase 09',
  username: `client09-${suffix}`,
  capability: 'publish',
  skillId: skill.data.id,
});
const talentAccount = await createAccount({
  local,
  email: talentEmail,
  password,
  displayName: 'Talent Phase 09',
  username: `talent09-${suffix}`,
  capability: 'find',
  skillId: skill.data.id,
});
const thirdAccount = await createAccount({
  local,
  email: thirdEmail,
  password,
  displayName: 'Double mode Phase 09',
  username: `double09-${suffix}`,
  capability: 'both',
  skillId: skill.data.id,
});

const missionTitle = `Mission avis réel ${suffix}`;
const missionId = await createMission(
  clientAccount.client,
  skill.data.id,
  missionTitle,
);
const application = await talentAccount.client.rpc('submit_application', {
  p_availability_note: 'Disponible pendant toute la période annoncée.',
  p_confirmed: true,
  p_message: 'Je propose une réalisation accessible et documentée.',
  p_mission_id: missionId,
  p_proposed_amount: 620,
});
if (application.error || !application.data[0]) {
  throw application.error ?? new Error('Candidature absente.');
}
let applicationVersion = application.data[0].lock_version;
for (const status of ['viewed', 'shortlisted']) {
  const transitioned = await clientAccount.client.rpc(
    'transition_application',
    {
      p_application_id: application.data[0].application_id,
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
  p_application_id: application.data[0].application_id,
  p_expected_application_version: applicationVersion,
  p_expected_mission_version: mission.data.lock_version,
});
if (accepted.error || !accepted.data[0]) {
  throw accepted.error ?? new Error('Acceptation absente.');
}
const matchId = accepted.data[0].match_id;

const premature = await talentAccount.client.rpc('submit_review', {
  p_comment: 'Cet avis ne doit pas être accepté avant la clôture.',
  p_communication: 4,
  p_match_id: matchId,
  p_quality: 4,
  p_rating: 4,
  p_reliability: 4,
});
const outsider = await thirdAccount.client.rpc('submit_review', {
  p_comment: 'Avis tiers interdit.',
  p_communication: 4,
  p_match_id: matchId,
  p_quality: 4,
  p_rating: 4,
  p_reliability: 4,
});
if (premature.error?.code !== '23514' || outsider.error?.code !== '42501') {
  throw new Error('Les avis prématuré ou tiers n’ont pas été refusés.');
}

await completeCollaboration(clientAccount, talentAccount, matchId);

const talentReview = await talentAccount.client.rpc('submit_review', {
  p_comment: 'Cadrage clair et échanges efficaces pendant toute la mission.',
  p_communication: 5,
  p_match_id: matchId,
  p_quality: 4,
  p_rating: 4,
  p_reliability: 5,
});
if (talentReview.error) throw talentReview.error;

const dualModeDashboard = await thirdAccount.client.rpc(
  'get_dashboard_overview',
);
const newProfile = await thirdAccount.client.rpc('get_reputation_summary', {
  p_profile_id: thirdAccount.user.id,
});
if (
  dualModeDashboard.error ||
  !dualModeDashboard.data[0]?.can_hire ||
  !dualModeDashboard.data[0]?.can_work ||
  newProfile.error ||
  !newProfile.data[0]?.is_new_profile
) {
  throw new Error(
    'Le dashboard double mode ou le nouveau profil est incorrect.',
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
  await clientPage.getByText('1 message non lu').waitFor();
  await clientPage.getByText('1 mission terminée à évaluer').waitFor();
  await clientPage
    .getByRole('heading', { name: 'Top de la semaine' })
    .waitFor();

  await clientPage.goto(`${APP_URL}/espace/avis/${matchId}`);
  await clientPage.getByLabel('Note globale').selectOption('5');
  await clientPage.getByLabel('Communication').selectOption('5');
  await clientPage.getByLabel('Fiabilité').selectOption('4');
  await clientPage
    .getByLabel('Qualité du travail ou du cadrage')
    .selectOption('5');
  await clientPage
    .getByLabel('Commentaire')
    .fill('Travail soigné, communication claire et délais respectés.');
  await clientPage
    .getByRole('button', { name: 'Prévisualiser l’avis' })
    .click();
  await clientPage.getByText('Prévisualisation obligatoire').waitFor();
  await clientPage
    .getByRole('button', { name: 'Confirmer et publier' })
    .focus();
  await clientPage.keyboard.press('Enter');
  await clientPage
    .getByRole('dialog')
    .getByRole('button', { name: 'Publier cet avis' })
    .click();
  await clientPage.waitForURL(`${APP_URL}/espace/avis`);
  await clientPage.getByText('4/5', { exact: true }).first().waitFor();
  await clientPage.reload();
  await clientPage.getByText('Cadrage clair et échanges efficaces').waitFor();
  await clientPage.goto(`${APP_URL}/espace/avis/${matchId}`);
  await clientPage.getByRole('heading', { name: 'Avis déjà publié' }).waitFor();

  const duplicate = await clientAccount.client.rpc('submit_review', {
    p_comment: 'Deuxième avis interdit.',
    p_communication: 5,
    p_match_id: matchId,
    p_quality: 5,
    p_rating: 5,
    p_reliability: 5,
  });
  if (duplicate.error?.code !== '23505') {
    throw new Error('Le doublon d’avis n’a pas été refusé.');
  }

  const talentReputation = await talentAccount.client.rpc(
    'get_reputation_summary',
    { p_profile_id: talentAccount.user.id },
  );
  const clientReputation = await clientAccount.client.rpc(
    'get_reputation_summary',
    { p_profile_id: clientAccount.user.id },
  );
  if (
    talentReputation.error ||
    talentReputation.data[0]?.average_rating !== 5 ||
    talentReputation.data[0]?.review_count !== 1 ||
    clientReputation.error ||
    clientReputation.data[0]?.average_rating !== 4 ||
    clientReputation.data[0]?.review_count !== 1
  ) {
    throw new Error('Les moyennes ou nombres d’avis ne sont pas exacts.');
  }

  await loginInBrowser(talentPage, talentEmail, password);
  await talentPage.goto(`${APP_URL}/espace/avis`);
  await talentPage.getByText('5/5', { exact: true }).first().waitFor();
  await talentPage.getByText('1 avis').waitFor();
  await talentPage.getByText('Travail soigné, communication claire').waitFor();
  const viewport = await talentPage.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  if (viewport.scrollWidth > viewport.clientWidth) {
    throw new Error(`Débordement à 320 px : ${JSON.stringify(viewport)}`);
  }

  const ranking = await clientAccount.client.rpc('get_weekly_ranking', {
    p_limit: 5,
  });
  if (ranking.error) throw ranking.error;
  if (
    !ranking.data.sufficientData &&
    (ranking.data.items.length !== 0 ||
      ranking.data.formulaVersion !== 'weekly-completions-v2')
  ) {
    throw new Error('Le classement sous le seuil n’est pas honnêtement vide.');
  }

  const unexpectedBrowserErrors = browserErrors.filter(
    (message) =>
      !message.includes(
        'server responded with a status of 400 (Bad Request)',
      ) &&
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
    'Trois comptes confirmés : client, talent et compte double mode de contrôle.',
  );
  console.log(
    'Avis avant clôture et tiers refusés ; un avis par sens publié après mission terminée.',
  );
  console.log(
    'Moyennes exactes 4/5 et 5/5 avec un avis, doublon refusé et persistance après rechargement.',
  );
  console.log(
    'Dashboard client, nouveau profil et double mode validés avec messages, actions et échéances réels.',
  );
  console.log(
    'Prévisualisation, confirmation clavier et viewport 320 px vérifiés sans débordement.',
  );
} finally {
  await browser.close();
}
