import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import AxeBuilder from '@axe-core/playwright';
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
    throw new Error('API, Auth, rôle local ou Mailpit est indisponible.');
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
      const content = [detail.HTML, detail.Html, detail.Text, detail.text]
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
  const signup = await client.auth.signUp({ email, password });
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
    throw login.error ?? new Error('Session locale absente.');
  }
  const save = await client.rpc('save_profile', {
    p_adult_confirmed: true,
    p_avatar_path: '',
    p_availability_end: `${isoDateAfter(60)}T18:00:00Z`,
    p_availability_start: `${isoDateAfter(2)}T09:00:00Z`,
    p_availability_timezone: 'UTC',
    p_availability_visibility: 'matched',
    p_bio: 'Compte local créé uniquement pour la QA de sécurité SkillMatch.',
    p_capability: capability,
    p_city: 'Lyon',
    p_complete_onboarding: true,
    p_country_code: 'FR',
    p_display_name: displayName,
    p_headline: 'QA locale de la modération',
    p_profile_id: login.data.user.id,
    p_show_approximate_location: false,
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

function grantModeratorRoleLocal(userId) {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) {
    throw new Error('Identifiant de test modérateur invalide.');
  }
  const sql = `insert into public.user_roles (user_id, role, granted_by) values ('${userId}', 'moderator', null);`;
  const sqlPath = join(tmpdir(), `skillmatch-moderator-${randomUUID()}.sql`);
  writeFileSync(sqlPath, sql, { encoding: 'utf8', mode: 0o600 });
  const executable = process.platform === 'win32' ? process.env.ComSpec : 'npx';
  const args =
    process.platform === 'win32'
      ? ['/d', '/s', '/c', `npx supabase db query --local --file ${sqlPath}`]
      : ['supabase', 'db', 'query', '--local', '--file', sqlPath];
  let result;
  try {
    result = spawnSync(executable, args, {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: '1' },
      shell: false,
    });
  } finally {
    unlinkSync(sqlPath);
  }
  if (result.status !== 0) {
    const diagnostic =
      `${result.error?.message ?? ''}\n${result.stdout ?? ''}\n${result.stderr ?? ''}`
        .replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, '[identifiant]')
        .trim()
        .slice(-500);
    throw new Error(
      `Le rôle modérateur réservé au test local n’a pas pu être attribué${diagnostic ? ` : ${diagnostic}` : '.'}`,
    );
  }
}

const local = readLocalStatus();
const health = await fetch(APP_URL);
if (!health.ok) throw new Error(`SkillMatch ne répond pas sur ${APP_URL}.`);

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
const password = `Phase11!${randomUUID()}Aa9`;
const reporterEmail = `phase11-reporter-${suffix}@example.test`;
const targetEmail = `phase11-target-${suffix}@example.test`;
const moderatorEmail = `phase11-moderator-${suffix}@example.test`;
const reporter = await createAccount({
  local,
  email: reporterEmail,
  password,
  displayName: 'Talent QA Phase 11',
  username: `qa-reporter-${suffix}`,
  capability: 'find',
  skillId: skill.data.id,
});
const target = await createAccount({
  local,
  email: targetEmail,
  password,
  displayName: 'Client QA Phase 11',
  username: `qa-target-${suffix}`,
  capability: 'publish',
  skillId: skill.data.id,
});
const moderator = await createAccount({
  local,
  email: moderatorEmail,
  password,
  displayName: 'Modération QA Phase 11',
  username: `qa-moderator-${suffix}`,
  capability: 'both',
  skillId: skill.data.id,
});
grantModeratorRoleLocal(moderator.user.id);

const savedMission = await target.client.rpc('save_mission', {
  p_application_deadline: isoDateAfter(10),
  p_budget_max: 700,
  p_budget_min: 500,
  p_budget_model: 'fixed',
  p_category: 'Numérique',
  p_country_code: null,
  p_deliverables: ['Rapport de QA accessible'],
  p_description:
    'Mission locale de test destinée à vérifier le signalement et le blocage réels.',
  p_ends_on: isoDateAfter(30),
  p_expected_version: null,
  p_flexible_schedule: true,
  p_mission_id: null,
  p_presence_details: null,
  p_public_city: null,
  p_public_region: null,
  p_publish: true,
  p_required_level: 'advanced',
  p_skill_ids: [skill.data.id],
  p_skill_levels: ['advanced'],
  p_starts_on: isoDateAfter(15),
  p_title: `Mission modération réelle ${suffix}`,
  p_wizard_draft_id: null,
  p_work_mode: 'remote',
});
if (savedMission.error || !savedMission.data[0]) {
  throw savedMission.error ?? new Error('Mission locale absente.');
}
const missionId = savedMission.data[0].mission_id;

const report = await reporter.client.rpc('submit_report', {
  p_confirmed: true,
  p_description:
    'Signalement QA confirmé : le contenu doit être examiné par un vrai rôle modérateur local.',
  p_reason: 'abuse',
  p_target_id: missionId,
  p_target_type: 'mission',
});
if (report.error || !report.data) {
  throw report.error ?? new Error('Signalement réel absent.');
}

