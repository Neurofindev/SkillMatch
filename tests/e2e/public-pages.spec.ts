import { expect, test } from '@playwright/test';

const publicRoutes = [
  '/',
  '/fonctionnement',
  '/connexion',
  '/inscription',
  '/mot-de-passe-oublie',
  '/auth/retour',
  '/confidentialite',
  '/conditions',
  '/regles-communaute',
  '/contact',
] as const;

for (const route of publicRoutes) {
  test(`${route} répond après un chargement direct`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response?.ok()).toBeTruthy();
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('h1')).toBeVisible();
  });
}

test('la page d’accueil reste contenue dans un viewport de 320 px', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-320');
  await page.goto('/');
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Une mission à publier. Une compétence à proposer.',
    }),
  ).toBeVisible();

  const width = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(width.scroll).toBeLessThanOrEqual(width.client);
});

test('le lien d’évitement est le premier contrôle clavier', async ({
  page,
}) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'Aller au contenu principal' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#contenu')).toBeFocused();
});

test('une route inconnue conserve la navigation et affiche la 404', async ({
  page,
}) => {
  await page.goto('/inconnue');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Cette page n’existe pas.' }),
  ).toBeVisible();
  await expect(
    page.getByRole('banner').getByRole('link', { name: 'SkillMatch, accueil' }),
  ).toBeVisible();
});

test('l’espace applicatif refuse une session absente ou non configurée', async ({
  page,
}) => {
  await page.goto('/espace');
  await expect(
    page.getByRole('heading', { name: 'Retrouver mon espace' }).or(
      page.getByRole('heading', {
        name: 'Connexion Supabase non configurée',
      }),
    ),
  ).toBeVisible();
});

test('le formulaire d’inscription reste contenu à 320 px', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-320');
  await page.goto('/inscription');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Créer mon compte unique' }),
  ).toBeVisible();
  const width = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(width.scroll).toBeLessThanOrEqual(width.client);
});

test('les règles publiques décrivent les interdictions et le vrai signalement contextuel', async ({
  page,
}) => {
  await page.goto('/regles-communaute');
  await expect(page.getByText(/frauduleux, discriminatoires/i)).toBeVisible();
  await expect(
    page.getByText(/l’action « Signaler » enregistre/i),
  ).toBeVisible();
});

test('la confidentialité décrit honnêtement la suppression non immédiate', async ({
  page,
}) => {
  await page.goto('/confidentialite');
  await expect(
    page.getByText(/ne prétend pas effacer immédiatement/i),
  ).toBeVisible();
});

test('la route de modération n’accorde aucun accès sans session', async ({
  page,
}) => {
  await page.goto('/espace/moderation');
  await expect(
    page.getByRole('heading', { name: 'Retrouver mon espace' }).or(
      page.getByRole('heading', {
        name: 'Connexion Supabase non configurée',
      }),
    ),
  ).toBeVisible();
});
