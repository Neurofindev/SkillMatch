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
      return match[0].replaceAll('&amp;', '&');
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(
    `Le message de confirmation local n’est pas arrivé pour ${email}.`,
  );
}

async function createConfirmedAccount({
  apiUrl,
  capability,
  displayName,
  email,
  mailpitUrl,
  password,
  publishableKey,
  skillId,
  username,
}) {
  const client = createClient(apiUrl, publishableKey, {
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
  const confirmationLink = await waitForConfirmationLink(mailpitUrl, email);
  const confirmation = await fetch(confirmationLink, { redirect: 'manual' });
  if (![302, 303].includes(confirmation.status)) {
    throw new Error(`La confirmation locale a répondu ${confirmation.status}.`);
  }
  const login = await client.auth.signInWithPassword({ email, password });
  if (login.error || !login.data.user) {
    throw login.error ?? new Error('Session absente.');
  }
  const availabilityStart = new Date();
  availabilityStart.setDate(availabilityStart.getDate() + 2);
  const availabilityEnd = new Date();
  availabilityEnd.setDate(availabilityEnd.getDate() + 90);
  const save = await client.rpc('save_profile', {
    p_adult_confirmed: true,
    p_avatar_path: '',
    p_availability_end: `${availabilityEnd.toISOString().slice(0, 10)}T18:00:00Z`,
    p_availability_start: `${availabilityStart.toISOString().slice(0, 10)}T09:00:00Z`,
    p_availability_timezone: 'UTC',
    p_availability_visibility: 'private',
    p_bio:
      'Compte réel créé pour le parcours automatisé local des candidatures SkillMatch.',
    p_capability: capability,
    p_city: 'Lyon',
    p_complete_onboarding: true,
    p_country_code: 'FR',
    p_display_name: displayName,
    p_headline: 'Validation locale des candidatures',
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

async function loginInBrowser(page, email, password) {
  await page.goto(`${APP_URL}/connexion`);
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL(`${APP_URL}/espace`);
}

function isoDateAfter(days) {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

async function createMission(client, skillId, title) {
  const saved = await client.rpc('save_mission', {
    p_application_deadline: isoDateAfter(10),
    p_budget_max: 650,
    p_budget_min: 400,
    p_budget_model: 'fixed',
    p_category: 'Numérique',
    p_country_code: null,
    p_deliverables: ['Interface responsive', 'Compte rendu accessible'],
    p_description:
      'Concevoir une interface professionnelle accessible, testable et entièrement réalisable à distance.',
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
    throw saved.error ?? new Error('La mission locale n’a pas été créée.');
  }
  return saved.data[0].mission_id;
}

async function submitFromBrowser(
  page,
  missionId,
  message,
  availability,
  proposal,
) {
  await page.goto(`${APP_URL}/espace/missions/${missionId}`);
  await page.getByRole('link', { name: 'Candidater' }).click();
  await page.getByLabel('Message au client').fill(message);
  await page.getByLabel('Disponibilité').fill(availability);
  await page.getByLabel(/Proposition informative/).fill(String(proposal));
  await page.getByRole('button', { name: 'Prévisualiser' }).click();
  await page.getByText('Aucun envoi effectué').waitFor();
  await page
    .getByLabel(/Je confirme vouloir envoyer cette candidature/)
    .check();
  await page.getByRole('button', { name: 'Confirmer l’envoi' }).click();
  await page.waitForURL(/\/espace\/candidatures\/[0-9a-f-]+$/);
  await page.reload();
  await page.getByText('Pertinence').first().waitFor();
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

const suffix = randomUUID().slice(0, 10);
const password = `Phase06!${randomUUID()}Aa9`;
const clientEmail = `phase06-client-${suffix}@example.test`;
const talentAEmail = `phase06-talent-a-${suffix}@example.test`;
const talentBEmail = `phase06-talent-b-${suffix}@example.test`;
const clientAccount = await createConfirmedAccount({
  ...local,
  capability: 'publish',
  displayName: 'Client Phase 06',
  email: clientEmail,
  password,
  skillId: skill.data.id,
  username: `client06-${suffix}`,
});
const talentA = await createConfirmedAccount({
  ...local,
  capability: 'both',
  displayName: 'Talent Alpha Phase 06',
  email: talentAEmail,
  password,
  skillId: skill.data.id,
  username: `talenta06-${suffix}`,
});
const talentB = await createConfirmedAccount({
  ...local,
  capability: 'find',
  displayName: 'Talent Bêta Phase 06',
  email: talentBEmail,
  password,
  skillId: skill.data.id,
  username: `talentb06-${suffix}`,
});

const missionTitle = `Mission candidatures réelle ${suffix}`;
const missionId = await createMission(
  clientAccount.client,
  skill.data.id,
  missionTitle,
);

const browser = await chromium.launch({ headless: true });
try {
  const talentAContext = await browser.newContext({
    viewport: { height: 780, width: 320 },
  });
  const talentAPage = await talentAContext.newPage();
  await loginInBrowser(talentAPage, talentAEmail, password);
  await talentAPage.goto(`${APP_URL}/espace/missions/${missionId}/candidature`);
  await talentAPage
    .getByLabel('Message au client')
    .fill(
      'Je propose une réalisation structurée, testée au clavier et documentée pour cette mission.',
    );
  await talentAPage
    .getByLabel('Disponibilité')
    .fill('Disponible sur toute la période, quatre jours par semaine.');
  await talentAPage.getByLabel(/Proposition informative/).fill('520');
  await talentAPage.getByRole('button', { name: 'Prévisualiser' }).click();
  const beforeConfirmation = await talentA.client
    .from('applications')
    .select('*', { count: 'exact', head: true })
    .eq('mission_id', missionId);
  if (beforeConfirmation.error || beforeConfirmation.count !== 0) {
    throw new Error(
      'La prévisualisation a envoyé une candidature sans confirmation.',
    );
  }
  await talentAPage
    .getByLabel(/Je confirme vouloir envoyer cette candidature/)
    .check();
  await talentAPage.getByRole('button', { name: 'Confirmer l’envoi' }).click();
  await talentAPage.waitForURL(/\/espace\/candidatures\/[0-9a-f-]+$/);
  await talentAPage.reload();
  await talentAPage.getByText('Pertinence').first().waitFor();

  const talentAApplication = await talentA.client
    .from('applications')
    .select(
      'id, status, relevance_score, score_version, submission_confirmed_at',
    )
    .eq('mission_id', missionId)
    .single();
  if (
    talentAApplication.error ||
    talentAApplication.data.status !== 'submitted' ||
    !talentAApplication.data.submission_confirmed_at ||
    talentAApplication.data.score_version !== 'relevance-v1'
  ) {
    throw (
      talentAApplication.error ??
      new Error('La candidature Alpha est incomplète.')
    );
  }

  const talentBContext = await browser.newContext({
    viewport: { height: 780, width: 390 },
  });
  const talentBPage = await talentBContext.newPage();
  await loginInBrowser(talentBPage, talentBEmail, password);
  await submitFromBrowser(
    talentBPage,
    missionId,
    'Je peux livrer cette mission avec une méthode claire, des tests et une documentation complète.',
    'Disponible trois jours par semaine pendant toute la mission.',
    560,
  );
  const talentBApplication = await talentB.client
    .from('applications')
    .select('id, status')
    .eq('mission_id', missionId)
    .single();
  if (talentBApplication.error) throw talentBApplication.error;

  const hiddenApplication = await talentB.client
    .from('applications')
    .select('id', { count: 'exact', head: true })
    .eq('id', talentAApplication.data.id);
  if (hiddenApplication.error || hiddenApplication.count !== 0) {
    throw new Error('Le second talent peut lire une candidature tierce.');
  }
  const unauthorized = await talentB.client.rpc('transition_application', {
    p_application_id: talentAApplication.data.id,
    p_expected_version: 1,
    p_new_status: 'rejected',
  });
  if (!unauthorized.error || unauthorized.error.code !== '42501') {
    throw new Error('La transition tierce n’a pas été refusée avec 42501.');
  }

  const clientContext = await browser.newContext({
    viewport: { height: 820, width: 1280 },
  });
  const clientPage = await clientContext.newPage();
  await loginInBrowser(clientPage, clientEmail, password);
  await clientPage.goto(`${APP_URL}/espace/candidatures?vue=recues`);
  await clientPage.getByRole('heading', { name: missionTitle }).waitFor();
  const alphaCard = clientPage
    .locator('.application-card')
    .filter({ hasText: 'Talent Alpha Phase 06' });
  const betaCard = clientPage
    .locator('.application-card')
    .filter({ hasText: 'Talent Bêta Phase 06' });
  await alphaCard.getByRole('button', { name: /Comparer/ }).click();
  await betaCard.getByRole('button', { name: /Comparer/ }).click();
  await clientPage.getByRole('heading', { name: 'Comparaison' }).waitFor();
  await clientPage
    .locator('.comparison-panel')
    .getByText('Talent Alpha Phase 06')
    .waitFor();
  await clientPage
    .locator('.comparison-panel')
    .getByText('Talent Bêta Phase 06')
    .waitFor();
  await alphaCard.getByRole('button', { name: /Présélectionner/ }).click();
  await alphaCard.getByText('Présélectionnée').waitFor();

  const shortlisted = await clientAccount.client
    .from('applications')
    .select('status')
    .eq('id', talentAApplication.data.id)
    .single();
  if (shortlisted.error || shortlisted.data.status !== 'shortlisted') {
    throw (
      shortlisted.error ?? new Error('La présélection n’est pas persistée.')
    );
  }

  await talentAPage.reload();
  await talentAPage.getByText('Présélectionnée').first().waitFor();
  await talentAPage.getByRole('button', { name: 'Retirer' }).click();
  await talentAPage
    .getByRole('button', { name: 'Retirer ma candidature' })
    .click();
  await talentAPage.getByText('Retirée').first().waitFor();
  const withdrawn = await talentA.client
    .from('applications')
    .select('status')
    .eq('id', talentAApplication.data.id)
    .single();
  if (withdrawn.error || withdrawn.data.status !== 'withdrawn') {
    throw withdrawn.error ?? new Error('Le retrait n’est pas persistant.');
  }

  await clientAccount.client.rpc('undo_last_application_swipe');
  await clientPage.goto(`${APP_URL}/espace/swipe?vue=client`);
  await clientPage
    .getByRole('heading', { name: 'Talent Bêta Phase 06' })
    .waitFor();
  const clientSwipeCard = clientPage.getByRole('group');
  await clientSwipeCard.focus();
  await clientPage.keyboard.press('ArrowLeft');
  await clientPage
    .getByRole('heading', { name: 'Talent Bêta Phase 06' })
    .waitFor({ state: 'detached' });
  const passed = await clientAccount.client
    .from('applications')
    .select('status')
    .eq('id', talentBApplication.data.id)
    .single();
  if (passed.error || passed.data.status === 'rejected') {
    throw passed.error ?? new Error('Le swipe passer a refusé la candidature.');
  }

  const swipeMissionTitle = `Mission swipe sans envoi ${suffix}`;
  const swipeMissionId = await createMission(
    clientAccount.client,
    skill.data.id,
    swipeMissionTitle,
  );
  await talentBPage.goto(`${APP_URL}/espace/swipe`);
  await talentBPage.getByRole('heading', { name: swipeMissionTitle }).waitFor();
  const talentSwipeCard = talentBPage.getByRole('group');
  await talentSwipeCard.focus();
  await talentBPage.keyboard.press('Enter');
  await talentBPage.waitForURL(
    `${APP_URL}/espace/missions/${swipeMissionId}/candidature`,
  );
  const silentApplication = await talentB.client
    .from('applications')
    .select('*', { count: 'exact', head: true })
    .eq('mission_id', swipeMissionId);
  if (silentApplication.error || silentApplication.count !== 0) {
    throw new Error(
      'Le swipe intéressé a envoyé une candidature automatiquement.',
    );
  }

  const viewport = await talentAPage.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  if (viewport.scrollWidth > viewport.clientWidth) {
    throw new Error(
      `La candidature déborde à 320 px (${JSON.stringify(viewport)}).`,
    );
  }

  await clientContext.close();
  await talentBContext.close();
  await talentAContext.close();
  console.log(
    'Trois comptes confirmés et profils persistés sur Supabase local.',
  );
  console.log(
    'Parcours talents : prévisualisation, confirmation, rechargement et retrait réels.',
  );
  console.log(
    'Parcours client : candidatures groupées, comparaison de deux profils et présélection persistée.',
  );
  console.log(
    'Sécurité : lecture et transition tierces refusées; swipe sans envoi ni refus automatique.',
  );
  console.log(
    'Pertinence relevance-v1 persistée; viewport 320 px sans débordement.',
  );
} finally {
  await browser.close();
}
