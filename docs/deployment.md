# Déploiement gratuit — Supabase Cloud et Cloudflare Pages

Statut au 2026-09-02 : déploiement Git intégré actif sur [https://skillmatch-wo9.pages.dev](https://skillmatch-wo9.pages.dev), projet Supabase Cloud `omsrvbgurjfpqqompacp` lié et 14 migrations appliquées. Le seed local n’a pas été envoyé. Une inscription externe a produit un e-mail Brevo ouvert et cliqué, puis un compte Supabase effectivement confirmé.

Cette procédure cible une SPA statique Cloudflare Pages et un projet Supabase Free. Elle n’ajoute ni Pages Function, ni serveur intermédiaire, ni service payant.

## 1. Préparer une version reproductible

Depuis une copie suivie par Git :

```bash
npm ci
npm run verify:full
git status --short
```

Le statut doit être compris et les fichiers hors périmètre conservés. Ne publier que la révision testée. Le dossier fourni pendant l’audit est encore entièrement non suivi dans le dépôt parent ; il faut l’ajouter à un dépôt dédié avant une intégration Git Pages.

## 2. Créer et configurer Supabase Cloud

1. Créer un projet dans une organisation Free et conserver le mot de passe de base dans un gestionnaire de secrets.
2. Installer/authentifier la CLI localement, sans commiter le jeton :

```bash
npx supabase login
npx supabase link --project-ref <PROJECT_REF>
npx supabase db push --dry-run
npx supabase db push
npx supabase migration list
```

La procédure suit la [documentation officielle des environnements](https://supabase.com/docs/guides/deployment/managing-environments). Ne jamais utiliser `--include-seed` sur le projet public : `supabase/seed.sql` est exclusivement local. Ne jamais exécuter `supabase db reset --linked` sur une base contenant des données à conserver.

3. Vérifier dans Studio :
   - les 14 migrations présentes dans l’historique ;
   - RLS actif et policies en place ;
   - buckets `avatars`, `mission-attachments` et `message-attachments` avec leurs limites MIME/taille ;
   - publication Realtime limitée à `messages` et `notifications` ;
   - aucun utilisateur, rôle modérateur ou contenu du seed local.
4. Dans Auth > URL Configuration, définir le `Site URL` Pages final et ajouter les retours réellement utilisés :
   - `https://<PROJET>.pages.dev/auth/retour` ;
   - `https://<PROJET>.pages.dev/mot-de-passe/nouveau`.
5. Conserver la confirmation e-mail active. Le SMTP intégré n’est pas adapté au public : configurer un SMTP externe, puis tester inscription, confirmation et récupération avec de vraies boîtes avant ouverture.

Les seules valeurs destinées au navigateur sont l’URL du projet et sa clé publishable. Une clé `service_role`, un jeton personnel, le mot de passe PostgreSQL ou les identifiants SMTP ne doivent jamais apparaître dans Cloudflare Pages comme variable `VITE_*`.

## 3. Créer le projet Cloudflare Pages

Avec l’intégration Git dans Workers & Pages :

| Réglage               | Valeur                        |
| --------------------- | ----------------------------- |
| Framework             | React (Vite)                  |
| Branche de production | `main`                        |
| Commande de build     | `npm run build`               |
| Répertoire de sortie  | `dist`                        |
| Répertoire racine     | racine de SkillMatch          |
| Version Node          | 24                            |

Ajouter deux variables de build :

- `VITE_SUPABASE_URL=https://<PROJECT_REF>.supabase.co` ;
- `VITE_SUPABASE_PUBLISHABLE_KEY=<clé publishable du projet>`.

Ne pas ajouter de secret backend. Le build copie `public/_headers` dans `dist`. Cloudflare Pages applique son fallback SPA natif lorsqu’un `index.html` existe sans page `404.html`; il ne faut pas publier la règle `/* /index.html 200`, rejetée comme boucle infinie. `_headers` applique CSP, anti-frame, HSTS, `nosniff`, COOP et Permissions-Policy aux réponses statiques. L’application ne contient pas de dossier `functions` ni de `_worker.js`.

## 4. Contrôles de production

Sur l’URL preview exacte :

1. ouvrir directement une route profonde, par exemple `/connexion`, puis recharger : réponse 200 et application fonctionnelle ;
2. inspecter les en-têtes de `/` et d’un actif :

```bash
curl -I https://<PREVIEW>.pages.dev/
curl -I https://<PREVIEW>.pages.dev/assets/<FICHIER>.js
```

3. confirmer la présence de CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options`, COOP et Permissions-Policy ;
4. confirmer dans la console navigateur l’absence de violation CSP non justifiée, de requête en boucle et d’erreur Realtime ;
5. créer deux comptes externes, confirmer les deux e-mails, terminer l’onboarding et recharger les sessions ;
6. jouer le cycle mission → candidature → acceptation → message Realtime → accord → clôture → avis ;
7. vérifier le refus du tiers et du compte normal sur la modération ;
8. envoyer une image valide et chaque fichier invalide attendu ;
9. contrôler à 320 px et au clavier ;
10. vérifier l’absence de tout Wallet, bouton de paiement ou promesse financière.

La CSP a été validée statiquement par `npm run deployment:check`, mais seul ce contrôle HTTP sur Pages prouve son émission et sa compatibilité réelles.

## 5. Passage en production

Après recette du preview :

1. corriger dans Supabase Auth le `Site URL` et les Redirect URLs vers l’URL de production exacte ;
2. déclencher le déploiement de la même révision testée ;
3. rejouer les contrôles d’en-têtes, route profonde et Auth ;
4. noter révision, date, migration la plus récente et URL dans le journal d’exploitation ;
5. surveiller les quotas décrits dans [free-tier-constraints.md](free-tier-constraints.md).

Un domaine personnalisé est facultatif et n’est pas requis par le MVP. Ne pas annoncer le service comme ouvert au public tant que SMTP, sauvegarde/restauration, procédures de suppression et contrôles navigateurs réels ne sont pas validés.

## 6. Retour arrière et récupération

### Frontend

Cloudflare Pages permet de promouvoir un déploiement antérieur. Revenir à la dernière révision validée, puis vérifier les en-têtes et routes. Un rollback frontend ne retire jamais automatiquement une migration déjà appliquée.

### Base

Les migrations doivent être additives et corrigées par une nouvelle migration versionnée. Ne pas modifier un fichier déjà appliqué et ne pas remettre une base distante à zéro. Avant une migration risquée, réaliser et tester une sauvegarde conforme aux capacités du plan.

### Projet Free en pause

Ouvrir le Dashboard Supabase, sélectionner le projet et utiliser `Resume project`. La restauration en un clic est annoncée jusqu’à un an après la pause. Après reprise, vérifier Auth, Storage, Realtime et la dernière migration avant de réouvrir l’application.

### Incident de secret

Retirer immédiatement le déploiement concerné, révoquer/faire tourner la clé ou le jeton auprès du fournisseur, rechercher l’exposition dans l’historique Git et les logs, puis republier une révision propre. Une clé publishable Supabase est publique par conception ; la sécurité repose malgré tout sur RLS et les RPC. La `service_role` reste un secret critique.

## 7. Ce qui reste manuel

- création des comptes et projets fournisseurs ;
- configuration SMTP et validation de la délivrabilité ;
- saisie des URL Auth exactes après attribution du sous-domaine ;
- application contrôlée des migrations au projet distant ;
- recette HTTP/CSP et parcours avec comptes externes ;
- sauvegarde/restauration, traitement des suppressions et supervision des quotas.

Ces étapes sont volontairement non simulées. L’absence d’accès cloud pendant l’audit final n’empêche pas la validation du build local, mais empêche toute affirmation de déploiement ou de disponibilité publique.
