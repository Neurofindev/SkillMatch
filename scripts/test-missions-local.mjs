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
  if (login.error || !login.data.user)
    throw login.error ?? new Error('Session absente.');
  const today = new Date();
  const availabilityStart = new Date(today);
  availabilityStart.setDate(today.getDate() + 2);
  const availabilityEnd = new Date(today);
  availabilityEnd.setDate(today.getDate() + 90);
  const save = await client.rpc('save_profile', {
    p_adult_confirmed: true,
    p_avatar_path: '',
    p_availability_end: `${availabilityEnd.toISOString().slice(0, 10)}T18:00:00Z`,
    p_availability_start: `${availabilityStart.toISOString().slice(0, 10)}T09:00:00Z`,
    p_availability_timezone: 'UTC',
    p_availability_visibility: 'matched',
    p_bio:
      'Compte réel créé pour le parcours local automatisé de la phase cinq.',
    p_capability: capability,
    p_city: 'Lyon',
    p_complete_onboarding: true,
    p_country_code: 'FR',
    p_display_name:
      capability === 'publish' ? 'Client Phase 05' : 'Talent Phase 05',
    p_headline: 'Validation locale SkillMatch',
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
  await page.goto(`${APP_URL}/espace/decouvrir`);
}

function isoDateAfter(days) {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

const local = readLocalStatus();
const health = await fetch(APP_URL);
if (!health.ok)
  throw new Error(`L’application locale ne répond pas sur ${APP_URL}.`);

const anonymous = createClient(local.apiUrl, local.publishableKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const skills = await anonymous
  .from('skills')
  .select('id')
  .eq('is_active', true)
  .order('id')
  .limit(1)
  .single();
if (skills.error) throw skills.error;

const suffix = randomUUID().slice(0, 10);
const password = `Phase05!${randomUUID()}Aa9`;
const clientEmail = `phase05-client-${suffix}@example.test`;
const talentEmail = `phase05-talent-${suffix}@example.test`;
const missionTitle = `Mission remote réelle ${suffix}`;
const missionSkillName = `Conception responsive ${suffix}`;
const clientAccount = await createConfirmedAccount({
  ...local,
  capability: 'publish',
  email: clientEmail,
  password,
  skillId: skills.data.id,
  username: `client-${suffix}`,
});
const talentAccount = await createConfirmedAccount({
  ...local,
  capability: 'both',
  email: talentEmail,
  password,
  skillId: skills.data.id,
  username: `talent-${suffix}`,
});

const browser = await chromium.launch({ headless: true });
try {
  const clientContext = await browser.newContext({
    viewport: { height: 780, width: 320 },
  });
  const clientPage = await clientContext.newPage();
  await loginInBrowser(clientPage, clientEmail, password);
  await clientPage.goto(`${APP_URL}/espace/missions/nouvelle`);
  await clientPage.getByLabel('Titre de la mission').fill(missionTitle);
  await clientPage
    .getByLabel('Besoin')
    .fill(
      'Concevoir une interface responsive accessible pour une association locale, entièrement à distance.',
    );
  await clientPage.getByRole('button', { name: /Suivant/ }).click();
  await clientPage
    .getByRole('heading', { name: 'Compétences requises' })
    .waitFor();
  await clientPage.getByLabel('Ajouter une compétence').fill(missionSkillName);
  await clientPage.getByRole('button', { name: 'Ajouter' }).click();
  await clientPage.getByText(missionSkillName).waitFor();
  await clientPage.getByRole('button', { name: /Suivant/ }).click();
  await clientPage.getByRole('heading', { name: 'Mode de mission' }).waitFor();
  await clientPage.locator('input[value="remote"]').check();
  await clientPage.getByRole('button', { name: /Suivant/ }).click();
  await clientPage
    .getByRole('heading', { name: 'Zone approximative' })
    .waitFor();
  await clientPage.getByText(/Aucune ville ni distance/).waitFor();
  await clientPage.getByRole('button', { name: /Suivant/ }).click();
  await clientPage
    .getByRole('heading', { name: 'Budget informatif' })
    .waitFor();
  await clientPage.getByLabel('Minimum indicatif').fill('400');
  await clientPage.getByLabel('Maximum indicatif').fill('650');
  await clientPage.getByRole('button', { name: /Suivant/ }).click();
  await clientPage
    .getByRole('heading', { name: 'Dates et flexibilité' })
    .waitFor();
  await clientPage.getByLabel('Échéance de candidature').fill(isoDateAfter(10));
  await clientPage.getByLabel('Début').fill(isoDateAfter(15));
  await clientPage.getByLabel('Fin').fill(isoDateAfter(45));
  await clientPage.getByLabel(/dates peuvent être ajustées/).check();
  await clientPage.getByRole('button', { name: /Suivant/ }).click();
  await clientPage
    .getByRole('heading', { name: 'Livrables et pièces jointes' })
    .waitFor();
  const fileInput = clientPage.locator('input[type="file"]');
  await fileInput.setInputFiles({
    buffer: Buffer.from('fichier non autorisé'),
    mimeType: 'application/x-msdownload',
    name: 'interdit.exe',
  });
  await clientPage
    .getByRole('alert')
    .filter({ hasText: 'Choisissez une image' })
    .waitFor();
  await clientPage
    .getByLabel('Livrables attendus')
    .fill('Maquettes responsive\nGuide d’accessibilité');
  await clientPage.getByRole('button', { name: /Suivant/ }).click();
  await clientPage.getByRole('heading', { name: 'Prévisualisation' }).waitFor();
  await clientPage.getByText(missionTitle).waitFor();
  await clientPage.getByRole('button', { name: /Suivant/ }).click();
  await clientPage.getByRole('heading', { name: 'Confirmation' }).waitFor();
  await clientPage
    .getByLabel(/Je confirme que les informations sont exactes/)
    .check();
  await clientPage.getByRole('button', { name: 'Publier la mission' }).click();
  await clientPage.waitForURL(`${APP_URL}/espace/missions/**`);
  await clientPage.getByRole('heading', { name: missionTitle }).waitFor();
  await clientPage.reload();
  await clientPage.getByRole('heading', { name: missionTitle }).waitFor();

  const viewport = await clientPage.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  if (viewport.scrollWidth > viewport.clientWidth) {
    throw new Error(
      `Le détail mission déborde à 320 px (${JSON.stringify(viewport)}).`,
    );
  }

  const missionResult = await clientAccount.client
    .from('missions')
    .select('*')
    .eq('title', missionTitle)
    .single();
  if (missionResult.error || missionResult.data.status !== 'published') {
    throw missionResult.error ?? new Error('La mission publiée est absente.');
  }
  const mission = missionResult.data;
  const missionSkills = await clientAccount.client
    .from('mission_skills')
    .select('skill_id, required_level')
    .eq('mission_id', mission.id);
  if (missionSkills.error || !missionSkills.data.length) {
    throw (
      missionSkills.error ??
      new Error('Les compétences de mission sont absentes.')
    );
  }
  const enteredSkill = await clientAccount.client
    .from('skills')
    .select('id, name')
    .in(
      'id',
      missionSkills.data.map((skill) => skill.skill_id),
    )
    .eq('name', missionSkillName)
    .single();
  if (enteredSkill.error) {
    throw enteredSkill.error;
  }
  const wizardDrafts = await clientAccount.client
    .from('mission_drafts')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', clientAccount.user.id);
  if (wizardDrafts.error || wizardDrafts.count !== 0) {
    throw (
      wizardDrafts.error ??
      new Error('Le brouillon du wizard n’a pas été nettoyé.')
    );
  }

  const talentContext = await browser.newContext({
    viewport: { height: 780, width: 320 },
  });
  const talentPage = await talentContext.newPage();
  await loginInBrowser(talentPage, talentEmail, password);
  await talentPage.getByLabel('Recherche').fill(missionTitle);
  await talentPage.waitForURL(
    (url) => url.searchParams.get('q') === missionTitle,
  );
  await talentPage
    .getByRole('heading', { name: missionTitle })
    .waitFor({ timeout: 10_000 });
  const talentMissionCard = talentPage
    .locator('.mission-card')
    .filter({ hasText: missionTitle });
  await talentMissionCard
    .getByText('À distance · aucune distance calculée')
    .waitFor();
  const filteredUrl = new URL(await talentPage.url());
  if (filteredUrl.searchParams.get('q') !== missionTitle) {
    throw new Error('Le filtre de recherche n’est pas synchronisé dans l’URL.');
  }
  await talentPage
    .getByRole('button', { name: `Ajouter ${missionTitle} aux favoris` })
    .click();
  await talentPage.getByText('Mission ajoutée aux favoris').waitFor();
  await talentPage.reload();
  await talentPage.getByRole('heading', { name: missionTitle }).waitFor();
  await talentPage.goto(`${APP_URL}/espace/favoris`);
  await talentPage.getByRole('heading', { name: missionTitle }).waitFor();

  const unauthorized = await talentAccount.client.rpc('save_mission', {
    p_application_deadline: mission.application_deadline,
    p_budget_max: mission.budget_max,
    p_budget_min: mission.budget_min,
    p_budget_model: mission.budget_model,
    p_category: mission.category,
    p_country_code: mission.country_code,
    p_deliverables: mission.deliverables,
    p_description: mission.description,
    p_ends_on: mission.ends_on,
    p_expected_version: mission.lock_version,
    p_flexible_schedule: mission.flexible_schedule,
    p_mission_id: mission.id,
    p_presence_details: mission.presence_details,
    p_public_city: mission.public_city,
    p_public_region: mission.public_region,
    p_publish: true,
    p_required_level: mission.required_level,
    p_skill_ids: missionSkills.data.map((skill) => skill.skill_id),
    p_skill_levels: missionSkills.data.map((skill) => skill.required_level),
    p_starts_on: mission.starts_on,
    p_title: `${mission.title} tentative tierce`,
    p_wizard_draft_id: null,
    p_work_mode: mission.work_mode,
  });
  if (!unauthorized.error || unauthorized.error.code !== '42501') {
    throw new Error(
      `La modification tierce n’a pas été refusée par RLS/RPC (${unauthorized.error?.code ?? 'aucune erreur'}).`,
    );
  }

  await clientPage.goto(`${APP_URL}/espace/missions`);
  const ownerCard = clientPage
    .locator('.owner-mission-grid .card')
    .filter({ hasText: missionTitle });
  await ownerCard.getByRole('button', { name: 'Annuler' }).click();
  await clientPage.getByRole('button', { name: 'Annuler la mission' }).click();
  await clientPage.getByText('Mission annulée').waitFor();
  await talentPage.goto(
    `${APP_URL}/espace/decouvrir?q=${encodeURIComponent(missionTitle)}`,
  );
  await talentPage.getByRole('heading', { name: 'Aucun résultat' }).waitFor();

  const favoriteCount = await talentAccount.client
    .from('favorites')
    .select('*', { count: 'exact', head: true })
    .eq('mission_id', mission.id)
    .eq('profile_id', talentAccount.user.id);
  if (favoriteCount.error || favoriteCount.count !== 1) {
    throw favoriteCount.error ?? new Error('Le favori persistant est absent.');
  }
  const cancelled = await clientAccount.client
    .from('missions')
    .select('status')
    .eq('id', mission.id)
    .single();
  if (cancelled.error || cancelled.data.status !== 'cancelled') {
    throw cancelled.error ?? new Error('La mission n’est pas annulée.');
  }

  await talentContext.close();
  await clientContext.close();
  console.log(
    'Deux comptes confirmés et onboarding persisté sur Supabase local.',
  );
  console.log(
    'Parcours client : wizard sauvegardé, erreur de fichier gérée, publication et annulation réelles.',
  );
  console.log(
    'Parcours talent : recherche URL, remote sans distance, rechargement et favori persistant.',
  );
  console.log(
    'Sécurité : modification tierce refusée avec le code 42501; viewport 320 px sans débordement.',
  );
} finally {
  await browser.close();
}
