# SkillMatch

SkillMatch est une marketplace web française de mise en relation entre un client qui publie un besoin et un talent qui propose ses compétences. Un compte unique peut chercher des missions, en publier, ou faire les deux. L’application ne reçoit, ne conserve, ne garantit et ne transfère aucun paiement : les budgets et propositions sont uniquement informatifs.

Le MVP est une SPA React persistée par Supabase. Le prototype historique n’est ni importé dans le build ni utilisé comme source de données.

## Stack

- React 19, TypeScript strict, Vite 8, React Router et Tailwind CSS ;
- TanStack Query pour les données serveur, React Hook Form et Zod pour les formulaires ;
- Supabase PostgreSQL, Auth, Storage et Realtime avec migrations, RPC et RLS versionnées ;
- Vitest, Testing Library, Playwright, Axe et pgTAP ;
- hébergement statique : Cloudflare Pages Free, sortie `dist`.

## Prérequis

- Node.js 24 et npm ;
- Docker Desktop pour Supabase local ;
- Git recommandé ; SkillMatch possède son dépôt dédié sur la branche `main` ;
- aucun compte cloud n’est nécessaire pour le développement local.

## Installation locale

```bash
npm ci
npm run local:start
```

Copier ensuite `.env.example` vers `.env.local` et renseigner uniquement les deux valeurs publiques retournées par `supabase status` :

```dotenv
VITE_SUPABASE_URL=http://127.0.0.1:56421
VITE_SUPABASE_PUBLISHABLE_KEY=<clé publique locale>
```

Ne jamais placer de clé `service_role`, de mot de passe de base ou de jeton Cloudflare dans une variable `VITE_*`. Sans configuration valide, l’interface affiche volontairement un état non configuré et ne crée aucune fausse session.

Lancer l’application :

```bash
npm run dev
```

L’interface est alors disponible par défaut sur `http://127.0.0.1:5173`. La confirmation d’e-mail locale est obligatoire et Mailpit capture les messages sur `http://127.0.0.1:56424` ; aucun e-mail externe n’est envoyé par cette procédure.

## Supabase local et données de démonstration

- `npm run local:start` — démarre Auth, API, PostgreSQL, Storage, Realtime et Mailpit ;
- `npm run db:reset` — reconstruit la base depuis les 14 migrations puis charge le seed local ;
- `npm run db:lint` — analyse le schéma et les fonctions ;
- `npm run db:smoke` — vérifie directement schéma, grants, RLS et contraintes ;
- `npm run db:test` — exécute les 471 assertions pgTAP ;
- `npm run db:test:concurrency` — oppose deux acceptations concurrentes réelles ;
- `npm run db:types` — régénère les types TypeScript ;
- `npm run db:verify` — rejoue toute la chaîne base ;
- `npm run db:stop` — arrête uniquement la stack Supabase de ce projet.

`supabase/seed.sql` est séparé des migrations de déploiement. Ses identités utilisent le domaine réservé `.invalid`, les libellés visibles commencent par « Démonstration » et aucun e-mail n’est artificiellement confirmé. Ne jamais déployer ce seed en production.

## Vérifications

```bash
npm run verify
npm run verify:full
```

`verify` exécute typecheck, lint, 74 tests Vitest, build de production et contrôle des fichiers Cloudflare produits. `verify:full` ajoute une reconstruction vide de Supabase, 471 tests SQL/RLS, les parcours locaux multi-comptes et 162 scénarios Playwright sur six viewports.

Les commandes ciblées sont aussi disponibles :

- `npm run auth:test:onboarding:local` ;
- `npm run missions:test:local` ;
- `npm run applications:test:local` ;
- `npm run matches:test:local` ;
- `npm run messages:test:local` ;
- `npm run reviews:test:local` ;
- `npm run moderation:test:local` ;
- `npm run test:e2e` ;
- `npm run deployment:check` après `npm run build`.

Les résultats reproductibles et les limites de couverture se trouvent dans [docs/QA_REPORT.md](docs/QA_REPORT.md).

## Déploiement gratuit

Le chemin déployé est : dépôt GitHub `Neurofindev/SkillMatch` → Cloudflare Pages statique → Supabase Cloud Free. L’application est disponible sur [https://skillmatch-wo9.pages.dev](https://skillmatch-wo9.pages.dev). Les paramètres Pages sont `npm run build` comme commande et `dist` comme répertoire de sortie. Seules `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY` sont configurées côté Pages. Les 14 migrations distantes ont été appliquées sans `--include-seed`.

La procédure complète, les redirections Auth, les contrôles post-déploiement et le retour arrière sont dans [docs/deployment.md](docs/deployment.md). Les quotas vérifiés et alertes d’exploitation sont dans [docs/free-tier-constraints.md](docs/free-tier-constraints.md).

Les déploiements automatiques de `main` sont actifs. La route profonde `/connexion`, les en-têtes CSP/HSTS/anti-frame et le cache immuable des actifs ont été observés sur la vraie URL Pages.

## Documentation

- [spécification produit](docs/PRODUCT_SPEC.md) ;
- [architecture et ADR](docs/architecture.md) ;
- [sécurité, RLS, Storage et confidentialité](docs/security.md) ;
- [audit du prototype historique](docs/legacy-audit.md) ;
- [état final](docs/STATUS.md).

## Limites connues avant ouverture publique

- SMTP Brevo configuré, mais délivrabilité et parcours externes confirmation/récupération encore à tester de bout en bout ;
- Firefox, WebKit, appareils physiques et lecteur d’écran réel non exécutés ;
- aucune campagne de charge, de reprise après incident cloud ou de Realtime multi-région ;
- suppression définitive Auth/Storage et durées légales de conservation encore opérées manuellement ;
- modération adaptée à un petit MVP, sans astreinte ni délai garanti.

Le projet est déployé et validé techniquement ; les limites restantes empêchent encore de le qualifier de prêt pour une ouverture publique générale.
