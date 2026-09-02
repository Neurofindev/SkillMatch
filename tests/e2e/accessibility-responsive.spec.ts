import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const auditedRoutes = [
  '/',
  '/connexion',
  '/inscription',
  '/fonctionnement',
  '/regles-communaute',
  '/confidentialite',
] as const;

for (const route of auditedRoutes) {
  test(`${route} n’a aucune violation Axe critique ou sérieuse`, async ({
    page,
  }) => {
    await page.goto(route);
    await page.locator('main').waitFor();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const blocking = results.violations.filter(
      (violation) =>
        violation.impact === 'critical' || violation.impact === 'serious',
    );
    expect(
      blocking,
      blocking
        .map(
          (violation) =>
            `${violation.id}: ${violation.help} (${violation.nodes.length})`,
        )
        .join('\n'),
    ).toEqual([]);
  });
}

test('les pages publiques restent utilisables sans débordement horizontal', async ({
  page,
}) => {
  for (const route of auditedRoutes) {
    await page.goto(route);
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth, route).toBeLessThanOrEqual(
      dimensions.clientWidth,
    );
  }
});

test('les contrôles principaux respectent la cible tactile de 44 px', async ({
  page,
}) => {
  await page.goto('/inscription');
  const undersized = await page
    .locator('button, input, select, textarea, a.button')
    .evaluateAll((elements) =>
      elements
        .filter((element) => {
          const box = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return (
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            box.width > 0 &&
            box.height > 0 &&
            (box.width < 44 || box.height < 44)
          );
        })
        .map((element) => ({
          height: Math.round(element.getBoundingClientRect().height),
          label:
            element.getAttribute('aria-label') ??
            element.textContent?.trim() ??
            element.tagName,
          width: Math.round(element.getBoundingClientRect().width),
        })),
    );
  expect(undersized).toEqual([]);
});

test('la réduction des animations est effectivement appliquée', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('heading', { level: 1 }).waitFor();
  const durations = await page.locator('main').evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      animation: style.animationDuration,
      transition: style.transitionDuration,
    };
  });
  const maximumSeconds = (value: string) =>
    Math.max(
      ...value.split(',').map((duration) => {
        const numeric = Number.parseFloat(duration);
        return duration.trim().endsWith('ms') ? numeric / 1000 : numeric;
      }),
    );
  expect(maximumSeconds(durations.animation)).toBeLessThanOrEqual(0.00001);
  expect(maximumSeconds(durations.transition)).toBeLessThanOrEqual(0.00001);
});