const ordinaryAccess = await reporter.client.rpc('get_moderation_access');
const ordinaryQueue = await reporter.client.rpc('list_moderation_reports', {
  p_page: 1,
  p_page_size: 20,
  p_status: null,
});
if (ordinaryAccess.data !== false || ordinaryQueue.error?.code !== '42501') {
  throw new Error('Le refus du rôle normal n’est pas appliqué.');
}

const blocked = await reporter.client.rpc('set_profile_block', {
  p_blocked: true,
  p_profile_id: target.user.id,
});
if (blocked.error || blocked.data !== true) throw blocked.error;
const blockedApplication = await reporter.client.rpc('submit_application', {
  p_availability_note: 'Disponible pour la période annoncée.',
  p_confirmed: true,
  p_message: 'Cette candidature doit être refusée par le blocage côté base.',
  p_mission_id: missionId,
  p_proposed_amount: 600,
});
if (blockedApplication.error?.code !== '42501') {
  throw new Error('La candidature après blocage n’a pas été refusée.');
}
const unblocked = await reporter.client.rpc('set_profile_block', {
  p_blocked: false,
  p_profile_id: target.user.id,
});
if (unblocked.error || unblocked.data !== false) throw unblocked.error;

const moderatorAccess = await moderator.client.rpc('get_moderation_access');
if (moderatorAccess.error || moderatorAccess.data !== true) {
  throw moderatorAccess.error ?? new Error('Rôle modérateur local absent.');
}

const browserErrors = [];
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    viewport: { height: 844, width: 390 },
  });
  const page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });
  page.on('pageerror', (error) => browserErrors.push(error.message));
  await loginInBrowser(page, moderatorEmail, password);
  await page.goto(`${APP_URL}/espace/moderation`);
  await page.getByRole('heading', { name: 'File de modération' }).waitFor();
  await page.getByText(`Mission modération réelle ${suffix}`).waitFor();
  const axe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const blockingAxe = axe.violations.filter(
    (violation) =>
      violation.impact === 'critical' || violation.impact === 'serious',
  );
  if (blockingAxe.length) {
    throw new Error(
      `Axe modération : ${blockingAxe.map((item) => item.id).join(', ')}`,
    );
  }
  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  if (viewport.scrollWidth > viewport.clientWidth) {
    throw new Error(`Débordement modération : ${JSON.stringify(viewport)}`);
  }
  await context.close();
} finally {
  await browser.close();
}

const detail = await moderator.client.rpc('get_moderation_report', {
  p_report_id: report.data,
});
if (detail.error || !detail.data?.report) {
  throw detail.error ?? new Error('Détail modérateur absent.');
}
const triaged = await moderator.client.rpc('moderate_report', {
  p_action: 'triage',
  p_expected_version: detail.data.report.lockVersion,
  p_reason: 'Examen QA confirmé par le modérateur local.',
  p_report_id: report.data,
});
if (triaged.error || !triaged.data[0]) {
  throw triaged.error ?? new Error('Mise en examen absente.');
}
const hidden = await moderator.client.rpc('moderate_report', {
  p_action: 'hide_mission',
  p_expected_version: triaged.data[0].lock_version,
  p_reason: 'Mission masquée pendant la validation QA reproductible.',
  p_report_id: report.data,
});
if (hidden.error || !hidden.data[0]) {
  throw hidden.error ?? new Error('Masquage modérateur absent.');
}

const finalDetail = await moderator.client.rpc('get_moderation_report', {
  p_report_id: report.data,
});
if (
  finalDetail.error ||
  finalDetail.data?.report?.status !== 'actioned' ||
  finalDetail.data?.actions?.length !== 2
) {
  throw finalDetail.error ?? new Error('Journal d’audit modérateur incorrect.');
}
const hiddenSearch = await reporter.client.rpc('search_missions', {
  p_budget_max: null,
  p_budget_min: null,
  p_category: null,
  p_city: null,
  p_ends_after: null,
  p_favorites_only: false,
  p_mission_id: missionId,
  p_page: 1,
  p_page_size: 9,
  p_query: null,
  p_required_levels: [],
  p_skill_ids: [],
  p_sort: 'relevance',
  p_starts_before: null,
  p_work_modes: [],
});
if (hiddenSearch.error || hiddenSearch.data.length !== 0) {
  throw hiddenSearch.error ?? new Error('La mission masquée reste publique.');
}

const unexpectedBrowserErrors = browserErrors.filter(
  (message) =>
    !message.includes('status of 400') && !message.includes('status of 403'),
);
if (unexpectedBrowserErrors.length) {
  throw new Error(
    `Erreurs console inattendues : ${JSON.stringify(unexpectedBrowserErrors)}`,
  );
}

console.log('Trois comptes confirmés : auteur, cible et modérateur local.');
console.log(
  'Utilisateur normal refusé, blocage base vérifié puis retiré sans contourner l’historique.',
);
console.log(
  'Signalement affiché à 390 px, Axe sans impact critique/sérieux et sans erreur console.',
);
console.log(
  'Mise en examen puis masquage persistés avec exactement deux actions d’audit.',
);
